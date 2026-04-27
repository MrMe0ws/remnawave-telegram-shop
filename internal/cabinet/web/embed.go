// Package web содержит встроенный (через go:embed) бандл SPA-кабинета.
//
// Каталог ./dist заполняется при сборке фронтенда: из web/cabinet выполнить npm run build
// (vite кладёт артефакты сюда). В рантайме бот отдаёт именно встроенный снимок dist —
// если UI «не видит» новые поля API, чаще всего забыли пересобрать SPA и пересобрать бинарь.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var spa embed.FS

// FS возвращает корень встроенного SPA (уже обрезанный до dist/),
// пригодный для http.FileServer / fs.Sub.
func FS() (fs.FS, error) {
	return fs.Sub(spa, "dist")
}
