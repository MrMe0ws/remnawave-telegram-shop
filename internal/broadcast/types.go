package broadcast

// RecipientButtons — inline-кнопки под сообщением рассылки (как в TG-админке).
type RecipientButtons struct {
	Buy      bool
	MainMenu bool
	Promo    bool
	Connect  bool
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
