import type { AdminStatsInsightsDTO } from '@/lib/types/admin'
import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import type { AdminLoyaltyStatsResponse } from '../../hooks/useAdminLoyaltyStats'
import type { AdminPromoStatsResponse } from '../../hooks/useAdminPromoStats'

import { FortuneStatsAccordion } from '../components/FortuneStatsAccordion'
import { LoyaltyStatsAccordion } from '../components/LoyaltyStatsAccordion'
import { PartnerProgramBlock } from '../components/PartnerProgramBlock'
import { PromoStatsAccordion } from '../components/PromoStatsAccordion'
import type { StatsPeriod } from '../utils/statsPeriod'

interface StatsMechanicsTabProps {
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
  insights,
  fortune,
  loyalty,
  promo,
  period,
}: StatsMechanicsTabProps) {
  return (
    <div className="space-y-4">
      {insights?.partners && <PartnerProgramBlock data={insights.partners} />}
      {fortune && <FortuneStatsAccordion data={fortune} globalPeriod={period} />}
      {loyalty?.enabled && <LoyaltyStatsAccordion data={loyalty} />}
      {promo && <PromoStatsAccordion data={promo} />}
    </div>
  )
}
