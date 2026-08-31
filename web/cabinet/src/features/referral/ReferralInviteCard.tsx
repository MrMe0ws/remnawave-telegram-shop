import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { QrCode } from '@/components/QrCode'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { ReferralCopyRow } from './ReferralCopyRow'

export interface ReferralLink {
  key: 'bot' | 'cabinet'
  label: string
  url: string
}

/**
 * Приглашение первым экраном: QR, ссылка и одна кнопка.
 *
 * Раньше ссылки лежали третьей карточкой под правилами начисления — чтобы
 * поделиться, надо было проскроллить условия и найти строку моноширинного
 * текста. Задача страницы ровно одна: чтобы ссылкой поделились, поэтому она
 * стоит выше всего остального.
 *
 * QR решает офлайн-сценарий, ради которого рефералкой и пользуются, — показать
 * телефон другу за столом. Ссылку в этот момент диктовать невозможно.
 *
 * Ссылок у пользователя две — в бота и на регистрацию в кабинете, — и они
 * ведут на один аккаунт. Показывать два QR рядом нельзя: это ровно тот вопрос
 * «а какой из них правильный», на который отвечает подпись под переключателем,
 * и на телефоне оба кода получились бы вдвое мельче. Поэтому код один, а
 * переключатель меняет и его, и строку, и кнопку «Поделиться». Если ссылка
 * настроена только одна, переключателя нет вовсе.
 */
export function ReferralInviteCard({
  links,
  refereeDays,
  canShare,
  onShare,
}: {
  links: ReferralLink[]
  /** Сколько дней получит приглашённый. 0 — в этом режиме подарка нет. */
  refereeDays: number
  canShare: boolean
  onShare: (url: string) => void
}) {
  const { t } = useTranslation()
  const [activeKey, setActiveKey] = useState<ReferralLink['key']>(links[0]?.key ?? 'bot')

  const active = links.find((l) => l.key === activeKey) ?? links[0]
  if (!active) return null

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="pt-6">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
          {/* Белое поле вокруг кода — требование читаемости, а не украшение:
              QR сканируют с чужого телефона под углом и при бликах. */}
          <div className="mx-auto w-full max-w-[168px] rounded-xl bg-white p-2.5 shadow-sm sm:mx-0">
            <QrCode
              value={active.url}
              size={168}
              className="h-auto w-full"
              title={t('referralPage.invite.qrAlt')}
            />
          </div>

          <div className="min-w-0">
            {refereeDays > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Gift size={13} />
                {t('referralPage.invite.refereeBadge', { count: refereeDays })}
              </span>
            ) : null}

            <h2 className="mt-2 text-balance text-xl font-bold tracking-tight sm:text-2xl">
              {t('referralPage.invite.title')}
            </h2>

            {links.length > 1 ? (
              <>
                <div
                  role="group"
                  aria-label={t('referralPage.invite.switchLabel')}
                  className="mt-3 inline-flex rounded-lg border border-border bg-secondary p-0.5"
                >
                  {links.map((link) => (
                    <button
                      key={link.key}
                      type="button"
                      aria-pressed={link.key === active.key}
                      onClick={() => setActiveKey(link.key)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        link.key === active.key
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('referralPage.invite.bothLinks')}
                </p>
              </>
            ) : null}

            <div className="mt-3">
              <ReferralCopyRow
                label={t('referralPage.invite.linkLabel')}
                value={active.url}
                canShare={canShare}
                onShare={() => onShare(active.url)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
