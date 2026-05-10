import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useCabinetContentConfig } from '@/features/info/contentConfig'
import { InfoPanel } from '@/features/info/InfoPanel'

const INFO_HASH = 'cabinet-info'
const SUPPORT_ANCHOR = 'cabinet-support'

export default function SupportPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { data, isLoading } = useAuthBootstrap()
  const { data: content, isLoading: contentLoading } = useCabinetContentConfig()
  const siteLinks = data?.site_links
  const supportURL = siteLinks?.support
  const infoRef = useRef<HTMLElement>(null)

  const layoutReady = !isLoading && !contentLoading

  useEffect(() => {
    function scrollToInfoBlock(): void {
      const fromWindow = (window.location.hash || '').replace(/^#/, '')
      const fromRouter = (location.hash || '').replace(/^#/, '')
      const raw = fromWindow || fromRouter
      if (raw !== INFO_HASH) return
      const el = infoRef.current ?? document.getElementById(INFO_HASH)
      el?.scrollIntoView({ behavior: 'auto', block: 'start' })
    }

    scrollToInfoBlock()

    const timeouts = [50, 150, 400, 900, 1600].map((ms) => window.setTimeout(scrollToInfoBlock, ms))

    function onHashChange() {
      scrollToInfoBlock()
    }
    window.addEventListener('hashchange', onHashChange)

    return () => {
      timeouts.forEach(clearTimeout)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [location.hash, location.pathname, layoutReady])

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl space-y-8 py-2">
        <section id={SUPPORT_ANCHOR} className="scroll-mt-24">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-muted/40 text-card-foreground">
            <CardContent className="space-y-6 px-[10px] py-[15px] text-center sm:px-6 sm:py-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <MessageCircle className="size-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold">
                  {content?.support.title ?? 'Поддержка'}
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {content?.support.description ??
                    'Если у вас возникли вопросы или проблемы с подключением, наша поддержка поможет их решить.'}
                </p>
              </div>
              {isLoading || contentLoading ? (
                <p className="text-sm text-muted-foreground">Загрузка…</p>
              ) : supportURL ? (
                <Button
                  asChild
                  className="w-full shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)]"
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
        </section>

        <section id={INFO_HASH} ref={infoRef} className="scroll-mt-24 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('supportPage.infoSectionTitle')}</h2>
          </div>
          <InfoPanel hideTitle />
        </section>
      </div>
    </AppLayout>
  )
}
