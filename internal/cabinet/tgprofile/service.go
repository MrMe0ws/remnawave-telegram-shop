// Package tgprofile достаёт имя, @username и аватарку пользователя из
// Telegram через бота и держит их в памяти процесса.
//
// Почему getChat, а не сохранённый payload логина: first_name и photo_url
// приходят только от Login Widget, а у входа через Mini App и Telegram OIDC
// их нет вовсе. К тому же сохранённое протухает — человек сменил аватарку, а
// в кабинете висит прошлогодняя. Бот же и так знает всех своих пользователей,
// и один getChat отдаёт сразу и имя, и file_id фотографии.
//
// Цена — поход в Bot API, а /me дёргается на каждом заходе, поэтому всё
// закрыто кэшем: профиль на 15 минут, отрицательный ответ на 10, картинка на
// 6 часов. Кэш живёт в процессе: перезапуск просто прогреет его заново.
package tgprofile

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-telegram/bot"
)

const (
	profileTTL    = 15 * time.Minute
	profileNegTTL = 10 * time.Minute
	avatarTTL     = 6 * time.Hour

	// lookupTimeout держим коротким: /me не должен ждать Telegram. Не успели —
	// отдаём то, что знаем из базы, и пробуем снова на следующем запросе.
	lookupTimeout   = 3 * time.Second
	downloadTimeout = 8 * time.Second

	// maxAvatarBytes — предохранитель: аватарка Telegram весит килобайты,
	// всё, что больше, — повод не класть это в память.
	maxAvatarBytes = 1 << 20

	maxProfileEntries = 10_000
	maxAvatarEntries  = 512
)

// Profile — то, что бот знает о пользователе.
type Profile struct {
	FirstName     string
	LastName      string
	Username      string
	PhotoFileID   string
	PhotoUniqueID string
}

// DisplayName — «Имя Фамилия»; пустая строка, если Telegram не отдал имени.
func (p Profile) DisplayName() string {
	return strings.TrimSpace(strings.TrimSpace(p.FirstName) + " " + strings.TrimSpace(p.LastName))
}

// HasPhoto — есть ли аватарка (её может не быть или её мог закрыть приватностью).
func (p Profile) HasPhoto() bool { return p.PhotoFileID != "" }

// Avatar — скачанная картинка вместе с метаданными для отдачи наружу.
type Avatar struct {
	Body        []byte
	ContentType string
	// ETag — file_unique_id фотографии: он меняется ровно тогда, когда
	// пользователь сменил аватарку, то есть идеально ложится на условный GET.
	ETag string
}

type profileEntry struct {
	profile Profile
	ok      bool
	at      time.Time
}

type avatarEntry struct {
	avatar Avatar
	at     time.Time
}

// Service — кэширующая обёртка над Bot API. Nil-safe: если бот в окружении не
// поднят, все методы честно отвечают «не знаю», и кабинет живёт как раньше.
type Service struct {
	bot  *bot.Bot
	http *http.Client
	now  func() time.Time

	mu       sync.RWMutex
	profiles map[int64]profileEntry
	avatars  map[string]avatarEntry
}

// New — конструктор. b может быть nil.
func New(b *bot.Bot) *Service {
	if b == nil {
		return nil
	}
	return &Service{
		bot:      b,
		http:     &http.Client{Timeout: downloadTimeout},
		now:      time.Now,
		profiles: make(map[int64]profileEntry),
		avatars:  make(map[string]avatarEntry),
	}
}

// Profile возвращает профиль пользователя. Второе значение — false, если
// Telegram о нём ничего не сказал: человек не запускал бота, заблокировал его
// или Bot API сейчас недоступен.
func (s *Service) Profile(ctx context.Context, telegramID int64) (Profile, bool) {
	if s == nil || s.bot == nil || telegramID <= 0 {
		return Profile{}, false
	}
	if e, hit := s.cachedProfile(telegramID); hit {
		return e.profile, e.ok
	}

	fetchCtx, cancel := context.WithTimeout(ctx, lookupTimeout)
	defer cancel()

	chat, err := s.bot.GetChat(fetchCtx, &bot.GetChatParams{ChatID: telegramID})
	if err != nil || chat == nil {
		// Причина не важна: и «бот не видит пользователя», и сетевая ошибка
		// лечатся одинаково — не спрашивать снова ближайшие минуты.
		slog.Debug("tgprofile: get chat failed", "telegram_id", telegramID, "error", err)
		s.storeProfile(telegramID, Profile{}, false)
		return Profile{}, false
	}

	p := Profile{
		FirstName: strings.TrimSpace(chat.FirstName),
		LastName:  strings.TrimSpace(chat.LastName),
		Username:  strings.TrimSpace(strings.TrimPrefix(chat.Username, "@")),
	}
	if chat.Photo != nil {
		// SmallFileID — 160×160. Аватарка в кабинете рисуется в 38–56 px,
		// так что даже на 4x-экране этого хватает, а весит она килобайты
		// против десятков у BigFileID.
		p.PhotoFileID = chat.Photo.SmallFileID
		p.PhotoUniqueID = chat.Photo.SmallFileUniqueID
	}
	s.storeProfile(telegramID, p, true)
	return p, true
}

// Avatar скачивает аватарку пользователя. ok=false — аватарки нет (нет фото
// или её закрыли настройками приватности), это не ошибка.
func (s *Service) Avatar(ctx context.Context, telegramID int64) (Avatar, bool, error) {
	if s == nil || s.bot == nil || telegramID <= 0 {
		return Avatar{}, false, nil
	}
	p, ok := s.Profile(ctx, telegramID)
	if !ok || !p.HasPhoto() {
		return Avatar{}, false, nil
	}
	if a, hit := s.cachedAvatar(p.PhotoUniqueID); hit {
		return a, true, nil
	}

	fetchCtx, cancel := context.WithTimeout(ctx, downloadTimeout)
	defer cancel()

	file, err := s.bot.GetFile(fetchCtx, &bot.GetFileParams{FileID: p.PhotoFileID})
	if err != nil || file == nil {
		return Avatar{}, false, fmt.Errorf("tgprofile: get file: %w", err)
	}
	// Ссылка содержит токен бота — наружу она не уходит никогда, только сюда.
	req, err := http.NewRequestWithContext(fetchCtx, http.MethodGet, s.bot.FileDownloadLink(file), nil)
	if err != nil {
		return Avatar{}, false, fmt.Errorf("tgprofile: build download request: %w", err)
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return Avatar{}, false, fmt.Errorf("tgprofile: download avatar: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return Avatar{}, false, fmt.Errorf("tgprofile: download avatar: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAvatarBytes+1))
	if err != nil {
		return Avatar{}, false, fmt.Errorf("tgprofile: read avatar: %w", err)
	}
	if len(body) > maxAvatarBytes {
		return Avatar{}, false, fmt.Errorf("tgprofile: avatar too large")
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		// Telegram отдаёт аватарки в JPEG; заголовку доверяем только если он
		// действительно про картинку — иначе браузер получит nosniff-отказ.
		contentType = "image/jpeg"
	}

	avatar := Avatar{Body: body, ContentType: contentType, ETag: `"tg-` + p.PhotoUniqueID + `"`}
	s.storeAvatar(p.PhotoUniqueID, avatar)
	return avatar, true, nil
}

// ---------------------------------------------------------------- cache

func (s *Service) cachedProfile(telegramID int64) (profileEntry, bool) {
	s.mu.RLock()
	e, ok := s.profiles[telegramID]
	s.mu.RUnlock()
	if !ok {
		return profileEntry{}, false
	}
	ttl := profileTTL
	if !e.ok {
		ttl = profileNegTTL
	}
	if s.now().Sub(e.at) > ttl {
		return profileEntry{}, false
	}
	return e, true
}

func (s *Service) storeProfile(telegramID int64, p Profile, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.profiles) >= maxProfileEntries {
		s.sweepProfilesLocked()
	}
	s.profiles[telegramID] = profileEntry{profile: p, ok: ok, at: s.now()}
}

func (s *Service) cachedAvatar(uniqueID string) (Avatar, bool) {
	if uniqueID == "" {
		return Avatar{}, false
	}
	s.mu.RLock()
	e, ok := s.avatars[uniqueID]
	s.mu.RUnlock()
	if !ok || s.now().Sub(e.at) > avatarTTL {
		return Avatar{}, false
	}
	return e.avatar, true
}

func (s *Service) storeAvatar(uniqueID string, a Avatar) {
	if uniqueID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.avatars) >= maxAvatarEntries {
		s.sweepAvatarsLocked()
	}
	s.avatars[uniqueID] = avatarEntry{avatar: a, at: s.now()}
}

// sweepProfilesLocked выбрасывает протухшее. Если протухшего не нашлось —
// чистит всё: кэш здесь чисто ускоряющий, потерять его не страшно, а расти
// без предела он не должен.
func (s *Service) sweepProfilesLocked() {
	now := s.now()
	for k, e := range s.profiles {
		ttl := profileTTL
		if !e.ok {
			ttl = profileNegTTL
		}
		if now.Sub(e.at) > ttl {
			delete(s.profiles, k)
		}
	}
	if len(s.profiles) >= maxProfileEntries {
		s.profiles = make(map[int64]profileEntry)
	}
}

func (s *Service) sweepAvatarsLocked() {
	now := s.now()
	for k, e := range s.avatars {
		if now.Sub(e.at) > avatarTTL {
			delete(s.avatars, k)
		}
	}
	if len(s.avatars) >= maxAvatarEntries {
		s.avatars = make(map[string]avatarEntry)
	}
}
