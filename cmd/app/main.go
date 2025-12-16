package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"remnawave-tg-shop-bot/internal/cache"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/cryptopay"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/handler"
	"remnawave-tg-shop-bot/internal/moynalog"
	"remnawave-tg-shop-bot/internal/notification"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/internal/sync"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/internal/tribute"
	"remnawave-tg-shop-bot/internal/yookasa"
	"strconv"
	"strings"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/robfig/cron/v3"
)

// main - главная функция приложения, инициализирует все компоненты бота и запускает его
func main() {
	// Создаем контекст с обработкой сигналов прерывания (Ctrl+C) для корректного завершения
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	// Инициализация конфигурации из переменных окружения
	config.InitConfig()

	// Инициализация системы переводов (поддержка русского и английского языков)
	tm := translation.GetInstance()
	err := tm.InitTranslations("./translations", config.DefaultLanguage())
	if err != nil {
		panic(err)
	}

	// Подключение к базе данных PostgreSQL
	pool, err := initDatabase(ctx, config.DadaBaseUrl())
	if err != nil {
		panic(err)
	}

	// Выполнение миграций базы данных (создание/обновление таблиц)
	err = database.RunMigrations(ctx, &database.MigrationConfig{Direction: "up", MigrationsPath: "./db/migrations", Steps: 0}, pool)
	if err != nil {
		panic(err)
	}

	// Инициализация кэша (TTL 30 минут) для временного хранения данных
	cache := cache.NewCache(30 * time.Minute)

	// Создание репозиториев для работы с данными в БД
	customerRepository := database.NewCustomerRepository(pool) // Работа с пользователями
	purchaseRepository := database.NewPurchaseRepository(pool) // Работа с покупками
	referralRepository := database.NewReferralRepository(pool) // Работа с реферальной системой

	// Инициализация клиентов для работы с внешними сервисами
	cryptoPayClient := cryptopay.NewCryptoPayClient(config.CryptoPayUrl(), config.CryptoPayToken())                // Криптоплатежи
	remnawaveClient := remnawave.NewClient(config.RemnawaveUrl(), config.RemnawaveToken(), config.RemnawaveMode()) // Remnawave API
	yookasaClient := yookasa.NewClient(config.YookasaUrl(), config.YookasaShopId(), config.YookasaSecretKey())     // YooKassa платежи

	// Инициализация клиента МойНалог (опционально, если включен)
	var moynalogClient *moynalog.Client
	if config.IsMoynalogEnabled() {
		moynalogClient = moynalog.NewClient(config.MoynalogURL(), config.MoynalogUsername(), config.MoynalogPassword())
		slog.Info("Moynalog client initialized")
	} else {
		slog.Info("Moynalog integration disabled")
	}

	// Создание экземпляра Telegram бота с 3 воркерами для параллельной обработки запросов
	b, err := bot.New(config.TelegramToken(), bot.WithWorkers(3))
	if err != nil {
		panic(err)
	}

	// Инициализация сервиса платежей, который объединяет все платежные системы
	paymentService := payment.NewPaymentService(tm, purchaseRepository, remnawaveClient, customerRepository, b, cryptoPayClient, yookasaClient, referralRepository, cache, moynalogClient)

	// Настройка cron-задачи для проверки статуса счетов (каждые 5 секунд)
	// Проверяет оплаченные счета в CryptoPay и YooKassa
	cronScheduler := setupInvoiceChecker(purchaseRepository, cryptoPayClient, paymentService, yookasaClient)
	if cronScheduler != nil {
		cronScheduler.Start()
		defer cronScheduler.Stop()
	}

	// Инициализация сервиса уведомлений о подписках
	subService := notification.NewSubscriptionService(customerRepository, purchaseRepository, paymentService, b, tm)

	// Настройка cron-задачи для проверки истечения подписок (каждый день в 16:00)
	// Отправляет уведомления пользователям об истечении подписки
	subscriptionNotificationCronScheduler := subscriptionChecker(subService)
	subscriptionNotificationCronScheduler.Start()
	defer subscriptionNotificationCronScheduler.Stop()

	// Инициализация сервиса синхронизации с Remnawave
	syncService := sync.NewSyncService(remnawaveClient, customerRepository)

	// Создание главного обработчика всех команд и callback'ов бота
	h := handler.NewHandler(syncService, paymentService, tm, customerRepository, purchaseRepository, cryptoPayClient, yookasaClient, referralRepository, cache)

	// Получение информации о боте (username и т.д.)
	me, err := b.GetMe(ctx)
	if err != nil {
		panic(err)
	}

	// Настройка кнопки меню бота (показывать список команд)
	_, err = b.SetChatMenuButton(ctx, &bot.SetChatMenuButtonParams{
		MenuButton: &models.MenuButtonCommands{
			Type: models.MenuButtonTypeCommands,
		},
	})

	if err != nil {
		panic(err)
	}

	// Установка списка команд бота для русского языка
	_, err = b.SetMyCommands(ctx, &bot.SetMyCommandsParams{
		Commands: []models.BotCommand{
			{Command: "start", Description: "Начать работу с ботом"},
		},
		LanguageCode: "ru",
	})

	// Установка списка команд бота для английского языка
	_, err = b.SetMyCommands(ctx, &bot.SetMyCommandsParams{
		Commands: []models.BotCommand{
			{Command: "start", Description: "Start using the bot"},
		},
		LanguageCode: "en",
	})

	// Сохранение URL бота в конфигурации (используется для генерации ссылок)
	config.SetBotURL(fmt.Sprintf("https://t.me/%s", me.Username))

	// ============================================================================
	// РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ КОМАНД И CALLBACK'ОВ
	// ============================================================================
	// ВАЖНО: Порядок регистрации имеет значение! Обработчики проверяются сверху вниз.
	// Более специфичные обработчики должны регистрироваться раньше общих.

	// --- Обработчики текстовых команд ---

	// /start - главная команда бота, запускает взаимодействие с пользователем
	// Middleware: ForwardUserMessageToAdminMiddleware (пересылает сообщение админу),
	//             SuspiciousUserFilterMiddleware (блокирует подозрительных пользователей)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/start", bot.MatchTypePrefix, h.StartCommandHandler, h.ForwardUserMessageToAdminMiddleware, h.SuspiciousUserFilterMiddleware)

	// /connect - команда для подключения устройств
	// Middleware: SuspiciousUserFilterMiddleware, CreateCustomerIfNotExistMiddleware
	b.RegisterHandler(bot.HandlerTypeMessageText, "/connect", bot.MatchTypeExact, h.ConnectCommandHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// /sync - команда для синхронизации пользователей с Remnawave (только для админа)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/sync", bot.MatchTypeExact, h.SyncUsersCommandHandler, isAdminMiddleware)

	// /broadcast - команда для массовой рассылки сообщений всем пользователям (только для админа)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/broadcast", bot.MatchTypeExact, h.BroadcastCommandHandler, isAdminMiddleware)

	// --- Обработчики callback-кнопок (inline кнопки) ---

	// Callback для выбора типа рассылки (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastAll, bot.MatchTypeExact, h.BroadcastTypeSelectHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastActive, bot.MatchTypeExact, h.BroadcastTypeSelectHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastInactive, bot.MatchTypeExact, h.BroadcastTypeSelectHandler, isAdminMiddleware)

	// Callback для подтверждения рассылки (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastConfirm, bot.MatchTypeExact, h.BroadcastConfirmHandler, isAdminMiddleware)

	// Callback для отмены рассылки (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastCancel, bot.MatchTypeExact, h.BroadcastCancelHandler, isAdminMiddleware)

	// Callback для реферальной системы
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackReferral, bot.MatchTypeExact, h.ReferralCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для покупки подписки
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBuy, bot.MatchTypeExact, h.BuyCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для пробного периода
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackTrial, bot.MatchTypeExact, h.TrialCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для активации пробного периода
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackActivateTrial, bot.MatchTypeExact, h.ActivateTrialCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для возврата в главное меню
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackStart, bot.MatchTypeExact, h.StartCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для продажи подписки (с префиксом, т.к. содержит параметры)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackSell, bot.MatchTypePrefix, h.SellCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для подключения устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackConnect, bot.MatchTypeExact, h.ConnectCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для обработки платежей (с префиксом, т.к. содержит параметры)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPayment, bot.MatchTypePrefix, h.PaymentCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для справки/помощи
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "help", bot.MatchTypeExact, h.HelpCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для просмотра списка устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackDevices, bot.MatchTypeExact, h.DevicesCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Callback для удаления устройства (с префиксом, т.к. содержит HWID устройства)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackDeleteDevice, bot.MatchTypePrefix, h.DeleteDeviceCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Обработчик предварительной проверки платежа (Telegram Stars)
	// Срабатывает перед финальным подтверждением платежа
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.PreCheckoutQuery != nil
	}, h.PreCheckoutCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware)

	// Обработчик успешного платежа (Telegram Stars)
	// Срабатывает после успешной оплаты через Telegram Stars
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil && update.Message.SuccessfulPayment != nil
	}, h.SuccessPaymentHandler, h.SuspiciousUserFilterMiddleware)

	// ============================================================================
	// ОБРАБОТЧИКИ ТЕКСТОВЫХ СООБЩЕНИЙ И REPLY
	// ============================================================================
	// Эти обработчики регистрируются после основных команд, чтобы не перехватывать их

	// Обработчик текстовых сообщений от админа для рассылки
	// Срабатывает только если админ в режиме ввода текста для рассылки (после /broadcast)
	// НЕ обрабатывает reply-сообщения (они обрабатываются AdminReplyToUser ниже)
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil // Пропускаем reply-сообщения
	}, h.BroadcastMessageHandler)

	// Обработчик для неизвестных команд от пользователей
	// Пересылает все команды пользователей админу для просмотра
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID != config.GetAdminTelegramId()
	}, h.ForwardUserMessageToAdmin)

	// Обработчик для обычных текстовых сообщений от пользователей (не команд)
	// Пересылает все текстовые сообщения пользователей админу для просмотра
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID != config.GetAdminTelegramId()
	}, h.ForwardUserMessageToAdmin)

	// Обработчик для reply-сообщений от админа
	// Позволяет админу отвечать на сообщения пользователей через reply
	// Извлекает ID пользователя из текста пересланного сообщения и отправляет ответ
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.ReplyToMessage != nil &&
			update.Message.From.ID == config.GetAdminTelegramId()
	}, h.AdminReplyToUser)

	// ============================================================================
	// HTTP СЕРВЕР ДЛЯ HEALTHCHECK И WEBHOOK'ОВ
	// ============================================================================

	// Создание HTTP роутера для обработки внешних запросов
	mux := http.NewServeMux()

	// Endpoint для проверки здоровья сервиса (используется для мониторинга)
	// Проверяет доступность БД и Remnawave API
	mux.Handle("/healthcheck", fullHealthHandler(pool, remnawaveClient))

	// Webhook для платежной системы Tribute (если включена)
	if config.GetTributeWebHookUrl() != "" {
		tributeHandler := tribute.NewClient(paymentService, customerRepository)
		mux.Handle(config.GetTributeWebHookUrl(), tributeHandler.WebHookHandler())
	}

	// Запуск HTTP сервера в отдельной горутине
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", config.GetHealthCheckPort()),
		Handler: mux,
	}
	go func() {
		log.Printf("Server listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// ============================================================================
	// ЗАПУСК БОТА
	// ============================================================================

	slog.Info("Bot is starting...")
	// Запуск бота (блокирующий вызов, работает до получения сигнала прерывания)
	b.Start(ctx)

	// Корректное завершение HTTP сервера при остановке бота
	log.Println("Shutting down health server…")
	shutdownCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Health server shutdown error: %v", err)
	}
}

// fullHealthHandler - HTTP обработчик для проверки здоровья сервиса
// Проверяет доступность базы данных и Remnawave API
// Используется для мониторинга и healthcheck в оркестраторах (Docker, Kubernetes и т.д.)
func fullHealthHandler(pool *pgxpool.Pool, rw *remnawave.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		status := map[string]string{
			"status": "ok",
			"db":     "ok",
			"rw":     "ok",
			"time":   time.Now().Format(time.RFC3339),
		}

		// Проверка доступности базы данных PostgreSQL
		dbCtx, dbCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer dbCancel()
		if err := pool.Ping(dbCtx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			status["status"] = "fail"
			status["db"] = "error: " + err.Error()
		}

		// Проверка доступности Remnawave API
		rwCtx, rwCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer rwCancel()
		if err := rw.Ping(rwCtx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			status["status"] = "fail"
			status["rw"] = "error: " + err.Error()
		}

		if status["status"] == "ok" {
			w.WriteHeader(http.StatusOK)
		}

		// Возвращаем JSON с результатами проверки
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"%s","db":"%s","remnawave":"%s","time":"%s"}`,
			status["status"], status["db"], status["rw"], status["time"])
	})
}

// isAdminMiddleware - middleware для проверки, что запрос пришел от администратора
// Пропускает обработчик только если пользователь является админом
// Работает как с обычными сообщениями, так и с callback queries
func isAdminMiddleware(next bot.HandlerFunc) bot.HandlerFunc {
	return func(ctx context.Context, b *bot.Bot, update *models.Update) {
		var userID int64
		// Определяем ID пользователя в зависимости от типа обновления
		if update.Message != nil {
			userID = update.Message.From.ID
		} else if update.CallbackQuery != nil {
			userID = update.CallbackQuery.From.ID
		} else {
			return // Неизвестный тип обновления, пропускаем
		}

		// Проверяем, является ли пользователь админом
		if userID == config.GetAdminTelegramId() {
			next(ctx, b, update) // Пропускаем в обработчик
		} else {
			return // Не админ, блокируем запрос
		}
	}
}

// subscriptionChecker - настраивает cron-задачу для проверки истечения подписок
// Запускается каждый день в 16:00 (формат cron: "0 16 * * *")
// Отправляет уведомления пользователям об истечении подписки
func subscriptionChecker(subService *notification.SubscriptionService) *cron.Cron {
	c := cron.New()

	// Добавляем задачу: каждый день в 16:00 проверять истечение подписок
	_, err := c.AddFunc("0 16 * * *", func() {
		err := subService.ProcessSubscriptionExpiration()
		if err != nil {
			slog.Error("Error sending subscription notifications", "error", err)
		}
	})

	if err != nil {
		panic(err)
	}
	return c
}

// initDatabase - инициализирует пул соединений с базой данных PostgreSQL
// Настраивает максимальное и минимальное количество соединений для оптимизации производительности
func initDatabase(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	// Настройка пула соединений
	config.MaxConns = 20 // Максимальное количество одновременных соединений
	config.MinConns = 5  // Минимальное количество соединений (поддерживается постоянно)

	return pgxpool.ConnectConfig(ctx, config)
}

// setupInvoiceChecker - настраивает cron-задачи для проверки статуса счетов
// Проверяет оплаченные счета в CryptoPay и YooKassa каждые 5 секунд
// Если счет оплачен, обрабатывает покупку и активирует подписку
func setupInvoiceChecker(
	purchaseRepository *database.PurchaseRepository,
	cryptoPayClient *cryptopay.Client,
	paymentService *payment.PaymentService,
	yookasaClient *yookasa.Client) *cron.Cron {
	// Если обе платежные системы отключены, не создаем cron-задачу
	if !config.IsYookasaEnabled() && !config.IsCryptoPayEnabled() {
		return nil
	}
	c := cron.New(cron.WithSeconds()) // Включаем поддержку секунд в расписании

	// Задача для проверки счетов CryptoPay (каждые 5 секунд)
	if config.IsCryptoPayEnabled() {
		_, err := c.AddFunc("*/5 * * * * *", func() {
			ctx := context.Background()
			checkCryptoPayInvoice(ctx, purchaseRepository, cryptoPayClient, paymentService)
		})

		if err != nil {
			panic(err)
		}
	}

	// Задача для проверки счетов YooKassa (каждые 5 секунд)
	if config.IsYookasaEnabled() {
		_, err := c.AddFunc("*/5 * * * * *", func() {
			ctx := context.Background()
			checkYookasaInvoice(ctx, purchaseRepository, yookasaClient, paymentService)
		})

		if err != nil {
			panic(err)
		}
	}

	return c
}

// checkYookasaInvoice - проверяет статус счетов YooKassa
// Находит все ожидающие оплаты покупки и проверяет их статус в YooKassa
// Если счет оплачен, обрабатывает покупку и активирует подписку
func checkYookasaInvoice(
	ctx context.Context,
	purchaseRepository *database.PurchaseRepository,
	yookasaClient *yookasa.Client,
	paymentService *payment.PaymentService,
) {
	// Получаем все покупки со статусом "ожидает оплаты" для YooKassa
	pendingPurchases, err := purchaseRepository.FindByInvoiceTypeAndStatus(
		ctx,
		database.InvoiceTypeYookasa,
		database.PurchaseStatusPending,
	)
	if err != nil {
		log.Printf("Error finding pending purchases: %v", err)
		return
	}
	if len(*pendingPurchases) == 0 {
		return // Нет ожидающих покупок
	}

	// Проверяем каждую покупку
	for _, purchase := range *pendingPurchases {
		// Получаем информацию о счете из YooKassa
		invoice, err := yookasaClient.GetPayment(ctx, *purchase.YookasaID)

		if err != nil {
			slog.Error("Error getting invoice", "invoiceId", purchase.YookasaID, err)
			continue
		}

		// Если счет отменен, отменяем покупку в нашей системе
		if invoice.IsCancelled() {
			err := paymentService.CancelYookassaPayment(purchase.ID)
			if err != nil {
				slog.Error("Error canceling invoice", "invoiceId", invoice.ID, "purchaseId", purchase.ID, err)
			}
			continue
		}

		// Если счет еще не оплачен, пропускаем
		if !invoice.Paid {
			continue
		}

		// Счет оплачен - обрабатываем покупку
		// Извлекаем ID покупки из метаданных счета
		purchaseId, err := strconv.Atoi(invoice.Metadata["purchaseId"])
		if err != nil {
			slog.Error("Error parsing purchaseId", "invoiceId", invoice.ID, err)
		}
		// Передаем username в контексте для логирования
		ctxWithValue := context.WithValue(ctx, "username", invoice.Metadata["username"])
		err = paymentService.ProcessPurchaseById(ctxWithValue, int64(purchaseId))
		if err != nil {
			slog.Error("Error processing invoice", "invoiceId", invoice.ID, "purchaseId", purchaseId, err)
		} else {
			slog.Info("Invoice processed", "invoiceId", invoice.ID, "purchaseId", purchaseId)
		}
	}
}

// checkCryptoPayInvoice - проверяет статус счетов CryptoPay
// Находит все ожидающие оплаты покупки и проверяет их статус в CryptoPay
// Если счет оплачен, обрабатывает покупку и активирует подписку
func checkCryptoPayInvoice(
	ctx context.Context,
	purchaseRepository *database.PurchaseRepository,
	cryptoPayClient *cryptopay.Client,
	paymentService *payment.PaymentService,
) {
	// Получаем все покупки со статусом "ожидает оплаты" для CryptoPay
	pendingPurchases, err := purchaseRepository.FindByInvoiceTypeAndStatus(
		ctx,
		database.InvoiceTypeCrypto,
		database.PurchaseStatusPending,
	)
	if err != nil {
		log.Printf("Error finding pending purchases: %v", err)
		return
	}
	if len(*pendingPurchases) == 0 {
		return // Нет ожидающих покупок
	}

	// Собираем ID всех счетов для массовой проверки
	var invoiceIDs []string
	for _, purchase := range *pendingPurchases {
		if purchase.CryptoInvoiceID != nil {
			invoiceIDs = append(invoiceIDs, fmt.Sprintf("%d", *purchase.CryptoInvoiceID))
		}
	}

	if len(invoiceIDs) == 0 {
		return
	}

	// Запрашиваем статус всех счетов одним запросом (оптимизация)
	stringInvoiceIDs := strings.Join(invoiceIDs, ",")
	invoices, err := cryptoPayClient.GetInvoices("", "", "", stringInvoiceIDs, 0, 0)
	if err != nil {
		log.Printf("Error getting invoices: %v", err)
		return
	}

	// Обрабатываем оплаченные счета
	for _, invoice := range *invoices {
		if invoice.InvoiceID != nil && invoice.IsPaid() {
			// Извлекаем данные из payload счета (формат: "purchaseId=123&username=user")
			payload := strings.Split(invoice.Payload, "&")
			purchaseID, err := strconv.Atoi(strings.Split(payload[0], "=")[1])
			username := strings.Split(payload[1], "=")[1]
			// Передаем username в контексте для логирования
			ctxWithUsername := context.WithValue(ctx, "username", username)
			err = paymentService.ProcessPurchaseById(ctxWithUsername, int64(purchaseID))
			if err != nil {
				slog.Error("Error processing invoice", "invoiceId", invoice.InvoiceID, err)
			} else {
				slog.Info("Invoice processed", "invoiceId", invoice.InvoiceID, "purchaseId", purchaseID)
			}
		}
	}
}
