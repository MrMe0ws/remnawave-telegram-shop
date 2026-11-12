import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, ChevronDown, CircleCheck, CircleX, Mail, Send, Server, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError, api, type AdminAlertTestResult } from '@/lib/api'
import { hapticError, hapticSuccess } from '@/lib/haptic'
import type { AdminSettingGroupDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'
import { AdminToggleSwitch } from './AdminToggleSwitch'

/** Синхрон с internal/config/admin_alerts.go: порядок — порядок строк. */
const KINDS: { kind: string; prefix: string; icon: LucideIcon }[] = [
  { kind: 'system', prefix: 'ADMIN_ALERT_SYSTEM', icon: Mail },
  { kind: 'servers', prefix: 'ADMIN_ALERT_SERVERS', icon: Activity },
  { kind: 'infra', prefix: 'ADMIN_ALERT_INFRA', icon: Server },
]

const SHARED_KEY = 'ADMIN_ALERTS_CHAT_ID'

const inputClass = 'admin-input w-full rounded-lg border border-border bg-card px-3 py-2 text-sm'

type TestState = { kind: 'ok'; result: AdminAlertTestResult } | { kind: 'fail'; message: string }

interface Props {
  group: AdminSettingGroupDTO
  draft: Record<string, string>
  saving: boolean
  togglingKey: string | null
  onDraftChange: (key: string, value: string) => void
  onToggle: (key: string, checked: boolean) => void
}

/**
 * «Оповещения админу»: общий чат сверху и у каждого вида — выключатель, свой чат и тема.
 * Куда уйдёт сообщение, считается здесь по тем же правилам, что adminalert.Resolve:
 * чат вида → общий чат → личка админу. «Тест» шлёт то, что сейчас введено, без сохранения.
 */
export function AdminAlertRoutes({ group, draft, saving, togglingKey, onDraftChange, onToggle }: Props) {
  const { t } = useTranslation()
  const [help, setHelp] = useState(false)
  const [tests, setTests] = useState<Record<string, TestState>>({})

  const value = (key: string) => (draft[key] ?? group.fields.find((f) => f.key === key)?.value ?? '').trim()
  const shared = value(SHARED_KEY)

  const runTest = async (kind: string, prefix: string) => {
    try {
      const result = await api.adminAlertTest({
        kind,
        draft: { shared_chat_id: shared, chat_id: value(`${prefix}_CHAT_ID`), thread_id: value(`${prefix}_THREAD_ID`) },
      })
      if (result.ok) {
        hapticSuccess()
        setTests((prev) => ({ ...prev, [kind]: { kind: 'ok', result } }))
      } else {
        hapticError()
        const hint = result.hint ? t(`admin.settings.alerts.hints.${result.hint}`) : ''
        setTests((prev) => ({
          ...prev,
          [kind]: { kind: 'fail', message: [hint, result.error].filter(Boolean).join(' · ') },
        }))
      }
    } catch (err) {
      hapticError()
      const message =
        err instanceof ApiError && err.status === 429
          ? t('admin.settings.alerts.tooFast')
          : err instanceof ApiError && err.status === 400
            ? t('admin.settings.alerts.badId')
            : t('admin.settings.alerts.testFailed')
      setTests((prev) => ({ ...prev, [kind]: { kind: 'fail', message } }))
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm">
        <label htmlFor="admin-alerts-shared" className="block text-sm font-medium">
          {t('admin.settings.alerts.sharedChat')}
        </label>
        <input
          id="admin-alerts-shared"
          className={cn(inputClass, 'mt-1.5')}
          inputMode="numeric"
          placeholder={t('admin.settings.alerts.sharedPlaceholder')}
          value={draft[SHARED_KEY] ?? shared}
          disabled={saving}
          onChange={(e) => onDraftChange(SHARED_KEY, e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">{t('admin.settings.alerts.sharedHint')}</p>
        <button
          type="button"
          aria-expanded={help}
          onClick={() => setHelp((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('admin.settings.alerts.howTo')}
          <ChevronDown className={cn('size-3.5 transition-transform', help && 'rotate-180')} />
        </button>
        {help && (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>{t('admin.settings.alerts.howTo1')}</li>
            <li>{t('admin.settings.alerts.howTo2')}</li>
            <li>{t('admin.settings.alerts.howTo3')}</li>
          </ol>
        )}
      </div>

      {KINDS.map(({ kind, prefix, icon: Icon }) => {
        const enabledKey = `${prefix}_ENABLED`
        const chatKey = `${prefix}_CHAT_ID`
        const threadKey = `${prefix}_THREAD_ID`
        const enabled = value(enabledKey) !== 'false'
        const chat = value(chatKey)
        const thread = value(threadKey)
        const threadNum = Number(thread) > 0 ? thread : ''
        const target = chat
          ? t('admin.settings.alerts.toOwnChat', { chat })
          : shared
            ? t('admin.settings.alerts.toShared')
            : t('admin.settings.alerts.toDirect')
        const where = enabled
          ? chat || shared
            ? threadNum
              ? `${target} · ${t('admin.settings.alerts.topic', { id: threadNum })}`
              : target
            : target
          : t('admin.settings.alerts.off')
        const test = tests[kind]
        const okWhere =
          test?.kind === 'ok'
            ? test.result.direct
              ? t('admin.settings.alerts.toDirect')
              : [test.result.chat_title || String(test.result.chat_id), test.result.thread_id ? t('admin.settings.alerts.topic', { id: test.result.thread_id }) : '']
                  .filter(Boolean)
                  .join(' · ')
            : ''

        return (
          <div key={kind} className="rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{t(`admin.settings.alerts.kinds.${kind}.title`)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(`admin.settings.alerts.kinds.${kind}.desc`)}</p>
              </div>
              <AdminToggleSwitch
                checked={enabled}
                busy={togglingKey === enabledKey}
                disabled={saving}
                aria-label={t(`admin.settings.alerts.kinds.${kind}.title`)}
                onChange={(next) => onToggle(enabledKey, next)}
              />
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{t('admin.settings.alerts.chat')}</span>
                <input
                  className={cn(inputClass, 'mt-1')}
                  inputMode="numeric"
                  placeholder={t('admin.settings.alerts.chatPlaceholder')}
                  value={draft[chatKey] ?? chat}
                  disabled={saving}
                  onChange={(e) => onDraftChange(chatKey, e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{t('admin.settings.alerts.thread')}</span>
                <input
                  className={cn(inputClass, 'mt-1')}
                  inputMode="numeric"
                  placeholder="—"
                  value={draft[threadKey] ?? thread}
                  disabled={saving}
                  onChange={(e) => onDraftChange(threadKey, e.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="col-span-2 h-10 sm:col-span-1"
                onClick={() => runTest(kind, prefix)}
              >
                <Send />
                {t('admin.settings.alerts.test')}
              </Button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {t('admin.settings.alerts.where')}: <span className={cn('font-medium', enabled ? 'text-foreground' : 'text-muted-foreground')}>{where}</span>
              {enabled && !chat && !shared && threadNum ? ` · ${t('admin.settings.alerts.threadIgnored')}` : ''}
            </p>
            {test && (
              <p
                className={cn(
                  'mt-1.5 flex items-start gap-1.5 text-xs',
                  test.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                )}
                role="status"
              >
                {test.kind === 'ok' ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
                <span>{test.kind === 'ok' ? t('admin.settings.alerts.sent', { where: okWhere }) : test.message}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
