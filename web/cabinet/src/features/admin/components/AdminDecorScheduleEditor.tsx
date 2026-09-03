import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, CalendarPlus, RotateCcw, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AdminSelect } from './AdminSelect'
import { AdminToggleSwitch } from './AdminToggleSwitch'
import { DECOR_THEME_IDS } from '@/features/decor/decorThemes'
import { decorThemeOptionLabelStyle } from '@/features/decor/decorThemeAdmin'
import {
  DECOR_SCHEDULE_DAYS_IN_MONTH,
  DECOR_SCHEDULE_MAX_RULES,
  activeDecorRuleIndex,
  clampDayToMonth,
  defaultDecorSchedule,
  formatMonthDay,
  parseDecorSchedule,
  parseMonthDay,
  serializeDecorSchedule,
  type DecorScheduleRule,
} from '@/features/decor/decorSchedule'

interface AdminDecorScheduleEditorProps {
  /** JSON настройки CABINET_DECOR_SCHEDULE (пусто — встроенный пресет). */
  value: string
  /** CABINET_DECOR_AUTO_ENABLED: выключено — расписание не применяется. */
  autoEnabled: boolean
  disabled?: boolean
  onChange: (next: string) => void
}

/**
 * Редактор окон авто-смены декор-тем.
 *
 * Всё расписание хранится одной строкой JSON, поэтому компонент каждый раз
 * разбирает `value` и сериализует результат обратно: черновик и кнопка
 * «Сохранить секцию» остаются общими с остальными настройками группы.
 */
export function AdminDecorScheduleEditor({
  value,
  autoEnabled,
  disabled,
  onChange,
}: AdminDecorScheduleEditorProps) {
  const { t, i18n } = useTranslation()

  const rules = useMemo(() => {
    const parsed = parseDecorSchedule(value)
    // Пустая настройка на backend означает встроенный пресет — показываем его,
    // чтобы админ не гадал, что именно включится по галочке.
    return parsed.length > 0 ? parsed : defaultDecorSchedule()
  }, [value])

  const monthOptions = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language || 'ru', { month: 'long' })
    return Array.from({ length: 12 }, (_, index) => {
      const label = format.format(new Date(2024, index, 1))
      return { value: String(index + 1), label: label.charAt(0).toUpperCase() + label.slice(1) }
    })
  }, [i18n.language])

  const themeOptions = useMemo(
    () =>
      DECOR_THEME_IDS.map((id) => ({
        value: id,
        label: t(`admin.settings.enum.${id}`, { defaultValue: id }),
        labelStyle: decorThemeOptionLabelStyle(id),
      })),
    [t],
  )

  const activeIndex = useMemo(
    () => (autoEnabled ? activeDecorRuleIndex(rules) : -1),
    [rules, autoEnabled],
  )

  const commit = useCallback(
    (next: DecorScheduleRule[]) => {
      onChange(serializeDecorSchedule(next))
    },
    [onChange],
  )

  const updateRule = useCallback(
    (index: number, patch: Partial<DecorScheduleRule>) => {
      commit(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
    },
    [commit, rules],
  )

  const updateBoundary = useCallback(
    (index: number, field: 'from' | 'to', month: number, day: number) => {
      updateRule(index, { [field]: formatMonthDay(month, clampDayToMonth(month, day)) })
    },
    [updateRule],
  )

  const moveRule = useCallback(
    (index: number, delta: number) => {
      const target = index + delta
      if (target < 0 || target >= rules.length) return
      const next = [...rules]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      commit(next)
    },
    [commit, rules],
  )

  const renderThemeSelect = (rule: DecorScheduleRule, index: number) => (
    <AdminSelect
      value={rule.theme}
      options={themeOptions}
      onChange={(next) => {
        if (next == null) return
        updateRule(index, { theme: next as DecorScheduleRule['theme'] })
      }}
      placeholder={t('admin.settings.decorSchedule.theme')}
      ariaLabel={t('admin.settings.decorSchedule.theme')}
      disabled={disabled}
    />
  )

  const renderBoundary = (rule: DecorScheduleRule, index: number, field: 'from' | 'to') => {
    const parsed = parseMonthDay(rule[field]) ?? { month: 1, day: 1 }
    const dayOptions = Array.from(
      { length: DECOR_SCHEDULE_DAYS_IN_MONTH[parsed.month - 1] },
      (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
    )
    const legend = t(`admin.settings.decorSchedule.${field}`)

    return (
      <div className="min-w-0 flex-1 space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {legend}
        </span>
        <div className="flex items-center gap-1.5">
          <AdminSelect
            className="w-[92px] shrink-0"
            value={String(parsed.day)}
            options={dayOptions}
            onChange={(next) => {
              if (next == null) return
              updateBoundary(index, field, parsed.month, Number(next))
            }}
            placeholder="1"
            ariaLabel={`${legend}: ${t('admin.settings.decorSchedule.day')}`}
            disabled={disabled}
          />
          <AdminSelect
            className="min-w-0 flex-1"
            value={String(parsed.month)}
            options={monthOptions}
            onChange={(next) => {
              if (next == null) return
              updateBoundary(index, field, Number(next), parsed.day)
            }}
            placeholder={t('admin.settings.decorSchedule.month')}
            ariaLabel={`${legend}: ${t('admin.settings.decorSchedule.month')}`}
            disabled={disabled}
          />
        </div>
      </div>
    )
  }

  const statusText = !autoEnabled
    ? t('admin.settings.decorSchedule.autoOff')
    : activeIndex === -1
      ? t('admin.settings.decorSchedule.noneActive')
      : t('admin.settings.decorSchedule.activeNow', {
          theme: t(`admin.settings.enum.${rules[activeIndex].theme}`, {
            defaultValue: rules[activeIndex].theme,
          }),
        })

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          autoEnabled
            ? 'border-border/60 bg-muted/40 text-muted-foreground'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        )}
      >
        {statusText}
      </div>

      <ul className="space-y-2">
        {rules.map((rule, index) => (
          <li
            key={index}
            className={cn(
              'rounded-lg border bg-card p-2.5 shadow-sm',
              index === activeIndex ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/60',
              !rule.enabled && 'opacity-60',
            )}
          >
            <div className="flex items-center gap-2">
              <AdminToggleSwitch
                checked={rule.enabled}
                disabled={disabled}
                onChange={(checked) => updateRule(index, { enabled: checked })}
                aria-label={t('admin.settings.decorSchedule.ruleEnabled')}
              />
              <div className="hidden min-w-0 flex-1 sm:block">{renderThemeSelect(rule, index)}</div>
              <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:ml-0">
                <ScheduleIconButton
                  icon={ArrowUp}
                  label={t('admin.settings.decorSchedule.moveUp')}
                  disabled={disabled || index === 0}
                  onClick={() => moveRule(index, -1)}
                />
                <ScheduleIconButton
                  icon={ArrowDown}
                  label={t('admin.settings.decorSchedule.moveDown')}
                  disabled={disabled || index === rules.length - 1}
                  onClick={() => moveRule(index, 1)}
                />
                <ScheduleIconButton
                  icon={Trash2}
                  label={t('admin.settings.decorSchedule.remove')}
                  disabled={disabled}
                  danger
                  onClick={() => commit(rules.filter((_, i) => i !== index))}
                />
              </div>
            </div>

            <div className="mt-2 sm:hidden">{renderThemeSelect(rule, index)}</div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              {renderBoundary(rule, index, 'from')}
              {renderBoundary(rule, index, 'to')}
            </div>

            {index === activeIndex && (
              <p className="mt-2 text-[11px] font-medium text-primary">
                {t('admin.settings.decorSchedule.ruleActiveBadge')}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || rules.length >= DECOR_SCHEDULE_MAX_RULES}
          onClick={() =>
            commit([...rules, { theme: 'new_year', from: '12-01', to: '01-31', enabled: true }])
          }
        >
          <CalendarPlus className="mr-2 size-4" aria-hidden />
          {t('admin.settings.decorSchedule.add')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => commit(defaultDecorSchedule())}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden />
          {t('admin.settings.decorSchedule.reset')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('admin.settings.decorSchedule.priorityHint')}</p>
    </div>
  )
}

interface ScheduleIconButtonProps {
  icon: LucideIcon
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}

function ScheduleIconButton({ icon: Icon, label, disabled, danger, onClick }: ScheduleIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        danger && 'hover:bg-destructive/10 hover:text-destructive',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
