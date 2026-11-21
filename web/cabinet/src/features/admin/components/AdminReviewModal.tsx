import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { StarPicker } from '@/features/reviews/StarRating'
import {
  togglesFromVisibility,
  visibilityFromToggles,
  type AdminReview,
  type ReviewStatus,
} from '@/features/reviews/reviewTypes'
import { useCreateAdminReview, useUpdateAdminReview } from '../hooks/useAdminReviews'
import { AdminModal } from './AdminModal'
import { AdminModalSaveFooter } from './AdminModalSaveFooter'
import { AdminToggleSwitch } from './AdminToggleSwitch'

const STATUSES: ReviewStatus[] = ['published', 'pending', 'hidden']
const STATUS_KEY: Record<ReviewStatus, string> = {
  published: 'admin.reviews.status.published',
  pending: 'admin.reviews.status.pending',
  hidden: 'admin.reviews.status.hidden',
}

interface Props {
  open: boolean
  onClose: () => void
  /** Правим существующий отзыв. Без него — создаём от имени клиента customerId. */
  review?: AdminReview | null
  customerId?: number | null
  /** Сфокусироваться на поле «Ответ команды» (кнопка «Ответить»). */
  focusReply?: boolean
  onSaved?: (message: string) => void
}

const fieldClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/**
 * Окно отзыва: правка (статус, оценка, текст, ответ команды, как показывать автора)
 * и «отзыв от имени клиента». Правка текста тихая — клиент её не видит, а оригинал
 * хранится на сервере и показывается только здесь.
 */
export function AdminReviewModal({ open, onClose, review, customerId, focusReply, onSaved }: Props) {
  const { t } = useTranslation()
  const update = useUpdateAdminReview()
  const create = useCreateAdminReview()
  const editing = Boolean(review)

  const [status, setStatus] = useState<ReviewStatus>('published')
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [showName, setShowName] = useState(true)
  const [showAvatar, setShowAvatar] = useState(true)
  const [name, setName] = useState('')
  const [custId, setCustId] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)
  const [error, setError] = useState('')

  // Окно открывается заново на каждый отзыв: поля берутся из него.
  useEffect(() => {
    if (!open) return
    setError('')
    setShowOriginal(false)
    setStatus(review?.status ?? 'published')
    setRating(review?.rating ?? 5)
    setBody(review?.body ?? '')
    setReply(review?.reply?.body ?? '')
    const tg = togglesFromVisibility(review?.visibility)
    setShowName(review ? tg.showName : true)
    setShowAvatar(review ? tg.showAvatar : true)
    setName(review?.display_name ?? '')
    setCustId(customerId ? String(customerId) : '')
  }, [open, review, customerId])

  const pending = update.isPending || create.isPending
  const bodyLen = body.trim().length
  const custNum = Number(custId)
  const valid = bodyLen >= 5 && bodyLen <= 1000 && (editing || (Number.isInteger(custNum) && custNum > 0))

  const submit = async () => {
    setError('')
    const visibility = visibilityFromToggles(showName, showName && showAvatar)
    const display_name = showName ? name.trim() : ''
    try {
      if (review) {
        await update.mutateAsync({
          id: review.id,
          body: { rating, body: body.trim(), visibility, display_name, status, reply: reply.trim() },
        })
      } else {
        await create.mutateAsync({ customer_id: custNum, rating, body: body.trim(), visibility, display_name, status })
      }
      onSaved?.(t('admin.reviews.saved'))
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404 ? t('admin.reviews.modal.noCustomer') : t('admin.reviews.modal.error'),
      )
    }
  }

  const title = review
    ? t('admin.reviews.modal.titleEdit', { name: review.author_name || t('reviews.anonymous') })
    : t('admin.reviews.modal.titleCreate')

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      description={editing ? t('admin.reviews.modal.subtitleEdit') : t('admin.reviews.modal.subtitleCreate')}
      size="lg"
      footer={<AdminModalSaveFooter onCancel={onClose} onSave={() => void submit()} isPending={pending} saveDisabled={!valid} />}
    >
      <div className="space-y-4">
        {!editing && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('admin.reviews.modal.customerId')}</span>
            <input
              inputMode="numeric"
              value={custId}
              disabled={pending}
              onChange={(e) => setCustId(e.target.value.replace(/\D/g, ''))}
              placeholder={t('admin.reviews.modal.customerPlaceholder')}
              className={fieldClass}
            />
          </label>
        )}

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('admin.reviews.modal.status')}</span>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                disabled={pending}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                  status === s ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(STATUS_KEY[s])}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('admin.reviews.modal.rating')}</span>
          <StarPicker value={rating} onChange={setRating} disabled={pending} label={t('admin.reviews.modal.rating')} />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t('admin.reviews.modal.body')}</span>
          <textarea
            value={body}
            rows={4}
            maxLength={1000}
            disabled={pending}
            onChange={(e) => setBody(e.target.value)}
            className={cn(fieldClass, 'min-h-[6rem] resize-y')}
          />
          {review?.original_body ? (
            <p className="text-xs text-muted-foreground">
              {t('admin.reviews.modal.edited')} ·{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? t('admin.reviews.modal.hideOriginal') : t('admin.reviews.modal.showOriginal')}
              </button>
            </p>
          ) : null}
          {showOriginal && review?.original_body ? (
            <p className="whitespace-pre-line rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {review.original_body}
            </p>
          ) : null}
        </label>

        {editing && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('admin.reviews.modal.replyLabel')}</span>
            <textarea
              value={reply}
              rows={3}
              maxLength={1000}
              autoFocus={focusReply}
              disabled={pending}
              onChange={(e) => setReply(e.target.value)}
              className={cn(fieldClass, 'resize-y')}
            />
            <p className="text-xs text-muted-foreground">{t('admin.reviews.modal.replyHint')}</p>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t('admin.reviews.modal.showName')}</span>
            <AdminToggleSwitch checked={showName} onChange={setShowName} disabled={pending} aria-label={t('admin.reviews.modal.showName')} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={cn('text-sm font-medium', !showName && 'text-muted-foreground')}>{t('admin.reviews.modal.showAvatar')}</span>
            <AdminToggleSwitch checked={showName && showAvatar} onChange={setShowAvatar} disabled={pending || !showName} aria-label={t('admin.reviews.modal.showAvatar')} />
          </div>
        </div>
        {showName && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('admin.reviews.modal.nameLabel')}</span>
            <input value={name} maxLength={120} disabled={pending} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </label>
        )}

        {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </div>
    </AdminModal>
  )
}
