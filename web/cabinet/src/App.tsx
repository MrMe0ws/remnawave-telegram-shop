import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { BrandFavicon } from '@/components/BrandFavicon'
import { ThemePolicyProvider } from '@/components/ThemePolicyProvider'
import { CabinetDecorThemeSync } from '@/features/decor/CabinetDecorThemeSync'

// Auth pages (9a)
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import VerifyEmailPage from '@/features/auth/VerifyEmailPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'

// Публичный лендинг (9a): отдельный маршрут, корень SPA по-прежнему ведёт в кабинет.
import LandingPage from '@/features/landing/LandingPage'

// Dev-превью компонентов. Маршрут ниже регистрируется только при import.meta.env.DEV,
// в прод-бандле ветка мертва и модуль вырезается сборкой.
import ConnectCtaPreviewPage from '@/features/dev/ConnectCtaPreviewPage'

// Protected pages (9b)
import DashboardPage from '@/features/dashboard/DashboardPage'
import SubscriptionPage from '@/features/subscription/SubscriptionPage'
import TariffsPage from '@/features/tariffs/TariffsPage'
import CheckoutPage from '@/features/checkout/CheckoutPage'
import PaymentStatusPage from '@/features/checkout/PaymentStatusPage'
import SettingsPage from '@/features/settings/SettingsPage'
import LinkEmailPage from '@/features/settings/LinkEmailPage'
import MergePreviewPage from '@/features/settings/MergePreviewPage'
import ProfilePage from '@/features/profile/ProfilePage'
import ConnectionsPage from '@/features/connections/ConnectionsPage'
import DeepLinkRedirectPage from '@/features/connections/DeepLinkRedirectPage'
import ReferralProgramPage from '@/features/referral/ReferralProgramPage'
import FortunePage from '@/features/fortune/FortunePage'
import LoyaltyProgramPage from '@/features/loyalty/LoyaltyProgramPage'
import PromoCodesPage from '@/features/promocodes/PromoCodesPage'
import SupportPage from '@/features/support/SupportPage'
import InfoPage from '@/features/info/InfoPage'
import AdminDashboardPage from '@/features/admin/pages/AdminDashboardPage'
import AdminStatsPage from '@/features/admin/pages/AdminStatsPage'
import AdminUsersPage from '@/features/admin/pages/AdminUsersPage'
import AdminUserDetailPage from '@/features/admin/pages/AdminUserDetailPage'
import AdminPromosPage from '@/features/admin/pages/AdminPromosPage'
import AdminTariffsPage from '@/features/admin/pages/AdminTariffsPage'
import AdminLoyaltyPage from '@/features/admin/pages/AdminLoyaltyPage'
import AdminBroadcastPage from '@/features/admin/pages/AdminBroadcastPage'
import AdminInfraPage from '@/features/admin/pages/AdminInfraPage'
import AdminSyncPage from '@/features/admin/pages/AdminSyncPage'
import AdminSettingsPage from '@/features/admin/pages/AdminSettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

/**
 * Кабинет живёт под /cabinet, а лендинг отдаётся ещё и с корня домена (/landing) —
 * см. mux.Handle("/landing") в internal/cabinet/http/router.go. Basename выбираем
 * по фактическому пути, иначе router с фиксированным '/cabinet' не сматчит /landing.
 */
function resolveBasename(): string {
  if (typeof window === 'undefined') return '/cabinet'
  return window.location.pathname.startsWith('/cabinet') ? '/cabinet' : ''
}

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/password/forgot',
  '/password/reset',
])

/** Показывать оболочку до init auth (публичные страницы + deeplink и лендинг без сессии). */
const PUBLIC_SHELL_PATHS = new Set([
  ...PUBLIC_AUTH_PATHS,
  '/deeplink',
  '/landing',
  // Dev-превью: без этого страница ждала бы инициализацию auth. В прод не попадает.
  ...(import.meta.env.DEV ? ['/dev/connect-cta'] : []),
])

function normalizePath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '')
  return p === '' ? '/' : p
}

function isPublicShellPath(pathname: string): boolean {
  return PUBLIC_SHELL_PATHS.has(normalizePath(pathname))
}

function AppRoutes() {
  const location = useLocation()
  const { initialized, initialize } = useAuthStore()
  const showAuthShellEarly = isPublicShellPath(location.pathname)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  useEffect(() => {
    void initialize()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialized && !showAuthShellEarly) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      {/* ── Public auth routes ─────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/password/forgot" element={<ForgotPasswordPage />} />
      <Route path="/password/reset" element={<ResetPasswordPage />} />

      {/* Публичная страница редиректа на custom scheme — открывается из мини-приложения во внешнем браузере (без сессии). */}
      <Route path="/deeplink" element={<DeepLinkRedirectPage />} />

      {/* Витрина проекта. Доступна и гостю, и авторизованному — редиректа нет. */}
      <Route path="/landing" element={<LandingPage />} />

      {/* Только dev: превью акцентной кнопки «Подключить устройство». */}
      {import.meta.env.DEV && (
        <Route path="/dev/connect-cta" element={<ConnectCtaPreviewPage />} />
      )}

      {/* ── Protected routes ───────────────────────────── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireVerified>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute requireVerified>
            <SubscriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tariffs"
        element={
          <ProtectedRoute requireVerified>
            <TariffsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute requireVerified>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/status/:id"
        element={
          <ProtectedRoute>
            <PaymentStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/status"
        element={
          <ProtectedRoute>
            <PaymentStatusPage />
          </ProtectedRoute>
        }
      />

      <Route path="/settings" element={<Navigate to="/profile" replace />} />

      <Route
        path="/profile"
        element={
          <ProtectedRoute requireVerified>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/email"
        element={
          <ProtectedRoute>
            <LinkEmailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/connections"
        element={
          <ProtectedRoute requireVerified>
            <ConnectionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute requireVerified>
            <Navigate to="/profile#history" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/promocodes"
        element={
          <ProtectedRoute requireVerified>
            <PromoCodesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute requireVerified>
            <SupportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/info"
        element={
          <ProtectedRoute requireVerified>
            <InfoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referral"
        element={
          <ProtectedRoute requireVerified>
            <ReferralProgramPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fortune"
        element={
          <ProtectedRoute requireVerified>
            <FortunePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/loyalty"
        element={
          <ProtectedRoute requireVerified>
            <LoyaltyProgramPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/link/merge"
        element={
          <ProtectedRoute requireVerified>
            <MergePreviewPage />
          </ProtectedRoute>
        }
      />

      {/* ── Admin routes ─────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/stats"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminStatsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminUserDetailPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/promos"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminPromosPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tariffs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminTariffsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/loyalty"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLoyaltyPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/broadcast"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminBroadcastPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/infra"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminInfraPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSettingsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sync"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSyncPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Fallbacks */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemePolicyProvider>
          <BrandFavicon />
          <CabinetDecorThemeSync />
          <BrowserRouter basename={resolveBasename()}>
            <AppRoutes />
          </BrowserRouter>
        </ThemePolicyProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
