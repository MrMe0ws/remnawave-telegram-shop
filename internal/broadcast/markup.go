package broadcast

import (
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/translation"
)

const (
	callbackBuy        = "buy"
	callbackStart      = "start"
	callbackConnect    = "connect"
	callbackEnterPromo = "enter_promo"
	inlineQuerySuffix  = "?bc=1"
)

// BuildReplyMarkup строит inline-клавиатуру под рассылку для языка получателя.
func BuildReplyMarkup(tm *translation.Manager, lang string, flags RecipientButtons) models.ReplyMarkup {
	if tm == nil || (!flags.Buy && !flags.MainMenu && !flags.Promo && !flags.Connect) {
		return nil
	}
	var rows [][]models.InlineKeyboardButton
	if flags.Buy {
		rows = append(rows, []models.InlineKeyboardButton{
			tm.WithButton(lang, "buy_button", models.InlineKeyboardButton{CallbackData: callbackBuy + inlineQuerySuffix}),
		})
	}
	if flags.Connect {
		rows = append(rows, connectRow(tm, lang))
	}
	if flags.Promo {
		rows = append(rows, []models.InlineKeyboardButton{
			tm.WithButton(lang, "promo_code_button", models.InlineKeyboardButton{CallbackData: callbackEnterPromo + inlineQuerySuffix}),
		})
	}
	if flags.MainMenu {
		rows = append(rows, []models.InlineKeyboardButton{
			tm.WithButton(lang, "broadcast_inline_main", models.InlineKeyboardButton{CallbackData: callbackStart + inlineQuerySuffix}),
		})
	}
	return models.InlineKeyboardMarkup{InlineKeyboard: rows}
}

func connectRow(tm *translation.Manager, lang string) []models.InlineKeyboardButton {
	if u := cabinetWebAppURL("/cabinet/dashboard"); u != "" {
		return []models.InlineKeyboardButton{
			tm.WithButton(lang, "connect_button", models.InlineKeyboardButton{
				WebApp: &models.WebAppInfo{URL: u},
			}),
		}
	}
	return []models.InlineKeyboardButton{
		tm.WithButton(lang, "connect_button", models.InlineKeyboardButton{
			CallbackData: callbackConnect + inlineQuerySuffix,
		}),
	}
}
