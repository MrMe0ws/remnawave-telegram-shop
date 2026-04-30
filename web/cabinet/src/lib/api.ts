/**
 * API-клиент для web-кабинета.
 *
 * Особенности:
 * - Все запросы идут на /cabinet/api/*
 * - CSRF-токен читается из cookie `csrf_token` (как в internal/cabinet/auth/csrf)
 *   и передаётся в X-CSRF-Token; при необходимости fallback на `cab_csrf`
 * - При 401 (кроме /auth/*) автоматически вызывается refresh и запрос повторяется
 * - При неудаче refresh — стор сбрасывает сессию
 */

import { getCookie } from './utils'

/** Имя cookie с double-submit CSRF (совпадает с csrf.CookieName на бэкенде). */
function readCsrfCookie(): string {
  return getCookie('csrf_token') || getCookie('cab_csrf')
}

// --- Типы ------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`API ${status}: ${body}`)
    this.name = 'ApiError'
  }
}

/** Ответ login / refresh / смена пароля (совпадает с бэкендом loginResp). */
export interface AuthTokenResponse {
  access_token: string
  access_exp: number
  csrf_token: string
}

/** Ответ GET /auth/bootstrap — до JWT, для экрана логина. */
export interface AuthBootstrapResponse {
  google_oauth_enabled: boolean
  yandex_oauth_enabled?: boolean
  vk_oauth_enabled?: boolean
  telegram_widget_bot?: string
  telegram_oidc_enabled?: boolean
  telegram_web_auth_mode?: 'widget' | 'oidc'
  turnstile_enabled?: boolean
  turnstile_site_key?: string
  /** URL из env бота (SUPPORT_URL, BOT_URL и т.д.), только непустые. */
  site_links?: Record<string, string>
  /** CABINET_BRAND_NAME; по умолчанию на фронте — Cabinet. */
  brand_name?: string
  /** Полный или относительный URL логотипа для <img src>. */
  brand_logo_url?: string
  /** PWA feature flag + names from CABINET_PWA_* */
  pwa_enabled?: boolean
  pwa_app_name?: string
  pwa_short_name?: string
  /** Доступные провайдеры оплаты по backend-конфигурации env. */
  payment_providers?: {
    yookassa?: boolean
    cryptopay?: boolean
    telegram?: boolean
  }
}

export interface MeResponse {
  id: number
  email?: string | null
  email_verified: boolean
  language: string
  providers: string[]
  has_telegram_link: boolean
  has_password: boolean
  /** true, если задан пароль (сценарии входа/привязки «как через почту»). */
  can_use_email_password_login?: boolean
  customer_id?: number | null
  telegram_widget_bot?: string
  google_oauth_enabled: boolean
  yandex_oauth_enabled?: boolean
  vk_oauth_enabled?: boolean
  telegram_oidc_enabled?: boolean
  /** ISO 8601 — дата регистрации аккаунта кабинета. */
  registered_at?: string
  /** Управляет видимостью блока удаления аккаунта в профиле. */
  can_delete_account_ui?: boolean
  /** Числовой Telegram user id, если известен. */
  telegram_id?: number | null
  /** Маска почты из OAuth identity (без sub). */
  google_masked_email?: string | null
  yandex_masked_email?: string | null
  vk_masked_email?: string | null
}

export interface MergeCustomerSnapshot {
  id: number
  expire_at?: string
  loyalty_xp: number
  extra_hwid: number
  is_web_only: boolean
  has_subscription: boolean
  current_tariff_id?: number | null
}

export interface MergePreviewResponse {
  customer_web?: MergeCustomerSnapshot
  customer_tg?: MergeCustomerSnapshot
  /** Email-peer merge при привязанном Telegram: customer_web=peer, customer_tg=текущий; UI меняет местами карточки. */
  ui_swap_sides?: boolean
  merged_expire_at?: string | null
  merged_loyalty_xp: number
  merged_extra_hwid: number
  purchases_moved: number
  referrals_moved: number
  is_noop: boolean
  is_dangerous: boolean
  danger_reason?: string
  requires_subscription_choice?: boolean
  claim_expires_at?: string
}

export interface MergeConfirmResponse {
  result: string
  customer_id: number
  purchases_moved?: number
  referrals_moved?: number
}

export interface TariffItem {
  id: number | null
  slug: string
  name: string
  /** Текст из админки (tariff.description), если задан. */
  description?: string | null
  price_rub: number
  monthly_base_rub: number
  months: number
  device_limit: number
  traffic_gb: number | null
  is_popular?: boolean
}

export interface TariffsResponse {
  tariffs: TariffItem[]
  sales_mode: string
  currency?: string
  show_savings?: boolean
}

/** Как отдаёт GET /tariffs (internal/cabinet/service/catalog.go): тариф + вложенные prices. */
interface TariffPriceDTO {
  months: number
  amount_rub: number
  monthly_base_rub: number
}

interface TariffViewDTO {
  id: number
  slug: string
  name?: string | null
  description?: string | null
  device_limit: number
  traffic_limit_bytes: number
  traffic_limit_reset_strategy?: string
  prices: TariffPriceDTO[]
}

interface TariffsRawResponse {
  sales_mode: string
  currency?: string
  show_savings?: boolean
  tariffs: unknown[]
}

function trafficBytesToGb(bytes: number): number | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  return Math.round(bytes / (1024 * 1024 * 1024))
}

/**
 * Бэкенд отдаёт витрину как TariffView[] с полем prices[]; UI (тарифы, чекаут)
 * ожидает плоский список строк «период × тариф». Без этого на /tariffs падает
 * рендер (undefined.toLocaleString и т.п.).
 */
export function normalizeTariffsResponse(raw: TariffsRawResponse): TariffsResponse {
  const rows: TariffItem[] = []
  const list = raw.tariffs ?? []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const t = item as Partial<TariffViewDTO> & Partial<TariffItem>
    if (Array.isArray(t.prices) && t.prices.length > 0) {
      const slugStr = String(t.slug ?? '')
      const nameStr =
        t.name != null && String(t.name).trim() !== '' ? String(t.name) : slugStr
      const tid = typeof t.id === 'number' ? t.id : null
      const trafficGb = trafficBytesToGb(Number(t.traffic_limit_bytes) || 0)
      const devLim = typeof t.device_limit === 'number' ? t.device_limit : 0
      const desc =
        t.description != null && String(t.description).trim() !== '' ? String(t.description).trim() : null
      for (const p of t.prices) {
        if (!p || typeof p.months !== 'number') continue
        const months = p.months
        const amount = typeof p.amount_rub === 'number' ? p.amount_rub : 0
        const perMonth = months > 0 ? Math.round(amount / months) : amount
        rows.push({
          id: tid,
          slug: slugStr,
          name: nameStr,
          description: desc,
          price_rub: amount,
          monthly_base_rub: perMonth,
          months,
          device_limit: devLim,
          traffic_gb: trafficGb,
        })
      }
      continue
    }
    if (
      typeof t.slug === 'string' &&
      typeof t.months === 'number' &&
      typeof t.price_rub === 'number' &&
      typeof t.monthly_base_rub === 'number'
    ) {
      rows.push(item as TariffItem)
    }
  }
  return {
    sales_mode: raw.sales_mode,
    tariffs: rows,
    currency: raw.currency,
    show_savings: raw.show_savings,
  }
}

export interface SubscriptionResponse {
  expire_at: string | null
  subscription_link: string | null
  /** Срок оплаченного периода в месяцах (classic и tariffs), если известен. */
  subscription_period_months?: number | null
  traffic_used_gb?: number | null
  traffic_limit_gb?: number | null
  /** Пробный период: есть активная подписка, но нет оплаченных покупок с month>0. */
  is_trial?: boolean
  tariff: {
    id: number | null
    slug: string
    name: string
    traffic_gb: number | null
    device_limit: number
  } | null
  loyalty_xp: number
  loyalty_tier: string | null
}

export interface DeviceInfo {
  hwid: string
  platform?: string
  os_version?: string
  device_model?: string
  user_agent?: string
  created_at?: string
  updated_at?: string
}

export interface DevicesResponse {
  enabled: boolean
  device_limit: number
  connected: number
  devices: DeviceInfo[]
}

export interface LoyaltyTierDTO {
  sort_order: number
  xp_min: number
  discount_percent: number
  display_name?: string | null
}

export interface LoyaltyDashboardResponse {
  enabled: boolean
  xp: number
  current?: LoyaltyTierDTO | null
  next?: LoyaltyTierDTO | null
  progress_percent: number
  xp_in_segment: number
  xp_segment_span: number
  xp_until_next: number
  first_discount_xp_min?: number | null
}

export interface LoyaltyHistoryItem {
  purchase_id: number
  paid_at?: string
  xp_gained: number
  amount: number
  currency: string
  invoice_type: string
  purchase_kind: string
  running_xp: number
}

export interface LoyaltyHistoryResponse {
  items: LoyaltyHistoryItem[]
}

export interface TrialInfoResponse {
  enabled: boolean
  can_activate: boolean
  days: number
  traffic_gb: number
  device_limit: number
}

export interface CheckoutResponse {
  payment_url: string
  checkout_id: number
  purchase_id: number
  status: string
  provider?: string
  reused?: boolean
}

/** GET /payments/preview — сумма и сценарий как при создании счёта (апгрейд/даунгрейд). */
export interface PaymentPreviewResponse {
  amount: number
  currency: 'RUB' | 'STARS' | string
  amount_rub: number
  sales_mode: string
  scenario: string
  purchase_kind?: string
  is_early_downgrade?: boolean
  list_price_rub?: number
  base_amount_rub?: number
  loyalty_discount_pct?: number
  promo_discount_pct?: number
  total_discount_pct?: number
}

export interface PaymentStatusResponse {
  status: 'new' | 'pending' | 'paid' | 'failed' | 'expired'
  subscription_link: string | null
}

export interface ReferralsStatsResponse {
  total: number
  paid: number
  active: number
  conversion_pct: number
  earned_days_total: number
  earned_days_last_month: number
  referral_days_per_paid_default: number
}

export interface ReferralsResponse {
  referrer_telegram_id: number
  stats: ReferralsStatsResponse
  referees: { telegram_id_masked: string; telegram_username?: string | null; email?: string | null; active: boolean }[]
  bot_start_link?: string
  cabinet_register_link?: string
  referral_mode: string
  referral_bonus_days_default?: number
  referral_first_referrer_days?: number
  referral_first_referee_days?: number
  referral_repeat_referrer_days?: number
}

export interface PurchaseHistoryItem {
  id: number
  amount: number
  currency: string
  status: string
  invoice_type: string
  purchase_kind: string
  month: number
  paid_at?: string
  created_at: string
}

export interface PurchasesResponse {
  items: PurchaseHistoryItem[]
}

export interface PromoStateResponse {
  has_pending_discount: boolean
  pending_discount?: {
    promo_code_id: number
    percent: number
    until_first_purchase: boolean
    subscription_payments_remaining: number
    expires_at?: string
  } | null
}

export interface PromoApplyResponse {
  applied: boolean
  type: 'subscription_days' | 'trial' | 'extra_hwid' | 'discount'
  subscription_days?: number
  trial_days?: number
  extra_hwid_delta?: number
  discount_percent?: number
  trial_skipped_active_sub?: boolean
}

// --- Singleton клиент -------------------------------------------------------

const BASE = '/cabinet/api'

// Ленивый импорт стора (избегаем circular dep: store → api → store).
type AuthStoreRef = {
  getAccessToken: () => string | null
  setToken: (token: string) => void
  logout: () => void
}

let _authRef: AuthStoreRef | null = null

export function setAuthStoreRef(ref: AuthStoreRef) {
  _authRef = ref
}

// Состояние refresh-in-progress для deduplication.
let _refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing
  _refreshing = (async () => {
    try {
      const csrf = readCsrfCookie()
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        credentials: 'include',
      })
      if (!res.ok) return null
      const data: AuthTokenResponse = await res.json()
      _authRef?.setToken(data.access_token)
      return data.access_token
    } catch {
      return null
    } finally {
      _refreshing = null
    }
  })()
  return _refreshing
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  retrying = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  const csrf = readCsrfCookie()
  if (csrf) headers['X-CSRF-Token'] = csrf

  const token = _authRef?.getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  // Auto-refresh: только один раз, только для защищённых запросов.
  if (res.status === 401 && !retrying && !path.startsWith('/auth/')) {
    const newToken = await doRefresh()
    if (newToken) {
      return request<T>(method, path, body, extraHeaders, true)
    }
    _authRef?.logout()
    throw new ApiError(401, 'Session expired')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// --- Методы ----------------------------------------------------------------

export const api = {
  // Auth (отдельный fetch: не кэшировать, иначе после смены env/nginx долго «нет Telegram»).
  authBootstrap: async (): Promise<AuthBootstrapResponse> => {
    const res = await fetch(`${BASE}/auth/bootstrap`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApiError(res.status, text)
    }
    return res.json() as Promise<AuthBootstrapResponse>
  },

  login: (email: string, password: string, turnstileToken?: string) =>
    request<AuthTokenResponse>(
      'POST',
      '/auth/login',
      { email, password },
      turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    ),

  register: (email: string, password: string, referralCode?: string, turnstileToken?: string) =>
    request<{ message?: string }>(
      'POST',
      '/auth/register',
      {
        email,
        password,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    ),

  logout: () =>
    request<void>('POST', '/auth/logout'),

  refresh: () =>
    request<AuthTokenResponse>('POST', '/auth/refresh'),

  /** Автовход из Telegram Mini App (без Bearer). */
  telegramAuthMiniApp: (initData: string, referralCode?: string) =>
    request<AuthTokenResponse>('POST', '/auth/telegram', {
      source: 'miniapp',
      init_data: initData,
      ...(referralCode ? { referral_code: referralCode } : {}),
    }),

  /** Вход через Telegram Login Widget (без Bearer). */
  telegramAuthWidget: (
    user: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
      auth_date: number
      hash: string
    },
    referralCode?: string,
  ) =>
    request<AuthTokenResponse>('POST', '/auth/telegram', {
      source: 'widget',
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      auth_date: user.auth_date,
      hash: user.hash,
      ...(referralCode ? { referral_code: referralCode } : {}),
    }),

  confirmEmail: (token: string) =>
    request<AuthTokenResponse>('POST', '/auth/email/verify/confirm', { token }),

  resendVerifyEmail: () =>
    request<void>('POST', '/me/email/verify/resend'),

  /** Повторная отправка кода подтверждения email без JWT (после регистрации). */
  resendVerifyEmailPublic: (email: string, turnstileToken?: string) =>
    request<void>(
      'POST',
      '/auth/email/verify/resend-public',
      { email },
      turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    ),

  forgotPassword: (email: string, turnstileToken?: string) =>
    request<void>(
      'POST',
      '/auth/password/forgot',
      { email },
      turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    ),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message?: string }>('POST', '/auth/password/reset', { token, new_password: newPassword }),

  // Me
  me: () =>
    request<MeResponse>('GET', '/me'),

  putLanguage: (language: string) =>
    request<void>('PUT', '/me/language', { language }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<AuthTokenResponse>('PUT', '/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  /** Мягкое снятие привязки google/yandex/vk/email (Telegram отключён на бэкенде). */
  identityUnlink: (provider: 'google' | 'yandex' | 'vk' | 'telegram' | 'email') =>
    request<{ ok: boolean; soft_unlinked?: boolean; rows?: number }>('POST', '/me/identities/unlink', {
      provider,
    }),

  /** Привязка email+пароля к текущему аккаунту (OAuth/Telegram). */
  linkEmail: (email: string, password: string, passwordConfirm: string) =>
    request<{ status: string; reason_code?: string; masked_email?: string; message?: string }>('POST', '/me/email/link', {
      email,
      password,
      password_confirm: passwordConfirm,
    }),
  /** Подтверждение merge-кода (если email занят OAuth-only аккаунтом без пароля). */
  confirmEmailMergeCode: (code: string) =>
    request<{ status: string; reason_code?: string; masked_email?: string }>('POST', '/me/email/link/verify-code', { code }),

  /** Удаление аккаунта кабинета (необратимо). */
  deleteAccount: () =>
    request<{ message: string }>('POST', '/me/account/delete'),

  // Subscription
  subscription: () =>
    request<SubscriptionResponse>('GET', '/me/subscription'),

  loyalty: () => request<LoyaltyDashboardResponse>('GET', '/me/loyalty'),

  loyaltyHistory: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return request<LoyaltyHistoryResponse>('GET', `/me/loyalty/history${suffix}`)
  },

  referrals: () =>
    request<ReferralsResponse>('GET', '/me/referrals'),

  promoState: () => request<PromoStateResponse>('GET', '/promocodes/state'),
  applyPromoCode: (code: string) =>
    request<PromoApplyResponse>('POST', '/promocodes/apply', { code }),

  purchases: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return request<PurchasesResponse>('GET', `/me/purchases${suffix}`)
  },

  trialInfo: () =>
    request<TrialInfoResponse>('GET', '/me/trial'),

  activateTrial: () =>
    request<{ ok: boolean; subscription_link?: string; message?: string }>('POST', '/me/trial/activate'),

  devices: () =>
    request<DevicesResponse>('GET', '/me/devices'),

  deleteDevice: (hwid: string) =>
    request<{ ok: boolean }>('POST', '/me/devices/delete', { hwid }),

  // Tariffs
  tariffs: () => request<TariffsRawResponse>('GET', '/tariffs').then(normalizeTariffsResponse),

  // Payments — тело как в internal/cabinet/http/handlers/payments.go: period, tariff_id, provider.
  checkout: (
    input: { period: number; provider: string; tariffId?: number | null },
    idempotencyKey: string,
  ) => {
    const body: Record<string, unknown> = {
      period: input.period,
      provider: input.provider,
    }
    if (input.tariffId != null && input.tariffId > 0) {
      body.tariff_id = input.tariffId
    }
    return request<CheckoutResponse>('POST', '/payments/checkout', body, { 'Idempotency-Key': idempotencyKey })
  },

  paymentPreview: (period: number, tariffId?: number | null, provider?: string) => {
    const q = new URLSearchParams()
    q.set('period', String(period))
    if (tariffId != null && tariffId > 0) q.set('tariff_id', String(tariffId))
    if (provider) q.set('provider', provider)
    return request<PaymentPreviewResponse>('GET', `/payments/preview?${q.toString()}`)
  },

  paymentStatus: (id: number) =>
    request<PaymentStatusResponse>('GET', `/payments/${id}/status`),

  // Link / Merge
  linkTelegramStart: () =>
    request<{ nonce: string }>('POST', '/link/telegram/start'),

  linkTelegramConfirm: (payload: {
    source: 'widget' | 'miniapp'
    nonce: string
    id?: number
    first_name?: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date?: number
    hash?: string
    init_data?: string
  }) =>
    request<{ telegram_id: number; telegram_username?: string; has_merge_candidate: boolean; customer_tg_id?: number }>(
      'POST',
      '/link/telegram/confirm',
      payload,
    ),

  mergePreview: () =>
    request<MergePreviewResponse>('POST', '/link/merge/preview'),

  mergeConfirm: (idempotencyKey: string, opts?: { force?: boolean; keep_subscription?: 'web' | 'tg' }) =>
    request<MergeConfirmResponse>(
      'POST',
      '/link/merge/confirm',
      { force: opts?.force ?? false, keep_subscription: opts?.keep_subscription },
      { 'Idempotency-Key': idempotencyKey },
    ),

  /**
   * Привязка Telegram (OIDC): браузерный переход на oauth.telegram.org.
   * Нельзя делать location.href на /me/telegram/link/start — эндпоинт требует Bearer,
   * при полной навигации заголовок не отправляется → 401.
   * Редирект на другой origin через fetch+redirect:manual даёт opaqueredirect без Location —
   * поэтому запрашиваем JSON с redirect_url.
   */
  startTelegramOIDCLink: async (): Promise<void> => {
    const run = (token: string) => {
      const csrf = readCsrfCookie()
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }
      if (csrf) headers['X-CSRF-Token'] = csrf
      return fetch(`${BASE}/me/telegram/link/start`, {
        method: 'GET',
        headers,
        credentials: 'include',
      })
    }
    let token = _authRef?.getAccessToken()
    if (!token) throw new ApiError(401, 'not signed in')
    let res = await run(token)
    if (res.status === 401) {
      const newTok = await doRefresh()
      if (!newTok) {
        _authRef?.logout()
        throw new ApiError(401, 'Session expired')
      }
      res = await run(newTok)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApiError(res.status, text || 'telegram link start failed')
    }
    const data = (await res.json().catch(() => null)) as { redirect_url?: string } | null
    const url = data?.redirect_url?.trim()
    if (url) {
      window.location.assign(url)
      return
    }
    throw new ApiError(res.status, 'telegram link start failed')
  },

  /**
   * Привязка Google к текущему аккаунту: JSON с redirect_url (аналогично Telegram OIDC link).
   */
  startGoogleOAuthLink: async (): Promise<void> => {
    const run = (token: string) => {
      const csrf = readCsrfCookie()
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }
      if (csrf) headers['X-CSRF-Token'] = csrf
      return fetch(`${BASE}/me/google/link/start`, {
        method: 'GET',
        headers,
        credentials: 'include',
      })
    }
    let token = _authRef?.getAccessToken()
    if (!token) throw new ApiError(401, 'not signed in')
    let res = await run(token)
    if (res.status === 401) {
      const newTok = await doRefresh()
      if (!newTok) {
        _authRef?.logout()
        throw new ApiError(401, 'Session expired')
      }
      res = await run(newTok)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApiError(res.status, text || 'google link start failed')
    }
    const data = (await res.json().catch(() => null)) as { redirect_url?: string } | null
    const url = data?.redirect_url?.trim()
    if (url) {
      window.location.assign(url)
      return
    }
    throw new ApiError(res.status, 'google link start failed')
  },
  startYandexOAuthLink: async (): Promise<void> => {
    const run = (token: string) => {
      const csrf = readCsrfCookie()
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      if (csrf) headers['X-CSRF-Token'] = csrf
      return fetch(`${BASE}/me/yandex/link/start`, { method: 'GET', headers, credentials: 'include' })
    }
    let token = _authRef?.getAccessToken()
    if (!token) throw new ApiError(401, 'not signed in')
    let res = await run(token)
    if (res.status === 401) {
      const newTok = await doRefresh()
      if (!newTok) {
        _authRef?.logout()
        throw new ApiError(401, 'Session expired')
      }
      res = await run(newTok)
    }
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')) || 'yandex link start failed')
    const data = (await res.json().catch(() => null)) as { redirect_url?: string } | null
    const u = data?.redirect_url?.trim()
    if (!u) throw new ApiError(res.status, 'yandex link start failed')
    window.location.assign(u)
  },
  startVKOAuthLink: async (): Promise<void> => {
    const run = (token: string) => {
      const csrf = readCsrfCookie()
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      if (csrf) headers['X-CSRF-Token'] = csrf
      return fetch(`${BASE}/me/vk/link/start`, { method: 'GET', headers, credentials: 'include' })
    }
    let token = _authRef?.getAccessToken()
    if (!token) throw new ApiError(401, 'not signed in')
    let res = await run(token)
    if (res.status === 401) {
      const newTok = await doRefresh()
      if (!newTok) {
        _authRef?.logout()
        throw new ApiError(401, 'Session expired')
      }
      res = await run(newTok)
    }
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')) || 'vk link start failed')
    const data = (await res.json().catch(() => null)) as { redirect_url?: string } | null
    const u = data?.redirect_url?.trim()
    if (!u) throw new ApiError(res.status, 'vk link start failed')
    window.location.assign(u)
  },
}
