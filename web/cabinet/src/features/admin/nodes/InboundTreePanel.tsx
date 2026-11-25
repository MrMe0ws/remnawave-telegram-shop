import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Network, Server, Sparkle } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CountryFlag } from '../components/CountryFlag'
import { NodeSidePanel } from './NodeSidePanel'
import { HeaderIconButton, PanelEmpty, PanelError, PanelSkeleton } from './panelUi'

/** Заголовок сворачиваемого уровня дерева. */
function Branch({
  open,
  onToggle,
  children,
  right,
  className,
}: {
  open: boolean
  onToggle: () => void
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={open ? t('admin.nodes.panels.tree.collapse') : t('admin.nodes.panels.tree.expand')}
      className={cn('flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors', className)}
    >
      <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">{children}</span>
      {right}
    </button>
  )
}

export function InboundTreePanel({
  nodeUuid,
  open,
  onClose,
  onOpenHost,
}: {
  nodeUuid: string
  open: boolean
  onClose: () => void
  /** Клик по хосту: открыть его настройки. */
  onOpenHost?: (hostUuid: string) => void
}) {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['admin-node-inbound-tree', nodeUuid],
    queryFn: () => api.adminNodeInboundTree(nodeUuid),
    enabled: open,
  })
  // true в карте — уровень свёрнут; по умолчанию всё развёрнуто.
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const isOpen = (k: string) => !closed[k]
  const toggle = (k: string) => setClosed((c) => ({ ...c, [k]: !c[k] }))

  const tree = q.data
  return (
    <NodeSidePanel
      open={open}
      onClose={onClose}
      title={t('admin.nodes.panels.tree.title')}
      icon={Network}
    >
      {q.isLoading && <PanelSkeleton rows={3} />}
      {q.isError && !tree && <PanelError onRetry={() => void q.refetch()} />}
      {tree && (
        <div className="flex flex-col gap-2">
          <Branch open={isOpen('node')} onToggle={() => toggle('node')} className="border-emerald-500/30 bg-emerald-500/10">
            <CountryFlag code={tree.node.country_code} className="h-4 w-[22px] shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{tree.node.name}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">{tree.node.address}</span>
            </span>
          </Branch>

          {isOpen('node') && (
            <div className="ml-3.5 flex flex-col gap-2 border-l border-border/80 pl-3">
              {!tree.profile && <PanelEmpty icon={Server}>{t('admin.nodes.panels.tree.noProfile')}</PanelEmpty>}
              {tree.profile && (
                <>
                  <Branch
                    open={isOpen('profile')}
                    onToggle={() => toggle('profile')}
                    className="border-sky-500/30 bg-sky-500/10"
                    right={
                      <span className="shrink-0 rounded-md border border-sky-500/30 px-1.5 py-0.5 font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                        {tree.inbounds.length}
                      </span>
                    }
                  >
                    <Sparkle className="size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                    <span className="min-w-0 truncate font-mono text-sm font-bold">{tree.profile.name}</span>
                  </Branch>

                  {isOpen('profile') && tree.inbounds.length === 0 && (
                    <div className="ml-3.5 border-l border-border/80 py-2 pl-3 text-sm text-muted-foreground">
                      {t('admin.nodes.panels.tree.noInbounds')}
                    </div>
                  )}
                  {isOpen('profile') &&
                    tree.inbounds.map((ib) => (
                      <div key={ib.uuid} className="ml-3.5 flex flex-col gap-2 border-l border-border/80 pl-3">
                        <Branch
                          open={isOpen(ib.uuid)}
                          onToggle={() => toggle(ib.uuid)}
                          className="border-border/70 bg-muted/30"
                          right={
                            <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                              {t('admin.nodes.panels.tree.hostsCount', { count: ib.hosts.length })}
                            </span>
                          }
                        >
                          <span className="min-w-0 break-all font-mono text-sm font-bold">{ib.tag}</span>
                          <span className="shrink-0 rounded border border-violet-500/35 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-violet-700 dark:text-violet-300">
                            {ib.type}
                          </span>
                          <span className="shrink-0 rounded border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                            {ib.port}
                          </span>
                        </Branch>

                        {isOpen(ib.uuid) && (
                          <ul className="ml-3.5 flex flex-col gap-1.5 border-l border-border/80 pl-3">
                            {ib.hosts.length === 0 && (
                              <li className="py-1 text-sm text-muted-foreground">{t('admin.nodes.panels.tree.noHosts')}</li>
                            )}
                            {ib.hosts.map((h) => (
                              <li key={h.uuid}>
                                <button
                                  type="button"
                                  onClick={() => onOpenHost?.(h.uuid)}
                                  className={cn(
                                    'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/40',
                                    h.linked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/60 bg-muted/20 opacity-60 hover:opacity-100',
                                  )}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block break-words text-[13px] font-semibold leading-snug">{h.remark}</span>
                                    <span className="block truncate font-mono text-[11.5px] text-muted-foreground">
                                      {h.address}:{h.port}
                                    </span>
                                  </span>
                                  {h.is_disabled && (
                                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                      {t('admin.nodes.panels.tree.disabled')}
                                    </span>
                                  )}
                                  {h.linked && (
                                    <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                      {t('admin.nodes.panels.tree.linked')}
                                    </span>
                                  )}
                                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </NodeSidePanel>
  )
}
