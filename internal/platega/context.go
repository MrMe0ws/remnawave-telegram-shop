package platega

import "context"

type ctxKey string

// CtxKeyReturnURL — если задан, подставляется в Return/FailedUrl вместо config.BotURL() (web-кабинет).
const CtxKeyReturnURL ctxKey = "platega.return_url"

// ReturnURLFromCtx возвращает URL возврата из контекста или пустую строку.
func ReturnURLFromCtx(ctx context.Context) string {
	if v, ok := ctx.Value(CtxKeyReturnURL).(string); ok {
		return v
	}
	return ""
}
