import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpRight,
  CircleHelp,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  Settings2,
  Shield,
  Star,
  type LucideIcon,
} from 'lucide-react'

import { AdminSectionCard } from '../components/AdminSectionCard'
import { AdminToggleSwitch } from '../components/AdminToggleSwitch'
import { AdminModal } from '../components/AdminModal'
import { AdminModalSaveFooter } from '../components/AdminModalSaveFooter'
import { useAdminBotSettings, useAdminBotSettingsPatch } from '../hooks/useAdminBotSettings'
import { cn } from '@/lib/utils'

const KEY_ENABLED = 'LOYALTY_ENABLED'
const KEY_CAP = 'LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT'
const KEY_RUB_PER_STAR = 'RUB_PER_STAR'

interface FeedbackProps {
  onSaved: () => void
  onError: (e: unknown) => void
}

function KeyValueRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

/**
 * Настройки программы целиком: включена ли, потолок общей скидки, курс Stars.
 *
 * Включение и потолок — те же поля, что в «Настройки → Маркетинг → Лояльность»,
 * просто под рукой. Курс Stars живёт среди продуктовых настроек на странице
 * «Тарифы», поэтому здесь только показан со ссылкой туда. Минимум XP за оплату
 * (LOYALTY_XP_MIN_PER_PURCHASE) задаётся лишь в .env — его не показываем:
 * поменять из кабинета всё равно нельзя.
 */
export function LoyaltyProgramCard({ onSaved, onError }: FeedbackProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useAdminBotSettings()
  const patch = useAdminBotSettingsPatch()
  const [togglePending, setTogglePending] = useState<boolean | null>(null)
  const [capOpen, setCapOpen] = useState(false)
  const [capDraft, setCapDraft] = useState('')

  const fields = data?.groups.flatMap((g) => g.fields) ?? []
  const valueOf = (key: string) => fields.find((f) => f.key === key)?.value

  const enabled = (togglePending ?? valueOf(KEY_ENABLED) === 'true') === true
  const cap = Number(valueOf(KEY_CAP) ?? '')
  const rubPerStar = Number.parseFloat(valueOf(KEY_RUB_PER_STAR) ?? '')

  function handleToggle(next: boolean) {
    setTogglePending(next)
    patch.mutate(
      { [KEY_ENABLED]: next ? 'true' : 'false' },
      {
        onSuccess: async () => {
          // Счётчики клиентов по уровням бэк отдаёт только при включённой программе.
          void queryClient.invalidateQueries({ queryKey: ['admin-loyalty-stats'] })
          onSaved()
          // Держим новое положение, пока настройки не перечитаются: иначе на кадр
          // возвращается старое значение из кэша — тумблер и плашка мигают.
          await queryClient.invalidateQueries({ queryKey: ['admin-bot-settings'] })
          setTogglePending(null)
        },
        onError: (err) => {
          setTogglePending(null)
          onError(err)
        },
      },
    )
  }

  const capNum = Number(capDraft)
  const capValid = capDraft.trim() !== '' && Number.isInteger(capNum) && capNum >= 1 && capNum <= 100

  function openCap() {
    setCapDraft(Number.isFinite(cap) && cap > 0 ? String(cap) : '')
    setCapOpen(true)
  }

  function saveCap() {
    if (!capValid) return
    patch.mutate(
      { [KEY_CAP]: String(capNum) },
      {
        onSuccess: () => {
          setCapOpen(false)
          onSaved()
        },
        onError,
      },
    )
  }

  const numberLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US'

  return (
    <AdminSectionCard title={t('admin.loyalty.program')} icon={Settings2} iconAccent="rose">
      <div>
        {isLoading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isError ? (
          <p className="py-2 text-sm text-destructive">{t('admin.settings.loadError')}</p>
        ) : (
          <div className="space-y-1">
            <KeyValueRow icon={Power} label={enabled ? t('admin.loyalty.programOn') : t('admin.loyalty.programOff')}>
              <AdminToggleSwitch
                checked={enabled}
                onChange={handleToggle}
                busy={togglePending !== null}
                aria-label={t('admin.loyalty.program')}
              />
            </KeyValueRow>
            {!enabled && (
              <p className="admin-reveal rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {t('admin.loyalty.programOffNote')}
              </p>
            )}
            <KeyValueRow icon={Shield} label={t('admin.loyalty.capLabel')}>
              <span className="font-semibold tabular-nums">{Number.isFinite(cap) && cap > 0 ? `${cap}%` : '—'}</span>
              <button
                type="button"
                onClick={openCap}
                aria-label={t('admin.edit')}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </KeyValueRow>
            <KeyValueRow icon={Star} label={t('admin.loyalty.starsRate')}>
              <span className={cn('tabular-nums', rubPerStar > 0 ? 'font-semibold' : 'text-xs text-muted-foreground')}>
                {rubPerStar > 0
                  ? t('admin.loyalty.starsRateValue', {
                      xp: rubPerStar.toLocaleString(numberLocale, { maximumFractionDigits: 2 }),
                    })
                  : t('admin.loyalty.starsRateOff')}
              </span>
              <Link
                to="/admin/tariffs?tab=conditions&open=stars"
                title={t('admin.loyalty.starsRateWhere')}
                aria-label={t('admin.loyalty.starsRateWhere')}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowUpRight className="size-3.5" />
              </Link>
            </KeyValueRow>
          </div>
        )}
      </div>

      <AdminModal
        open={capOpen}
        onClose={() => setCapOpen(false)}
        title={t('admin.loyalty.capLabel')}
        icon={Shield}
        iconAccent="rose"
        size="sm"
        footer={
          <AdminModalSaveFooter
            onCancel={() => setCapOpen(false)}
            onSave={saveCap}
            isPending={patch.isPending}
            saveDisabled={!capValid}
          />
        }
      >
        <div className="space-y-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            aria-label={t('admin.loyalty.capLabel')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:border-primary focus:outline-none"
            autoFocus
          />
          <p className={cn('text-xs', capValid || capDraft === '' ? 'text-muted-foreground' : 'text-destructive')}>
            {t('admin.loyalty.capHint')}
          </p>
        </div>
      </AdminModal>
    </AdminSectionCard>
  )
}

const HOW_KEYS = ['admin.loyalty.how1', 'admin.loyalty.how2', 'admin.loyalty.how3', 'admin.loyalty.how4'] as const

export function LoyaltyHowCard() {
  const { t } = useTranslation()
  return (
    <AdminSectionCard title={t('admin.loyalty.howTitle')} icon={CircleHelp} iconAccent="slate">
      <ol className="space-y-2 text-sm text-muted-foreground">
        {HOW_KEYS.map((key, i) => (
          <li key={key} className="flex gap-2.5">
            <span className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
              {i + 1}
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>
    </AdminSectionCard>
  )
}

export function LoyaltyRecalcCard({
  pending,
  onRecalc,
}: {
  pending: boolean
  onRecalc: () => void
}) {
  const { t } = useTranslation()
  return (
    <AdminSectionCard title={t('admin.loyalty.recalc')} icon={RefreshCw} iconAccent="rose">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('admin.loyalty.recalcHint')}</p>
        <button
          type="button"
          onClick={onRecalc}
          disabled={pending}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50',
            pending && '!opacity-100',
          )}
        >
          <RefreshCw className={cn('size-4', pending && 'animate-spin')} />
          {t('admin.loyalty.recalc')}
        </button>
      </div>
    </AdminSectionCard>
  )
}
