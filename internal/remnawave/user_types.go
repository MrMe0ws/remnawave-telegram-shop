package remnawave

import (
	"time"

	"github.com/google/uuid"
)

// InternalSquadRef короткое описание internal squad из ответа панели.
type InternalSquadRef struct {
	UUID uuid.UUID `json:"uuid"`
	Name string    `json:"name"`
}

// User represents a Remnawave user.
type User struct {
	UUID                   uuid.UUID         `json:"uuid"`
	ShortUUID              string            `json:"shortUuid"`
	Username               string            `json:"username"`
	SubscriptionUrl        string            `json:"subscriptionUrl"`
	ExpireAt               time.Time         `json:"expireAt"`
	TelegramID             *int64            `json:"telegramId"`
	Status                 string            `json:"status"`
	TrafficLimitBytes      int64             `json:"trafficLimitBytes"`
	TrafficLimitStrategy   string            `json:"trafficLimitStrategy"`
	HwidDeviceLimit        *int              `json:"hwidDeviceLimit"`
	Description            *string           `json:"description"`
	Tag                    *string           `json:"tag"`
	LastTrafficResetAt     *time.Time        `json:"lastTrafficResetAt"`
	CreatedAt              *time.Time        `json:"createdAt"`
	UpdatedAt              *time.Time        `json:"updatedAt"`
	ActiveInternalSquads   []InternalSquadRef `json:"activeInternalSquads"`
	UserTraffic            UserTraffic       `json:"userTraffic"`
}

type UserTraffic struct {
	UsedTrafficBytes         float64    `json:"usedTrafficBytes"`
	LifetimeUsedTrafficBytes float64    `json:"lifetimeUsedTrafficBytes"`
	OnlineAt                 *time.Time `json:"onlineAt"`
	FirstConnectedAt         *time.Time `json:"firstConnectedAt"`
	LastConnectedNodeUuid    *uuid.UUID `json:"lastConnectedNodeUuid"`
}

type Device struct {
	Hwid       string     `json:"hwid"`
	UserUuid   string     `json:"userUuid"`
	Platform   *string    `json:"platform"`
	OsVersion  *string    `json:"osVersion"`
	DeviceModel *string   `json:"deviceModel"`
	UserAgent  *string    `json:"userAgent"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// getAllUsersResponse is the raw API response for GET /api/users.
type getAllUsersResponse struct {
	Response struct {
		Users []User `json:"users"`
		Total int    `json:"total"`
	} `json:"response"`
}

// getUserDevicesResponse is the raw API response for GET /api/hwid/devices/{userUuid}.
type getUserDevicesResponse struct {
	Response struct {
		Total   int      `json:"total"`
		Devices []Device `json:"devices"`
	} `json:"response"`
}

// apiResponse is a generic wrapper for { "response": T } API responses.
type apiResponse[T any] struct {
	Response T `json:"response"`
}

// apiErrorResponse is the standard error response from the Remnawave API.
type apiErrorResponse struct {
	Message   string `json:"message"`
	ErrorCode string `json:"errorCode"`
}

// internalSquadItem is a single squad in the internal squads response.
type internalSquadItem struct {
	UUID uuid.UUID `json:"uuid"`
	Name string    `json:"name"`
}

// internalSquadsResponse is the response body for GET /api/internal-squads.
type internalSquadsResponse struct {
	InternalSquads []internalSquadItem `json:"internalSquads"`
}

// CreateUserRequest is the request body for POST /api/users.
type CreateUserRequest struct {
	Username             string      `json:"username"`
	ExpireAt             time.Time   `json:"expireAt"`
	Status               string      `json:"status,omitempty"`
	TrafficLimitBytes    *int64      `json:"trafficLimitBytes,omitempty"`
	TrafficLimitStrategy string      `json:"trafficLimitStrategy,omitempty"`
	HwidDeviceLimit      *int        `json:"hwidDeviceLimit,omitempty"`
	// nil — поле не уходит в JSON; non-nil (в т.ч. пустой слайс) — массив UUID.
	ActiveInternalSquads *[]uuid.UUID `json:"activeInternalSquads,omitempty"`
	ExternalSquadUuid    *uuid.UUID   `json:"externalSquadUuid,omitempty"`
	Tag                  *string      `json:"tag,omitempty"`
	TelegramID           *int         `json:"telegramId,omitempty"`
	Description          *string      `json:"description,omitempty"`
}

// UpdateUserRequest is the request body for PATCH /api/users.
type UpdateUserRequest struct {
	UUID                 *uuid.UUID  `json:"uuid,omitempty"`
	Username             *string     `json:"username,omitempty"`
	TelegramID           *int        `json:"telegramId,omitempty"`
	Status               string      `json:"status,omitempty"`
	ExpireAt             *time.Time  `json:"expireAt,omitempty"`
	TrafficLimitBytes    *int64      `json:"trafficLimitBytes,omitempty"`
	TrafficLimitStrategy string      `json:"trafficLimitStrategy,omitempty"`
	HwidDeviceLimit      *int         `json:"hwidDeviceLimit,omitempty"`
	// nil — не менять сквады; &[] — снять все внутренние сквады (пустой JSON-массив).
	ActiveInternalSquads *[]uuid.UUID `json:"activeInternalSquads,omitempty"`
	ExternalSquadUuid    *uuid.UUID  `json:"externalSquadUuid,omitempty"`
	Tag                  *string     `json:"tag,omitempty"`
	Description          *string     `json:"description,omitempty"`
}

type deleteUserDeviceRequest struct {
	UserUuid uuid.UUID `json:"userUuid"`
	Hwid     string    `json:"hwid"`
}
