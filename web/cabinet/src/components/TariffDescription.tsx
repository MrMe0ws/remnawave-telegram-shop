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

/** Убирает tg-emoji и прочие нестандартные теги, оставляя содержимое. Табы → 4 пробела. */
export function preprocessTelegramMarkup(input: string): string {
  return decodeHtmlEntities(String(input))
    .replace(/\r\n/g, '\n')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/\t/g, '    ')
}

/** pre-wrap — пробелы/табы; remark-breaks — одиночный Enter; mb-3 между абзацами. */
const descriptionClassName =
  '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:whitespace-pre-wrap [&_blockquote]:break-words [&_i]:italic [&_li]:ml-4 [&_li]:mb-2 [&_li]:list-disc [&_li]:whitespace-pre-wrap [&_li:last-child]:mb-0 [&_p]:mb-3 [&_p]:whitespace-pre-wrap [&_p:last-child]:mb-0'

export function TariffDescription({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const processed = preprocessTelegramMarkup(text)
  if (!processed.trim()) return null

  return (
    <div className={cn(descriptionClassName, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
