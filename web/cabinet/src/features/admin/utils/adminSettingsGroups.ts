import type { LucideIcon } from 'lucide-react'
import {
  BadgeRussianRuble,
  Bell,
  CalendarDays,
  CircleDot,
  Gauge,
  Gem,
  Gift,
  Link2,
  ListFilter,
  Megaphone,
  MessageSquare,
  Package,
  Percent,
  RefreshCw,
  Scale,
  ScrollText,
  Send,
  Settings2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Trophy,
  Undo2,
  Users,
  Wallet,
  WifiOff,
} from 'lucide-react'

/** Порядок и иконки секций (синхрон с backend buildAdminSettingsResponse). */
export const ADMIN_SETTINGS_GROUP_ORDER = [
  'cabinet',
  'tariffs',
  'trial',
  'hwid',
  'referral',
  'stars',
  'loyalty',
  'payments_notify',
  'access',
  'links',
  'tags',
  'lifecycle',
  'fortune',
] as const

export type AdminSettingsGroupId = (typeof ADMIN_SETTINGS_GROUP_ORDER)[number]

export const ADMIN_SETTINGS_GROUP_ICONS: Record<AdminSettingsGroupId, LucideIcon> = {
  trial: Gift,
  tariffs: BadgeRussianRuble,
  hwid: Smartphone,
  referral: Users,
  stars: Star,
  loyalty: Gem,
  payments_notify: Bell,
  access: Shield,
  links: Link2,
  tags: Tag,
  lifecycle: RefreshCw,
  fortune: CircleDot,
  cabinet: Settings2,
}

export interface AdminSettingsGroupIconStyle {
  box: string
  icon: string
}

export const ADMIN_SETTINGS_GROUP_ICON_STYLES: Record<AdminSettingsGroupId, AdminSettingsGroupIconStyle> = {
  trial: { box: 'bg-emerald-500/10 dark:bg-emerald-500/20', icon: 'text-emerald-500' },
  tariffs: { box: 'bg-lime-500/10 dark:bg-lime-500/20', icon: 'text-lime-600 dark:text-lime-400' },
  hwid: { box: 'bg-cyan-500/10 dark:bg-cyan-500/20', icon: 'text-cyan-500' },
  referral: { box: 'bg-violet-500/10 dark:bg-violet-500/20', icon: 'text-violet-500' },
  stars: { box: 'bg-amber-500/10 dark:bg-amber-500/20', icon: 'text-amber-500' },
  loyalty: { box: 'bg-teal-500/10 dark:bg-teal-500/20', icon: 'text-teal-500' },
  payments_notify: { box: 'bg-rose-500/10 dark:bg-rose-500/20', icon: 'text-rose-500' },
  access: { box: 'bg-blue-500/10 dark:bg-blue-500/20', icon: 'text-blue-500' },
  links: { box: 'bg-indigo-500/10 dark:bg-indigo-500/20', icon: 'text-indigo-500' },
  tags: { box: 'bg-orange-500/10 dark:bg-orange-500/20', icon: 'text-orange-500' },
  lifecycle: { box: 'bg-sky-500/10 dark:bg-sky-500/20', icon: 'text-sky-500' },
  fortune: { box: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20', icon: 'text-fuchsia-500' },
  cabinet: { box: 'bg-pink-500/10 dark:bg-pink-500/20', icon: 'text-pink-500' },
}

export function adminSettingsGroupIconStyle(id: string): AdminSettingsGroupIconStyle {
  return ADMIN_SETTINGS_GROUP_ICON_STYLES[id as AdminSettingsGroupId] ?? {
    box: 'bg-primary/10 dark:bg-primary/20',
    icon: 'text-primary',
  }
}

/** Крупные категории на странице «Настройки бота». */
export const ADMIN_SETTINGS_CATEGORY_ORDER = [
  'design',
  'product',
  'marketing',
  'operations',
  'access',
] as const

export type AdminSettingsCategoryId = (typeof ADMIN_SETTINGS_CATEGORY_ORDER)[number]

export const ADMIN_SETTINGS_DEFAULT_CATEGORY: AdminSettingsCategoryId = 'design'

export interface AdminSettingsCategoryDef {
  id: AdminSettingsCategoryId
  titleKey: string
  icon: LucideIcon
  groups: readonly AdminSettingsGroupId[]
  iconStyle: AdminSettingsGroupIconStyle
}

export const ADMIN_SETTINGS_CATEGORIES: AdminSettingsCategoryDef[] = [
  {
    id: 'design',
    titleKey: 'admin.settings.categories.design',
    icon: Sparkles,
    groups: ['cabinet'],
    iconStyle: { box: 'bg-pink-500/10 dark:bg-pink-500/20', icon: 'text-pink-500' },
  },
  {
    id: 'product',
    titleKey: 'admin.settings.categories.product',
    icon: Package,
    groups: ['tariffs', 'trial', 'hwid', 'stars'],
    iconStyle: { box: 'bg-emerald-500/10 dark:bg-emerald-500/20', icon: 'text-emerald-500' },
  },
  {
    id: 'marketing',
    titleKey: 'admin.settings.categories.marketing',
    icon: Megaphone,
    groups: ['referral', 'loyalty', 'lifecycle', 'fortune'],
    iconStyle: { box: 'bg-violet-500/10 dark:bg-violet-500/20', icon: 'text-violet-500' },
  },
  {
    id: 'operations',
    titleKey: 'admin.settings.categories.operations',
    icon: Bell,
    groups: ['payments_notify', 'links', 'tags'],
    iconStyle: { box: 'bg-amber-500/10 dark:bg-amber-500/20', icon: 'text-amber-500' },
  },
  {
    id: 'access',
    titleKey: 'admin.settings.categories.access',
    icon: Shield,
    groups: ['access'],
    iconStyle: { box: 'bg-blue-500/10 dark:bg-blue-500/20', icon: 'text-blue-500' },
  },
]

const GROUP_TO_CATEGORY = new Map<AdminSettingsGroupId, AdminSettingsCategoryId>(
  ADMIN_SETTINGS_CATEGORIES.flatMap((category) =>
    category.groups.map((groupId) => [groupId, category.id] as const),
  ),
)

if (import.meta.env.DEV) {
  const categorized = new Set(GROUP_TO_CATEGORY.keys())
  for (const groupId of ADMIN_SETTINGS_GROUP_ORDER) {
    if (!categorized.has(groupId)) {
      console.error(`[adminSettingsGroups] group "${groupId}" is not assigned to any category`)
    }
  }
}

export function adminSettingsCategoryForGroup(groupId: string): AdminSettingsCategoryId | undefined {
  return GROUP_TO_CATEGORY.get(groupId as AdminSettingsGroupId)
}

export function adminSettingsCategoryDef(
  categoryId: AdminSettingsCategoryId,
): AdminSettingsCategoryDef | undefined {
  return ADMIN_SETTINGS_CATEGORIES.find((c) => c.id === categoryId)
}

export function sortSettingsGroupsByOrder<T extends { id: string }>(groups: T[]): T[] {
  return [...groups].sort(
    (a, b) =>
      ADMIN_SETTINGS_GROUP_ORDER.indexOf(a.id as AdminSettingsGroupId) -
      ADMIN_SETTINGS_GROUP_ORDER.indexOf(b.id as AdminSettingsGroupId),
  )
}

export const ADMIN_SETTINGS_GROUPS_LIST_ANCHOR = 'settings-groups-list'

export function scrollToSettingsGroupsList(): void {
  const el = document.getElementById(ADMIN_SETTINGS_GROUPS_LIST_ANCHOR)
  if (!el) return

  const scroll = () => {
    const headerOffset = 96
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  scroll()
  window.setTimeout(scroll, 80)
}

export interface AdminSettingsSubsectionDef {
  id: string
  titleKey: string
  icon: LucideIcon
  keys: string[]
}

/** Подразделы внутри секций. */
export const ADMIN_SETTINGS_SUBSECTIONS: Partial<Record<AdminSettingsGroupId, AdminSettingsSubsectionDef[]>> = {
  trial: [
    {
      id: 'period',
      titleKey: 'admin.settings.subsections.trial.period',
      icon: CalendarDays,
      keys: ['TRIAL_DAYS', 'TRIAL_ADD_TO_PAID'],
    },
    {
      id: 'traffic',
      titleKey: 'admin.settings.subsections.trial.traffic',
      icon: Gauge,
      keys: ['TRIAL_TRAFFIC_LIMIT', 'TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY', 'TRAFFIC_LIMIT_RESET_STRATEGY'],
    },
  ],
  hwid: [
    {
      id: 'sales',
      titleKey: 'admin.settings.subsections.hwid.sales',
      icon: Wallet,
      keys: ['HWID_EXTRA_DEVICES_ENABLED', 'HWID_ADD_PRICE', 'HWID_ADD_STARS_PRICE'],
    },
    {
      id: 'limits',
      titleKey: 'admin.settings.subsections.hwid.limits',
      icon: Smartphone,
      keys: ['HWID_MAX_DEVICE', 'TRIAL_HWID_LIMIT', 'PAID_HWID_LIMIT', 'HWID_FALLBACK_DEVICE_LIMIT'],
    },
  ],
  referral: [
    {
      id: 'days',
      titleKey: 'admin.settings.subsections.referral.days',
      icon: CalendarDays,
      keys: [
        'REFERRAL_FIRST_REFERRER_DAYS',
        'REFERRAL_FIRST_REFEREE_DAYS',
        'REFERRAL_REPEAT_REFERRER_DAYS',
      ],
    },
  ],
  payments_notify: [
    {
      id: 'toggle',
      titleKey: 'admin.settings.subsections.payments_notify.toggle',
      icon: Bell,
      keys: ['PAYMENTS_NOTIFY_ENABLED'],
    },
    {
      id: 'delivery',
      titleKey: 'admin.settings.subsections.payments_notify.delivery',
      icon: Send,
      keys: ['PAYMENTS_NOTIFY_CHAT_ID', 'PAYMENTS_NOTIFY_MESSAGE_THREAD_ID', 'PAYMENTS_NOTIFY_EVENTS'],
    },
  ],
  access: [
    {
      id: 'moderation',
      titleKey: 'admin.settings.subsections.access.moderation',
      icon: MessageSquare,
      keys: ['FORWARD_USER_MESSAGES_TO_ADMIN'],
    },
    {
      id: 'lists',
      titleKey: 'admin.settings.subsections.access.lists',
      icon: ListFilter,
      keys: ['BLOCKED_TELEGRAM_IDS', 'WHITELISTED_TELEGRAM_IDS'],
    },
  ],
  links: [
    {
      id: 'bot',
      titleKey: 'admin.settings.subsections.links.bot',
      icon: Link2,
      keys: ['CHANNEL_URL', 'SERVER_SELECTION_URL', 'VIDEO_GUIDE_URL', 'TOS_URL'],
    },
    {
      id: 'legal',
      titleKey: 'admin.settings.subsections.links.legal',
      icon: Scale,
      keys: ['PUBLIC_OFFER_URL', 'PRIVACY_POLICY_URL', 'TERMS_OF_SERVICE_URL'],
    },
  ],
  lifecycle: [
    {
      id: 'no_connect',
      titleKey: 'admin.settings.subsections.lifecycle.no_connect',
      icon: WifiOff,
      keys: [
        'LIFECYCLE_NO_CONNECT_PAID_ENABLED',
        'LIFECYCLE_NO_CONNECT_TRIAL_ENABLED',
        'LIFECYCLE_NO_CONNECT_DELAY_HOURS',
        'LIFECYCLE_NO_CONNECT_MAX_AGE_HOURS',
      ],
    },
    {
      id: 'winback',
      titleKey: 'admin.settings.subsections.lifecycle.winback',
      icon: Undo2,
      keys: [
        'LIFECYCLE_WINBACK_ENABLED',
        'LIFECYCLE_WINBACK_DAYS_AFTER_EXPIRY',
        'LIFECYCLE_WINBACK_DISCOUNT_PERCENT',
        'LIFECYCLE_WINBACK_DISCOUNT_TTL_HOURS',
      ],
    },
    {
      id: 'content',
      titleKey: 'admin.settings.subsections.lifecycle.content',
      icon: Link2,
      keys: ['LIFECYCLE_VIDEO_GUIDE_URL', 'LIFECYCLE_SUPPORT_CONTACT'],
    },
  ],
  fortune: [
    {
      id: 'basic',
      titleKey: 'admin.settings.fortune.basic',
      icon: Settings2,
      keys: [
        'FORTUNE_ENABLED',
        'FORTUNE_MAX_SPINS_PER_DAY',
        'FORTUNE_MIN_SUBSCRIPTION_DAYS',
        'FORTUNE_SPIN_COST_DAYS',
        'FORTUNE_DAILY_FREE_SPIN',
      ],
    },
    {
      id: 'ticker',
      titleKey: 'admin.settings.fortune.ticker',
      icon: ScrollText,
      keys: ['FORTUNE_WINNER_TICKER_ENABLED', 'FORTUNE_WINNER_TICKER_FAKE_FILL'],
    },
    {
      id: 'weights',
      titleKey: 'admin.settings.fortune.weights',
      icon: Percent,
      keys: [
        'FORTUNE_WEIGHT_MICRO',
        'FORTUNE_WEIGHT_XP',
        'FORTUNE_WEIGHT_DISCOUNT_3',
        'FORTUNE_WEIGHT_DAYS_3',
        'FORTUNE_WEIGHT_DISCOUNT_5',
        'FORTUNE_WEIGHT_DAYS_5',
        'FORTUNE_WEIGHT_DAYS_7',
        'FORTUNE_WEIGHT_DAYS_15',
        'FORTUNE_WEIGHT_DAYS_30',
        'FORTUNE_WEIGHT_DAYS_180',
      ],
    },
    {
      id: 'rewards',
      titleKey: 'admin.settings.fortune.rewards',
      icon: Trophy,
      keys: [
        'FORTUNE_REWARD_XP_AMOUNT',
        'FORTUNE_REWARD_MICRO_XP_MIN',
        'FORTUNE_REWARD_MICRO_XP_MAX',
        'FORTUNE_REWARD_DISCOUNT_3_PERCENT',
        'FORTUNE_REWARD_DISCOUNT_5_PERCENT',
        'FORTUNE_REWARD_DAYS_3',
        'FORTUNE_REWARD_DAYS_5',
        'FORTUNE_REWARD_DAYS_7',
        'FORTUNE_REWARD_DAYS_15',
        'FORTUNE_REWARD_DAYS_30',
        'FORTUNE_REWARD_DAYS_180',
      ],
    },
  ],
  cabinet: [
    {
      id: 'decor',
      titleKey: 'admin.settings.subsections.cabinet.decor',
      icon: Sparkles,
      keys: ['CABINET_LIGHT_THEME_ENABLED', 'CABINET_DECOR_THEME'],
    },
  ],
  tariffs: [
    {
      id: 'showcase',
      titleKey: 'admin.settings.subsections.tariffs.showcase',
      icon: BadgeRussianRuble,
      keys: ['CABINET_TARIFF_PRICE_DISPLAY'],
    },
  ],
}

export interface AdminSettingsSubsectionBlock {
  def: AdminSettingsSubsectionDef | null
  fields: { key: string }[]
}

export function splitGroupIntoSubsections(groupId: string, fieldKeys: string[]): AdminSettingsSubsectionBlock[] {
  const defs = ADMIN_SETTINGS_SUBSECTIONS[groupId as AdminSettingsGroupId]
  if (!defs?.length) {
    return [{ def: null, fields: fieldKeys.map((key) => ({ key })) }]
  }

  const keySet = new Set(fieldKeys)
  const used = new Set<string>()
  const blocks: AdminSettingsSubsectionBlock[] = []

  for (const def of defs) {
    const keys = def.keys.filter((k) => keySet.has(k))
    if (keys.length === 0) continue
    keys.forEach((k) => used.add(k))
    blocks.push({ def, fields: keys.map((key) => ({ key })) })
  }

  const rest = fieldKeys.filter((k) => !used.has(k))
  if (rest.length > 0) {
    blocks.push({ def: null, fields: rest.map((key) => ({ key })) })
  }

  return blocks
}

export function adminSettingsGroupAnchor(id: string): string {
  return `settings-group-${id}`
}

export function scrollToSettingsGroup(id: string): void {
  const el = document.getElementById(adminSettingsGroupAnchor(id))
  if (!el) return

  const scroll = () => {
    const headerOffset = 96
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  scroll()
  window.setTimeout(scroll, 320)
}
