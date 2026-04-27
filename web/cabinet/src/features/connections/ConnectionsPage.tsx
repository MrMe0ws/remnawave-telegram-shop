import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

/** Подключение устройства: пока ведём на страницу подписки Remnawave (как в ТЗ). */
export default function ConnectionsPage() {
  const { t } = useTranslation()

  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  const url = sub?.subscription_link?.trim() || ''

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-semibold">{t('connections.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('connections.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('connections.guideTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>{t('connections.step1')}</li>
              <li>{t('connections.step2')}</li>
              <li>{t('connections.step3')}</li>
            </ol>
            {isLoading ? (
              <p>{t('common.loading')}</p>
            ) : url ? (
              <Button className="w-full gap-2" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} />
                  {t('connections.openSubscriptionPage')}
                </a>
              </Button>
            ) : (
              <p>{t('connections.noLink')}</p>
            )}
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/subscription">{t('connections.backToSubscription')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
