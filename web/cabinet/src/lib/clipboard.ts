/**
 * Копирование в буфер обмена с фоллбэком.
 *
 * `navigator.clipboard` есть не везде: он требует secure context и в WebView
 * Telegram на части Android-устройств просто отсутствует. Прямой вызов там
 * бросает исключение — вызывающий код не показывал «Скопировано», и нажатие
 * выглядело как «кнопка не работает». Для кабинета это критично: копирование
 * ссылки подписки — основное действие всего интерфейса.
 *
 * Поэтому: сначала штатный API, затем скрытая textarea + execCommand. Функция
 * никогда не бросает — возвращает признак успеха, и вызывающий сам решает,
 * показать «Скопировано» или подсказку скопировать вручную.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = text?.trim()
  if (!value) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Недоступен или запрещён — пробуем legacy-путь ниже.
  }

  return copyViaExecCommand(value)
}

function copyViaExecCommand(value: string): boolean {
  try {
    const el = document.createElement('textarea')
    el.value = value
    // Вне экрана, но в потоке: display:none и visibility:hidden ломают выделение.
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '0'
    el.style.left = '0'
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
