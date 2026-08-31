/**
 * Разбор разметки Telegram для предпросмотра рассылки.
 *
 * Текст рассылки уходит с parse_mode=HTML, и предпросмотр обязан показывать
 * его так же, как увидит получатель. Показывать сырые «<b>…</b>» бессмысленно:
 * ради этого предпросмотр и открывают.
 *
 * Вставлять текст админа в разметку страницы как есть нельзя, даже в админке:
 * <script> или onerror у картинки выполнятся в сессии администратора. Поэтому
 * сначала экранируем весь текст целиком, а потом возвращаем к жизни только те
 * теги, которые понимает сам Telegram, — по белому списку и с проверкой ссылок.
 * Всё остальное так и остаётся видимым текстом, ровно как это сделает Bot API.
 */

/** Теги без атрибутов, которые Telegram разбирает в форматирование. */
const SIMPLE_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'code',
  'pre',
  'blockquote',
  'tg-spoiler',
] as const

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ссылки только http(s) и tg: — javascript:/data: в предпросмотр не пускаем. */
function safeHref(raw: string): string | null {
  const url = raw.trim()
  if (/^https?:\/\//i.test(url) || /^tg:\/\//i.test(url)) return url
  return null
}

export function renderTelegramHtml(text: string): string {
  let out = escapeHtml(text)

  for (const tag of SIMPLE_TAGS) {
    // Экранированный вид: &lt;b&gt; — его и разворачиваем обратно.
    out = out.replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
    out = out.replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`)
  }

  out = out.replace(/&lt;a href=&quot;([^&]*)&quot;&gt;/gi, (match, href: string) => {
    const safe = safeHref(href)
    return safe ? `<a href="${escapeHtml(safe)}" rel="noreferrer">` : match
  })
  out = out.replace(/&lt;\/a&gt;/gi, '</a>')

  return out
}
