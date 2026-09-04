import { createContext, useContext, useLayoutEffect } from 'react'

export interface AdminPageMeta {
  /** Последний сегмент breadcrumbs (например имя пользователя или «Редактирование»). */
  breadcrumbTail?: string
  /**
   * Ниже lg страница рисует свою верхнюю строку и обходится без общего хедера
   * админки и хлебных крошек. Нужно карточкам, где сверху осмысленны только
   * «назад» и меню действий (см. AdminUserMobileTopBar).
   */
  mobileBareHeader?: boolean
}

export const AdminPageMetaContext = createContext<{
  setMeta: (meta: AdminPageMeta) => void
} | null>(null)

export function useAdminPageMeta(meta: AdminPageMeta) {
  const ctx = useContext(AdminPageMetaContext)
  const tail = meta.breadcrumbTail
  const bare = meta.mobileBareHeader ?? false

  useLayoutEffect(() => {
    if (!ctx) return
    ctx.setMeta({ breadcrumbTail: tail, mobileBareHeader: bare })
    return () => ctx.setMeta({})
  }, [ctx, tail, bare])
}
