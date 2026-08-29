import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CreditCard, ExternalLink, Loader2, User } from 'lucide-react'

import { AdminModal } from './AdminModal'
import { cn } from '@/lib/utils'
import { useAdminPayment } from '../hooks/useAdminPayments'
import { formatInvoiceType } from '../utils/formatInvoiceType'
import { formatAdminDateTime } from '../utils/datetime'
import { formatPaymentAmount } from '../utils/formatPaymentAmount'
import { paymentStatusInfo, formatPurchaseKind } from '../utils/paymentStatus'

interface Props {
  paymentId: number | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  )
}

export function AdminPaymentDetailModal({ paymentId, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = paymentId != null
  const { data, isLoading } = useAdminPayment(paymentId)

  const handleOpenUser = (customerId: number) => {
    onClose()
    navigate(`/admin/users/${customerId}`)
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={paymentId != null ? t('admin.payments.modalTitle', { id: paymentId }) : ''}
      icon={CreditCard}
      iconAccent="emerald"
      panelClassName="sm:max-w-lg"
    >
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const status = paymentStatusInfo(data.status, t)
            const amount = formatPaymentAmount(data.amount, data.currency || '', data.invoice_type)
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums">{amount.text}</p>
                  <p className="text-sm text-muted-foreground">{formatInvoiceType(data.invoice_type, t)}</p>
                </div>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', status.cls)}>
                  {status.label}
                </span>
              </div>
            )
          })()}

          <Section title={t('admin.payments.sectionUser')}>
            <button
              type="button"
              onClick={() => handleOpenUser(data.customer_id)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:opacity-80"
            >
              <span className="flex min-w-0 items-center gap-2">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">
                  {data.telegram_username ? `@${data.telegram_username}` : (data.panel_login ?? `#${data.customer_id}`)}
                </span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
            <Row label={t('admin.users.id')} value={data.customer_id} />
            <Row label={t('admin.users.telegramId')} value={data.telegram_id} />
          </Section>

          <Section title={t('admin.payments.sectionPayment')}>
            <Row label="ID" value={`#${data.id}`} />
            <Row label={t('admin.payments.amount')} value={formatPaymentAmount(data.amount, data.currency || '', data.invoice_type).text} />
            <Row label={t('admin.payments.description')} value={formatPurchaseKind(data.purchase_kind, t)} />
            <Row label={t('admin.payments.createdAt')} value={formatAdminDateTime(data.created_at)} />
            {data.paid_at && <Row label={t('admin.payments.paidAt')} value={formatAdminDateTime(data.paid_at)} />}
          </Section>

          <Section title={t('admin.payments.sectionProvider')}>
            <Row label={t('admin.payments.provider')} value={formatInvoiceType(data.invoice_type, t)} />
            {data.provider_txn_id && <Row label={t('admin.payments.providerTxnId')} value={data.provider_txn_id} />}
            <Row label={t('admin.payments.idempotencyKey')} value={data.idempotency_key ?? '—'} />
          </Section>

          <Section title={t('admin.payments.sectionPurchase')}>
            <Row label={t('admin.payments.kindLabel')} value={formatPurchaseKind(data.purchase_kind, t)} />
            {data.tariff_name && <Row label={t('admin.payments.tariff')} value={data.tariff_name} />}
            <Row label={t('admin.payments.period')} value={data.month > 0 ? t('admin.users.monthsShort', { count: data.month }) : '—'} />
            <Row label={t('admin.payments.extraHwid')} value={data.extra_hwid > 0 ? `+${data.extra_hwid}` : '—'} />
            <Row
              label={t('admin.payments.promoCode')}
              value={
                data.promo_code
                  ? `${data.promo_code}${data.discount_percent ? ` (-${data.discount_percent}%)` : ''}`
                  : '—'
              }
            />
            {data.is_early_downgrade && (
              <Row label={t('admin.payments.earlyDowngrade')} value={t('admin.yes')} />
            )}
          </Section>
        </div>
      )}
    </AdminModal>
  )
}
