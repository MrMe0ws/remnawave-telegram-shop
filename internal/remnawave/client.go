package remnawave

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/utils"
	"strconv"
	"strings"
	"time"

	remapi "github.com/Jolymmiles/remnawave-api-go/v2/api"
	"github.com/google/uuid"
)

type Client struct {
	client *remapi.ClientExt
}

type headerTransport struct {
	base    http.RoundTripper
	headers map[string]string
	local   bool
}

func (t *headerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	r := req.Clone(req.Context())

	if t.local {
		r.Header.Set("x-forwarded-for", "127.0.0.1")
		r.Header.Set("x-forwarded-proto", "https")
	}

	for key, value := range t.headers {
		r.Header.Set(key, value)
	}

	return t.base.RoundTrip(r)
}

func NewClient(baseURL, token, mode string) *Client {
	local := mode == "local"
	headers := config.RemnawaveHeaders()

	client := &http.Client{
		Transport: &headerTransport{
			base:    http.DefaultTransport,
			headers: headers,
			local:   local,
		},
	}

	api, err := remapi.NewClient(baseURL, remapi.StaticToken{Token: token}, remapi.WithClient(client))
	if err != nil {
		panic(err)
	}
	return &Client{client: remapi.NewClientExt(api)}
}

func (r *Client) Ping(ctx context.Context) error {
	_, err := r.client.Users().GetAllUsers(ctx, 1, 0)
	return err
}

func (r *Client) GetUsers(ctx context.Context) (*[]remapi.User, error) {
	pager := remapi.NewPaginationHelper(250)
	users := make([]remapi.User, 0)

	for {
		resp, err := r.client.Users().GetAllUsers(ctx, float64(pager.Limit), float64(pager.Offset))

		if err != nil {
			return nil, err
		}
		response := resp.(*remapi.GetAllUsersResponseDto).GetResponse()
		users = append(users, response.Users...)

		if len(response.Users) < pager.Limit {
			break
		}

		if !pager.NextPage() {
			break
		}
	}

	return &users, nil
}

func (r *Client) DecreaseSubscription(ctx context.Context, telegramId int64, trafficLimit int, days int) (*time.Time, error) {

	resp, err := r.client.Users().GetUserByTelegramId(ctx, strconv.FormatInt(telegramId, 10))
	if err != nil {
		return nil, err
	}

	usersResp, ok := resp.(*remapi.UsersResponse)
	if !ok {
		return nil, errors.New("unknown response type")
	}

	users := usersResp.GetResponse()
	if len(users) == 0 {
		return nil, errors.New("user in remnawave not found")
	}

	var existingUser *remapi.User
	suffix := fmt.Sprintf("_%d", telegramId)

	for i := range users {
		if strings.Contains(users[i].Username, suffix) {
			existingUser = &users[i]
			break
		}
	}

	if existingUser == nil {
		existingUser = &users[0]
	}

	updatedUser, err := r.updateUser(ctx, existingUser, trafficLimit, days, false)
	if err != nil {
		return nil, err
	}
	return &updatedUser.ExpireAt, nil
}

func (r *Client) CreateOrUpdateUser(ctx context.Context, customerId int64, telegramId int64, trafficLimit int, days int) (*remapi.User, error) {
	return r.CreateOrUpdateUserWithStrategy(ctx, customerId, telegramId, trafficLimit, days, config.TrafficLimitResetStrategy())
}

func (r *Client) CreateOrUpdateUserWithStrategy(ctx context.Context, customerId int64, telegramId int64, trafficLimit int, days int, strategy string) (*remapi.User, error) {
	return r.CreateOrUpdateUserWithStrategyAndTrial(ctx, customerId, telegramId, trafficLimit, days, strategy, false)
}

func (r *Client) CreateOrUpdateUserWithStrategyAndTrial(ctx context.Context, customerId int64, telegramId int64, trafficLimit int, days int, strategy string, isTrialUser bool) (*remapi.User, error) {
	resp, err := r.client.Users().GetUserByTelegramId(ctx, strconv.FormatInt(telegramId, 10))
	if err != nil {
		return nil, err
	}

	usersResp, ok := resp.(*remapi.UsersResponse)
	if !ok {
		return nil, errors.New("unknown response type")
	}

	users := usersResp.GetResponse()
	if len(users) == 0 {
		return r.createUserWithStrategy(ctx, customerId, telegramId, trafficLimit, days, strategy, isTrialUser)
	}

	var existingUser *remapi.User
	suffix := fmt.Sprintf("_%d", telegramId)

	for i := range users {
		if strings.Contains(users[i].Username, suffix) {
			existingUser = &users[i]
			break
		}
	}

	if existingUser == nil {
		existingUser = &users[0]
	}

	// При обновлении передаем стратегию для изменения стратегии сброса трафика
	return r.updateUserWithStrategy(ctx, existingUser, trafficLimit, days, strategy, isTrialUser)
}

func (r *Client) updateUser(ctx context.Context, existingUser *remapi.User, trafficLimit int, days int, isTrialUser bool) (*remapi.User, error) {
	strategy := config.TrafficLimitResetStrategy()
	if isTrialUser {
		strategy = config.TrialTrafficLimitResetStrategy()
	}
	return r.updateUserWithStrategy(ctx, existingUser, trafficLimit, days, strategy, isTrialUser)
}

func (r *Client) updateUserWithStrategy(ctx context.Context, existingUser *remapi.User, trafficLimit int, days int, strategy string, isTrialUser bool) (*remapi.User, error) {

	newExpire := getNewExpire(days, existingUser.ExpireAt)

	userUpdate := &remapi.UpdateUserRequestDto{
		UUID:              remapi.NewOptUUID(existingUser.UUID),
		ExpireAt:          remapi.NewOptDateTime(newExpire),
		Status:            remapi.NewOptUpdateUserRequestDtoStatus(remapi.UpdateUserRequestDtoStatusACTIVE),
		TrafficLimitBytes: remapi.NewOptInt(trafficLimit),
	}

	// Обновляем внутренние squads в зависимости от типа пользователя
	resp, err := r.client.InternalSquad().GetInternalSquads(ctx)
	if err != nil {
		return nil, err
	}

	// Используем trial squad конфигурацию, если это trial пользователь
	squadUUIDs := config.SquadUUIDs()
	if isTrialUser {
		squadUUIDs = config.TrialInternalSquads()
	}

	squads := resp.(*remapi.InternalSquadsResponse).GetResponse()
	squadId := make([]uuid.UUID, 0, len(squadUUIDs))
	for _, squad := range squads.GetInternalSquads() {
		if squadUUIDs != nil && len(squadUUIDs) > 0 {
			if _, isExist := squadUUIDs[squad.UUID]; !isExist {
				continue
			} else {
				squadId = append(squadId, squad.UUID)
			}
		} else {
			squadId = append(squadId, squad.UUID)
		}
	}
	if len(squadId) > 0 {
		userUpdate.ActiveInternalSquads = squadId
	}

	// Используем trial squad конфигурацию, если это trial пользователь
	externalSquadUUID := config.ExternalSquadUUID()
	if isTrialUser {
		externalSquadUUID = config.TrialExternalSquadUUID()
	}
	if externalSquadUUID != uuid.Nil {
		userUpdate.ExternalSquadUuid = remapi.NewOptNilUUID(externalSquadUUID)
	}

	// Обновляем стратегию сброса трафика
	// Преобразуем строковую стратегию в значение для UpdateUserRequestDto
	strategyValue := getUpdateTrafficLimitStrategy(strategy)
	userUpdate.TrafficLimitStrategy = remapi.NewOptUpdateUserRequestDtoTrafficLimitStrategy(strategyValue)

	tag := config.RemnawaveTag()
	if isTrialUser {
		tag = config.TrialRemnawaveTag()
	}
	if isValidTag(tag) {
		userUpdate.Tag = remapi.NewOptNilString(tag)
	}

	var username string
	if ctx.Value("username") != nil {
		username = ctx.Value("username").(string)
		userUpdate.Description = remapi.NewOptNilString(username)
	} else {
		username = ""
	}

	updateUser, err := r.client.Users().UpdateUser(ctx, userUpdate)
	if err != nil {
		return nil, err
	}
	tgid, _ := existingUser.TelegramId.Get()
	slog.Info("updated user", "telegramId", utils.MaskHalf(strconv.Itoa(tgid)), "username", utils.MaskHalf(username), "days", days, "strategy", strategy)
	userResp := updateUser.(*remapi.UserResponse)
	user := userResp.GetResponse()
	return &user, nil
}

func (r *Client) createUser(ctx context.Context, customerId int64, telegramId int64, trafficLimit int, days int) (*remapi.User, error) {
	return r.createUserWithStrategy(ctx, customerId, telegramId, trafficLimit, days, config.TrafficLimitResetStrategy(), false)
}

func (r *Client) createUserWithStrategy(ctx context.Context, customerId int64, telegramId int64, trafficLimit int, days int, strategy string, isTrialUser bool) (*remapi.User, error) {
	expireAt := time.Now().UTC().AddDate(0, 0, days)
	username := generateUsername(customerId, telegramId)

	resp, err := r.client.InternalSquad().GetInternalSquads(ctx)
	if err != nil {
		return nil, err
	}

	// Используем trial squad конфигурацию, если это trial пользователь
	squadUUIDs := config.SquadUUIDs()
	if isTrialUser {
		squadUUIDs = config.TrialInternalSquads()
	}

	squads := resp.(*remapi.InternalSquadsResponse).GetResponse()
	squadId := make([]uuid.UUID, 0, len(squadUUIDs))
	for _, squad := range squads.GetInternalSquads() {
		if squadUUIDs != nil && len(squadUUIDs) > 0 {
			if _, isExist := squadUUIDs[squad.UUID]; !isExist {
				continue
			} else {
				squadId = append(squadId, squad.UUID)
			}
		} else {
			squadId = append(squadId, squad.UUID)
		}
	}

	createUserRequestDto := remapi.CreateUserRequestDto{
		Username:             username,
		ActiveInternalSquads: squadId,
		Status:               remapi.NewOptCreateUserRequestDtoStatus(remapi.CreateUserRequestDtoStatusACTIVE),
		TelegramId:           remapi.NewOptNilInt(int(telegramId)),
		ExpireAt:             expireAt,
		TrafficLimitStrategy: remapi.NewOptCreateUserRequestDtoTrafficLimitStrategy(getTrafficLimitStrategy(strategy)),
		TrafficLimitBytes:    remapi.NewOptInt(trafficLimit),
	}

	// Используем trial squad конфигурацию, если это trial пользователь
	externalSquadUUID := config.ExternalSquadUUID()
	if isTrialUser {
		externalSquadUUID = config.TrialExternalSquadUUID()
	}
	if externalSquadUUID != uuid.Nil {
		createUserRequestDto.ExternalSquadUuid = remapi.NewOptNilUUID(externalSquadUUID)
	}
	tag := config.RemnawaveTag()
	if isTrialUser {
		tag = config.TrialRemnawaveTag()
	}
	if isValidTag(tag) {
		createUserRequestDto.Tag = remapi.NewOptNilString(tag)
	}

	var tgUsername string
	if ctx.Value("username") != nil {
		tgUsername = ctx.Value("username").(string)
		createUserRequestDto.Description = remapi.NewOptString(ctx.Value("username").(string))
	} else {
		tgUsername = ""
	}

	userCreate, err := r.client.Users().CreateUser(ctx, &createUserRequestDto)
	if err != nil {
		return nil, err
	}
	slog.Info("created user", "telegramId", utils.MaskHalf(strconv.FormatInt(telegramId, 10)), "username", utils.MaskHalf(tgUsername), "days", days, "strategy", strategy)
	userResp := userCreate.(*remapi.UserResponse)
	user := userResp.GetResponse()
	return &user, nil
}

func generateUsername(customerId int64, telegramId int64) string {
	return fmt.Sprintf("%d_%d", customerId, telegramId)
}

// isValidTag проверяет, соответствует ли тег формату ^[A-Z0-9_]+$
func isValidTag(tag string) bool {
	if tag == "" {
		return false
	}
	for _, char := range tag {
		if !((char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_') {
			return false
		}
	}
	return true
}

// getTrafficLimitStrategy преобразует строку в значение TrafficLimitStrategy для remnawave API (CreateUserRequestDto)
func getTrafficLimitStrategy(strategy string) remapi.CreateUserRequestDtoTrafficLimitStrategy {
	switch strings.ToLower(strategy) {
	case "day":
		return remapi.CreateUserRequestDtoTrafficLimitStrategyDAY
	case "week":
		return remapi.CreateUserRequestDtoTrafficLimitStrategyWEEK
	case "month":
		return remapi.CreateUserRequestDtoTrafficLimitStrategyMONTH
	case "never":
		// Для "never" используем MONTH, так как NEVER может быть недоступен в CreateUserRequestDto
		// В этом случае лимит не будет сбрасываться автоматически
		return remapi.CreateUserRequestDtoTrafficLimitStrategyMONTH
	default:
		return remapi.CreateUserRequestDtoTrafficLimitStrategyMONTH
	}
}

// getUpdateTrafficLimitStrategy преобразует строку в значение TrafficLimitStrategy для remnawave API (UpdateUserRequestDto)
func getUpdateTrafficLimitStrategy(strategy string) remapi.UpdateUserRequestDtoTrafficLimitStrategy {
	switch strings.ToLower(strategy) {
	case "day":
		return remapi.UpdateUserRequestDtoTrafficLimitStrategyDAY
	case "week":
		return remapi.UpdateUserRequestDtoTrafficLimitStrategyWEEK
	case "month":
		return remapi.UpdateUserRequestDtoTrafficLimitStrategyMONTH
	case "never":
		// Для "never" используем NO_RESET (без сброса)
		return remapi.UpdateUserRequestDtoTrafficLimitStrategyNORESET
	default:
		return remapi.UpdateUserRequestDtoTrafficLimitStrategyMONTH
	}
}

func getNewExpire(daysToAdd int, currentExpire time.Time) time.Time {
	if daysToAdd <= 0 {
		if currentExpire.AddDate(0, 0, daysToAdd).Before(time.Now()) {
			return time.Now().UTC().AddDate(0, 0, 1)
		} else {
			return currentExpire.AddDate(0, 0, daysToAdd)
		}
	}

	if currentExpire.Before(time.Now().UTC()) || currentExpire.IsZero() {
		return time.Now().UTC().AddDate(0, 0, daysToAdd)
	}

	return currentExpire.AddDate(0, 0, daysToAdd)
}

// GetUserInfo получает информацию о пользователе по Telegram ID
func (r *Client) GetUserInfo(ctx context.Context, telegramId int64) (string, int, error) {
	resp, err := r.client.Users().GetUserByTelegramId(ctx, strconv.FormatInt(telegramId, 10))
	if err != nil {
		return "", 0, err
	}

	usersResp, ok := resp.(*remapi.UsersResponse)
	if !ok {
		return "", 0, errors.New("unknown response type")
	}

	response := usersResp.GetResponse()
	if len(response) == 0 {
		return "", 0, errors.New("user not found")
	}

	userUuid := &response[0].UUID
	deviceLimit := response[0].HwidDeviceLimit.Value

	return userUuid.String(), deviceLimit, nil
}

// GetUserTrafficInfo получает информацию о пользователе с лимитом трафика по Telegram ID
func (r *Client) GetUserTrafficInfo(ctx context.Context, telegramId int64) (*remapi.User, error) {
	resp, err := r.client.Users().GetUserByTelegramId(ctx, strconv.FormatInt(telegramId, 10))
	if err != nil {
		return nil, err
	}

	usersResp, ok := resp.(*remapi.UsersResponse)
	if !ok {
		return nil, errors.New("unknown response type")
	}

	response := usersResp.GetResponse()
	if len(response) == 0 {
		return nil, errors.New("user not found")
	}

	var user *remapi.User
	for i := range response {
		if strings.Contains(response[i].Username, fmt.Sprintf("_%d", telegramId)) {
			user = &response[i]
			break
		}
	}
	if user == nil {
		user = &response[0]
	}

	return user, nil
}

// GetUserDevicesByUuid получает список устройств пользователя по UUID
func (r *Client) GetUserDevicesByUuid(ctx context.Context, userUuid string) ([]remapi.Device, error) {
	hwidResp, err := r.client.HwidUserDevices().GetUserHwidDevices(
		ctx, userUuid,
	)
	if err != nil {
		return nil, err
	}

	hwidResponse := hwidResp.(*remapi.HwidDevicesResponse).GetResponse()

	devices := hwidResponse.GetDevices()

	return devices, nil
}

// DeleteUserDevice удаляет устройство пользователя
func (r *Client) DeleteUserDevice(ctx context.Context, userUuidStr string, hwid string) error {
	userUuid, err := uuid.Parse(userUuidStr)
	if err != nil {
		slog.Error(err.Error())
		return err
	}

	req := &remapi.DeleteUserHwidDeviceRequestDto{
		Hwid:     hwid,
		UserUuid: userUuid,
	}

	_, err = r.client.HwidUserDevices().DeleteUserHwidDevice(ctx, req)
	if err != nil {
		slog.Error(err.Error())
		return err
	}

	return nil
}
