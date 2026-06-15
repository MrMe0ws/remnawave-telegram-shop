/**
 * DTO для admin API (`/cabinet/api/admin/*`).
 * Синхронизированы с Go handlers в internal/cabinet/http/handlers/admin_*.go
 */

export interface AdminBootstrapDTO {
  sales_mode: string
  loyalty_enabled: boolean
  fortune_enabled: boolean
}

export interface AdminStatsDTO {
  captured_at: string
  total_customers: number
  active_subscriptions: number
  new_today: number
  new_week: number
  new_month: number
  new_prev_month: number
  new_half_year: number
  new_year: number
  trial_active: number
  paid_active: number
  inactive: number
  sales_sub_today: number
  sales_sub_week: number
  sales_sub_month: number
  sales_sub_prev_month: number
  sales_sub_half_year: number
  sales_sub_year: number
  revenue_month_rub: number
  revenue_today_rub: number
  revenue_week_rub: number
  revenue_half_year_rub: number
  revenue_year_rub: number
  revenue_all_time_rub: number
  revenue_subs_month_rub: number
  transactions_today: number
  transactions_week: number
  transactions_month: number
  transactions_half_year: number
  transactions_year: number
  unique_payers_day: number
  unique_payers_week: number
  unique_payers_month: number
  unique_payers_half_year: number
  unique_payers_year: number
  payment_rub_by_invoice: Record<string, number>
  distinct_referrers: number
  active_referrers: number
  ref_bonus_days_all: number
  ref_bonus_days_today: number
  ref_bonus_days_week: number
  ref_bonus_days_month: number
  ref_bonus_days_half_year: number
  ref_bonus_days_year: number
  top_referrers: {
    referrer_id: number
    customer_id: number
    telegram_username?: string | null
    nickname?: string | null
    paid_referees: number
  }[]
  tariff_breakdown: {
    tariff_id: number
    display_name: string
    sales_today: number
    sales_week: number
    sales_month: number
    sales_half_year: number
    sales_year: number
    subs_revenue_month: number
    revenue_today: number
    revenue_week: number
    revenue_half_year: number
    revenue_year: number
    revenue_all: number
    active_paid_users: number
  }[]
}

export interface AdminStatsTimeSeriesPointDTO {
  date: string
  revenue_rub: number
  sales: number
  new_users: number
  transactions: number
}

export interface AdminTariffTimeSeriesPointDTO {
  date: string
  sales: number
  revenue_rub: number
}

export interface AdminTariffTimeSeriesDTO {
  tariff_id: number
  display_name: string
  points: AdminTariffTimeSeriesPointDTO[]
}

export interface AdminStatsTimeSeriesDTO {
  captured_at: string
  period: string
  granularity: 'day' | 'week' | 'month'
  from: string
  to: string
  points: AdminStatsTimeSeriesPointDTO[]
  tariff_series: AdminTariffTimeSeriesDTO[]
}

export interface AdminFortunePeriodDTO {
  distinct_users: number
  total_spins: number
  free_spins: number
  paid_spins: number
  paid_cost_days_sum: number
  won_subs_days_sum: number
  won_loyalty_xp_sum: number
  won_discount_pct_sum: number
  by_reward: Record<string, number>
}

export interface AdminFortuneStatsDTO {
  captured_at: string
  month: AdminFortunePeriodDTO
  today: AdminFortunePeriodDTO
  all_time: AdminFortunePeriodDTO
}

export interface AdminCustomerDTO {
  id: number
  telegram_id: number
  telegram_username?: string | null
  language: string
  expire_at?: string | null
  created_at: string
  subscription_link?: string | null
  extra_hwid: number
  extra_hwid_expires_at?: string | null
  current_tariff_id?: number | null
  subscription_period_start?: string | null
  subscription_period_months?: number | null
  loyalty_xp: number
  is_web_only: boolean
  status: 'active' | 'expired' | 'trial' | 'disabled'
  rw_status?: string | null
}

export interface AdminUsersListDTO {
  items: AdminCustomerDTO[]
  total: number
  page: number
  limit: number
}

export interface AdminPurchaseDTO {
  id: number
  amount: number
  currency: string
  paid_at?: string | null
  month: number
  invoice_type: string
  purchase_kind: string
  tariff_id?: number | null
  promo_code_id?: number | null
  discount_percent?: number | null
}

export interface AdminPaymentsDTO {
  items: AdminPurchaseDTO[]
  total: number
  rub_count: number
  rub_sum: number
  stars_count: number
  stars_sum: number
  rub_per_star: number
  stars_rub_equiv: number
}

export interface AdminPromoCodeDTO {
  id: number
  code: string
  type: string
  subscription_days?: number | null
  trial_days?: number | null
  extra_hwid_delta?: number | null
  discount_percent?: number | null
  discount_ttl_hours?: number | null
  max_uses?: number | null
  uses_count: number
  valid_until?: string | null
  active: boolean
  first_purchase_only: boolean
  require_customer_in_db: boolean
  allow_trial_without_payment: boolean
  created_at: string
  discount_max_subscription_payments_per_customer: number
  tariff_id?: number | null
}

export interface AdminPromoListDTO {
  items: AdminPromoCodeDTO[]
  total: number
  page: number
  limit: number
}

export interface AdminPromoGetDTO {
  promo: AdminPromoCodeDTO
  redemptions: number
  redemptions_today: number
}

export interface AdminPromoRedemptionDTO {
  used_at: string
  customer_id: number
  telegram_username?: string | null
  nickname?: string | null
}

export interface AdminPromoRedemptionsListDTO {
  items: AdminPromoRedemptionDTO[]
  total: number
  page: number
  limit: number
}

export interface AdminTariffPriceDTO {
  tariff_id: number
  months: number
  amount_rub: number
  amount_stars?: number | null
}

export interface AdminTariffDTO {
  id: number
  slug: string
  name?: string | null
  sort_order: number
  is_active: boolean
  device_limit: number
  traffic_limit_bytes: number
  traffic_limit_reset_strategy: string
  active_internal_squad_uuids: string
  external_squad_uuid?: string | null
  remnawave_tag?: string | null
  tier_level?: number | null
  description?: string | null
  prices: AdminTariffPriceDTO[]
}

export interface AdminBroadcastPreviewDTO {
  recipient_count: number
  status?: string
}

export interface AdminBroadcastMediaDTO {
  file_id: string
  as_photo: boolean
}

export interface AdminBroadcastSendDTO {
  status: string
  recipient_count: number
}

export interface AdminBroadcastAudienceDTO {
  audience: string
  label: string
  count: number
}

export interface AdminOkDTO {
  ok?: boolean
  status?: string
}

export interface AdminSquadDTO {
  uuid: string
  name: string
}

export interface AdminRWPanelDTO {
  uuid: string
  username: string
  status: string
  subscription_url: string
  expire_at?: string | null
  traffic_used_bytes: number
  traffic_limit_bytes: number
  traffic_limit_strategy: string
  hwid_device_limit?: number | null
  description?: string | null
  tag?: string | null
  last_traffic_reset_at?: string | null
  online_at?: string | null
  active_squads?: AdminSquadDTO[] | null
}

export interface AdminTariffBriefDTO {
  id: number
  slug: string
  name: string
}

export interface AdminUserPanelDTO {
  customer: AdminCustomerDTO
  has_rw_user: boolean
  rw?: AdminRWPanelDTO | null
  available_squads: AdminSquadDTO[]
  traffic_presets_gb: number[]
  strategies: string[]
  tariffs?: AdminTariffBriefDTO[]
}

export interface AdminDeviceDTO {
  hwid: string
  platform?: string | null
  os_version?: string | null
  device_model?: string | null
  created_at: string
}

export interface AdminReferralStatsDTO {
  total: number
  paid: number
  active: number
  conversion: number
  earned_total: number
  earned_last_month: number
}

export interface AdminRefereeDTO {
  telegram_id: number
  telegram_username?: string | null
  active: boolean
  email?: string | null
}

export interface AdminReferralsDTO {
  stats: AdminReferralStatsDTO
  referees: AdminRefereeDTO[]
}

export interface AdminLoyaltyTierDTO {
  id: number
  sort_order: number
  xp_min: number
  discount_percent: number
  display_name?: string | null
}

/** Remnawave infra-billing API (camelCase JSON). */
export interface AdminInfraProviderShortDTO {
  uuid: string
  name: string
  faviconLink: string
  loginUrl: string
}

export interface AdminInfraNodeShortDTO {
  uuid: string
  name: string
  countryCode: string
}

export interface AdminInfraBillingNodeDTO {
  uuid: string
  nodeUuid: string
  providerUuid: string
  nextBillingAt: string
  createdAt: string
  updatedAt: string
  provider: AdminInfraProviderShortDTO
  node: AdminInfraNodeShortDTO
}

export interface AdminInfraNodesStatsDTO {
  upcomingNodesCount: number
  currentMonthPayments: number
  totalSpent: number
}

export interface AdminInfraAvailableNodeDTO {
  uuid: string
  name: string
  countryCode: string
}

export interface AdminInfraNodesDTO {
  totalBillingNodes: number
  totalAvailableBillingNodes: number
  billingNodes: AdminInfraBillingNodeDTO[]
  availableBillingNodes: AdminInfraAvailableNodeDTO[]
  stats: AdminInfraNodesStatsDTO
}

export interface AdminInfraProviderHistoryAggDTO {
  totalAmount: number
  totalBills: number
}

export interface AdminInfraProviderNodeDTO {
  nodeUuid: string
  name: string
  countryCode: string
}

export interface AdminInfraProviderDTO {
  uuid: string
  name: string
  faviconLink: string
  loginUrl: string
  createdAt: string
  updatedAt: string
  billingHistory: AdminInfraProviderHistoryAggDTO
  billingNodes: AdminInfraProviderNodeDTO[]
}

export interface AdminInfraProvidersDTO {
  total: number
  providers: AdminInfraProviderDTO[]
}

export interface AdminInfraHistoryRecordDTO {
  uuid: string
  providerUuid: string
  amount: number
  billedAt: string
  provider: AdminInfraProviderShortDTO
}

export interface AdminInfraHistoryDTO {
  records: AdminInfraHistoryRecordDTO[]
  total: number
}

export interface AdminInfraSettingsDTO {
  notify_before_1: boolean
  notify_before_3: boolean
  notify_before_7: boolean
  notify_before_14: boolean
}
