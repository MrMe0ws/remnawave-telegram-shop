import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Megaphone, Send, Users, Eye, AlertCircle, X, MessageSquare, PanelBottom } from 'lucide-react'
import { api } from '@/lib/api'
import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { AdminBroadcastMessagePreview } from '../components/AdminBroadcastMessagePreview'
import { AdminCheckboxField } from '../components/AdminCheckbox'
import { AdminSelect } from '../components/AdminSelect'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'
import { formatAdminApiError } from '../utils/formatAdminApiError'

interface AudienceItem {
  audience: string
  label: string
  count: number
}

interface BroadcastButtons {
  buy: boolean
  connect: boolean
  promo: boolean
  main_menu: boolean
}

interface UploadedMedia {
  file_id: string
  as_photo: boolean
  previewUrl: string
  name: string
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

const defaultButtons: BroadcastButtons = {
  buy: false,
  connect: false,
  promo: false,
  main_menu: false,
}

export default function AdminBroadcastPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: bootstrap } = useAdminBootstrap()
  const { data, isLoading } = useAudiences()
  const [selectedAudience, setSelectedAudience] = useState('all')
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [buttons, setButtons] = useState<BroadcastButtons>(defaultButtons)
  const [media, setMedia] = useState<UploadedMedia | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)

  const isTariffsMode = bootstrap?.sales_mode === 'tariffs'
  const hasContent = Boolean(text.trim() || media)

  const { data: tariffsData } = useBroadcastTariffs(isTariffsMode)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.adminBroadcastUploadMedia(file),
    onSuccess: (res, file) => {
      const previewUrl = URL.createObjectURL(file)
      setMedia((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return {
          file_id: res.file_id,
          as_photo: res.as_photo,
          previewUrl,
          name: file.name,
        }
      })
      setPreviewCount(null)
      setPreviewVisible(false)
      setPreviewError(null)
      setSendSuccess(null)
    },
  })

  const previewMutation = useMutation({
    mutationFn: () =>
      api.adminBroadcastPreview({
        audience: selectedAudience,
        tariff_id: selectedTariff,
        text,
      }),
    onSuccess: (res) => {
      setPreviewCount(res.recipient_count)
      setPreviewVisible(true)
      setPreviewError(null)
    },
    onError: (err) => {
      setPreviewCount(null)
      setPreviewVisible(false)
      setPreviewError(formatAdminApiError(err, t))
    },
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      api.adminBroadcastSend({
        audience: selectedAudience,
        tariff_id: selectedTariff,
        text,
        buttons,
        media: media
          ? { file_id: media.file_id, as_photo: media.as_photo }
          : null,
      }),
    onSuccess: (res) => {
      setConfirmOpen(false)
      setText('')
      setButtons(defaultButtons)
      if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
      setMedia(null)
      setPreviewCount(null)
      setPreviewVisible(false)
      setSendSuccess(
        t('admin.broadcast.started', { count: res.recipient_count }),
      )
      queryClient.invalidateQueries({ queryKey: ['admin-broadcast-audiences'] })
    },
    onError: () => {
      setConfirmOpen(false)
    },
  })

  const audienceLabels: Record<string, string> = {
    all: t('admin.broadcast.audience.all'),
    active_all: t('admin.broadcast.audience.activeAll'),
    active_paid: t('admin.broadcast.audience.activePaid'),
    active_trial: t('admin.broadcast.audience.activeTrial'),
    inactive_all: t('admin.broadcast.audience.inactiveAll'),
    inactive_paid: t('admin.broadcast.audience.inactivePaid'),
    inactive_trial: t('admin.broadcast.audience.inactiveTrial'),
  }

  const selectedButtonsSummary = [
    buttons.buy ? t('admin.broadcast.buttons.buy') : null,
    buttons.connect ? t('admin.broadcast.buttons.connect') : null,
    buttons.promo ? t('admin.broadcast.buttons.promo') : null,
    buttons.main_menu ? t('admin.broadcast.buttons.mainMenu') : null,
  ]
    .filter(Boolean)
    .join(', ')

  const confirmMessage = t('admin.broadcast.confirmMessage', {
    audience: audienceLabels[selectedAudience] ?? selectedAudience,
    count: previewCount ?? '…',
    buttons: selectedButtonsSummary || t('admin.broadcast.buttons.none'),
  })

  function invalidatePreview() {
    setPreviewCount(null)
    setPreviewVisible(false)
    setPreviewError(null)
  }

  function clearMedia() {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
    setMedia(null)
    invalidatePreview()
    setSendSuccess(null)
  }

  function handleFileChange(file: File | undefined) {
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          icon={Megaphone}
          title={t('admin.broadcast.title')}
          subtitle={t('admin.broadcast.subtitle')}
          accent="indigo"
        />

        {sendSuccess && (
          <AdminFeedback mode="inline" feedback={{ type: 'success', message: sendSuccess }} />
        )}

        {/* Audience segments */}
        <div className="rounded-lg border border-border/50 bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" />
            {t('admin.broadcast.audienceTitle')}
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <span className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data?.audiences?.map((aud) => (
                <button
                  key={aud.audience}
                  onClick={() => {
                    setSelectedAudience(aud.audience)
                    invalidatePreview()
                    setSendSuccess(null)
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selectedAudience === aud.audience
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 hover:border-border hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{audienceLabels[aud.audience] ?? aud.audience}</div>
                  <div className="text-xs text-muted-foreground">
                    {aud.count} {t('admin.broadcast.recipients')}
                  </div>
                </button>
              ))}
            </div>
          )}

          {isTariffsMode && (selectedAudience === 'active_paid' || selectedAudience === 'inactive_paid') && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('admin.broadcast.filterTariff')}</label>
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
                onChange={(id) => {
                  setSelectedTariff(id)
                  invalidatePreview()
                }}
              />
            </div>
          )}
        </div>

        {/* Compose */}
        <div className="rounded-lg border border-border/50 bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4" />
            {t('admin.broadcast.compose')}
          </h3>
          <textarea
            className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
            rows={5}
            placeholder={t('admin.broadcast.placeholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPreviewError(null)
              setSendSuccess(null)
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                handleFileChange(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              <ImagePlus className="size-4" />
              {uploadMutation.isPending
                ? t('admin.broadcast.uploadingPhoto')
                : t('admin.broadcast.attachPhoto')}
            </button>
          </div>

          {uploadMutation.isError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{formatAdminApiError(uploadMutation.error, t)}</span>
            </div>
          )}

          {media && (
            <div className="mt-3 flex items-start gap-3 rounded-md border border-border/50 bg-muted/30 p-3">
              <img
                src={media.previewUrl}
                alt={media.name}
                className="size-20 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{media.name}</p>
                <p className="text-xs text-muted-foreground">{t('admin.broadcast.photoAttached')}</p>
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

        {/* Inline buttons */}
        <div className="rounded-lg border border-border/50 bg-card p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
            <PanelBottom className="size-4" />
            {t('admin.broadcast.buttonsTitle')}
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">{t('admin.broadcast.buttonsHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <AdminCheckboxField
              checked={buttons.buy}
              onChange={(checked) => setButtons((prev) => ({ ...prev, buy: checked }))}
              label={t('admin.broadcast.buttons.buy')}
            />
            <AdminCheckboxField
              checked={buttons.connect}
              onChange={(checked) => setButtons((prev) => ({ ...prev, connect: checked }))}
              label={t('admin.broadcast.buttons.connect')}
            />
            <AdminCheckboxField
              checked={buttons.promo}
              onChange={(checked) => setButtons((prev) => ({ ...prev, promo: checked }))}
              label={t('admin.broadcast.buttons.promo')}
            />
            <AdminCheckboxField
              checked={buttons.main_menu}
              onChange={(checked) => setButtons((prev) => ({ ...prev, main_menu: checked }))}
              label={t('admin.broadcast.buttons.mainMenu')}
            />
          </div>
        </div>

        {previewVisible && previewCount !== null && (
          <div className="rounded-lg border border-border/50 bg-card p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Eye className="size-4" />
              {t('admin.broadcast.previewTitle')}
            </h3>
            <AdminBroadcastMessagePreview
              text={text}
              mediaUrl={media?.previewUrl}
              buttons={buttons}
              audienceLabel={audienceLabels[selectedAudience] ?? selectedAudience}
              recipientCount={previewCount}
            />
          </div>
        )}

        {/* Actions */}
        <div className="rounded-lg border border-border/50 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!hasContent) return
                previewMutation.mutate()
              }}
              disabled={!hasContent || previewMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              <Eye className="size-4" />
              {previewMutation.isPending ? t('admin.broadcast.previewLoading') : t('admin.broadcast.preview')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!hasContent) return
                if (previewCount === null) {
                  previewMutation.mutate(undefined, {
                    onSuccess: (res) => {
                      setPreviewCount(res.recipient_count)
                      setPreviewVisible(true)
                      setConfirmOpen(true)
                    },
                  })
                  return
                }
                setConfirmOpen(true)
              }}
              disabled={!hasContent || previewMutation.isPending || sendMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="size-4" />
              {t('admin.broadcast.send')}
            </button>
          </div>

          {sendMutation.isError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{formatAdminApiError(sendMutation.error, t)}</span>
            </div>
          )}

          {previewError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{previewError}</span>
            </div>
          )}
        </div>
      </div>

      <AdminConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => sendMutation.mutate()}
        title={t('admin.broadcast.confirmSend')}
        message={confirmMessage}
        confirmLabel={t('admin.broadcast.send')}
        loading={sendMutation.isPending}
        icon={Send}
        iconAccent="indigo"
      />
    </AdminLayout>
  )
}
