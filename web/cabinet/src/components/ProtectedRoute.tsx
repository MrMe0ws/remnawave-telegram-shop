import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireVerified?: boolean
}

export function ProtectedRoute({ children, requireVerified = false }: ProtectedRouteProps) {
  const { accessToken, user } = useAuthStore()
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (requireVerified && user && !user.email_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email ?? '' }} replace />
  }

  return <>{children}</>
}
