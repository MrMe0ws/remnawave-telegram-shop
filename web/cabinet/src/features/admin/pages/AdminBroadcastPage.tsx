import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, AlertTriangle, Eye, ImagePlus, Megaphone, PanelBottom, Send, X } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminBroadcastMediaKind } from '@/lib/types/admin'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { AdminBroadcastMessagePreview } from '../components/AdminBroadcastMessagePreview'
import { AdminSelect } from '../components/AdminSelect'
import { BroadcastTextEditor } from '../components/BroadcastTextEditor'
import { BroadcastAudienceSelector } from '../components/BroadcastAudienceSelector'
import {
  BroadcastButtonsPicker,
  type BroadcastButtonsState,
} from '../components/BroadcastButtonsPicker'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { BROADCAST_LINK_KEYS, broadcastLinkLabelKey } from '../utils/broadcastLinks'
import { telegramTextLength } from '../utils/telegramHtml'

interface AudienceItem {
  audience: string
  label: string
  count: number
}

interface UploadedMedia {
  file_id: string
  kind: AdminBroadcastMediaKind
  previewUrl: string
  name: string
}

/**
 * Лимиты Telegram на длину текста. Подпись к вложению короче обычного
 * сообщения вчетверо, и узнавать об этом на отправке — худший момент.
 */
const LIMIT_TEXT = 4096
const LIMIT_CAPTION = 1024

const defaultButtons: BroadcastButtonsState = {
  buy: false,
  connect: false,
  promo: false,
  main_menu: false,
  links: [],
}

function useAudiences() {
  return useQuery<{ audiences: AudienceItem[] }>({
    queryKey: ['admin-broadcast-audiences'],
    queryFn: () => api.adminBroadcastAudiences(),
  })
}

function useBroadcastTariffs(enabled: boolean) {
  return useQuery<{ tariffs: { id: number; name: string; slug: string }[] }>({
    queryKey: ['admin-broadcast-tariffs'],
    queryFn: () => api.adminBroadcastTariffs(),
    enabled,
  })
}

/**
 * Число получателей считает сервер: у платных сегментов оно зависит от фильтра
 * по тарифу, и цифра из списка аудиторий там уже неверна. Запрос идёт сам при
 * смене выбора — раньше для этого была отдельная кнопка «Предпросмотр», и до
 * подтверждения отправки админ не знал, скольким людям уйдёт сообщение.
 */
function useRecipientCount(audience: string, tariffId: number | null) {
  return useQuery({
    queryKey: ['admin-broadcast-count', audience, tariffId],
    queryFn: () => api.adminBroadcastPreview({ audience, tariff_id: tariffId }),
    staleTime: 30_000,
  })
}

export default function AdminBroadcastPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: bootstrap } = useAdminBootstrap()
  const { data, isLoading } = useAudiences()

  const [selectedAudience, setSelectedAudience] = useState('active_all')
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)
  const [html, setHtml] = useState('')
  const [buttons, setButtons] = useState<BroadcastButtonsState>(defaultButtons)
  const [media, setMedia] = useState<UploadedMedia | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'compose' | 'preview'>('compose')
  const [resetKey, setResetKey] = useState(0)

  const isTariffsMode = bootstrap?.sales_mode === 'tariffs'
  const { data: tariffsData } = useBroadcastTariffs(isTariffsMode)
  const { data: countData, isFetching: countLoading } = useRecipientCount(selectedAudience, selectedTariff)

  const recipientCount = countData?.recipient_count ?? null
  const hasContent = Boolean(html.trim() || media)
  const limit = media ? LIMIT_CAPTION : LIMIT_TEXT
  const length = useMemo(() => telegramTextLength(html), [html])
  const overLimit = length > limit

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.adminBroadcastUploadMedia(file),
    onSuccess: (res, file) => {
      const previewUrl = URL.createObjectURL(file)
      setMedia((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return { file_id: res.file_id, kind: res.kind, previewUrl, name: file.name }
      })
      setSendSuccess(null)
    },
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      api.adminBroadcastSend({
        audience: selectedAudience,
        tariff_id: selectedTariff,
        text: html,
        buttons,
        media: media ? { file_id: media.file_id, kind: media.kind } : null,
      }),
    onSuccess: (res) => {
      setConfirmOpen(false)
      setHtml('')
      setResetKey((v) => v + 1)
      setButtons(defaultButtons)
      if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
      setMedia(null)
      setSendSuccess(t('admin.broadcast.started', { count: res.recipient_count }))
      queryClient.invalidateQueries({ queryKey: ['admin-broadcast-audiences'] })
    },
    onError: () => setConfirmOpen(false),
  })

  const audienceLabels: Record<string, string> = {
    all: t('admin.broadcast.audience.all'),
    test_broadcast: t('admin.broadcast.audience.testBroadcast', 'Test Broadcast'),
    active_all: t('admin.broadcast.audience.activeAll'),
    active_paid: t('admin.broadcast.audience.activePaid'),
    active_trial: t('admin.broadcast.audience.activeTrial'),
    inactive_all: t('admin.broadcast.audience.inactiveAll'),
    inactive_paid: t('admin.broadcast.audience.inactivePaid'),
    inactive_trial: t('admin.broadcast.audience.inactiveTrial'),
  }

  const selectedButtonLabels = [
    buttons.buy ? t('admin.broadcast.buttons.buy') : null,
    buttons.connect ? t('admin.broadcast.buttons.connect') : null,
    ...BROADCAST_LINK_KEYS.filter((key) => buttons.links.includes(key)).map((key) =>
      t(broadcastLinkLabelKey(key)),
    ),
    buttons.promo ? t('admin.broadcast.buttons.promo') : null,
    buttons.main_menu ? t('admin.broadcast.buttons.mainMenu') : null,
  ].filter(Boolean) as string[]

  function clearMedia() {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
    setMedia(null)
    setSendSuccess(null)
  }

  const canSend = hasContent && !overLimit && !sendMutation.isPending

  const preview = (
    <div className="rounded-lg border border-border/50 bg-card">
      <h3 className="flex items-center gap-2 border-b border-border/50 px-4 py-3 text-sm font-semibold">
        <Eye className="size-4 text-muted-foreground" />
        {t('admin.broadcast.previewTitle')}
      </h3>
      <div className="space-y-3 p-4">
        <AdminBroadcastMessagePreview
          html={html}
          mediaUrl={media?.previewUrl}
          mediaKind={media?.kind}
          buttons={buttons}
        />

        <dl className="space-y-1 text-sm">
          <SummaryRow label={t('admin.broadcast.audienceTitle')}>
            {audienceLabels[selectedAudience] ?? selectedAudience}
          </SummaryRow>
          <SummaryRow label={t('admin.broadcast.recipients')}>
            {countLoading || recipientCount === null ? '…' : recipientCount}
          </SummaryRow>
          <SummaryRow label={t('admin.broadcast.buttonsTitle')}>
            {selectedButtonLabels.length || t('admin.broadcast.buttons.none')}
          </SummaryRow>
        </dl>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!canSend}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-4" />
          {t('admin.broadcast.send')}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          {t('admin.broadcast.previewButtonsHint')}
        </p>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="space-y-5 pb-20 lg:pb-0">
        <AdminPageHeader
          icon={Megaphone}
          title={t('admin.broadcast.title')}
          subtitle={t('admin.broadcast.subtitle')}
          accent="indigo"
        />

        {sendSuccess && (
          <AdminFeedback mode="inline" feedback={{ type: 'success', message: sendSuccess }} />
        )}

        {/* На узком экране форма и предпросмотр — две вкладки: иначе за
            результатом приходится листать через весь экран и обратно. */}
        <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/40 p-1 lg:hidden">
          {(['compose', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                mobileTab === tab
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'compose' ? t('admin.broadcast.compose') : t('admin.broadcast.preview')}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className={cn('space-y-4', mobileTab === 'preview' && 'hidden lg:block')}>
            <BroadcastAudienceSelector
              audiences={data?.audiences ?? []}
              isLoading={isLoading}
              selectedAudience={selectedAudience}
              onSelectAudience={(audience) => {
                setSelectedAudience(audience)
                setSelectedTariff(null)
                setSendSuccess(null)
              }}
              audienceLabels={audienceLabels}
            >
              {isTariffsMode &&
                (selectedAudience === 'active_paid' || selectedAudience === 'inactive_paid') && (
                  <>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      {t('admin.broadcast.filterTariff')}
                    </label>
                    <AdminSelect<number>
                      value={selectedTariff}
                      allowEmpty
                      emptyLabel={t('admin.broadcast.allTariffs')}
                      placeholder={t('admin.broadcast.allTariffs')}
                      ariaLabel={t('admin.broadcast.filterTariff')}
                      options={(tariffsData?.tariffs ?? []).map((tariff) => ({
                        value: tariff.id,
                        label: tariff.name,
                      }))}
                      onChange={setSelectedTariff}
                    />
                  </>
                )}
            </BroadcastAudienceSelector>

            {/* Сообщение */}
            <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] text-muted-foreground">
                  2
                </span>
                <span className="text-sm font-semibold">{t('admin.broadcast.compose')}</span>
                <span
                  className={cn(
                    'ml-auto text-xs tabular-nums',
                    overLimit ? 'font-semibold text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {length} / {limit}
                </span>
              </div>

              <BroadcastTextEditor
                resetKey={resetKey}
                onChange={(next) => {
                  setHtml(next)
                  setSendSuccess(null)
                }}
                placeholder={t('admin.broadcast.placeholder')}
              />

              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-4 py-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadMutation.mutate(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <ImagePlus className="size-4" />
                  {uploadMutation.isPending
                    ? t('admin.broadcast.uploadingMedia')
                    : t('admin.broadcast.attachMedia')}
                </button>
              </div>

              {/* Про MP4 сказано до отправки, а не после: WebM и MOV Telegram
                  видео не считает и молча кладёт их файлом. */}
              <p className="flex items-start gap-2 px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <span>{t('admin.broadcast.mp4Hint')}</span>
              </p>

              {uploadMutation.isError && (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{formatAdminApiError(uploadMutation.error, t)}</span>
                </div>
              )}

              {media && (
                <div className="mx-4 mb-4 flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  {media.kind === 'video' ? (
                    <video src={media.previewUrl} className="size-16 rounded-md object-cover" muted playsInline />
                  ) : (
                    <img src={media.previewUrl} alt={media.name} className="size-16 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{media.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {media.kind === 'video'
                        ? t('admin.broadcast.videoAttached')
                        : t('admin.broadcast.photoAttached')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={t('admin.broadcast.removePhoto')}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] text-muted-foreground">
                  3
                </span>
                <PanelBottom className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-semibold">{t('admin.broadcast.buttonsTitle')}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedButtonLabels.length
                    ? t('admin.broadcast.linksSelected', { count: selectedButtonLabels.length })
                    : t('admin.broadcast.buttons.none')}
                </span>
              </div>
              <div className="p-4">
                <BroadcastButtonsPicker buttons={buttons} onChange={setButtons} />
              </div>
            </div>

            {sendMutation.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formatAdminApiError(sendMutation.error, t)}</span>
              </div>
            )}
          </div>

          <div
            className={cn(
              'lg:sticky lg:top-4',
              mobileTab === 'compose' && 'hidden lg:block',
            )}
          >
            {preview}
          </div>
        </div>
      </div>

      {/* Панель отправки на телефоне: кнопка всегда под рукой, а не в конце формы. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border/60 bg-card/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <span className="text-xs leading-tight text-muted-foreground">
          {t('admin.broadcast.recipients')}
          <b className="block text-base text-foreground tabular-nums">
            {countLoading || recipientCount === null ? '…' : recipientCount}
          </b>
        </span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!canSend}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-4" />
          {t('admin.broadcast.send')}
        </button>
      </div>

      <AdminConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => sendMutation.mutate()}
        title={t('admin.broadcast.confirmSend')}
        confirmLabel={t('admin.broadcast.send')}
        loading={sendMutation.isPending}
        icon={Megaphone}
        message={
          /*
           * Строками, а не одним предложением: раньше здесь шло слитно
           * «Аудитория: … Получателей: … Кнопки: …», и проверить перед
           * отправкой на пять тысяч человек было нечего — текст не читался.
           */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('admin.broadcast.confirmLead')}</p>
            <dl className="divide-y divide-border/60 rounded-lg border border-border/60">
              <ConfirmRow label={t('admin.broadcast.audienceTitle')}>
                {audienceLabels[selectedAudience] ?? selectedAudience}
              </ConfirmRow>
              <ConfirmRow label={t('admin.broadcast.recipients')}>
                {recipientCount === null ? '…' : recipientCount}
              </ConfirmRow>
              <ConfirmRow label={t('admin.broadcast.buttonsTitle')}>
                {selectedButtonLabels.length
                  ? selectedButtonLabels.join(', ')
                  : t('admin.broadcast.buttons.none')}
              </ConfirmRow>
              <ConfirmRow label={t('admin.broadcast.attachment')}>
                {media ? (
                  <>
                    {media.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {media.kind === 'video'
                        ? t('admin.broadcast.videoAttached')
                        : t('admin.broadcast.photoAttached')}
                    </span>
                  </>
                ) : (
                  t('admin.broadcast.attachmentNone')
                )}
              </ConfirmRow>
            </dl>
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs leading-relaxed">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span>{t('admin.broadcast.confirmWebOnly')}</span>
            </p>
          </div>
        }
      />
    </AdminLayout>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="min-w-[92px] shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-semibold">{children}</dd>
    </div>
  )
}

function ConfirmRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-semibold">{children}</dd>
    </div>
  )
}
