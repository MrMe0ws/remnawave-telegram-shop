import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Handshake, ArrowLeft, Loader2, Pause, Play, Ban, Scale } from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminModal } from '../components/AdminModal'
import {
  useAdminPartnerDetail,
  useAdminPartnerSetStatus,
  useAdminPartnerUpdateTerms,
  useAdminPartnerAdjust,
} from '../hooks/useAdminPartners'
import { StatusChip, PercentInput } from './AdminPartnersPage'
import { formatMoney, formatPercent, formatDayShort } from '@/features/partner/format'
import type { AdminPartnerDTO, AdminPartnerOperationDTO } from '@/lib/types/admin'

export default function AdminPartnerDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const partnerID = id ? Number(id) : null

  const { data, isLoading } = useAdminPartnerDetail(partnerID)
  const setStatus = useAdminPartnerSetStatus()

  const [termsOpen, setTermsOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const partner = data?.partner

  return (
    <AdminLayout>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => navigate('/admin/partners')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('admin.partners.detail.back')}
        </button>

        {isLoading ? (
          <div className="flex justify-center rounded-xl border border-border bg-card py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {!isLoading && !partner ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
            {t('admin.partners.detail.notFound')}
          </div>
        ) : null}

        {partner ? (
          <>
            <AdminPageHeader
              icon={Handshake}
              title={partner.label}
              subtitle={t('admin.partners.detail.subtitle', {
                date: formatDayShort(partner.approved_at || partner.created_at),
              })}
              accent="amber"
              actions={
                <div className="flex flex-wrap gap-2">
                  {/* Заморозка блокирует вывод, но не начисления: это пауза на
                      разбор, а не наказание задним числом. */}
                  {partner.status === 'active' ? (
                    <ActionButton
                      icon={Pause}
                      label={t('admin.partners.detail.suspend')}
                      onClick={() => setStatus.mutate({ id: partner.id, status: 'suspended' })}
                      busy={setStatus.isPending}
                    />
                  ) : null}
                  {partner.status === 'suspended' ? (
                    <ActionButton
                      icon={Play}
                      label={t('admin.partners.detail.resume')}
                      onClick={() => setStatus.mutate({ id: partner.id, status: 'active' })}
                      busy={setStatus.isPending}
                    />
                  ) : null}
                  {partner.status !== 'rejected' ? (
                    <ActionButton
                      icon={Ban}
                      label={t('admin.partners.detail.revoke')}
                      onClick={() => setStatus.mutate({ id: partner.id, status: 'rejected' })}
                      busy={setStatus.isPending}
                      danger
                    />
                  ) : null}
                </div>
              }
            />

            <div className="flex items-center gap-2">
              <StatusChip status={partner.status} />
              <span className="text-xs text-muted-foreground">
                {t('admin.partners.detail.clientSince', { date: formatDayShort(partner.customer_since) })}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label={t('admin.partners.detail.earnedTotal')}
                value={formatMoney(partner.total_earned)}
                sub={t('admin.partners.detail.paidTotal', { amount: formatMoney(partner.total_paid) })}
              />
              <MetricCard
                label={t('admin.partners.detail.available')}
                value={formatMoney(partner.balance)}
                sub={t('admin.partners.detail.holdReserved', {
                  hold: formatMoney(partner.hold_balance),
                  reserved: formatMoney(partner.reserved_balance),
                })}
              />
              <MetricCard
                label={t('admin.partners.detail.customers')}
                value={String(partner.customers)}
                sub={t('admin.partners.detail.paying', { n: partner.paying_customers })}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <TermsCard partner={partner} onEdit={() => setTermsOpen(true)} onAdjust={() => setAdjustOpen(true)} />
              <LinksCard links={data?.links ?? []} />
            </div>

            <OperationsCard operations={data?.operations ?? []} />

            <TermsModal partner={partner} open={termsOpen} onClose={() => setTermsOpen(false)} />
            <AdjustModal partner={partner} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  busy,
  danger,
}: {
  icon: typeof Pause
  label: string
  onClick: () => void
  busy: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-60 ${
        danger ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : 'border-border hover:bg-accent'
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function TermsCard({
  partner,
  onEdit,
  onAdjust,
}: {
  partner: AdminPartnerDTO
  onEdit: () => void
  onAdjust: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">{t('admin.partners.detail.termsTitle')}</p>
      <dl className="divide-y divide-border rounded-lg border border-border text-sm">
        <Row
          label={t('admin.partners.terms.first')}
          value={
            <>
              {formatPercent(partner.effective_first_percent)}{' '}
              <span className="text-xs text-muted-foreground">
                {partner.first_percent == null
                  ? t('admin.partners.terms.global')
                  : t('admin.partners.terms.individual')}
              </span>
            </>
          }
        />
        <Row
          label={t('admin.partners.terms.renewal')}
          value={
            <>
              {formatPercent(partner.effective_renewal_percent)}{' '}
              <span className="text-xs text-muted-foreground">
                {partner.renewal_percent == null
                  ? t('admin.partners.terms.global')
                  : t('admin.partners.terms.individual')}
              </span>
            </>
          }
        />
        <Row
          label={t('admin.partners.terms.linksLimit')}
          value={partner.links_limit ?? t('admin.partners.terms.global')}
        />
        <Row label={t('admin.partners.detail.payoutDetails')} value={partner.payout_details || '—'} />
      </dl>
      {partner.admin_note ? (
        <p className="mt-2 text-xs text-muted-foreground">{partner.admin_note}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
        >
          {t('admin.partners.detail.editTerms')}
        </button>
        <button
          type="button"
          onClick={onAdjust}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
        >
          <Scale className="size-3.5" />
          {t('admin.partners.detail.adjust')}
        </button>
      </div>
    </div>
  )
}

function LinksCard({ links }: { links: { id: number; name: string; code: string; archived: boolean; customers: number; earned: number }[] }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">{t('admin.partners.detail.linksTitle')}</p>
      {links.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('admin.partners.detail.linksEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {links.map((l) => (
            <li key={l.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${l.archived ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <p className="truncate font-medium">{l.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{l.code}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{t('admin.partners.detail.linkCustomers', { n: l.customers })}</p>
                <p className="tabular-nums">{formatMoney(l.earned)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Лента всех движений денег: начисления, выплаты и ручные правки вместе.
 * Разнеси их по разным экранам — и сходимость баланса перестанет проверяться
 * глазами.
 */
function OperationsCard({ operations }: { operations: AdminPartnerOperationDTO[] }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">{t('admin.partners.detail.operationsTitle')}</p>
      {operations.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('admin.partners.detail.operationsEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 pb-2 font-medium">{t('admin.partners.detail.opDate')}</th>
                <th className="px-3 pb-2 font-medium">{t('admin.partners.detail.opKind')}</th>
                <th className="px-3 pb-2 font-medium">{t('admin.partners.detail.opRef')}</th>
                <th className="px-3 pb-2 text-right font-medium">{t('admin.partners.detail.opAmount')}</th>
                <th className="px-3 pb-2 text-right font-medium">{t('admin.partners.detail.opStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, i) => (
                <tr key={`${op.at}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDayShort(op.at)}</td>
                  <td className="px-3 py-2.5">
                    {op.kind === 'payout'
                      ? t('admin.partners.detail.opPayout')
                      : t(`admin.partners.detail.opEarning.${op.detail || 'renewal'}`)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{op.ref || op.note || '—'}</td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums ${op.amount < 0 ? 'text-muted-foreground' : ''}`}
                  >
                    {op.amount < 0 ? '−' : '+'}
                    {formatMoney(Math.abs(op.amount))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{op.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TermsModal({ partner, open, onClose }: { partner: AdminPartnerDTO; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useAdminPartnerUpdateTerms()
  const [first, setFirst] = useState(partner.first_percent == null ? '' : String(partner.first_percent))
  const [renewal, setRenewal] = useState(partner.renewal_percent == null ? '' : String(partner.renewal_percent))
  const [limit, setLimit] = useState(partner.links_limit == null ? '' : String(partner.links_limit))
  const [comment, setComment] = useState('')

  function parseOrNull(v: string): number | null {
    const trimmed = v.trim()
    if (!trimmed) return null
    const n = Number(trimmed.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  return (
    <AdminModal open={open} onClose={onClose} title={t('admin.partners.detail.editTerms')}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <PercentInput label={t('admin.partners.terms.first')} value={first} onChange={setFirst} placeholder="—" />
          <PercentInput label={t('admin.partners.terms.renewal')} value={renewal} onChange={setRenewal} placeholder="—" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('admin.partners.terms.linksLimit')}
          </label>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="numeric"
            placeholder="—"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('admin.partners.detail.notePlaceholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {/* Пустое поле — это «как у всех», а не ноль: ноль означал бы, что
            партнёру не платят вовсе. */}
        <p className="text-xs text-muted-foreground">{t('admin.partners.terms.emptyHint')}</p>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              {
                id: partner.id,
                terms: {
                  first_percent: parseOrNull(first),
                  renewal_percent: parseOrNull(renewal),
                  links_limit: parseOrNull(limit),
                  comment,
                },
              },
              { onSuccess: onClose },
            )
          }
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {t('admin.partners.detail.save')}
        </button>
      </div>
    </AdminModal>
  )
}

function AdjustModal({ partner, open, onClose }: { partner: AdminPartnerDTO; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const adjust = useAdminPartnerAdjust()
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value === 0) {
      setError(t('admin.partners.detail.adjustErrors.amount'))
      return
    }
    if (!comment.trim()) {
      setError(t('admin.partners.detail.adjustErrors.comment'))
      return
    }
    setError(null)
    adjust.mutate(
      { id: partner.id, amount: value, comment },
      {
        onSuccess: () => {
          setAmount('')
          setComment('')
          onClose()
        },
        onError: () => setError(t('admin.partners.detail.adjustErrors.failed')),
      },
    )
  }

  return (
    <AdminModal open={open} onClose={onClose} title={t('admin.partners.detail.adjust')}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('admin.partners.detail.adjustAmount')}
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="-500"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t('admin.partners.detail.adjustHint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('admin.partners.detail.adjustReason')}
          </label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={adjust.isPending}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {t('admin.partners.detail.save')}
        </button>
      </div>
    </AdminModal>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
