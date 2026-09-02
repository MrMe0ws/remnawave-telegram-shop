package heleket

import "context"

type ctxKey string

// CtxKeyReturnURL — куда вернуть плательщика после оплаты. Задаёт web-кабинет,
// чтобы после Heleket человек попал обратно в кабинет, а не в бота.
const CtxKeyReturnURL ctxKey = "heleket.return_url"

// ReturnURLFromCtx возвращает URL возврата из контекста или пустую строку.
func ReturnURLFromCtx(ctx context.Context) string {
	if v, ok := ctx.Value(CtxKeyReturnURL).(string); ok {
		return v
	}
	return ""
}
