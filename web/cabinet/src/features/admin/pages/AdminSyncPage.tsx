import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export default function AdminSyncPage() {
  const { t } = useTranslation()
  const [success, setSuccess] = useState(false)

  const syncMutation = useMutation({
    mutationFn: () => api.adminSync(),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    },
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          icon={RefreshCw}
          title={t('admin.sync.title')}
          subtitle={t('admin.sync.subtitle')}
          accent="cyan"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.sync.cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('admin.sync.description')}
            </p>

            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? t('admin.sync.inProgress') : t('admin.sync.trigger')}
            </Button>

            {success && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                {t('admin.sync.started')}
              </div>
            )}

            {syncMutation.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {t('admin.sync.error')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
