import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ADMIN_BREADCRUMB_ROUTE_KEYS, parseAdminPath } from './adminBreadcrumbRoutes'
import type { AdminPageMeta } from './useAdminPageMeta'

interface AdminBreadcrumbsProps {
  pathname: string
  pageMeta: AdminPageMeta
  className?: string
}

export function AdminBreadcrumbs({ pathname, pageMeta, className }: AdminBreadcrumbsProps) {
  const { t } = useTranslation()
  const { sectionKey, userId } = parseAdminPath(pathname)

  if (sectionKey === null || sectionKey === '') {
    return null
  }

  type Crumb = { label: string; to?: string }

  const sectionLabelKey = ADMIN_BREADCRUMB_ROUTE_KEYS[sectionKey]
  if (!sectionLabelKey) {
    return null
  }

  const crumbs: Crumb[] = [{ label: t('admin.breadcrumb.root'), to: '/admin' }]
  const sectionPath = `/admin/${sectionKey}`

  if (userId != null) {
    crumbs.push({ label: t(sectionLabelKey), to: sectionPath })
    crumbs.push({
      label: pageMeta.breadcrumbTail ?? t('admin.breadcrumb.userFallback', { id: userId }),
    })
  } else if (pageMeta.breadcrumbTail) {
    crumbs.push({ label: t(sectionLabelKey), to: sectionPath })
    crumbs.push({ label: pageMeta.breadcrumbTail })
  } else {
    crumbs.push({ label: t(sectionLabelKey) })
  }

  return (
    <nav aria-label={t('admin.breadcrumb.aria')} className={cn('mb-4 lg:mb-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="rounded-md transition-colors hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(isLast && 'font-medium text-foreground')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
