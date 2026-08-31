import { useTranslation } from 'react-i18next'
import { ExternalLink, LayoutGrid } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  BROADCAST_LINK_KEYS,
  CABINET_LINK_KEYS,
  EXTERNAL_LINK_KEYS,
  broadcastLinkLabelKey,
  type BroadcastLinkKey,
} from '../utils/broadcastLinks'

/** Кнопки-действия бота: остаются в чате, кабинет не открывают. */
type BotActionKey = 'buy' | 'promo' | 'main_menu'

export interface BroadcastButtonsState {
  buy: boolean
  connect: boolean
  promo: boolean
  main_menu: boolean
  links: BroadcastLinkKey[]
}

const BOT_ACTIONS: { key: BotActionKey; labelKey: string }[] = [
  { key: 'buy', labelKey: 'admin.broadcast.buttons.buy' },
  { key: 'promo', labelKey: 'admin.broadcast.buttons.promo' },
  { key: 'main_menu', labelKey: 'admin.broadcast.buttons.mainMenu' },
]

/**
 * Кнопки под сообщением, разложенные по тому, куда они ведут.
 *
 * Раньше группы были другие: «кнопки» и «разделы», — и в первой сидел «Мой
 * VPN», который открывает кабинет мини-приложением, ровно как разделы во
 * второй. Админ выбирал вслепую: по названию группы нельзя было понять, уйдёт
 * получатель в кабинет или останется в чате.
 *
 * Теперь деление ровно по этому признаку. Внутри всё одинаковые чипы: раньше
 * половина была чекбоксами, половина чипами, и это само по себе читалось как
 * «здесь другое», хотя разницы не было.
 */
export function BroadcastButtonsPicker({
  buttons,
  onChange,
}: {
  buttons: BroadcastButtonsState
  onChange: (next: BroadcastButtonsState) => void
}) {
  const { t } = useTranslation()

  // Порядок ключей в links держим как в BROADCAST_LINK_KEYS: бэкенд всё равно
  // приведёт к своему, и расхождение сбивало бы предпросмотр.
  const toggleLink = (key: BroadcastLinkKey) => {
    const next = buttons.links.includes(key)
      ? buttons.links.filter((item) => item !== key)
      : BROADCAST_LINK_KEYS.filter((item) => item === key || buttons.links.includes(item))
    onChange({ ...buttons, links: [...next] })
  }

  const cabinetSelected =
    (buttons.connect ? 1 : 0) + CABINET_LINK_KEYS.filter((k) => buttons.links.includes(k)).length
  const plainSelected =
    BOT_ACTIONS.filter((a) => buttons[a.key]).length +
    EXTERNAL_LINK_KEYS.filter((k) => buttons.links.includes(k)).length

  const clearCabinet = () =>
    onChange({
      ...buttons,
      connect: false,
      links: buttons.links.filter((k) => !CABINET_LINK_KEYS.includes(k as never)),
    })

  const clearPlain = () =>
    onChange({
      ...buttons,
      buy: false,
      promo: false,
      main_menu: false,
      links: buttons.links.filter((k) => !EXTERNAL_LINK_KEYS.includes(k as never)),
    })

  return (
    <div className="space-y-3">
      <Group
        icon={<LayoutGrid className="size-4 shrink-0 text-muted-foreground" />}
        title={t('admin.broadcast.groupCabinetTitle')}
        hint={t('admin.broadcast.groupCabinetHint')}
        selected={cabinetSelected}
        onClear={clearCabinet}
      >
        {/* «Мой VPN» ведёт на главную кабинета — туда же, куда «Главная
            кабинета» из разделов. Стоит рядом, чтобы дубль был виден. */}
        <Chip
          active={buttons.connect}
          label={t('admin.broadcast.buttons.connect')}
          onClick={() => onChange({ ...buttons, connect: !buttons.connect })}
        />
        {CABINET_LINK_KEYS.map((key) => (
          <Chip
            key={key}
            active={buttons.links.includes(key)}
            label={t(broadcastLinkLabelKey(key))}
            onClick={() => toggleLink(key)}
          />
        ))}
      </Group>

      <Group
        icon={<ExternalLink className="size-4 shrink-0 text-muted-foreground" />}
        title={t('admin.broadcast.groupPlainTitle')}
        hint={t('admin.broadcast.groupPlainHint')}
        selected={plainSelected}
        onClear={clearPlain}
      >
        {BOT_ACTIONS.map((action) => (
          <Chip
            key={action.key}
            active={buttons[action.key]}
            label={t(action.labelKey)}
            onClick={() => onChange({ ...buttons, [action.key]: !buttons[action.key] })}
          />
        ))}
        {EXTERNAL_LINK_KEYS.map((key) => (
          <Chip
            key={key}
            active={buttons.links.includes(key)}
            label={t(broadcastLinkLabelKey(key))}
            onClick={() => toggleLink(key)}
          />
        ))}
      </Group>

      <p className="text-xs text-muted-foreground">{t('admin.broadcast.linksConfigHint')}</p>
    </div>
  )
}

function Group({
  icon,
  title,
  hint,
  selected,
  onClear,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  selected: number
  onClear: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border border-border/50 p-3">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        {selected > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('admin.broadcast.linksClear')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
