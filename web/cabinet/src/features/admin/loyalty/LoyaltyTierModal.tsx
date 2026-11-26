import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil, Plus } from 'lucide-react'

import { AdminModal } from '../components/AdminModal'
import { AdminModalSaveFooter } from '../components/AdminModalSaveFooter'
import type { AdminLoyaltyTier } from '../hooks/useAdminLoyalty'
import { isBaseTier, tierNeighbors } from './loyaltyTiers'
import { cn } from '@/lib/utils'

export interface LoyaltyTierFormValues {
  xp_min: number
  discount_percent: number
}

interface Props {
  open: boolean
  onClose: () => void
  /** null — новый уровень. */
  editing: AdminLoyaltyTier | null
  /** Все уровни по возрастанию порога. */
  sorted: AdminLoyaltyTier[]
  /** Сколько клиентов на уровне (по sort_order); undefined — счётчиков нет. */
  userCounts?: Map<number, number>
  saving: boolean
  onSubmit: (values: LoyaltyTierFormValues) => void
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  disabled,
  invalid,
  hint,
}: {
  label: string
  suffix: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  invalid?: boolean
  hint: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}, {suffix}
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          invalid ? 'border-destructive' : 'border-border',
        )}
      />
      <p className={cn('mt-1 text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>{hint}</p>
    </div>
  )
}

/**
 * Окно уровня: порог и скидка с подсказкой, куда они должны лечь между
 * соседями, и строкой «что получит клиент».
 *
 * Порог проверяем строго: уровни нумеруются по порядку добавления (sort_order),
 * а считаются по порогу, и порог «не на своём месте» перепутал бы номера у
 * клиентов. Новый уровень бэк всегда ставит последним, поэтому его порог —
 * только выше текущего верхнего. Скидка тоже не может быть меньше, чем у
 * уровня ниже, и больше, чем у уровня выше: иначе рост уровня снижал бы скидку.
 */
export function LoyaltyTierModal({ open, onClose, editing, sorted, userCounts, saving, onSubmit }: Props) {
  const { t, i18n } = useTranslation()
  const [xp, setXp] = useState('')
  const [pct, setPct] = useState('')

  useEffect(() => {
    if (!open) return
    setXp(editing ? String(editing.xp_min) : '')
    setPct(editing ? String(editing.discount_percent) : '')
  }, [open, editing])

  const fmt = (n: number) => n.toLocaleString(i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US')
  const { prev, next } = tierNeighbors(sorted, editing)
  const base = editing ? isBaseTier(editing) : false
  const maxSort = sorted.reduce((m, tier) => Math.max(m, tier.sort_order), 0)

  const xpNum = Number(xp)
  const pctNum = Number(pct)
  const xpMin = base ? 0 : (prev?.xp_min ?? -1) + 1
  const xpMax = next ? next.xp_min - 1 : null
  const pctMin = prev?.discount_percent ?? 0
  const pctMax = next?.discount_percent ?? 100

  const xpFilled = xp.trim() !== ''
  const pctFilled = pct.trim() !== ''
  const xpValid =
    base ? xpNum === 0 : xpFilled && Number.isInteger(xpNum) && xpNum >= xpMin && (xpMax == null || xpNum <= xpMax)
  const pctValid = pctFilled && Number.isInteger(pctNum) && pctNum >= pctMin && pctNum <= pctMax

  const level = editing?.sort_order ?? maxSort + 1
  const title = editing ? t('admin.loyalty.levelN', { n: level }) : t('admin.loyalty.newTier')
  const description = editing
    ? base
      ? t('admin.loyalty.baseLevelDesc')
      : prev && next
        ? t('admin.loyalty.betweenLevels', { a: prev.sort_order, b: next.sort_order })
        : t('admin.loyalty.topLevel')
    : t('admin.loyalty.newTierDesc', { n: level })

  const xpHint = base
    ? t('admin.loyalty.xpBaseHint')
    : xpMax != null
      ? t('admin.loyalty.xpRangeHint', { min: fmt(xpMin), max: fmt(xpMax) })
      : t('admin.loyalty.xpFromHint', { min: fmt(xpMin) })
  const pctHint = t('admin.loyalty.discountRangeHint', { min: pctMin, max: pctMax })

  const count = editing ? userCounts?.get(editing.sort_order) : undefined
  const canSave = xpValid && pctValid && !saving

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={editing ? Pencil : Plus}
      iconAccent="rose"
      size="md"
      footer={
        <AdminModalSaveFooter
          onCancel={onClose}
          onSave={() => canSave && onSubmit({ xp_min: base ? 0 : xpNum, discount_percent: pctNum })}
          isPending={saving}
          saveDisabled={!xpValid || !pctValid}
        />
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label={t('admin.loyalty.xpLabel')}
            suffix="XP"
            value={base ? '0' : xp}
            onChange={setXp}
            disabled={base}
            invalid={xpFilled && !xpValid}
            hint={xpHint}
          />
          <NumberField
            label={t('admin.loyalty.discountLabel')}
            suffix="%"
            value={pct}
            onChange={setPct}
            invalid={pctFilled && !pctValid}
            hint={pctHint}
          />
        </div>

        {xpValid && pctValid && (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
            <Eye className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              {base || xpNum === 0
                ? t('admin.loyalty.previewBase', { pct: pctNum })
                : t('admin.loyalty.preview', { pct: pctNum, rub: fmt(xpNum) })}
              {count != null && <> {t('admin.loyalty.previewClients', { value: fmt(count) })}</>}
            </p>
          </div>
        )}
      </div>
    </AdminModal>
  )
}
