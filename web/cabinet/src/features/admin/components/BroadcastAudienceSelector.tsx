import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FlaskConical,
  Gift,
  Moon,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface AudienceItem {
  audience: string
  label: string
  count: number
}

interface BroadcastAudienceSelectorProps {
  audiences: AudienceItem[]
  isLoading: boolean
  selectedAudience: string
  onSelectAudience: (audience: string) => void
  audienceLabels: Record<string, string>
  /** Фильтр по тарифу — показывается под списком только для платных сегментов. */
  children?: React.ReactNode
}

/**
 * Порядок и разбивка списка. Ключи те же, что отдаёт бэкенд.
 *
 * Раньше это были три сворачиваемых блока, и чтобы сравнить «активных
 * оплативших» с «неактивными», приходилось открывать один и закрывать другой.
 * Теперь это один список: подзаголовки разделяют, но ничего не прячут.
 */
const GROUPS: { titleKey: string; items: { key: string; icon: LucideIcon }[] }[] = [
  {
    titleKey: 'admin.broadcast.audienceGroup.common',
    items: [
      { key: 'all', icon: Users },
      { key: 'test_broadcast', icon: FlaskConical },
    ],
  },
  {
    titleKey: 'admin.broadcast.audienceGroup.active',
    items: [
      { key: 'active_all', icon: UserCheck },
      { key: 'active_paid', icon: CreditCard },
      { key: 'active_trial', icon: Gift },
    ],
  },
  {
    titleKey: 'admin.broadcast.audienceGroup.inactive',
    items: [
      { key: 'inactive_all', icon: UserX },
      { key: 'inactive_paid', icon: Clock },
      { key: 'inactive_trial', icon: Moon },
    ],
  },
]

export function BroadcastAudienceSelector({
  audiences,
  isLoading,
  selectedAudience,
  onSelectAudience,
  audienceLabels,
  children,
}: BroadcastAudienceSelectorProps) {
  const { t } = useTranslation()
  /*
   * Свёрнут по умолчанию: аудиторию выбирают один раз в начале, а дальше
   * работают с текстом. Развёрнутый список из восьми строк отодвигал бы
   * сообщение за нижний край экрана при каждом заходе.
   */
  const [open, setOpen] = useState(false)

  const byKey = new Map(audiences.map((a) => [a.audience, a]))
  const selected = byKey.get(selectedAudience)
  const summary = selected
    ? `${audienceLabels[selected.audience] ?? selected.audience} · ${selected.count}`
    : audienceLabels[selectedAudience] ?? selectedAudience

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] text-muted-foreground">
          1
        </span>
        <span className="text-sm font-semibold">{t('admin.broadcast.audienceTitle')}</span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {isLoading ? t('admin.broadcast.previewLoading') : summary}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-border/50">
          {isLoading ? (
            <div className="flex justify-center py-5">
              <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <ul role="radiogroup" aria-label={t('admin.broadcast.audienceTitle')}>
              {GROUPS.map((group) => {
                const rows = group.items.filter((item) => byKey.has(item.key))
                if (!rows.length) return null
                return (
                  <li key={group.titleKey}>
                    <p className="flex items-center gap-2 px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {t(group.titleKey)}
                      <span className="h-px flex-1 bg-border" aria-hidden />
                    </p>
                    <ul>
                      {rows.map((item) => {
                        const data = byKey.get(item.key)!
                        const isSelected = item.key === selectedAudience
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => onSelectAudience(item.key)}
                              className={cn(
                                'flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-transparent hover:bg-accent/40',
                              )}
                            >
                              <item.icon
                                className={cn(
                                  'size-4 shrink-0',
                                  isSelected ? 'text-primary' : 'text-muted-foreground',
                                )}
                              />
                              <span className={cn('min-w-0 flex-1 truncate text-sm', isSelected && 'font-semibold')}>
                                {audienceLabels[item.key] ?? data.label}
                              </span>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums',
                                  isSelected
                                    ? 'bg-primary/15 font-semibold text-primary'
                                    : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {data.count}
                              </span>
                              {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}

          {children && <div className="border-t border-border/50 px-4 py-3">{children}</div>}
        </div>
      )}
    </div>
  )
}
