import { useTranslation } from 'react-i18next'

interface BroadcastButtons {
  buy: boolean
  connect: boolean
  promo: boolean
  main_menu: boolean
}

interface AdminBroadcastMessagePreviewProps {
  text: string
  mediaUrl?: string | null
  buttons: BroadcastButtons
  audienceLabel: string
  recipientCount: number
}

export function AdminBroadcastMessagePreview({
  text,
  mediaUrl,
  buttons,
  audienceLabel,
  recipientCount,
}: AdminBroadcastMessagePreviewProps) {
  const { t } = useTranslation()

  const inlineButtons = [
    buttons.buy ? t('admin.broadcast.buttons.buy') : null,
    buttons.connect ? t('admin.broadcast.buttons.connect') : null,
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
          {mediaUrl && (
            <img
              src={mediaUrl}
              alt=""
              className="max-h-80 w-full object-cover"
            />
          )}
          {caption && (
            <p className="whitespace-pre-wrap px-3 py-2.5 text-[15px] leading-snug">
              {caption}
            </p>
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
