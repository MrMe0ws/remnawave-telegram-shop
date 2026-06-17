import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

import { cn } from '@/lib/utils'

function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') return input
  const el = document.createElement('textarea')
  el.innerHTML = input
  return el.value
}

/** Типичная HTML-разметка Telegram в описаниях тарифов. */
const TELEGRAM_HTML_TAG =
  /<(a|b|strong|i|em|u|s|code|pre|blockquote|span)\b/i

function hasTelegramHtml(text: string): boolean {
  return TELEGRAM_HTML_TAG.test(text)
}

export type TariffDescriptionMode = 'html' | 'markdown'

/**
 * Подготовка текста из админки / бота.
 * HTML (как в TG): каждый \n → <br> (1 Enter = новая строка, несколько Enter = больше зазор).
 * Чистый markdown: переносы оставляем remark-breaks + абзацы.
 */
export function preprocessTelegramMarkup(input: string): {
  text: string
  mode: TariffDescriptionMode
} {
  const normalized = decodeHtmlEntities(String(input))
    .replace(/\r\n/g, '\n')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/\t/g, '    ')

  if (hasTelegramHtml(normalized)) {
    return {
      text: normalized.replace(/\n/g, '<br>'),
      mode: 'html',
    }
  }

  return { text: normalized, mode: 'markdown' }
}

const descriptionClassName =
  '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:whitespace-pre-wrap [&_blockquote]:break-words [&_i]:italic [&_li]:ml-4 [&_li]:mb-1 [&_li]:list-disc [&_li]:whitespace-pre-wrap [&_li:last-child]:mb-0 [&_p]:mb-0 [&_p]:whitespace-pre-wrap [&_p]:leading-relaxed [&_p+p]:mt-2'

export function TariffDescription({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const { text: processed, mode } = preprocessTelegramMarkup(text)
  if (!processed.trim()) return null

  const remarkPlugins = mode === 'html' ? [remarkGfm] : [remarkGfm, remarkBreaks]

  return (
    <div className={cn(descriptionClassName, className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}
