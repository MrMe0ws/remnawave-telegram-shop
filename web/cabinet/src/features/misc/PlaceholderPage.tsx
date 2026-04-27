import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PlaceholderPageProps {
  titleKey: string
  bodyKey: string
}

/** Заглушка для разделов в разработке (/payments, /support, /info, /referral). */
export function PlaceholderPage({ titleKey, bodyKey }: PlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl">
        <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-4">
            <p>{t(bodyKey)}</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">{t('stub.backHome')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
