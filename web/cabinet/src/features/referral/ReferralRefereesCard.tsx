import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReferralsResponse } from '@/lib/api'

/** Приглашённые: кто пришёл по ссылке и кто из них ещё с нами. */
export function ReferralRefereesCard({ referees }: { referees: ReferralsResponse['referees'] }) {
  const { t } = useTranslation()

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2">
        <Users size={18} className="text-muted-foreground" />
        <CardTitle className="text-base">{t('referralPage.listTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!referees.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('referralPage.emptyList')}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {referees.map((r, i) => (
              <li
                key={`${r.telegram_id_masked}-${i}`}
                className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="font-mono text-xs">{refereeName(r)}</span>
                <Badge variant={r.active ? 'default' : 'secondary'}>
                  {r.active ? t('referralPage.badgeActive') : t('referralPage.badgeInactive')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function refereeName(r: ReferralsResponse['referees'][number]): string {
  if (r.telegram_username) {
    // Пробел в «имени» означает, что это не username, а имя пользователя:
    // собаку к нему приписывать нельзя.
    return r.telegram_username.includes(' ') ? r.telegram_username : `@${r.telegram_username}`
  }
  if (r.email) return maskReferralEmail(r.email)
  return r.telegram_id_masked
}

function maskReferralEmail(email: string): string {
  const value = String(email).trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at <= 0 || at >= value.length - 1) return value
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}
