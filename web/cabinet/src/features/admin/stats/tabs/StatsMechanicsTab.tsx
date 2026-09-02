import type { AdminStatsInsightsDTO } from '@/lib/types/admin'
import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import type { AdminLoyaltyStatsResponse } from '../../hooks/useAdminLoyaltyStats'
import type { AdminPromoStatsResponse } from '../../hooks/useAdminPromoStats'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { PartnerProgramBlock } from '../components/PartnerProgramBlock'
import { StatsFortuneBlock } from '../components/StatsFortuneBlock'
import { StatsLoyaltyBlock } from '../components/StatsLoyaltyBlock'
import { StatsPromosBlock } from '../components/StatsPromosBlock'
import type { StatsPeriod } from '../utils/statsPeriod'

interface StatsMechanicsTabProps {
  data: AdminStatsResponse
  insights?: AdminStatsInsightsDTO | null
  fortune?: AdminFortuneStatsResponse | null
  loyalty?: AdminLoyaltyStatsResponse | null
  promo?: AdminPromoStatsResponse | null
  period: StatsPeriod
}

/**
 * «Механики» — всё, что подталкивает к покупке: партнёры, колесо, лояльность,
 * промокоды. Партнёрская программа стоит первой: это единственная механика,
 * которая стоит живых денег.
 */
export function StatsMechanicsTab({
  data,
  insights,
  fortune,
  loyalty,
  promo,
  period,
}: StatsMechanicsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {insights?.partners && (
        <PartnerProgramBlock
          data={insights.partners}
          totalCustomers={data.total_customers}
        />
      )}
      {fortune && <StatsFortuneBlock data={fortune} period={period} />}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {loyalty?.enabled && <StatsLoyaltyBlock data={loyalty} />}
        {promo && <StatsPromosBlock data={promo} />}
      </div>
    </div>
  )
}
