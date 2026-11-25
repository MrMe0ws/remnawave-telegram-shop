import { useEffect, useState } from 'react'

import { HostEditorPanel, HostsPanel } from './HostsPanel'
import { InboundTreePanel } from './InboundTreePanel'
import { SessionsPanel } from './SessionsPanel'
import { UsagePanel } from './UsagePanel'

/**
 * Боковые панели окна ноды. Уровни: 1 — окно ноды; 2 — хосты, дерево, статистика, сессии, профили;
 * 3 — редактор хоста (из списка хостов или дерева). Закрытие панели возвращает на уровень ниже.
 */
export type NodeSidePanelKind = 'hosts' | 'tree' | 'usage' | 'sessions'

export interface NodeSidePanelsProps {
  nodeUuid: string
  /** Какая панель открыта; null — ни одной. Редактор хоста живёт внутри панели «hosts» своим состоянием. */
  panel: NodeSidePanelKind | null
  onClose: () => void
}

export function NodeSidePanels({ nodeUuid, panel, onClose }: NodeSidePanelsProps) {
  // Хост, открытый на третьем уровне поверх списка хостов или дерева.
  const [editHost, setEditHost] = useState<string | null>(null)
  useEffect(() => {
    if (panel !== 'hosts' && panel !== 'tree') setEditHost(null)
  }, [panel])

  return (
    <>
      <HostsPanel nodeUuid={nodeUuid} open={panel === 'hosts'} onClose={onClose} onOpenHost={setEditHost} />
      <InboundTreePanel nodeUuid={nodeUuid} open={panel === 'tree'} onClose={onClose} onOpenHost={setEditHost} />
      <UsagePanel nodeUuid={nodeUuid} open={panel === 'usage'} onClose={onClose} />
      <SessionsPanel nodeUuid={nodeUuid} open={panel === 'sessions'} onClose={onClose} />
      <HostEditorPanel nodeUuid={nodeUuid} hostUuid={editHost} onClose={() => setEditHost(null)} />
    </>
  )
}
