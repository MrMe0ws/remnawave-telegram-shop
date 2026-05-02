import { MessageCircle } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useCabinetContentConfig } from '@/features/info/contentConfig'

export default function SupportPage() {
  const { data, isLoading } = useAuthBootstrap()
  const { data: content, isLoading: contentLoading } = useCabinetContentConfig()
  const siteLinks = data?.site_links
  const supportURL = siteLinks?.support

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl py-8">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-muted/40 text-card-foreground shadow-lg">
          <CardContent className="space-y-6 px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <MessageCircle className="size-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {content?.support.title ?? 'Поддержка'}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {content?.support.description ?? 'Если у вас возникли вопросы или проблемы с подключением, наша поддержка поможет их решить.'}
              </p>
            </div>
            {isLoading || contentLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : supportURL ? (
              <Button
                asChild
                className="w-full shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
              >
                <a href={supportURL} target="_blank" rel="noopener noreferrer">
                  {content?.support.primary_button ?? 'Написать в поддержку'}
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Ссылка поддержки не настроена</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
