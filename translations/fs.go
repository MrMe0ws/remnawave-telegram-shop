// Package translationfs отдаёт тексты бота и кабинета, вшитые в бинарник.
//
// Нужны как база: том ./translations на сервере часто отстаёт от образа
// (его обновляют вручную, git pull), и без вшитых файлов новые ключи
// показывались бы сырыми идентификаторами.
package translationfs

import "embed"

// FS — ru/en (+ admin_*) бота и cabinet/FAQ.json, cabinet/app-config.json из релиза.
//
//go:embed *.json
//go:embed cabinet/FAQ.json
//go:embed cabinet/app-config.json
var FS embed.FS
