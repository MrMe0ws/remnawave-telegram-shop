import { useTranslation } from 'react-i18next'

import {
  BROADCAST_LINK_KEYS,
  broadcastLinkLabelKey,
  type BroadcastLinkKey,
} from '../utils/broadcastLinks'
import type { AdminBroadcastMediaKind } from '@/lib/types/admin'
import { renderTelegramHtml } from '../utils/telegramHtml'

interface BroadcastButtons {
  buy: boolean
  connect: boolean
  promo: boolean
  main_menu: boolean
  links: BroadcastLinkKey[]
}

interface AdminBroadcastMessagePreviewProps {
  text: string
  mediaUrl?: string | null
  mediaKind?: AdminBroadcastMediaKind
  buttons: BroadcastButtons
  audienceLabel: string
  recipientCount: number
}

export function AdminBroadcastMessagePreview({
  text,
  mediaUrl,
  mediaKind,
  buttons,
  audienceLabel,
  recipientCount,
}: AdminBroadcastMessagePreviewProps) {
  const { t } = useTranslation()

  // Порядок повторяет BuildReplyMarkup: купить, мой VPN, разделы кабинета, промокод, меню.
  const inlineButtons = [
    buttons.buy ? t('admin.broadcast.buttons.buy') : null,
    buttons.connect ? t('admin.broadcast.buttons.connect') : null,
    ...BROADCAST_LINK_KEYS.filter((key) => buttons.links.includes(key)).map((key) =>
      t(broadcastLinkLabelKey(key)),
    ),
    buttons.promo ? t('admin.broadcast.buttons.promo') : null,
    buttons.main_menu ? t('admin.broadcast.buttons.mainMenu') : null,
  ].filter(Boolean) as string[]

  const caption = text.trim()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{t('admin.broadcast.previewAudience', { audience: audienceLabel })}</span>
        <span>{t('admin.broadcast.previewCount', { count: recipientCount })}</span>
      </div>

      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#18222d] text-[#f5f5f5] shadow-sm dark:bg-[#0e1621]">
          {mediaUrl &&
            (mediaKind === 'video' ? (
              <video src={mediaUrl} className="max-h-80 w-full object-cover" controls muted playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="max-h-80 w-full object-cover" />
            ))}
          {caption && (
            /*
             * Разметку показываем разобранной, а не тегами: текст уходит
             * получателю с parse_mode=HTML, и превью с «<b>» на экране не
             * отвечало на вопрос, ради которого его открывают, — как это
             * будет выглядеть в чате.
             */
            <p
              className="whitespace-pre-wrap px-3 py-2.5 text-[15px] leading-snug [&_a]:text-[#6ab3f3] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-white/30 [&_blockquote]:pl-2 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px]"
              dangerouslySetInnerHTML={{ __html: renderTelegramHtml(caption) }}
            />
          )}
          {!mediaUrl && !caption && (
            <p className="px-3 py-2.5 text-sm text-white/50">{t('admin.broadcast.previewNoText')}</p>
          )}
          {inlineButtons.length > 0 && (
            <div className="space-y-1 border-t border-white/10 p-2">
              {inlineButtons.map((label) => (
                <div
                  key={label}
                  className="rounded-lg bg-[#2b5278]/80 px-3 py-2 text-center text-sm font-medium text-[#6ab3f3]"
                >
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('admin.broadcast.previewButtonsHint')}
        </p>
      </div>
    </div>
  )
}
