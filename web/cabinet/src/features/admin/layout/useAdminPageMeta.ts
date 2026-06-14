import { createContext, useContext, useLayoutEffect } from 'react'

export interface AdminPageMeta {
  /** Последний сегмент breadcrumbs (например имя пользователя или «Редактирование»). */
  breadcrumbTail?: string
}

export const AdminPageMetaContext = createContext<{
  setMeta: (meta: AdminPageMeta) => void
} | null>(null)

export function useAdminPageMeta(meta: AdminPageMeta) {
  const ctx = useContext(AdminPageMetaContext)
  const tail = meta.breadcrumbTail

  useLayoutEffect(() => {
    if (!ctx) return
    ctx.setMeta({ breadcrumbTail: tail })
    return () => ctx.setMeta({})
  }, [ctx, tail])
}
