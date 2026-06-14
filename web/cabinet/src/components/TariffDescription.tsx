import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

import { cn } from '@/lib/utils'

function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') return input
  const el = document.createElement('textarea')
  el.innerHTML = input
  return el.value
}

/** Убирает tg-emoji и прочие нестандартные теги, оставляя содержимое. */
export function preprocessTelegramMarkup(input: string): string {
  return decodeHtmlEntities(String(input))
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
}

const descriptionClassName =
  '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:whitespace-pre-line [&_blockquote]:break-words [&_i]:italic [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-1 [&_p]:whitespace-pre-line [&_li]:whitespace-pre-line'

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
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}
