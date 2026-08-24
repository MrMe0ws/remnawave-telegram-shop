import { useEffect, useState } from 'react'
import { ChevronRight, MonitorSmartphone } from 'lucide-react'

import { applyTheme } from '@/hooks/useTheme'

/**
 * Dev-превью кнопки «Подключить устройство»: /cabinet/dev/connect-cta.
 *
 * Маршрут регистрируется только при import.meta.env.DEV (см. App.tsx) — нужен,
 * чтобы сравнить старый и новый вид без запущенного бота и живой сессии.
 * Разметка скопирована 1-в-1 с DashboardPage/SubscriptionPage, классы и токены
 * настоящие, поэтому превью показывает ровно то, что увидит пользователь.
 *
 * Декор-темы переключаются здесь же: у них свои правила заливки CTA, и важно
 * проверить, что акцентный вариант не теряется ни под одной из них.
 */

const DECOR_THEMES = [
  'off',
  'green',
  'pink',
  'violet',
  'neon',
  'aurora',
  'ocean',
  'cyber',
  'sunset',
  'new_year',
  'halloween',
] as const

export default function ConnectCtaPreviewPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [decor, setDecor] = useState<string>('off')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (decor === 'off') {
      delete root.dataset.cabinetDecor
    } else {
      root.dataset.cabinetDecor = decor
    }
    return () => {
      delete root.dataset.cabinetDecor
    }
  }, [decor])

  return (
    <div className="relative min-h-dvh">
      <div className="cabinet-shell-gradient" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Кнопка «Подключить устройство»
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Слева — как было, справа — как стало. Блок показан внутри карточки
          дашборда, на том же фоне, что и в кабинете.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Тема</span>
            {(['dark', 'light'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {value === 'dark' ? 'Тёмная' : 'Светлая'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Декор</span>
            <select
              value={decor}
              onChange={(e) => setDecor(e.target.value)}
              className="admin-input h-8 rounded-lg px-2 text-xs"
            >
              {DECOR_THEMES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <PreviewColumn title="Было" caption="Заливка = цвет карточки, видна только бегущая дуга">
            <a href="#было" className="connect-device-cta group block">
              <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MonitorSmartphone size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">Подключить устройство</p>
                  <p className="text-xs text-muted-foreground">Доступно 5 устройств</p>
                </div>
              </div>
            </a>
          </PreviewColumn>

          <PreviewColumn title="Стало" caption="Акцентная подложка, кольцо по периметру, свечение и стрелка">
            <a
              href="#стало"
              className="connect-device-cta connect-device-cta--highlight group block"
            >
              <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
                <span className="connect-device-cta-icon inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MonitorSmartphone size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">Подключить устройство</p>
                  <p className="text-xs text-muted-foreground">Доступно 5 устройств</p>
                </div>
                <ChevronRight size={18} className="connect-device-cta-chevron ml-auto shrink-0" />
              </div>
            </a>
          </PreviewColumn>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Страница доступна только в dev-сборке и в прод-бандл не попадает.
        </p>
      </div>
    </div>
  )
}

/** Карточка дашборда вокруг CTA — тот же фон, на котором кнопка теряется. */
function PreviewColumn({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>

      <div className="cabinet-elevated-card mt-3 p-4">
        <div className="mb-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Трафик</span>
            <span className="font-semibold">Без ограничений</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </div>

        {children}

        <div className="mt-4 rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">Подписка активна</p>
          <p className="text-xs text-muted-foreground">Соседний блок для сравнения контраста</p>
        </div>
      </div>
    </div>
  )
}
