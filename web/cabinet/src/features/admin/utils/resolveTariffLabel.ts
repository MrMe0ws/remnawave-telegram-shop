import type { AdminTariffBriefDTO } from '@/lib/types/admin'

import type { AdminTariff } from '../hooks/useAdminTariffs'

export function resolveTariffLabel(
  tariffId: number | null | undefined,
  panelTariffs?: AdminTariffBriefDTO[],
  allTariffs?: AdminTariff[],
): string | null {
  if (tariffId == null) return null

  for (const source of [panelTariffs, allTariffs]) {
    const match = source?.find((t) => t.id === tariffId)
    if (!match) continue
    const name = match.name?.trim()
    if (name) return name
    const slug = match.slug?.trim()
    if (slug) return slug
  }

  return null
}
