import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/store/auth'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
