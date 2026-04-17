package payment

import (
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"

	"github.com/google/uuid"
)

func buildRemnawaveTariffProfile(t *database.Tariff) remnawave.TariffPaidProfile {
	uuids, _ := database.ParseSquadUUIDList(t.ActiveInternalSquadUUIDs)
	ext := uuid.Nil
	if t.ExternalSquadUUID != nil {
		ext = *t.ExternalSquadUUID
	}
	tag := ""
	if t.RemnawaveTag != nil {
		tag = *t.RemnawaveTag
	}
	var tl int64
	if t.TrafficLimitBytes > 0 {
		tl = t.TrafficLimitBytes
	} else {
		tl = int64(config.TrafficLimit())
	}
	if tl < 0 {
		tl = 0
	}
	return remnawave.TariffPaidProfile{
		TrafficLimitBytes:         tl,
		TrafficLimitResetStrategy: t.TrafficLimitResetStrategy,
		SquadUUIDs:                uuids,
		ExternalSquadUUID:         ext,
		Tag:                       tag,
		BaseDeviceLimit:           t.DeviceLimit,
	}
}
