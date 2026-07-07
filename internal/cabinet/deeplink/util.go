package deeplink

import (
	"bytes"
	"encoding/json"
	"strings"
)

// jsonStringNoHTMLEscape кодирует строку в JSON-литерал без HTML-эскейпинга
// (`<`, `>`, `&`), чтобы совпадать с поведением JSON.stringify в JS-клиентах.
func jsonStringNoHTMLEscape(s string) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(s); err != nil {
		return "", err
	}
	return strings.TrimRight(buf.String(), "\n"), nil
}
