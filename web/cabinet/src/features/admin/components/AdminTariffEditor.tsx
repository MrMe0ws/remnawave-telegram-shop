import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Save,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Gauge,
  Server,
  Coins,
  FileText,
  Smartphone,
  HardDrive,
  RotateCcw,
  ListOrdered,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { TariffDescription } from '@/components/TariffDescription'
import { AdminModal } from './AdminModal'
import { slugifyTariffName } from '../utils/slugifyTariffName'
import { AdminCheckbox, AdminCheckboxField } from './AdminCheckbox'
import {
  adminSectionIconBoxClass,
  adminSectionIconAccentClassNames,
  type AdminSectionIconAccent,
} from '../utils/adminSectionIconAccents'
import {
  useAdminSquads,
  STRATEGIES,
  type AdminTariff,
  type CreateTariffInput,
} from '../hooks/useAdminTariffs'

const GB = 1024 * 1024 * 1024
const PERIOD_MONTHS = [1, 3, 6, 12] as const

const STRATEGY_I18N_KEYS: Record<string, string> = {
  no_reset: 'admin.tariffs.strategies.noReset',
  DAY: 'admin.tariffs.strategies.day',
  WEEK: 'admin.tariffs.strategies.week',
  MONTH: 'admin.tariffs.strategies.month',
  MONTH_ROLLING: 'admin.tariffs.strategies.monthRolling',
  NO_RESET: 'admin.tariffs.strategies.noResetRw',
}

function parseSquadUUIDs(raw: string): string[] {
  if (!raw.trim()) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function joinSquadUUIDs(uuids: string[]): string {
  return uuids.join(',')
}

function TariffEditorSectionHeader({
  icon: Icon,
  accent,
  children,
}: {
  icon: LucideIcon
  accent: AdminSectionIconAccent
  children: ReactNode
}) {
  const { iconClassName } = adminSectionIconAccentClassNames(accent)
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className={adminSectionIconBoxClass(accent, 'size-7')}>
        <Icon className={cn('size-3.5', iconClassName)} />
      </span>
      {children}
    </h3>
  )
}

function TariffFieldLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      {children}
    </label>
  )
}

export interface TariffFormData {
  slug: string
  name: string
  sort_order: number
  is_active: boolean
  device_limit: number
  traffic_gb: number
  traffic_limit_reset_strategy: string
  squad_uuids: string[]
  description: string
  rub: [number, number, number, number]
  stars: [number | null, number | null, number | null, number | null]
}

function tariffToForm(t?: AdminTariff | null): TariffFormData {
  const rub: [number, number, number, number] = [0, 0, 0, 0]
  const stars: [number | null, number | null, number | null, number | null] = [null, null, null, null]
  if (t?.prices) {
    for (const p of t.prices) {
      const idx = PERIOD_MONTHS.indexOf(p.months as 1 | 3 | 6 | 12)
      if (idx >= 0) {
        rub[idx] = p.amount_rub
        stars[idx] = p.amount_stars ?? null
      }
    }
  }
  return {
    slug: t?.slug ?? '',
    name: t?.name ?? '',
    sort_order: t?.sort_order ?? 0,
    is_active: t?.is_active ?? true,
    device_limit: t?.device_limit ?? 1,
    traffic_gb: t ? t.traffic_limit_bytes / GB : 0,
    traffic_limit_reset_strategy: t?.traffic_limit_reset_strategy ?? 'no_reset',
    squad_uuids: parseSquadUUIDs(t?.active_internal_squad_uuids ?? ''),
    description: t?.description ?? '',
    rub,
    stars,
  }
}

function formToCreateInput(f: TariffFormData, tierLevel?: number | null): CreateTariffInput {
  const slug = f.slug.trim() || slugifyTariffName(f.name)
  return {
    slug,
    name: f.name.trim() || null,
    sort_order: f.sort_order,
    is_active: f.is_active,
    device_limit: f.device_limit,
    traffic_limit_bytes: Math.round(f.traffic_gb * GB),
    traffic_limit_reset_strategy: f.traffic_limit_reset_strategy,
    active_internal_squad_uuids: joinSquadUUIDs(f.squad_uuids),
    tier_level: tierLevel ?? f.sort_order,
    description: f.description.trim() || null,
    rub: f.rub,
    stars: f.stars,
  }
}

function formToUpdateFields(f: TariffFormData, original?: AdminTariff | null): Record<string, unknown> {
  const input = formToCreateInput(f, original?.tier_level)
  const fields: Record<string, unknown> = {
    name: input.name,
    sort_order: input.sort_order,
    is_active: input.is_active,
    device_limit: input.device_limit,
    traffic_limit_bytes: input.traffic_limit_bytes,
    traffic_limit_reset_strategy: input.traffic_limit_reset_strategy,
    active_internal_squad_uuids: input.active_internal_squad_uuids,
    tier_level: input.tier_level,
    description: input.description,
    rub: input.rub,
    stars: input.stars,
  }
  if (!original) fields.slug = input.slug
  return fields
}

interface Props {
  open: boolean
  onClose: () => void
  tariff?: AdminTariff | null
  onSave: (data: CreateTariffInput | Record<string, unknown>, isEdit: boolean) => void
  saving?: boolean
}

export function AdminTariffEditor({ open, onClose, tariff, onSave, saving }: Props) {
  const { t } = useTranslation()
  const { data: squadsData } = useAdminSquads()
  const [form, setForm] = useState<TariffFormData>(() => tariffToForm(tariff))
  const isEdit = tariff != null

  useEffect(() => {
    if (open) setForm(tariffToForm(tariff))
  }, [open, tariff?.id])

  const set = <K extends keyof TariffFormData>(k: K, v: TariffFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const toggleSquad = (uuid: string) => {
    setForm((p) => ({
      ...p,
      squad_uuids: p.squad_uuids.includes(uuid)
        ? p.squad_uuids.filter((u) => u !== uuid)
        : [...p.squad_uuids, uuid],
    }))
  }

  const handleSave = () => {
    if (isEdit) {
      onSave(formToUpdateFields(form, tariff), true)
    } else {
      onSave(formToCreateInput(form), false)
    }
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEdit ? t('admin.tariffs.editTitle') : t('admin.tariffs.createTitle')}
      panelClassName="sm:max-w-2xl"
      icon={isEdit ? Pencil : Plus}
      iconAccent="emerald"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!isEdit && !form.name.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('admin.save')}
          </button>
        </div>
      }
    >
        <div className="space-y-5">
          {/* Basic */}
          <section>
            <TariffEditorSectionHeader icon={Settings} accent="slate">
              {t('admin.tariffs.sectionBasic')}
            </TariffEditorSectionHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TariffFieldLabel>{t('admin.tariffs.name')}</TariffFieldLabel>
                <input className="admin-input w-full px-3 py-2" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <TariffFieldLabel icon={ListOrdered}>{t('admin.tariffs.sortOrder')}</TariffFieldLabel>
                <input type="number" className="admin-input w-full max-w-xs px-3 py-2" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
                <p className="mt-1 text-xs text-muted-foreground">{t('admin.tariffs.sortOrderHint')}</p>
              </div>
            </div>
            <AdminCheckboxField
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
              label={t('admin.tariffs.active')}
              className="mt-3"
            />
          </section>

          {/* Limits */}
          <section>
            <TariffEditorSectionHeader icon={Gauge} accent="blue">
              {t('admin.tariffs.sectionLimits')}
            </TariffEditorSectionHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <TariffFieldLabel icon={Smartphone}>{t('admin.tariffs.devices')}</TariffFieldLabel>
                <input type="number" min={1} className="admin-input w-full px-3 py-2" value={form.device_limit} onChange={(e) => set('device_limit', Number(e.target.value))} />
              </div>
              <div>
                <TariffFieldLabel icon={HardDrive}>{t('admin.tariffs.traffic')}</TariffFieldLabel>
                <input type="number" min={0} step={0.1} className="admin-input w-full px-3 py-2" value={form.traffic_gb} onChange={(e) => set('traffic_gb', Number(e.target.value))} />
              </div>
              <div>
                <TariffFieldLabel icon={RotateCcw}>{t('admin.tariffs.strategy')}</TariffFieldLabel>
                <select className="admin-input w-full px-3 py-2" value={form.traffic_limit_reset_strategy} onChange={(e) => set('traffic_limit_reset_strategy', e.target.value)}>
                  {STRATEGIES.map((s) => (
                    <option key={s} value={s}>{t(STRATEGY_I18N_KEYS[s] ?? s, { defaultValue: s })}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Squads */}
          {squadsData && squadsData.items.length > 0 && (
            <section>
              <TariffEditorSectionHeader icon={Server} accent="indigo">
                {t('admin.tariffs.squads')}
              </TariffEditorSectionHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {squadsData.items.map((sq) => (
                  <label key={sq.uuid} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', form.squad_uuids.includes(sq.uuid) && 'border-primary/50 bg-primary/5')}>
                    <AdminCheckbox
                      checked={form.squad_uuids.includes(sq.uuid)}
                      onChange={() => toggleSquad(sq.uuid)}
                      aria-label={sq.name}
                    />
                    <span className="truncate">{sq.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t('admin.tariffs.squadsHint')}</p>
            </section>
          )}

          {/* Prices */}
          <section>
            <TariffEditorSectionHeader icon={Coins} accent="amber">
              {t('admin.tariffs.prices')}
            </TariffEditorSectionHeader>
            <p className="mb-3 text-xs text-muted-foreground">{t('admin.tariffs.pricesHint')}</p>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="hidden grid-cols-[minmax(5rem,1fr)_1fr_1fr] gap-3 border-b border-border/50 bg-muted/25 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
                <span>{t('admin.tariffs.pricePeriod')}</span>
                <span>{t('admin.tariffs.priceRub')}</span>
                <span>{t('admin.tariffs.priceStars')}</span>
              </div>
              <div className="divide-y divide-border/50">
                {PERIOD_MONTHS.map((m, i) => (
                  <div
                    key={m}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(5rem,1fr)_1fr_1fr] sm:items-center"
                  >
                    <span className="text-sm font-medium sm:pt-0">
                      {t('admin.users.monthsShort', { count: m })}
                    </span>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground sm:sr-only">
                        {t('admin.tariffs.priceRub')}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ₽
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="admin-input w-full py-2 pl-7 pr-3 tabular-nums"
                          value={form.rub[i] || ''}
                          onChange={(e) => {
                            const n = [...form.rub] as [number, number, number, number]
                            n[i] = Number(e.target.value) || 0
                            set('rub', n)
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground sm:sr-only">
                        {t('admin.tariffs.priceStars')}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ⭐
                        </span>
                        <input
                          type="number"
                          min={0}
                          placeholder="—"
                          className="admin-input w-full py-2 pl-8 pr-3 tabular-nums"
                          value={form.stars[i] ?? ''}
                          onChange={(e) => {
                            const n = [...form.stars] as [number | null, number | null, number | null, number | null]
                            n[i] = e.target.value ? Number(e.target.value) : null
                            set('stars', n)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Description */}
          <section>
            <TariffEditorSectionHeader icon={FileText} accent="slate">
              {t('admin.tariffs.description')}
            </TariffEditorSectionHeader>
            <p className="mb-3 text-xs text-muted-foreground">{t('admin.tariffs.descriptionHint')}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <TariffFieldLabel>{t('admin.tariffs.descriptionSource')}</TariffFieldLabel>
                <textarea
                  rows={8}
                  spellCheck={false}
                  className="admin-input w-full resize-y px-3 py-2 font-mono text-xs leading-relaxed"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </div>
              <div>
                <TariffFieldLabel>{t('admin.tariffs.descriptionPreview')}</TariffFieldLabel>
                <div className="min-h-[12rem] rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
                  {form.description.trim() ? (
                    <TariffDescription text={form.description} className="text-sm" />
                  ) : (
                    <p className="text-xs italic text-muted-foreground">{t('admin.tariffs.descriptionPreviewEmpty')}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
    </AdminModal>
  )
}
