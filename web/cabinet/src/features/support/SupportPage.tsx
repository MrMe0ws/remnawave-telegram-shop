import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

const SUPPORT_KEYS = ['bot', 'support', 'channel', 'feedback'] as const

export default function SupportPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useAuthBootstrap()
  const siteLinks = data?.site_links

  const keys = SUPPORT_KEYS.filter((k) => siteLinks?.[k])

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-semibold">{t('support.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('support.intro')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('support.sectionContact')}</CardTitle>
            <CardDescription>{t('support.sectionContactHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('support.empty')}</p>
            ) : (
              <ul className="space-y-1">
                {keys.map((key) => (
                  <li key={key}>
                    <a
                      href={siteLinks![key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      {t(`siteLink.${key}`)}
                      <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
