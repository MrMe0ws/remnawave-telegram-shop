/**
 * Шапка профиля: аватарка, имя и @username того, кто вошёл.
 *
 * Данные приходят из /me уже разрешёнными бэкендом (см. me_identity.go) —
 * здесь остаются только те запасные варианты, которым нужен перевод:
 * «Аккаунт №…», маска почты, подпись про непривязанный Telegram.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
    }
  }, [t, user])
}

function ProviderBadge({ provider }: { provider: ProfileIdentity['provider'] }) {
  if (!provider) return null
  const icon =
    provider === 'telegram' ? (
      <TelegramBrandIcon className="size-3" />
    ) : provider === 'google' ? (
      <GoogleBrandIcon className="size-3" />
    ) : provider === 'yandex' ? (
      <YandexBrandIcon className="size-3" />
    ) : (
      <VKBrandIcon className="size-3" />
    )
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 inline-flex size-5 items-center justify-center rounded-full border-2 border-card bg-card"
      aria-hidden
    >
      {icon}
    </span>
  )
}

/** Аватарка с бейджем провайдера и запасными инициалами. */
export function ProfileAvatar({
  identity,
  className,
}: {
  identity: ProfileIdentity
  className?: string
}) {
  // Запоминаем именно упавший URL: после смены аватарки новую ссылку надо
  // попробовать снова, а не остаться навсегда на инициалах.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = identity.avatarUrl
  const showImage = Boolean(url) && failedUrl !== url

  return (
    <span className={cn('relative inline-flex size-14 shrink-0', className)}>
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
              'flex size-full items-center justify-center bg-gradient-to-br text-lg font-semibold text-white',
              identity.gradient,
            )}
            aria-hidden
          >
            {identity.initials}
          </span>
        )}
      </span>
      <ProviderBadge provider={identity.provider} />
    </span>
  )
}

/** Имя и ник шапкой карточки «Информация об аккаунте». */
export function ProfileIdentityHeader({ identity }: { identity: ProfileIdentity | null }) {
  if (!identity) return null
  return (
    <div className="flex items-center gap-3 pb-3">
      <ProfileAvatar identity={identity} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-snug sm:text-[18px]">{identity.name}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{identity.secondary}</p>
      </div>
    </div>
  )
}
