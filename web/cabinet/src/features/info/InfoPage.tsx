import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

const LEGAL_KEYS = ['public_offer', 'privacy_policy', 'terms_of_service', 'tos'] as const
const RESOURCE_KEYS = ['server_status', 'video_guide', 'server_selection', 'channel'] as const

function LinkList({ keys, siteLinks }: { keys: readonly string[]; siteLinks: Record<string, string> }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-1">
      {keys.map((key) => (
        <li key={key}>
          <a
            href={siteLinks[key]}
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
  )
}

export default function InfoPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useAuthBootstrap()
  const siteLinks = data?.site_links

  const legal = LEGAL_KEYS.filter((k) => siteLinks?.[k])
  const resources = RESOURCE_KEYS.filter((k) => siteLinks?.[k])
  const hasAny = legal.length > 0 || resources.length > 0

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-semibold">{t('info.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('info.intro')}</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !hasAny || !siteLinks ? (
          <p className="text-sm text-muted-foreground">{t('info.empty')}</p>
        ) : (
          <div className="space-y-4">
            {legal.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('info.sectionLegal')}</CardTitle>
                  <CardDescription>{t('info.sectionLegalHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LinkList keys={legal} siteLinks={siteLinks} />
                </CardContent>
              </Card>
            ) : null}
            {resources.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('info.sectionResources')}</CardTitle>
                  <CardDescription>{t('info.sectionResourcesHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LinkList keys={resources} siteLinks={siteLinks} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
