import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { BrandFavicon } from '@/components/BrandFavicon'

// Auth pages (9a)
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import VerifyEmailPage from '@/features/auth/VerifyEmailPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'

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
import ReferralProgramPage from '@/features/referral/ReferralProgramPage'
import LoyaltyProgramPage from '@/features/loyalty/LoyaltyProgramPage'
import PaymentsHistoryPage from '@/features/payments/PaymentsHistoryPage'
import PromoCodesPage from '@/features/promocodes/PromoCodesPage'
import SupportPage from '@/features/support/SupportPage'
import InfoPage from '@/features/info/InfoPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/password/forgot',
  '/password/reset',
])

function normalizePath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '')
  return p === '' ? '/' : p
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(normalizePath(pathname))
}

function AppRoutes() {
  const location = useLocation()
  const { initialized, initialize } = useAuthStore()
  const showAuthShellEarly = isPublicAuthPath(location.pathname)

  useEffect(() => {
    void initialize()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialized && !showAuthShellEarly) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
            <PaymentsHistoryPage />
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
        <BrandFavicon />
        <BrowserRouter basename="/cabinet">
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
