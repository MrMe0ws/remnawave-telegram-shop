package remnawave

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"remnawave-tg-shop-bot/utils"
)

// TariffPaidProfile — параметры платной подписки из строки тарифа (не trial).
type TariffPaidProfile struct {
	TrafficLimitBytes         int64
	TrafficLimitResetStrategy string
	SquadUUIDs                []uuid.UUID
	ExternalSquadUUID         uuid.UUID
	Tag                       string
	BaseDeviceLimit           int
}

func filterSquadsByUUIDList(all []internalSquadItem, want []uuid.UUID) []uuid.UUID {
	if len(want) == 0 {
		result := make([]uuid.UUID, 0, len(all))
		for _, s := range all {
			result = append(result, s.UUID)
		}
		return result
	}
	wantSet := make(map[uuid.UUID]struct{}, len(want))
	for _, u := range want {
		wantSet[u] = struct{}{}
	}
	result := make([]uuid.UUID, 0, len(want))
	for _, s := range all {
		if _, ok := wantSet[s.UUID]; ok {
			result = append(result, s.UUID)
		}
	}
	return result
}

// CreateOrUpdateUserWithTariffProfile продлевает подписку с лимитами и сквадами из тарифа.
func (r *Client) CreateOrUpdateUserWithTariffProfile(ctx context.Context, customerID int64, telegramID int64, days int, profile TariffPaidProfile) (*User, error) {
	return r.createOrUpdateUserWithTariffProfile(ctx, customerID, telegramID, days, profile, nil)
}

// CreateOrUpdateUserWithTariffProfileFromNow — срок от текущего момента (аналог CreateOrUpdateUserFromNow).
func (r *Client) CreateOrUpdateUserWithTariffProfileFromNow(ctx context.Context, customerID int64, telegramID int64, days int, profile TariffPaidProfile) (*User, error) {
	base := time.Now().UTC().Add(-time.Second)
	return r.createOrUpdateUserWithTariffProfile(ctx, customerID, telegramID, days, profile, &base)
}

func (r *Client) createOrUpdateUserWithTariffProfile(ctx context.Context, customerID int64, telegramID int64, days int, profile TariffPaidProfile, baseExpire *time.Time) (*User, error) {
	users, err := r.getUsersByTelegramID(ctx, telegramID)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return r.createUserWithTariffProfile(ctx, customerID, telegramID, days, profile)
	}
	existingUser := findUserBySuffix(users, telegramID)
	return r.updateUserWithTariffProfile(ctx, existingUser, days, profile, baseExpire)
}

func (r *Client) updateUserWithTariffProfile(ctx context.Context, existingUser *User, days int, profile TariffPaidProfile, baseExpire *time.Time) (*User, error) {
	expireBase := existingUser.ExpireAt
	if baseExpire != nil {
		expireBase = *baseExpire
	}
	newExpire := getNewExpire(days, expireBase)

	squads, err := r.getInternalSquads(ctx)
	if err != nil {
		return nil, err
	}
	squadIds := filterSquadsByUUIDList(squads, profile.SquadUUIDs)
	strategy := normalizeStrategy(profile.TrafficLimitResetStrategy)
	tl := profile.TrafficLimitBytes
	userUpdate := &UpdateUserRequest{
		UUID:                 &existingUser.UUID,
		ExpireAt:             &newExpire,
		Status:               "ACTIVE",
		TrafficLimitBytes:    &tl,
		ActiveInternalSquads: squadIds,
		TrafficLimitStrategy: strategy,
	}
	if profile.BaseDeviceLimit > 0 {
		lim := profile.BaseDeviceLimit
		userUpdate.HwidDeviceLimit = &lim
	}
	if profile.ExternalSquadUUID != uuid.Nil {
		u := profile.ExternalSquadUUID
		userUpdate.ExternalSquadUuid = &u
	}
	if isValidTag(profile.Tag) {
		t := profile.Tag
		userUpdate.Tag = &t
	}
	if username := usernameFromCtx(ctx); username != "" {
		userUpdate.Description = &username
	}

	var resp apiResponse[User]
	if err := r.doJSON(ctx, http.MethodPatch, "/api/users", userUpdate, &resp); err != nil {
		return nil, err
	}
	tgid := ""
	if existingUser.TelegramID != nil {
		tgid = strconv.FormatInt(*existingUser.TelegramID, 10)
	}
	slog.Info("updated user (tariff profile)", "telegramId", utils.MaskHalf(tgid), "days", days)
	return &resp.Response, nil
}

func (r *Client) createUserWithTariffProfile(ctx context.Context, customerID int64, telegramID int64, days int, profile TariffPaidProfile) (*User, error) {
	expireAt := time.Now().UTC().AddDate(0, 0, days)
	username := generateUsername(customerID, telegramID)
	squads, err := r.getInternalSquads(ctx)
	if err != nil {
		return nil, err
	}
	squadIds := filterSquadsByUUIDList(squads, profile.SquadUUIDs)
	strategy := normalizeStrategy(profile.TrafficLimitResetStrategy)
	tl := profile.TrafficLimitBytes
	tid := int(telegramID)
	createReq := &CreateUserRequest{
		Username:             username,
		ActiveInternalSquads: squadIds,
		Status:               "ACTIVE",
		TelegramID:           &tid,
		ExpireAt:             expireAt,
		TrafficLimitStrategy: strategy,
		TrafficLimitBytes:    &tl,
	}
	if profile.BaseDeviceLimit > 0 {
		lim := profile.BaseDeviceLimit
		createReq.HwidDeviceLimit = &lim
	}
	if profile.ExternalSquadUUID != uuid.Nil {
		u := profile.ExternalSquadUUID
		createReq.ExternalSquadUuid = &u
	}
	if isValidTag(profile.Tag) {
		t := profile.Tag
		createReq.Tag = &t
	}
	if tgUsername := usernameFromCtx(ctx); tgUsername != "" {
		createReq.Description = &tgUsername
	}
	var resp apiResponse[User]
	if err := r.doJSON(ctx, http.MethodPost, "/api/users", createReq, &resp); err != nil {
		return nil, err
	}
	slog.Info("created user (tariff profile)", "telegramId", utils.MaskHalf(strconv.FormatInt(telegramID, 10)), "days", days)
	return &resp.Response, nil
}
