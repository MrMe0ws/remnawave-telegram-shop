import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminStatsResponse {
  captured_at: string
  total_customers: number
  active_subscriptions: number
  new_today: number
  new_week: number
  new_month: number
  new_prev_month: number
  trial_active: number
  paid_active: number
  inactive: number
  sales_sub_today: number
  sales_sub_week: number
  sales_sub_month: number
  sales_sub_prev_month: number
  revenue_month_rub: number
  revenue_today_rub: number
  revenue_all_time_rub: number
  revenue_subs_month_rub: number
  transactions_today: number
  transactions_month: number
  unique_payers_month: number
  payment_rub_by_invoice: Record<string, number>
  distinct_referrers: number
  active_referrers: number
  ref_bonus_days_all: number
  ref_bonus_days_today: number
  ref_bonus_days_week: number
  ref_bonus_days_month: number
  top_referrers: { referrer_id: number; paid_referees: number }[]
  tariff_breakdown: {
    tariff_id: number
    display_name: string
    sales_today: number
    sales_week: number
    sales_month: number
    subs_revenue_month: number
    revenue_today: number
    revenue_all: number
    active_paid_users: number
  }[]
}

export function useAdminStats() {
  return useQuery<AdminStatsResponse>({
    queryKey: ['admin-stats'],
    queryFn: () => api.adminStats(),
  })
}
