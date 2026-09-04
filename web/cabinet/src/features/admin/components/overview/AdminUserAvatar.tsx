import { useState } from 'react'
import { User } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rwIconToneClassNames, type RwIconTone } from '../../utils/rwStatusStyles'

/**
 * Аватарка пользователя в админской карточке.
 *
 * Картинка приходит подписанной ссылкой `/cabinet/api/avatar` — тем же
 * механизмом, что и в профиле кабинета (см. avatartoken). Наличие фотографии
 * бэкенд не проверяет: это стоило бы запроса в Telegram на каждую карточку,
 * поэтому 404 здесь — законный ответ, и по `onError` мы падаем в инициалы.
 *
 * Цвет кольца несёт статус аккаунта: активен, отключён, истёк. Так статус
 * читается даже там, где бейдж не поместился.
 */
const RING_CLASS: Record<RwIconTone, string> = {
  success: 'ring-emerald-500/45',
  danger: 'ring-red-500/45',
  warning: 'ring-amber-500/45',
  default: 'ring-border',
}

/** Первые буквы одного-двух слов; эмодзи не разрезаются. */
function initialsFrom(source: string): string {
  const words = source.replace(/^[@#]/, '').trim().split(/[\s_.-]+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = [...words[0]][0] ?? ''
  const second = words.length > 1 ? ([...words[1]][0] ?? '') : ''
  return (first + second).toUpperCase()
}

interface Props {
  /** Подписанная ссылка на картинку; пусто — сразу инициалы. */
  url?: string | null
  /** Ник или имя: из него берутся инициалы. */
  name: string
  tone: RwIconTone
  /** Крупная аватарка в колонке личности, мелкая — в списках. */
  size?: 'sm' | 'md'
  className?: string
}

export function AdminUserAvatar({ url, name, tone, size = 'md', className }: Props) {
  // Запоминаем именно упавший URL: после смены аватарки новая ссылка должна
  // попробовать загрузиться снова, а не остаться навсегда на инициалах.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(url) && failedUrl !== url

  const tones = rwIconToneClassNames(tone)
  const initials = initialsFrom(name)
  const box = size === 'sm' ? 'size-9' : 'size-12'

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-card',
        box,
        RING_CLASS[tone],
        className,
      )}
    >
      {showImage ? (
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedUrl(url ?? null)}
        />
      ) : (
        <span
          className={cn(
            'flex size-full items-center justify-center font-semibold',
            size === 'sm' ? 'text-xs' : 'text-sm',
            tones.boxClassName,
            tones.iconClassName,
          )}
          aria-hidden
        >
          {initials || <User className={size === 'sm' ? 'size-4' : 'size-5'} />}
        </span>
      )}
    </span>
  )
}
