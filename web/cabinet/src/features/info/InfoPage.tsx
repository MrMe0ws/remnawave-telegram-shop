import { useMemo, useState } from 'react'
import { ExternalLink, FileText, HelpCircle, ShieldCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useCabinetContentConfig } from './contentConfig'

type TabId = 'faq' | 'documents' | 'status' | 'useful_links'

export default function InfoPage() {
  const { data, isLoading } = useAuthBootstrap()
  const { data: content, isLoading: contentLoading } = useCabinetContentConfig()
  const siteLinks = data?.site_links
  const [tab, setTab] = useState<TabId>('faq')

  const tabsBase = content?.info.tabs ?? [
    { id: 'faq' as const, label: 'FAQ' },
    { id: 'documents' as const, label: 'Документы' },
    { id: 'status' as const, label: 'Статус' },
  ]
  const usefulLinks = (content?.info.useful_links ?? []).filter((x) => siteLinks?.[x.link_key])
  const tabs: { id: TabId; label: string }[] = [
    ...tabsBase.map((t) => ({ id: t.id as TabId, label: t.label })),
    ...(usefulLinks.length > 0 ? [{ id: 'useful_links' as const, label: 'Полезные ссылки' }] : []),
  ]
  const faq = content?.faq ?? []
  const docs = (content?.info.documents ?? []).filter((x) => siteLinks?.[x.link_key])
  const statusUrl = siteLinks?.server_status
  const loading = isLoading || contentLoading
  const hasFaq = faq.length > 0
  const hasDocs = docs.length > 0
  const canShowStatus = Boolean(statusUrl)

  const visibleFaq = useMemo(() => faq, [faq])

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {content?.info.title ?? 'Информация'}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={tab === item.id ? 'default' : 'outline'}
              className={tab === item.id ? 'shadow-[0_0_20px_rgba(34,158,217,0.35)]' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <>
            {tab === 'faq' && (
              <div className="space-y-3">
                {!hasFaq ? (
                  <p className="text-sm text-muted-foreground">FAQ пока не заполнен</p>
                ) : (
                  visibleFaq.map((item) => (
                    <details
                      key={item.id}
                      className="group rounded-xl border border-border/70 bg-card/70 p-4 open:border-primary/35"
                    >
                      <summary className="cursor-pointer list-none text-base font-medium">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <HelpCircle className="size-4 text-primary/85" />
                            {item.question}
                          </span>
                          <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
                            code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>,
                          }}
                        >
                          {item.answer_md}
                        </ReactMarkdown>
                        {item.link_key && siteLinks?.[item.link_key] && (
                          <a
                            href={siteLinks[item.link_key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          >
                            Открыть материал
                            <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          </a>
                        )}
                      </div>
                    </details>
                  ))
                )}
              </div>
            )}

            {tab === 'documents' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Документы</CardTitle>
                  <CardDescription>Юридические документы и условия использования</CardDescription>
                </CardHeader>
                <CardContent>
                  {!hasDocs ? (
                    <p className="text-sm text-muted-foreground">Документы не настроены</p>
                  ) : (
                    <ul className="space-y-2">
                      {docs.map((doc) => (
                        <li key={doc.link_key}>
                          <a
                            href={siteLinks?.[doc.link_key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          >
                            <FileText className="size-4 text-primary/80" />
                            {doc.label}
                            <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {tab === 'status' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="size-5 text-emerald-500" />
                    {content?.info.status.title ?? 'Статус сервисов'}
                  </CardTitle>
                  <CardDescription>
                    {content?.info.status.description ?? 'Проверяйте актуальное состояние сервисов'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canShowStatus ? (
                    <Button asChild>
                      <a href={statusUrl} target="_blank" rel="noopener noreferrer">
                        {content?.info.status.button ?? 'Открыть статус'}
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ссылка статуса не настроена</p>
                  )}
                </CardContent>
              </Card>
            )}

            {tab === 'useful_links' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Полезные ссылки</CardTitle>
                  <CardDescription>Новости, отзывы и другие полезные материалы</CardDescription>
                </CardHeader>
                <CardContent>
                  {usefulLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ссылки не настроены</p>
                  ) : (
                    <ul className="space-y-2">
                      {usefulLinks.map((l) => (
                        <li key={l.link_key}>
                          <a
                            href={siteLinks?.[l.link_key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
