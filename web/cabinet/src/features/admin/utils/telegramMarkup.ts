/**
 * Разметка описания тарифа.
 *
 * Описание уходит в Telegram с parse_mode=HTML, поэтому панель форматирования
 * вставляет именно HTML-теги Telegram, а не markdown. Разница принципиальна:
 * превью в кабинете рендерит ReactMarkdown (см. TariffDescription), поэтому
 * `**жирный**` там отрисуется жирным, а в Telegram придёт звёздочками как есть.
 */

export type TelegramMarkupActionId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'link'
  | 'code'
  | 'quote'
  | 'spoiler'

const MARKUP_PAIRS: Record<TelegramMarkupActionId, { open: string; close: string }> = {
  bold: { open: '<b>', close: '</b>' },
  italic: { open: '<i>', close: '</i>' },
  underline: { open: '<u>', close: '</u>' },
  strike: { open: '<s>', close: '</s>' },
  link: { open: '<a href="">', close: '</a>' },
  code: { open: '<code>', close: '</code>' },
  quote: { open: '<blockquote>', close: '</blockquote>' },
  spoiler: { open: '<tg-spoiler>', close: '</tg-spoiler>' },
}

export interface MarkupApplyResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

/**
 * Оборачивает выделение в теги; повторное нажатие на уже обёрнутом тексте
 * теги снимает — чтобы не копились `<b><b>…</b></b>`.
 */
export function applyTelegramMarkup(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: TelegramMarkupActionId,
): MarkupApplyResult {
  const { open, close } = MARKUP_PAIRS[action]
  const before = value.slice(0, selectionStart)
  const selected = value.slice(selectionStart, selectionEnd)
  const after = value.slice(selectionEnd)

  // Теги стоят вокруг выделения — снимаем их.
  if (before.endsWith(open) && after.startsWith(close)) {
    const start = selectionStart - open.length
    return {
      value: before.slice(0, before.length - open.length) + selected + after.slice(close.length),
      selectionStart: start,
      selectionEnd: start + selected.length,
    }
  }

  // Теги попали внутрь выделения — тоже снимаем.
  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    const inner = selected.slice(open.length, selected.length - close.length)
    return {
      value: before + inner + after,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    }
  }

  const next = before + open + selected + close + after

  // Для ссылки курсор ставим внутрь href="" — админ сразу вставляет URL.
  if (action === 'link') {
    const caret = before.length + open.length - 2
    return { value: next, selectionStart: caret, selectionEnd: caret }
  }

  const start = before.length + open.length
  return { value: next, selectionStart: start, selectionEnd: start + selected.length }
}

export type UnsupportedMarkdownId = 'bold' | 'underline' | 'heading' | 'link' | 'code'

// Списки через `- ` сюда намеренно не входят: превью делает из них <li>, а
// Telegram показывает дефис — выглядит одинаково уместно в обоих местах.
const UNSUPPORTED_PATTERNS: { id: UnsupportedMarkdownId; re: RegExp }[] = [
  { id: 'bold', re: /\*\*[^*\n]+\*\*/ },
  { id: 'underline', re: /__[^_\n]+__/ },
  { id: 'heading', re: /^#{1,6}\s+\S/m },
  { id: 'link', re: /\[[^\]\n]+\]\([^)\n]+\)/ },
  { id: 'code', re: /`[^`\n]+`/ },
]

/** Markdown, который превью отрендерит, а Telegram покажет как есть. */
export function detectUnsupportedMarkdown(text: string): UnsupportedMarkdownId[] {
  if (!text) return []
  return UNSUPPORTED_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
}
