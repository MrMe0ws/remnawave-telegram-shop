package broadcast

// RecipientButtons — inline-кнопки под сообщением рассылки (как в TG-админке).
// Links — ключи разделов кабинета (см. CabinetLinks); они рендерятся как web_app-кнопки.
type RecipientButtons struct {
	Buy      bool
	MainMenu bool
	Promo    bool
	Connect  bool
	Links    []string
}

// IsEmpty — под сообщением не будет ни одной кнопки.
func (f RecipientButtons) IsEmpty() bool {
	return !f.Buy && !f.MainMenu && !f.Promo && !f.Connect && len(f.Links) == 0
}

// Media — прикреплённое изображение (file_id из Telegram Bot API).
type Media struct {
	FileID  string
	AsPhoto bool
}

// SendResult — итог массовой отправки.
type SendResult struct {
	TotalUsers  int
	SentCount   int
	FailedCount int
}
