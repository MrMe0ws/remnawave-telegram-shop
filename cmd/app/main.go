package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"remnawave-tg-shop-bot/internal/cache"
	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	cabinethttp "remnawave-tg-shop-bot/internal/cabinet/http"
	cabstartup "remnawave-tg-shop-bot/internal/cabinet/startup"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/cryptopay"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/handler"
	"remnawave-tg-shop-bot/internal/moynalog"
	"remnawave-tg-shop-bot/internal/notification"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/promo"
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

// Version, Commit, BuildDate - переменные версии, устанавливаются при сборке через ldflags
var (
	Version   = "4.4.1"
	Commit    = "none"
	BuildDate = "unknown"
)

// main - главная функция приложения, инициализирует все компоненты бота и запускает его
func main() {
	// Создаем контекст с обработкой сигналов прерывания (Ctrl+C) для корректного завершения
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	// Инициализация конфигурации из переменных окружения
	config.InitConfig()
	slog.Info("Application starting", "version", Version, "commit", Commit, "buildDate", BuildDate)

	// Инициализация клиента МойНалог (опционально, если включен)
	var moynalogClient *moynalog.Client
	if config.IsMoynalogEnabled() {
		moynalogClient = moynalog.NewClient(
			config.MoynalogUrl(),
			config.MoynalogUsername(),
			config.MoynalogPassword(),
			config.MoynalogProxyURL(),
		)
		slog.Info("Moynalog client initialized")
	} else {
		slog.Info("Moynalog integration disabled")
	}

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

	// Инициализация конфигурации web-кабинета. Делаем сразу после миграций,
	// чтобы startup-check мог обратиться к уже созданной колонке customer.is_web_only
	// и чтобы падать рано при невалидных CABINET_* переменных.
	cabcfg.InitConfig()
	if cabcfg.IsEnabled() {
		if err := cabstartup.VerifySyntheticIDRange(ctx, pool, cabcfg.WebTelegramIDBase()); err != nil {
			panic(fmt.Errorf("cabinet startup check failed: %w", err))
		}
		slog.Info("cabinet startup check passed",
			"web_tg_id_base", cabcfg.WebTelegramIDBase())
	}

	// Инициализация кэша (TTL 30 минут) для временного хранения данных
	cache := cache.NewCache(30 * time.Minute)

	// Создание репозиториев для работы с данными в БД
	customerRepository := database.NewCustomerRepository(pool) // Работа с пользователями
	purchaseRepository := database.NewPurchaseRepository(pool) // Работа с покупками
	tariffRepository := database.NewTariffRepository(pool)     // Тарифы (SALES_MODE=tariffs)
	referralRepository := database.NewReferralRepository(pool) // Работа с реферальной системой
	promoRepository := database.NewPromoRepository(pool)
	statsRepository := database.NewStatsRepository(pool)
	infraBillingRepository := database.NewInfraBillingRepository(pool)
	loyaltyTierRepository := database.NewLoyaltyTierRepository(pool)

	// Инициализация клиентов для работы с внешними сервисами
	cryptoPayClient := cryptopay.NewCryptoPayClient(config.CryptoPayUrl(), config.CryptoPayToken())                // Криптоплатежи
	remnawaveClient := remnawave.NewClient(config.RemnawaveUrl(), config.RemnawaveToken(), config.RemnawaveMode()) // Remnawave API
	yookasaClient := yookasa.NewClient(config.YookasaUrl(), config.YookasaShopId(), config.YookasaSecretKey())     // YooKassa платежи

	// Создание экземпляра Telegram бота с 3 воркерами для параллельной обработки запросов
	botOptions := []bot.Option{bot.WithWorkers(3)}
	if proxyURL := config.TelegramProxyURL(); proxyURL != "" {
		parsedURL, err := url.Parse(proxyURL)
		if err != nil {
			slog.Error("Invalid TELEGRAM_PROXY_URL, proxy disabled", "error", err)
		} else {
			transport := &http.Transport{
				Proxy: http.ProxyURL(parsedURL),
			}
			botOptions = append(botOptions, bot.WithHTTPClient(30*time.Second, &http.Client{
				Transport: transport,
			}))
		}
	}
	b, err := bot.New(config.TelegramToken(), botOptions...)
	if err != nil {
		panic(err)
	}

	promoService := promo.NewService(promoRepository, customerRepository, purchaseRepository, remnawaveClient)

	// Инициализация сервиса платежей, который объединяет все платежные системы
	paymentService := payment.NewPaymentService(tm, purchaseRepository, tariffRepository, remnawaveClient, customerRepository, b, cryptoPayClient, yookasaClient, referralRepository, cache, moynalogClient, promoService, loyaltyTierRepository)

	// Настройка cron-задачи для проверки статуса счетов (каждые 5 секунд)
	// Проверяет оплаченные счета в CryptoPay и YooKassa
	cronScheduler := setupInvoiceChecker(purchaseRepository, cryptoPayClient, paymentService, yookasaClient)
	if cronScheduler != nil {
		cronScheduler.Start()
		defer cronScheduler.Stop()
	}

	// Инициализация сервиса уведомлений о подписках
	subService := notification.NewSubscriptionService(customerRepository, purchaseRepository, paymentService, b, tm)
	infraBillingNotifyService := notification.NewInfraBillingNotifyService(remnawaveClient, infraBillingRepository, b, tm)

	// Настройка cron-задачи для проверки истечения подписок (каждый день в 16:00)
	// Отправляет уведомления пользователям об истечении подписки
	subscriptionNotificationCronScheduler := subscriptionChecker(subService, infraBillingNotifyService)
	subscriptionNotificationCronScheduler.Start()
	defer subscriptionNotificationCronScheduler.Stop()

	// Инициализация сервиса синхронизации с Remnawave
	syncService := sync.NewSyncService(remnawaveClient, customerRepository)

	// Создание главного обработчика всех команд и callback'ов бота
	h := handler.NewHandler(syncService, paymentService, tm, customerRepository, purchaseRepository, tariffRepository, cryptoPayClient, yookasaClient, referralRepository, cache, promoRepository, promoService, remnawaveClient, statsRepository, infraBillingRepository, loyaltyTierRepository)

	// Получение информации о боте (username и т.д.)
	// Используем контекст с таймаутом для GetMe, чтобы избежать зависания при проблемах с сетью
	// Таймаут 30 секунд применяется к каждой попытке отдельно
	var me *models.User
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		// Создаем новый контекст с таймаутом для каждой попытки
		getMeCtx, getMeCancel := context.WithTimeout(ctx, 30*time.Second)
		me, err = b.GetMe(getMeCtx)
		getMeCancel() // Освобождаем ресурсы контекста

		if err == nil {
			break
		}
		if i < maxRetries-1 {
			slog.Warn("Failed to get bot info, retrying...", "attempt", i+1, "maxRetries", maxRetries, "error", err)
			time.Sleep(2 * time.Second)
		}
	}
	if err != nil {
		slog.Error("Failed to get bot info after retries", "error", err)
		panic(fmt.Errorf("failed to get bot info: %w", err))
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
			{Command: "connect", Description: "Подключиться"},
		},
		LanguageCode: "ru",
	})
	if err != nil {
		slog.Warn("Failed to set bot commands for Russian", "error", err)
	}

	// Установка списка команд бота для английского языка
	_, err = b.SetMyCommands(ctx, &bot.SetMyCommandsParams{
		Commands: []models.BotCommand{
			{Command: "start", Description: "Start using the bot"},
			{Command: "connect", Description: "Connect"},
		},
		LanguageCode: "en",
	})
	if err != nil {
		slog.Warn("Failed to set bot commands for English", "error", err)
	}

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
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastAll, bot.MatchTypeExact, h.BroadcastTypeSelectHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastActive, bot.MatchTypeExact, h.BroadcastActiveMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastInactive, bot.MatchTypeExact, h.BroadcastInactiveMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastActivePaid, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastActiveTrial, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastActiveAllSeg, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastInactivePaid, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastInactiveTrial, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastInactiveAllSeg, bot.MatchTypeExact, h.BroadcastSegmentPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastBackAudience, bot.MatchTypeExact, h.BroadcastBackToAudienceHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastBackAdmin, bot.MatchTypeExact, h.BroadcastBackToAdminHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "bc_pt_", bot.MatchTypePrefix, h.BroadcastPaidTariffCallbacksHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для подтверждения рассылки (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastConfirm, bot.MatchTypeExact, h.BroadcastConfirmHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для отмены рассылки (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastCancel, bot.MatchTypeExact, h.BroadcastCancelHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)

	// Выбор inline-кнопок под рассылку (только для админа)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastToggleMain, bot.MatchTypeExact, h.BroadcastButtonToggleHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastTogglePromo, bot.MatchTypeExact, h.BroadcastButtonToggleHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastToggleVPN, bot.MatchTypeExact, h.BroadcastButtonToggleHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastToggleBuy, bot.MatchTypeExact, h.BroadcastButtonToggleHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBroadcastButtonsNext, bot.MatchTypeExact, h.BroadcastButtonsNextHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)

	// Админ-панель и промокоды
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackEnterPromo, bot.MatchTypePrefix, h.EnterPromoCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminPanel, bot.MatchTypeExact, h.AdminPanelHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminBroadcast, bot.MatchTypeExact, h.AdminBroadcastShortcutHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSync, bot.MatchTypeExact, h.AdminSyncShortcutHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminPromo, bot.MatchTypeExact, h.AdminPromoOpenHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminTariffs, bot.MatchTypeExact, h.AdminTariffsHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersSubmenu, bot.MatchTypeExact, h.AdminUsersSubmenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersRoot, bot.MatchTypeExact, h.AdminUsersRootHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersSearch, bot.MatchTypeExact, h.AdminUsersSearchHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersStatsSection, bot.MatchTypeExact, h.AdminUsersStatsSectionHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersInactiveMenu, bot.MatchTypeExact, h.AdminUsersInactiveJumpHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersListAllPrefix, bot.MatchTypePrefix, h.AdminUsersListAllRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersListInactivePrefix, bot.MatchTypePrefix, h.AdminUsersListInactiveRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersListPagePickOpenPrefix, bot.MatchTypePrefix, h.AdminUsersListPagePickerOpenHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUsersListPagePickJumpPrefix, bot.MatchTypePrefix, h.AdminUsersListPagePickerJumpHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPaymentsNotifyUserOpenPrefix, bot.MatchTypePrefix, h.AdminPaymentsNotifyOpenUserHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserManagePrefix, bot.MatchTypePrefix, h.AdminUserManageHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserSubscriptionPrefix, bot.MatchTypePrefix, h.AdminUserSubscriptionHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserExtraHwidDecPrefix, bot.MatchTypePrefix, h.AdminUserExtraHwidDecHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserExtraHwidIncPrefix, bot.MatchTypePrefix, h.AdminUserExtraHwidIncHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserTariffMenuPrefix, bot.MatchTypePrefix, h.AdminUserTariffMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserTariffPickPrefix, bot.MatchTypePrefix, h.AdminUserTariffPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDescAskPrefix, bot.MatchTypePrefix, h.AdminUserDescriptionAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDescClearPrefix, bot.MatchTypePrefix, h.AdminUserDescriptionClearHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserReferralsPrefix, bot.MatchTypePrefix, h.AdminUserReferralsHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserSpendPrefix, bot.MatchTypePrefix, h.AdminUserSpendHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserPaymentsPrefix, bot.MatchTypePrefix, h.AdminUserPaymentsHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserMsgHintPrefix, bot.MatchTypePrefix, h.AdminUserMsgHintHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserExtendPrefix, bot.MatchTypePrefix, h.AdminUserExtendHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserResetTrafficAskPrefix, bot.MatchTypePrefix, h.AdminUserResetTrafficAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserResetTrafficConfirmPrefix, bot.MatchTypePrefix, h.AdminUserResetTrafficConfirmHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserHwPresetMenuPrefix, bot.MatchTypePrefix, h.AdminUserHwPresetMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserHwPresetSetPrefix, bot.MatchTypePrefix, h.AdminUserHwPresetSetHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserCalOpenPrefix, bot.MatchTypePrefix, h.AdminUserCalOpenHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserCalNavPrefix, bot.MatchTypePrefix, h.AdminUserCalNavHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserCalPickPrefix, bot.MatchTypePrefix, h.AdminUserCalPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserCalBlankPrefix, bot.MatchTypePrefix, h.AdminUserCalBlankHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserPanelMenuPrefix, bot.MatchTypePrefix, h.AdminUserPanelMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserSquadMenuPrefix, bot.MatchTypePrefix, h.AdminUserSquadMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserSquadPickPrefix, bot.MatchTypePrefix, h.AdminUserSquadPickHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserStrategyMenuPrefix, bot.MatchTypePrefix, h.AdminUserStrategyMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserStrategySetPrefix, bot.MatchTypePrefix, h.AdminUserStrategySetHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserTrafficMenuPrefix, bot.MatchTypePrefix, h.AdminUserTrafficMenuHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserTrafficSetPrefix, bot.MatchTypePrefix, h.AdminUserTrafficSetHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserTrafficCustomPrefix, bot.MatchTypePrefix, h.AdminUserTrafficCustomAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDisableAskPrefix, bot.MatchTypePrefix, h.AdminUserDisableAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDisableConfirmPrefix, bot.MatchTypePrefix, h.AdminUserDisableConfirmHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserEnableAskPrefix, bot.MatchTypePrefix, h.AdminUserEnableAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserEnableConfirmPrefix, bot.MatchTypePrefix, h.AdminUserEnableConfirmHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDeleteAskPrefix, bot.MatchTypePrefix, h.AdminUserDeleteAskHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDeleteConfirmPrefix, bot.MatchTypePrefix, h.AdminUserDeleteConfirmHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDevicesPrefix, bot.MatchTypePrefix, h.AdminUserDevicesHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminUserDevDelPrefix, bot.MatchTypePrefix, h.AdminUserDevDelHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSubsRoot, bot.MatchTypeExact, h.AdminSubsRootHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSubsListPrefix, bot.MatchTypePrefix, h.AdminSubsListRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSubsExpiringListPrefix, bot.MatchTypePrefix, h.AdminSubsExpiringListRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSubsExpiring, bot.MatchTypeExact, h.AdminSubsExpiringHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminSubsStatsJump, bot.MatchTypeExact, h.AdminSubsStatsJumpHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminRefRoot, bot.MatchTypeExact, h.AdminRefRootHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyRoot, bot.MatchTypeExact, h.AdminLoyaltyRootHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyLevels, bot.MatchTypeExact, h.AdminLoyaltyLevelsHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyNew, bot.MatchTypeExact, h.AdminLoyaltyNewHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyRecalcAsk, bot.MatchTypeExact, h.AdminLoyaltyRecalcAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyRecalcRun, bot.MatchTypeExact, h.AdminLoyaltyRecalcRunHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyRules, bot.MatchTypeExact, h.AdminLoyaltyRulesHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyStats, bot.MatchTypeExact, h.AdminLoyaltyStatsHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyCard, bot.MatchTypePrefix, h.AdminLoyaltyTierCardHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyDelAsk, bot.MatchTypePrefix, h.AdminLoyaltyDelAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyDelYes, bot.MatchTypePrefix, h.AdminLoyaltyDelYesHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyEditXP, bot.MatchTypePrefix, h.AdminLoyaltyEditXPAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyEditPct, bot.MatchTypePrefix, h.AdminLoyaltyEditPctAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminLoyaltyEditDn, bot.MatchTypePrefix, h.AdminLoyaltyEditDnAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsRoot, bot.MatchTypeExact, h.AdminStatsRootHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsUsers, bot.MatchTypeExact, h.AdminStatsUsersHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsSubs, bot.MatchTypeExact, h.AdminStatsSubsHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsRevenue, bot.MatchTypeExact, h.AdminStatsRevenueHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsRef, bot.MatchTypeExact, h.AdminStatsRefHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminStatsSummary, bot.MatchTypeExact, h.AdminStatsSummaryHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraRoot, bot.MatchTypeExact, h.AdminInfraRootHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraNodes, bot.MatchTypeExact, h.AdminInfraNodesHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraNotify, bot.MatchTypeExact, h.AdminInfraNotifyHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraHist, bot.MatchTypePrefix, h.AdminInfraHistoryHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraProv, bot.MatchTypeExact, h.AdminInfraProvidersHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAdminInfraToggle, bot.MatchTypePrefix, h.AdminInfraToggleHandler, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "ifn", bot.MatchTypePrefix, h.AdminInfraNodeCRUDRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "ifp", bot.MatchTypePrefix, h.AdminInfraProviderCRUDRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "ifh", bot.MatchTypePrefix, h.AdminInfraHistoryCRUDRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "ifb", bot.MatchTypePrefix, h.AdminInfraWizBackRouter, isAdminMiddleware, h.AnswerCallbackQueryMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackTariffNew, bot.MatchTypeExact, h.AdminTariffNewHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "tf_", bot.MatchTypePrefix, h.AdminTariffCallbackRouter, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoRoot, bot.MatchTypeExact, h.PromoRootHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoList, bot.MatchTypePrefix, h.PromoListHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoNew, bot.MatchTypeExact, h.PromoNewMenuHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoStatsAll, bot.MatchTypeExact, h.PromoStatsAllHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoCard, bot.MatchTypePrefix, h.PromoCardHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEdit, bot.MatchTypePrefix, h.PromoEditMenuHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditValid, bot.MatchTypePrefix, h.PromoEditAskValidHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditMax, bot.MatchTypePrefix, h.PromoEditAskMaxHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditSubDays, bot.MatchTypePrefix, h.PromoEditAskSubDaysHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditTrialDays, bot.MatchTypePrefix, h.PromoEditAskTrialDaysHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditSubsTariff, bot.MatchTypePrefix, h.PromoEditSubsTariffMenuHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditSubsTariffSet, bot.MatchTypePrefix, h.PromoEditSubsTariffApplyHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoEditDiscPay, bot.MatchTypePrefix, h.PromoEditAskDiscPayHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoNewType, bot.MatchTypePrefix, h.PromoNewTypeHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoDiscKind, bot.MatchTypePrefix, h.PromoDiscountKindHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoSubDaysScope, bot.MatchTypePrefix, h.PromoSubDaysScopeHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoToggle, bot.MatchTypePrefix, h.PromoToggleHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoFirstPur, bot.MatchTypePrefix, h.PromoFirstPurchaseToggle, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoStat, bot.MatchTypePrefix, h.PromoStatHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoDel, bot.MatchTypePrefix, h.PromoDeleteAskHandler, isAdminMiddleware)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPromoDelYes, bot.MatchTypePrefix, h.PromoDeleteYesHandler, isAdminMiddleware)

	// Callback для реферальной системы
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackReferral, bot.MatchTypeExact, h.ReferralCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для списка рефералов
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackReferralList, bot.MatchTypeExact, h.ReferralListCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Экран лояльности (Мой VPN)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackLoyaltyRoot, bot.MatchTypeExact, h.LoyaltyRootCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для покупки подписки
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackBuy, bot.MatchTypePrefix, h.BuyCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для пробного периода
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackTrial, bot.MatchTypeExact, h.TrialCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для активации пробного периода
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackActivateTrial, bot.MatchTypeExact, h.ActivateTrialCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для возврата в главное меню
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackStart, bot.MatchTypePrefix, h.StartCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для продажи подписки (с префиксом, т.к. содержит параметры)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackSell, bot.MatchTypePrefix, h.SellCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для подключения устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackConnect, bot.MatchTypePrefix, h.ConnectCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для управления устройствами
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackManageDevices, bot.MatchTypeExact, h.ManageDevicesCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для подтверждения изменения устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAddDeviceConfirm, bot.MatchTypePrefix, h.AddDeviceConfirmCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для применения изменения без оплаты
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAddDeviceApply, bot.MatchTypePrefix, h.AddDeviceApplyCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для докупки устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAddDevice, bot.MatchTypeExact, h.AddDeviceCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для оплаты докупки устройств (с префиксом, т.к. содержит параметры)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackAddDevicePayment, bot.MatchTypePrefix, h.AddDevicePaymentCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для продления доп. устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackRenewExtraHwid, bot.MatchTypePrefix, h.RenewExtraHwidCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для истории операций (с префиксом, т.к. содержит параметры страницы)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPurchaseHistory, bot.MatchTypePrefix, h.PurchaseHistoryCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для обработки платежей (с префиксом, т.к. содержит параметры)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackPayment, bot.MatchTypePrefix, h.PaymentCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для справки/помощи
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, "help", bot.MatchTypeExact, h.HelpCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для просмотра списка устройств
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackDevices, bot.MatchTypeExact, h.DevicesCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

	// Callback для удаления устройства (с префиксом, т.к. содержит HWID устройства)
	b.RegisterHandler(bot.HandlerTypeCallbackQueryData, handler.CallbackDeleteDevice, bot.MatchTypePrefix, h.DeleteDeviceCallbackHandler, h.SuspiciousUserFilterMiddleware, h.CreateCustomerIfNotExistMiddleware, h.AnswerCallbackQueryMiddleware)

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

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		if update.Message == nil || update.Message.Text == "" || strings.HasPrefix(update.Message.Text, "/") {
			return false
		}
		if !handler.UserPromoWaiting(update.Message.From.ID) {
			return false
		}
		// Админ: ввод промокода с главной не пересекается с мастером/редактированием в админке
		if update.Message.From.ID == config.GetAdminTelegramId() {
			if handler.AdminPromoWaiting(update.Message.From.ID) || handler.AdminPromoEditWaiting(update.Message.From.ID) {
				return false
			}
			if handler.AdminTariffWizardWaiting(update.Message.From.ID) || handler.AdminTariffEditWaiting(update.Message.From.ID) {
				return false
			}
			if handler.InfraBillingWizardWaiting(update.Message.From.ID) {
				return false
			}
			if handler.AdminLoyaltyWaiting(update.Message.From.ID) {
				return false
			}
			if handler.AdminUsersSearchWaiting(update.Message.From.ID) || handler.AdminUsersDMWaiting(update.Message.From.ID) {
				return false
			}
			if handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) {
				return false
			}
			if handler.AdminUserDescriptionWaiting(update.Message.From.ID) {
				return false
			}
		}
		return true
	}, h.UserPromoMessageHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			(handler.AdminPromoWaiting(update.Message.From.ID) || handler.AdminPromoEditWaiting(update.Message.From.ID)) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminPromoTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			(handler.AdminTariffWizardWaiting(update.Message.From.ID) || handler.AdminTariffEditWaiting(update.Message.From.ID)) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminTariffTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminLoyaltyTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.InfraBillingWizardWaiting(update.Message.From.ID) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminInfraBillingTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminPromoWaiting(update.Message.From.ID) &&
			!handler.AdminPromoEditWaiting(update.Message.From.ID) &&
			!handler.AdminTariffWizardWaiting(update.Message.From.ID) &&
			!handler.AdminTariffEditWaiting(update.Message.From.ID) &&
			!handler.InfraBillingWizardWaiting(update.Message.From.ID) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminUserDMMessageHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminPromoWaiting(update.Message.From.ID) &&
			!handler.AdminPromoEditWaiting(update.Message.From.ID) &&
			!handler.AdminTariffWizardWaiting(update.Message.From.ID) &&
			!handler.AdminTariffEditWaiting(update.Message.From.ID) &&
			!handler.InfraBillingWizardWaiting(update.Message.From.ID) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminUserTrafficLimitTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.AdminUserDescriptionWaiting(update.Message.From.ID) &&
			!handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminPromoWaiting(update.Message.From.ID) &&
			!handler.AdminPromoEditWaiting(update.Message.From.ID) &&
			!handler.AdminTariffWizardWaiting(update.Message.From.ID) &&
			!handler.AdminTariffEditWaiting(update.Message.From.ID) &&
			!handler.InfraBillingWizardWaiting(update.Message.From.ID) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID)
	}, h.AdminUserDescriptionTextHandler)

	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		return update.Message != nil &&
			update.Message.Text != "" &&
			!strings.HasPrefix(update.Message.Text, "/") &&
			update.Message.From.ID == config.GetAdminTelegramId() &&
			update.Message.ReplyToMessage == nil &&
			handler.AdminUsersSearchWaiting(update.Message.From.ID) &&
			!handler.AdminUsersDMWaiting(update.Message.From.ID) &&
			!handler.AdminPromoWaiting(update.Message.From.ID) &&
			!handler.AdminPromoEditWaiting(update.Message.From.ID) &&
			!handler.AdminTariffWizardWaiting(update.Message.From.ID) &&
			!handler.AdminTariffEditWaiting(update.Message.From.ID) &&
			!handler.InfraBillingWizardWaiting(update.Message.From.ID) &&
			!handler.AdminLoyaltyWaiting(update.Message.From.ID) &&
			!handler.AdminUserTrafficLimitWaiting(update.Message.From.ID) &&
			!handler.AdminUserDescriptionWaiting(update.Message.From.ID)
	}, h.AdminUsersSearchMessageHandler)

	// Обработчик черновика рассылки: текст, подпись к фото или фото/файл JPEG|PNG|WebP (после выбора аудитории)
	// НЕ обрабатывает reply-сообщения (они обрабатываются AdminReplyToUser ниже)
	b.RegisterHandlerMatchFunc(func(update *models.Update) bool {
		if update.Message == nil || update.Message.ReplyToMessage != nil {
			return false
		}
		if update.Message.From.ID != config.GetAdminTelegramId() {
			return false
		}
		if !handler.BroadcastAwaitingMessageInput(update.Message.From.ID) {
			return false
		}
		return handler.BroadcastIncomingDraftMessage(update.Message)
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

	// Web-кабинет: при CABINET_ENABLED=true регистрируем /cabinet/api/*
	// и /cabinet/* на том же mux и том же порту, что и healthcheck.
	// cabcfg.InitConfig() вызван ранее (сразу после миграций), здесь только
	// монтируем роуты.
	if cabcfg.IsEnabled() {
		if err := cabinethttp.Mount(ctx, mux, pool, paymentService, remnawaveClient, promoService); err != nil {
			panic(fmt.Errorf("failed to mount cabinet routes: %w", err))
		}
		slog.Info("cabinet routes mounted", "prefix", "/cabinet")
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

	// Логирование информации о версии при старте
	slog.Info("Bot is starting...",
		"version", Version,
		"commit", Commit,
		"buildDate", BuildDate)
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
			"status":    "ok",
			"db":        "ok",
			"rw":        "ok",
			"time":      time.Now().Format(time.RFC3339),
			"version":   Version,
			"commit":    Commit,
			"buildDate": BuildDate,
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
		fmt.Fprintf(w, `{"status":"%s","db":"%s","remnawave":"%s","time":"%s","version":"%s","commit":"%s","buildDate":"%s"}`,
			status["status"], status["db"], status["rw"], status["time"], status["version"], status["commit"], status["buildDate"])
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
func subscriptionChecker(subService *notification.SubscriptionService, infraNotify *notification.InfraBillingNotifyService) *cron.Cron {
	c := cron.New()

	// Добавляем задачу: каждый день в 16:00 проверять истечение подписок
	_, err := c.AddFunc("0 16 * * *", func() {
		err := subService.ProcessSubscriptionExpiration()
		if err != nil {
			slog.Error("Error sending subscription notifications", "error", err)
		}
		if infraNotify != nil {
			ctx := context.Background()
			if err := infraNotify.ProcessInfraBillingReminders(ctx); err != nil {
				slog.Error("Error sending infra billing reminders", "error", err)
			}
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
			if errors.Is(err, yookasa.ErrPaymentNotFound) {
				slog.Warn("YooKassa invoice not found, canceling purchase", "invoiceId", purchase.YookasaID, "purchaseId", purchase.ID)
				if cancelErr := paymentService.CancelYookassaPayment(purchase.ID); cancelErr != nil {
					slog.Error("Error canceling invoice after not found", "invoiceId", purchase.YookasaID, "purchaseId", purchase.ID, "error", cancelErr)
				}
				continue
			}
			slog.Error("Error getting invoice", "invoiceId", purchase.YookasaID, "error", err)
			continue
		}

		// Если счет отменен, отменяем покупку в нашей системе
		if invoice.IsCancelled() {
			err := paymentService.CancelYookassaPayment(purchase.ID)
			if err != nil {
				slog.Error("Error canceling invoice", "invoiceId", invoice.ID, "purchaseId", purchase.ID, "error", err)
			}
			continue
		}

		// Если счет еще не оплачен, пропускаем
		if !invoice.Paid {
			continue
		}

		// Счет оплачен - обрабатываем текущую pending-покупку.
		// Не зависим от invoice.Metadata["purchaseId"], т.к. некоторые провайдеры/ответы
		// могут вернуть metadata в нестабильном формате и это приводило к "eternal pending".
		username := ""
		if invoice.Metadata != nil {
			username = invoice.Metadata["username"]
		}
		ctxWithValue := context.WithValue(ctx, remnawave.CtxKeyUsername, username)
		purchaseId := int(purchase.ID)
		err = paymentService.ProcessPurchaseById(ctxWithValue, purchase.ID)
		if err != nil {
			slog.Error("Error processing invoice", "invoiceId", invoice.ID, "purchaseId", purchaseId, "error", err)
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
			ctxWithUsername := context.WithValue(ctx, remnawave.CtxKeyUsername, username)
			feeAmt := ""
			if invoice.FeeAmount != nil {
				feeAmt = *invoice.FeeAmount
			}
			ctxPaid := payment.WithCryptoNotifyMeta(ctxWithUsername, payment.CryptoNotifyMeta{
				Hash:         invoice.Hash,
				Status:       invoice.Status,
				CurrencyType: invoice.CurrencyType,
				Asset:        invoice.Asset,
				PaidAsset:    invoice.PaidAsset,
				PaidAmount:   invoice.PaidAmount,
				PayUrl:       invoice.PayUrl,
				BotInvoiceUrl: invoice.BotInvoiceUrl,
				FeeAmount:    feeAmt,
			})
			err = paymentService.ProcessPurchaseById(ctxPaid, int64(purchaseID))
			if err != nil {
				slog.Error("Error processing invoice", "invoiceId", invoice.InvoiceID, "purchaseId", purchaseID, "error", err)
			} else {
				slog.Info("Invoice processed", "invoiceId", invoice.InvoiceID, "purchaseId", purchaseID)
			}
		}
	}
}
