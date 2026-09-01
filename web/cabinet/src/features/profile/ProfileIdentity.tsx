/**
 * Шапка профиля: аватарка, имя и @username того, кто вошёл.
 *
 * Данные приходят из /me уже разрешёнными бэкендом (см. me_identity.go) —
 * здесь остаются только те запасные варианты, которым нужен перевод:
 * «Аккаунт №…», маска почты, подпись про непривязанный Telegram.
 *
 * Пока живут два варианта вёрстки, C и D. Переключатель — временный, чтобы
 * выбрать на живом кабинете; после выбора лишний вариант и весь механизм
 * переключения удаляются (см. useProfileHeaderVariant).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { GoogleBrandIcon, TelegramBrandIcon, VKBrandIcon, YandexBrandIcon } from '@/components/BrandIcons'
import { useAuthStore } from '@/store/auth'
import { cn, maskEmail } from '@/lib/utils'
import type { MeResponse } from '@/lib/api'

/**
 * Подложки под инициалы. Выбор детерминирован по id аккаунта: один и тот же
 * человек всегда видит один и тот же цвет, и карточка не выглядит случайной.
 */
const INITIAL_GRADIENTS = [
  'from-sky-500 to-indigo-500',
  'from-violet-500 to-fuchsia-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-600',
]

export type ProfileIdentity = {
  /** Первая строка карточки. */
  name: string
  /** Вторая строка: @ник, ID или маска почты. */
  secondary: string
  avatarUrl?: string
  provider?: MeResponse['identity_provider']
  initials: string
  gradient: string
  /** Ник Telegram без «@» — нужен отдельной строкой в варианте C. */
  username?: string
}

/** Первые буквы одного-двух слов. Через spread — чтобы не разрезать эмодзи. */
function initialsFrom(source: string): string {
  const words = source.replace(/^@/, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '#'
  const first = [...words[0]][0] ?? ''
  const second = words.length > 1 ? ([...words[1]][0] ?? '') : ''
  return (first + second).toUpperCase()
}

/** Собирает шапку из /me. null — пока /me не ответил. */
export function useProfileIdentity(): ProfileIdentity | null {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  return useMemo(() => {
    if (!user) return null

    const username = (user.username ?? '').trim()
    const displayName = (user.display_name ?? '').trim()
    const email = (user.email ?? '').trim()
    const providerEmail =
      user.google_masked_email || user.yandex_masked_email || user.vk_masked_email || ''

    const name =
      displayName ||
      (username ? `@${username}` : '') ||
      (email ? maskEmail(email) : '') ||
      providerEmail ||
      t('profile.identity.fallbackName', { id: user.id })

    let secondary: string
    if (username && name !== `@${username}`) {
      secondary = `@${username}`
    } else if (user.has_telegram_link && user.telegram_id != null) {
      // Ник в Telegram может быть не задан — тогда вторая строка это ID.
      secondary = `ID ${user.telegram_id}`
    } else if (providerEmail) {
      secondary = providerEmail
    } else if (email) {
      secondary = maskEmail(email)
    } else {
      secondary = t('profile.identity.noLinkHint')
    }
    if (secondary === name) {
      // Почтовый аккаунт без имени: маска почты уже стоит первой строкой,
      // дублировать её незачем.
      secondary = t('profile.identity.emailLogin')
    }

    return {
      name,
      secondary,
      avatarUrl: user.avatar_url,
      provider: user.identity_provider,
      initials: initialsFrom(displayName || username || email || ''),
      gradient: INITIAL_GRADIENTS[Math.abs(user.id) % INITIAL_GRADIENTS.length],
      username: username || undefined,
    }
  }, [t, user])
}

const AVATAR_SIZES = {
  sm: { box: 'size-10', text: 'text-sm', badge: 'size-4 -right-0.5 -bottom-0.5', icon: 'size-2.5' },
  md: { box: 'size-14', text: 'text-lg', badge: 'size-5 -right-0.5 -bottom-0.5', icon: 'size-3' },
} as const

function ProviderBadge({ provider, size }: { provider: ProfileIdentity['provider']; size: 'sm' | 'md' }) {
  if (!provider) return null
  const s = AVATAR_SIZES[size]
  const icon =
    provider === 'telegram' ? (
      <TelegramBrandIcon className={s.icon} />
    ) : provider === 'google' ? (
      <GoogleBrandIcon className={s.icon} />
    ) : provider === 'yandex' ? (
      <YandexBrandIcon className={s.icon} />
    ) : (
      <VKBrandIcon className={s.icon} />
    )
  return (
    <span
      className={cn(
        'absolute inline-flex items-center justify-center rounded-full border-2 border-card bg-card',
        s.badge,
      )}
      aria-hidden
    >
      {icon}
    </span>
  )
}

/** Аватарка с бейджем провайдера и запасными инициалами. */
export function ProfileAvatar({
  identity,
  size = 'md',
  className,
}: {
  identity: ProfileIdentity
  size?: 'sm' | 'md'
  className?: string
}) {
  // Запоминаем именно упавший URL: после смены аватарки новую ссылку надо
  // попробовать снова, а не остаться навсегда на инициалах.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const s = AVATAR_SIZES[size]
  const url = identity.avatarUrl
  const showImage = Boolean(url) && failedUrl !== url

  return (
    <span className={cn('relative inline-flex shrink-0', s.box, className)}>
      <span className="size-full overflow-hidden rounded-full bg-secondary">
        {showImage ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
            onError={() => setFailedUrl(url ?? null)}
          />
        ) : (
          <span
            className={cn(
              'flex size-full items-center justify-center bg-gradient-to-br font-semibold text-white',
              identity.gradient,
              s.text,
            )}
            aria-hidden
          >
            {identity.initials}
          </span>
        )}
      </span>
      <ProviderBadge provider={identity.provider} size={size} />
    </span>
  )
}

/**
 * Вариант C: аватарка встаёт в строку заголовка, «Профиль» уезжает наверх
 * мелкой надписью, имя занимает его место. Страница не становится длиннее.
 */
export function ProfileIdentityTitle({ identity }: { identity: ProfileIdentity | null }) {
  const { t } = useTranslation()
  if (!identity) return <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
  return (
    <div className="flex items-center gap-3">
      <ProfileAvatar identity={identity} size="sm" />
      <div className="min-w-0">
        <p className="text-xs leading-none text-muted-foreground">{t('profile.title')}</p>
        <h1 className="mt-1 truncate text-2xl font-semibold leading-tight">{identity.name}</h1>
      </div>
    </div>
  )
}

/**
 * Вариант D: имя становится шапкой карточки «Информация об аккаунте», новых
 * блоков на странице не появляется.
 */
export function ProfileIdentityHeader({ identity }: { identity: ProfileIdentity | null }) {
  if (!identity) return null
  return (
    <div className="flex items-center gap-3 pb-3">
      <ProfileAvatar identity={identity} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-snug sm:text-[18px]">{identity.name}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{identity.secondary}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Временный переключатель вариантов
// ---------------------------------------------------------------------------

export type ProfileHeaderVariant = 'c' | 'd'

const VARIANT_STORAGE_KEY = 'cabinet:profile-header-variant'

function readStoredVariant(): ProfileHeaderVariant | null {
  try {
    const raw = window.localStorage.getItem(VARIANT_STORAGE_KEY)
    return raw === 'c' || raw === 'd' ? raw : null
  } catch {
    // Приватный режим / запрещённые куки — просто работаем со значением по умолчанию.
    return null
  }
}

/**
 * Текущий вариант шапки. Приоритет: ?header=c|d в адресе (чтобы показать
 * коллеге ссылкой) → сохранённый выбор → C.
 */
export function useProfileHeaderVariant(): [ProfileHeaderVariant, (next: ProfileHeaderVariant) => void] {
  const location = useLocation()
  const fromQuery = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('header')?.toLowerCase()
    return raw === 'c' || raw === 'd' ? (raw as ProfileHeaderVariant) : null
  }, [location.search])

  const [variant, setVariant] = useState<ProfileHeaderVariant>(() => fromQuery ?? readStoredVariant() ?? 'c')

  useEffect(() => {
    if (fromQuery) setVariant(fromQuery)
  }, [fromQuery])

  const update = useCallback((next: ProfileHeaderVariant) => {
    setVariant(next)
    try {
      window.localStorage.setItem(VARIANT_STORAGE_KEY, next)
    } catch {
      // Выбор не переживёт перезагрузку — не повод ломать переключение.
    }
  }, [])

  return [variant, update]
}

/**
 * Переключатель C/D. Показывается администратору либо любому, кто пришёл по
 * ссылке с ?header=. Уедет вместе с проигравшим вариантом.
 */
export function ProfileHeaderVariantSwitch({
  variant,
  onChange,
}: {
  variant: ProfileHeaderVariant
  onChange: (next: ProfileHeaderVariant) => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const isAdmin = useAuthStore((s) => s.user?.is_admin)
  const forced = new URLSearchParams(location.search).has('header')
  if (!isAdmin && !forced) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border/80 px-3 py-2">
      <span className="text-xs text-muted-foreground">{t('profile.identity.variantLabel')}</span>
      <div className="flex gap-1">
        {(['c', 'd'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={variant === id}
            onClick={() => onChange(id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors',
              variant === id
                ? 'bg-secondary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {id}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">{t('profile.identity.variantHint')}</span>
    </div>
  )
}
