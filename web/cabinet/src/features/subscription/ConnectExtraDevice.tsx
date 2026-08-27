import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, ChevronDown, Copy, MonitorSmartphone, Plus, Send, X } from 'lucide-react'

import { QrCode } from '@/components/QrCode'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'
import { api, ApiError } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

/**
 * Перенос подписки на устройство, с которого в кабинет не зайти.
 *
 * Карточка заменила прежнюю «Ссылка подписки». Та показывала сырой URL и
 * молчала о том, зачем он: пользователи видели ссылку, не понимали, что ею
 * подключается второй телефон или компьютер, и шли в поддержку. Здесь на
 * первом плане задача («подключить ещё устройство»), а транспорт — QR и
 * пересылка приглашения — спрятан внутрь.
 *
 * Сырая ссылка никуда не делась: она под раскрывашкой «Настроить вручную»,
 * для случая, когда установка по гайду не сработала и подписку вставляют в
 * приложение руками.
 */
export function ConnectExtraDeviceCard({
  onOpen,
  inactive,
}: {
  onOpen: () => void
  inactive?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card className="subscription-feature-card">
      {/* Отступ на кнопке, а не на CardContent: суммарно те же 1rem, но
          подсветка при наведении заливает карточку целиком, а не прямоугольник
          внутри неё. */}
      <CardContent className="p-0">
        <button
          type="button"
          disabled={inactive}
          onClick={onOpen}
          className="cabinet-row flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="cabinet-icon-box inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
            <MonitorSmartphone size={16} className="text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('connectInvite.cardTitle')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('connectInvite.cardSubtitle')}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  )
}

/**
 * Пустой слот в списке устройств: «+ Добавить устройство».
 *
 * Именно на счётчик «1 / 2» смотрит человек, задавшийся вопросом, как занять
 * второй слот, — поэтому ответ стоит прямо там. Вес намеренно слабый,
 * пунктирная строка читается продолжением списка, а не третьим призывом к
 * действию рядом с двумя имеющимися.
 */
export function AddDeviceSlot({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-border">
        <Plus size={15} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{t('connectInvite.addDeviceSlot')}</span>
    </button>
  )
}

export function ConnectInviteModal({
  subscriptionLink,
  onClose,
}: {
  subscriptionLink: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const [manualOpen, setManualOpen] = useState(false)
  const { state: inviteCopyState, copy: copyInvite } = useCopyToClipboard()
  const { state: linkCopyState, copy: copyLink } = useCopyToClipboard()

  // Приглашение запрашиваем только при открытии модалки: выпуск токена — не
  // то, что стоит делать на каждый показ страницы подписки.
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['connect-invite'],
    queryFn: () => api.connectInvite(),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const inviteUrl = data?.url || ''
  const shareText = t('connectInvite.shareText', { url: inviteUrl })
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function share() {
    if (!inviteUrl) return
    if (canShare) {
      try {
        await navigator.share({ text: shareText })
        return
      } catch (e) {
        // Закрытый системный шит — это отказ, а не сбой: копировать в ответ на
        // него нельзя, иначе отмена превращается в «скопировано».
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Остальное (share запрещён политикой, нет обработчика) — падаем в
        // копирование, оно решает ту же задачу.
      }
    }
    void copyInvite(shareText)
  }

  const noSubscription = error instanceof ApiError && error.status === 409

  if (typeof document === 'undefined') return null

  return createPortal(
    // На узком экране — лист снизу: до верхнего края окна большим пальцем не
    // дотянуться, а модалка по центру там ещё и обрезается клавиатурой. На
    // sm+ остаётся обычный центрированный диалог.
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('connectInvite.cardTitle')}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] backdrop-blur-sm sm:max-h-[90vh] sm:rounded-2xl sm:p-5 sm:pb-5"
      >
        {/* Полоска-ручка: на мобиле она объясняет, что это лист, а не экран. */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">{t('connectInvite.modalTitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <InviteSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {noSubscription ? t('connectInvite.noSubscription') : t('errors.unknown')}
            </p>
            {!noSubscription && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                loading={isFetching}
                onClick={() => void refetch()}
              >
                {t('errors.retry')}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Шаг 1 — устройство рядом: камера открывает страницу с инструкцией. */}
            <div className="flex flex-col items-center rounded-xl bg-muted/30 px-3 py-4">
              <div className="rounded-xl bg-white p-2.5">
                <QrCode value={inviteUrl} size={196} title={t('connectInvite.qrAlt')} />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('connectInvite.qrHint')}
              </p>
            </div>

            {/* Шаг 2 — устройство не рядом: приглашение уезжает текстом. */}
            <div className="mt-3 space-y-2">
              <Button type="button" className="w-full gap-2" onClick={() => void share()}>
                {inviteCopyState === 'done' ? <Check size={15} /> : <Send size={15} />}
                {inviteCopyState === 'done'
                  ? t('connectInvite.inviteCopied')
                  : canShare
                    ? t('connectInvite.share')
                    : t('connectInvite.copyInvite')}
              </Button>
              <p className="text-center text-[11px] leading-4 text-muted-foreground">
                {t('connectInvite.shareHint')}
              </p>
            </div>

            {data?.expires_at && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                {t('connectInvite.expiresAt', { date: formatDate(data.expires_at, lang) })}
              </p>
            )}
          </>
        )}

        {/* Сырая ссылка подписки — для ручной вставки в приложение, когда гайд
            не помог. Свёрнута: рядовому пользователю она ничего не говорит. */}
        {subscriptionLink && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              aria-expanded={manualOpen}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('connectInvite.manualToggle')}
              <ChevronDown size={14} className={cn('transition-transform', manualOpen && 'rotate-180')} />
            </button>
            {manualOpen && (
              <div className="mt-2.5">
                <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
                  {t('connectInvite.manualHint')}
                </p>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 select-all truncate rounded-lg bg-muted/70 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {subscriptionLink}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => void copyLink(subscriptionLink)}
                  >
                    {linkCopyState === 'done' ? (
                      <>
                        <Check size={14} className="text-primary" />
                        {t('subscriptionPage.copied')}
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        {t('subscriptionPage.copyLink')}
                      </>
                    )}
                  </Button>
                </div>
                {linkCopyState === 'failed' && (
                  <p className="mt-2 text-xs text-destructive">{t('common.copyFailed')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function InviteSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 px-3 py-4">
        <Skeleton className="size-[196px] rounded-xl" />
        <Skeleton className="mt-3 h-3 w-48" />
      </div>
      <Skeleton className="mt-3 h-10 w-full rounded-lg" />
    </div>
  )
}
