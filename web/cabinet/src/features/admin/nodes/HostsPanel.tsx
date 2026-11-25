import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Braces,
  Combine,
  EyeOff,
  KeyRound,
  Layers,
  ListChecks,
  Eraser,
  Globe,
  Pin,
  Route,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CountryFlag } from '../components/CountryFlag'
import type { AdminHostDTO, AdminHostFeature } from '@/lib/types/admin'
import { NodeSidePanel } from './NodeSidePanel'
import { PanelEmpty, PanelError, PanelSkeleton } from './panelUi'
import { HostEditBody, HostEditDialogs, HostEditFooter, useHostEditor } from './HostEditPanel'

/** Значки возможностей хоста, в порядке из контракта. */
const FEATURE_ICON: Record<AdminHostFeature, LucideIcon> = {
  xray_template: Braces,
  mux: Layers,
  sockopt: SlidersHorizontal,
  final_mask: Combine,
  xhttp_extra: Waypoints,
  shuffle_host: Shuffle,
  mihomo_x25519: KeyRound,
  override_sni: Globe,
  keep_sni_blank: Eraser,
  vless_route: Route,
  pinned_cert: Pin,
  verify_cert_name: ShieldCheck,
}

function FeatureBadge({ feature }: { feature: AdminHostFeature }) {
  const { t } = useTranslation()
  const Icon = FEATURE_ICON[feature] ?? Braces
  const label = t(`admin.nodes.panels.hosts.features.${feature}`, { defaultValue: feature })
  return (
    <span
      title={label}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <Icon className="size-3" aria-hidden />
    </span>
  )
}

type NodeInfo = { uuid: string; name: string; country_code: string }

function HostRow({ host, nodes, onOpen }: { host: AdminHostDTO; nodes: Map<string, NodeInfo>; onOpen: () => void }) {
  const { t } = useTranslation()
  const off = host.is_disabled
  const hostNodes = host.node_uuids.map((id) => nodes.get(id)).filter((n): n is NodeInfo => !!n)
  const inboundText =
    host.inbound.profile_name || host.inbound.inbound_tag
      ? `${host.inbound.profile_name ?? '—'} › ${host.inbound.inbound_tag ?? '—'}`
      : t('admin.nodes.panels.hosts.noInbound')
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50',
          off && 'opacity-70',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border',
            off
              ? 'border-border bg-muted/50 text-muted-foreground'
              : host.is_hidden
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
          title={off ? t('admin.nodes.panels.hosts.disabled') : host.is_hidden ? t('admin.nodes.panels.hosts.hidden') : undefined}
        >
          {host.is_hidden ? <EyeOff className="size-3.5" aria-hidden /> : <ListChecks className="size-3.5" aria-hidden />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="min-w-0 break-words text-sm font-bold leading-snug">{host.remark}</span>
              <span className="min-w-0 max-w-full truncate font-mono text-xs text-muted-foreground">
                {host.address}:{host.port}
              </span>
            </span>
            {host.features.length > 0 && (
              <span className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1">
                {host.features.map((f) => (
                  <FeatureBadge key={f} feature={f} />
                ))}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <span className="min-w-0 max-w-full truncate text-xs font-bold text-violet-700 dark:text-violet-300">{inboundText}</span>
            {hostNodes.length > 0 && (
              <span className="ml-auto flex min-w-0 flex-wrap justify-end gap-1">
                {hostNodes.map((n) => (
                  <span
                    key={n.uuid}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-sky-500/35 bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase leading-none tracking-wide text-sky-700 dark:text-sky-300"
                  >
                    <CountryFlag code={n.country_code} className="h-2.5 w-3.5 shrink-0" />
                    <span className="truncate">{n.name}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

/** Второй уровень: список хостов ноды. Клик по хосту открывает третий уровень — редактор поверх списка. */
export function HostsPanel({
  nodeUuid,
  open,
  onClose,
  onOpenHost,
}: {
  nodeUuid: string
  open: boolean
  onClose: () => void
  onOpenHost: (hostUuid: string) => void
}) {
  const { t } = useTranslation()
  const list = useQuery({
    queryKey: ['admin-node-hosts', nodeUuid],
    queryFn: () => api.adminNodeHosts(nodeUuid),
    enabled: open,
  })
  const nodesQ = useQuery({ queryKey: ['admin-nodes'], queryFn: () => api.adminNodes(), enabled: open, staleTime: 30_000 })
  const nodeMap = useMemo(() => new Map((nodesQ.data?.nodes ?? []).map((n) => [n.uuid, n as NodeInfo])), [nodesQ.data])
  const hosts = list.data?.hosts ?? []

  return (
    <NodeSidePanel open={open} onClose={onClose} depth={2} title={t('admin.nodes.panels.hosts.title')} icon={ListChecks}>
      {list.isLoading && <PanelSkeleton rows={3} />}
      {list.isError && !list.data && <PanelError onRetry={() => void list.refetch()} />}
      {list.data && hosts.length === 0 && <PanelEmpty icon={ListChecks}>{t('admin.nodes.panels.hosts.empty')}</PanelEmpty>}
      {hosts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {hosts.map((h) => (
            <HostRow key={h.uuid} host={h} nodes={nodeMap} onOpen={() => onOpenHost(h.uuid)} />
          ))}
        </ul>
      )}
    </NodeSidePanel>
  )
}

/** Третий уровень: редактор хоста поверх списка хостов или дерева инбаундов. Закрытие возвращает на уровень ниже. */
export function HostEditorPanel({ nodeUuid, hostUuid, onClose }: { nodeUuid: string; hostUuid: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const ed = useHostEditor(hostUuid, nodeUuid, onClose)

  const requestClose = () => {
    if (ed.dialogOpen) ed.closeTopDialog()
    else if (ed.dirty) ed.setConfirmLeave('close')
    else onClose()
  }

  const title = (
    <div className="min-w-0">
      <div className="truncate">{ed.title || t('admin.nodes.panels.host.title')}</div>
      {hostUuid && <div className="truncate font-mono text-[10.5px] font-normal text-muted-foreground">{hostUuid}</div>}
    </div>
  )

  return (
    <>
      <NodeSidePanel
        open={!!hostUuid}
        onClose={requestClose}
        depth={3}
        title={title}
        icon={SlidersHorizontal}
        footer={<HostEditFooter ed={ed} />}
      >
        <HostEditBody ed={ed} />
      </NodeSidePanel>
      <HostEditDialogs ed={ed} onLeave={onClose} />
    </>
  )
}
