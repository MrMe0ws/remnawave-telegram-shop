import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, CalendarDays, DollarSign, Globe, Server } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import type { AdminInfraAvailableNodeDTO } from '@/lib/types/admin'
import { AdminModal } from '../components/AdminModal'
import { AdminModalSaveFooter } from '../components/AdminModalSaveFooter'
import { AdminSelect } from '../components/AdminSelect'
import { AdminDatePicker } from '../components/AdminDatePicker'
import { PromoPopover } from '../promos/PromoBits'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { normalizeHttpUrl } from '../utils/normalizeUrl'
import { addMonthsClamped, formatDate, noonOf, startOfDay, type InfraNode } from './infraModel'
import { FieldLabel, MoneyInput, NodeFlag, PeriodChips, ProviderIcon, chipClass, parseAmount } from './infraBits'
import { INFRA_QUERY_KEYS, useInfraInvalidate } from './useInfraActions'

type ProviderOption = { uuid: string; name: string; faviconLink: string }

/** «+ Нода»: нода панели без биллинга → провайдер, дата следующей оплаты, цена и период. */
export function InfraAddNodeModal({
  open,
  onClose,
  available,
  providers,
}: {
  open: boolean
  onClose: () => void
  available: AdminInfraAvailableNodeDTO[]
  providers: ProviderOption[]
}) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()
  const [provider, setProvider] = useState<string | null>(null)
  const [node, setNode] = useState<string | null>(null)
  const [date, setDate] = useState<Date>(() => addMonthsClamped(startOfDay(new Date()), 1))
  const [price, setPrice] = useState('')
  const [period, setPeriod] = useState(1)

  const save = useMutation({
    meta: { haptics: true },
    mutationFn: async () => {
      await api.adminInfraCreateNode({ provider_uuid: provider!, node_uuid: node!, next_billing_at: noonOf(date).toISOString() })
      const p = parseAmount(price)
      if (p || period !== 1) await api.adminInfraSetNodeMeta({ node_uuid: node!, price: p || null, period_months: period })
    },
    onSuccess: async () => {
      await invalidate()
      const name = available.find((n) => n.uuid === node)?.name ?? ''
      toast.success(t('admin.infra.toast.nodeAdded', { node: name }), { description: t('admin.infra.toast.nextDateOnly', { date: formatDate(date, i18n.language) }) })
      onClose()
    },
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t('admin.infra.addNodeModal.title')}
      description={t('admin.infra.addNodeModal.subtitle')}
      icon={Server}
      iconAccent="blue"
      size="md"
      footer={<AdminModalSaveFooter onCancel={onClose} onSave={() => save.mutate()} isPending={save.isPending} saveDisabled={!provider || !node} />}
    >
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.infra.noAvailableNodes')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>{t('admin.infra.pickNode')}</FieldLabel>
            <AdminSelect
              value={node}
              options={available.map((n) => ({ value: n.uuid, label: n.name, icon: <NodeFlag code={n.countryCode} className="h-3 w-[18px]" /> }))}
              onChange={setNode}
              placeholder="—"
              ariaLabel={t('admin.infra.pickNode')}
            />
          </div>
          <div>
            <FieldLabel>{t('admin.infra.pickProvider')}</FieldLabel>
            <AdminSelect
              value={provider}
              options={providers.map((p) => ({ value: p.uuid, label: p.name, icon: <ProviderIcon name={p.name} favicon={p.faviconLink} size="xs" /> }))}
              onChange={setProvider}
              placeholder="—"
              ariaLabel={t('admin.infra.pickProvider')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>{t('admin.infra.priceField')}</FieldLabel>
              <MoneyInput value={price} onChange={setPrice} ariaLabel={t('admin.infra.priceField')} />
            </div>
            <div>
              <FieldLabel>{t('admin.infra.periodField')}</FieldLabel>
              <PeriodChips value={period} onChange={setPeriod} />
            </div>
          </div>
          <div>
            <FieldLabel>{t('admin.infra.nextBillingAt')}</FieldLabel>
            <AdminDatePicker value={date} onChange={(d) => setDate(startOfDay(d))} showTime={false} />
          </div>
        </div>
      )}
    </AdminModal>
  )
}

/** Меню ноды → «Изменить дату оплаты». */
export function InfraEditDateModal({ node, onClose }: { node: InfraNode | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()
  const [date, setDate] = useState<Date | null>(null)
  const [shown, setShown] = useState<InfraNode | null>(node)
  if (node && node !== shown) {
    setShown(node)
    setDate(startOfDay(node.nextBillingAt))
  }
  const n = node ?? shown
  const save = useMutation({
    meta: { haptics: true },
    mutationFn: () => api.adminInfraPatchNode({ uuid: n!.billingUuid, next_billing_at: noonOf(date!).toISOString() }),
    onSuccess: async () => {
      await invalidate()
      toast.success(t('admin.infra.toast.dateChanged', { node: n!.name }), { description: t('admin.infra.toast.nextDateOnly', { date: formatDate(date!, i18n.language) }) })
      onClose()
    },
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })
  return (
    <AdminModal
      open={!!node}
      onClose={onClose}
      title={t('admin.infra.editDate.title')}
      description={n?.name}
      icon={CalendarDays}
      iconAccent="blue"
      size="sm"
      footer={<AdminModalSaveFooter onCancel={onClose} onSave={() => save.mutate()} isPending={save.isPending} saveDisabled={!date} />}
    >
      {n && date && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[1, 3, 6, 12].map((m) => {
              const target = addMonthsClamped(startOfDay(n.nextBillingAt), m)
              return (
                <button key={m} type="button" className={chipClass(startOfDay(target).getTime() === date.getTime())} onClick={() => setDate(target)}>
                  {m === 12 ? t('admin.infra.pay.plusYear') : t('admin.infra.pay.plusMonths', { count: m })}
                </button>
              )
            })}
          </div>
          <AdminDatePicker value={date} onChange={(d) => setDate(startOfDay(d))} showTime={false} />
        </div>
      )}
    </AdminModal>
  )
}

/** Меню ноды → «Цена и период». */
export function InfraPriceModal({ node, onClose }: { node: InfraNode | null; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()
  const [shown, setShown] = useState<InfraNode | null>(node)
  const [price, setPrice] = useState('')
  const [period, setPeriod] = useState(1)
  if (node && node !== shown) {
    setShown(node)
    setPrice(node.price != null ? node.price.toFixed(2) : '')
    setPeriod(node.periodMonths)
  }
  const n = node ?? shown
  const save = useMutation({
    meta: { haptics: true },
    mutationFn: () => api.adminInfraSetNodeMeta({ node_uuid: n!.nodeUuid, price: parseAmount(price) || null, period_months: period }),
    onSuccess: async () => {
      await invalidate()
      toast.success(t('admin.infra.toast.priceSaved', { node: n!.name }))
      onClose()
    },
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })
  return (
    <AdminModal
      open={!!node}
      onClose={onClose}
      title={t('admin.infra.price.title')}
      description={n?.name}
      icon={DollarSign}
      iconAccent="emerald"
      size="sm"
      footer={<AdminModalSaveFooter onCancel={onClose} onSave={() => save.mutate()} isPending={save.isPending} />}
    >
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel>{t('admin.infra.priceField')}</FieldLabel>
          <MoneyInput value={price} onChange={setPrice} autoFocus onEnter={() => save.mutate()} ariaLabel={t('admin.infra.priceField')} />
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">{t('admin.infra.price.hint')}</p>
        </div>
        <div>
          <FieldLabel>{t('admin.infra.periodField')}</FieldLabel>
          <PeriodChips value={period} onChange={setPeriod} />
        </div>
      </div>
    </AdminModal>
  )
}

export type ProviderDraft = { uuid?: string; name: string; favicon_link: string; login_url: string }

/** Создание и правка провайдера. */
export function InfraProviderModal({ draft, onClose }: { draft: ProviderDraft | null; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()
  const [form, setForm] = useState<ProviderDraft>({ name: '', favicon_link: '', login_url: '' })
  const [shown, setShown] = useState<ProviderDraft | null>(draft)
  if (draft && draft !== shown) {
    setShown(draft)
    setForm(draft)
  }
  const editing = !!(draft ?? shown)?.uuid
  const save = useMutation({
    meta: { haptics: true },
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        favicon_link: form.favicon_link.trim() ? normalizeHttpUrl(form.favicon_link) : undefined,
        login_url: form.login_url.trim() ? normalizeHttpUrl(form.login_url) : undefined,
      }
      if (form.uuid) await api.adminInfraPatchProvider({ uuid: form.uuid, ...body })
      else await api.adminInfraCreateProvider(body)
    },
    onSuccess: async () => {
      await invalidate()
      toast.success(t(editing ? 'admin.infra.toast.providerSaved' : 'admin.infra.toast.providerAdded', { provider: form.name.trim() }))
      onClose()
    },
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })
  const field = (key: 'name' | 'favicon_link' | 'login_url', label: string, url?: boolean) => (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        inputMode={url ? 'url' : undefined}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (url && v) setForm({ ...form, [key]: normalizeHttpUrl(v) })
        }}
        className="h-10 w-full rounded-[11px] border border-border/80 bg-background/60 px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-[3px] focus:ring-primary/20"
      />
    </div>
  )
  return (
    <AdminModal
      open={!!draft}
      onClose={onClose}
      title={editing ? t('admin.infra.editProvider') : t('admin.infra.createProvider')}
      icon={Globe}
      iconAccent="indigo"
      size="sm"
      footer={<AdminModalSaveFooter onCancel={onClose} onSave={() => save.mutate()} isPending={save.isPending} saveDisabled={form.name.trim().length < 2} />}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <ProviderIcon name={form.name || '?'} favicon={form.favicon_link} size="lg" />
          <div className="min-w-0 flex-1">{field('name', t('admin.infra.providerName'))}</div>
        </div>
        {field('login_url', t('admin.infra.loginUrl'), true)}
        {field('favicon_link', t('admin.infra.faviconLink'), true)}
      </div>
    </AdminModal>
  )
}

/** Колокольчик в шапке: за сколько дней напоминать в бота (вместо вкладки «Настройки»). */
export function InfraBell() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const { data } = useQuery({ queryKey: INFRA_QUERY_KEYS.settings, queryFn: () => api.adminInfraSettings() })
  const toggle = useMutation({
    meta: { haptics: true },
    mutationFn: (p: { days: number; enabled: boolean }) => api.adminInfraUpdateSettings(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: INFRA_QUERY_KEYS.settings }),
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })
  const thresholds = [
    { days: 1, key: 'notify_before_1' },
    { days: 3, key: 'notify_before_3' },
    { days: 7, key: 'notify_before_7' },
    { days: 14, key: 'notify_before_14' },
  ] as const
  const anyOn = thresholds.some((x) => data?.[x.key])
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={t('admin.infra.notifySettings')}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="size-[18px]" aria-hidden />
        {anyOn && <span className="absolute right-2 top-2 size-[7px] rounded-full bg-emerald-500 ring-2 ring-background" />}
      </button>
      <PromoPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} align="right" width={280} label={t('admin.infra.notifySettings')}>
        <p className="px-2 pb-1.5 pt-1.5 text-[11px] text-muted-foreground">{t('admin.infra.bell.title')}</p>
        <div className="flex flex-wrap gap-1.5 px-2 pb-2">
          {thresholds.map(({ days, key }) => {
            const on = !!data?.[key]
            const busy = toggle.isPending && toggle.variables?.days === days
            return (
              <button key={days} type="button" disabled={busy} className={cn(chipClass(on), busy && 'opacity-80')} onClick={() => toggle.mutate({ days, enabled: !on })}>
                {busy && <Spinner />}
                {t('admin.infra.bell.days', { count: days })}
              </button>
            )
          })}
        </div>
        <div className="mx-1 my-1 border-t border-border/60" />
        <p className="px-2 pb-1.5 pt-1 text-[11px] leading-relaxed text-muted-foreground">{t('admin.infra.bell.hint')}</p>
      </PromoPopover>
    </>
  )
}
