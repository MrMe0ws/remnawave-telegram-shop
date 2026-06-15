import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  useAdminUsers,
  useAdminUserSearch,
  type AdminCustomerDTO,
} from '../hooks/useAdminUsers'
import { useAdminTariffList, type AdminTariff } from '../hooks/useAdminTariffs'
import { resolveTariffLabel } from '../utils/resolveTariffLabel'

const SCOPES = ['all', 'active', 'inactive', 'expiring', 'trial'] as const
type Scope = (typeof SCOPES)[number]

const PAGE_LIMIT = 20

function statusBadge(status: string, t: (k: string) => string) {
  const map: Record<string, { labelKey: string; cls: string }> = {
    active: { labelKey: 'admin.users.statusActive', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    expired: { labelKey: 'admin.users.statusExpired', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
    trial: { labelKey: 'admin.users.statusTrial', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    inactive: { labelKey: 'admin.users.statusInactive', cls: 'bg-muted text-muted-foreground' },
    disabled: { labelKey: 'admin.users.rwStatusDisabled', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  }
  const entry = map[status]
  const label = entry ? t(entry.labelKey) : status
  const cls = entry?.cls ?? 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  )
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function UserRow({
  user,
  onClick,
  t,
  tariffs,
}: {
  user: AdminCustomerDTO
  onClick: () => void
  t: (k: string) => string
  tariffs?: AdminTariff[]
}) {
  const tariffLabel = resolveTariffLabel(user.current_tariff_id, undefined, tariffs)

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/50 last:border-0"
    >
      <td className="w-[1%] whitespace-nowrap px-3 py-2.5 text-sm font-mono tabular-nums">{user.id}</td>
      <td className="w-[7rem] max-w-[7rem] truncate px-3 py-2.5 text-sm font-mono tabular-nums" title={String(user.telegram_id)}>
        {user.telegram_id}
      </td>
      <td className="max-w-[9rem] truncate px-3 py-2.5 text-sm" title={user.telegram_username ? `@${user.telegram_username}` : undefined}>
        {user.telegram_username ? (
          <span className="text-foreground">@{user.telegram_username}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 text-sm sm:table-cell">{formatDate(user.expire_at)}</td>
      <td className="px-3 py-2.5 text-sm">{statusBadge(user.status, t)}</td>
      <td className="hidden max-w-[8rem] truncate px-3 py-2.5 text-sm md:table-cell" title={tariffLabel ?? undefined}>
        {tariffLabel ?? '—'}
      </td>
    </tr>
  )
}

function UserMobileCard({
  user,
  onClick,
  t,
}: {
  user: AdminCustomerDTO
  onClick: () => void
  t: (k: string) => string
}) {
  const displayName = user.telegram_username ? `@${user.telegram_username}` : '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 active:bg-accent/60"
    >
      <p className="min-w-0 truncate text-sm font-semibold">{displayName}</p>
      <div className="flex shrink-0 items-center gap-2">
        {statusBadge(user.status, t)}
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  )
}

const SCOPE_LABEL_KEYS: Record<Scope, string> = {
  all: 'admin.users.scopeAll',
  active: 'admin.users.scopeActive',
  inactive: 'admin.users.scopeInactive',
  expiring: 'admin.users.scopeExpiring',
  trial: 'admin.users.scopeTrial',
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [scope, setScope] = useState<Scope>('all')
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const isSearching = debouncedSearch.trim().length > 0

  const listQuery = useAdminUsers({ scope, page, limit: PAGE_LIMIT })
  const searchResult = useAdminUserSearch(debouncedSearch)
  const { data: tariffs } = useAdminTariffList()

  const debounceRef = useMemo(() => ({ timer: null as ReturnType<typeof setTimeout> | null }), [])

  const onSearchChange = useCallback(
    (val: string) => {
      setSearchQuery(val)
      if (debounceRef.timer) clearTimeout(debounceRef.timer)
      debounceRef.timer = setTimeout(() => setDebouncedSearch(val), 350)
    },
    [debounceRef],
  )

  const items = isSearching ? (searchResult.data?.items ?? []) : (listQuery.data?.items ?? [])
  const total = isSearching ? items.length : (listQuery.data?.total ?? 0)
  const totalPages = isSearching ? 1 : Math.max(1, Math.ceil(total / PAGE_LIMIT))
  const isLoading = isSearching ? searchResult.isLoading : listQuery.isLoading
  const isError = isSearching ? searchResult.isError : listQuery.isError

  return (
    <AdminLayout>
      <div className="space-y-4">
        <AdminPageHeader
          icon={Users}
          title={t('admin.users.title')}
          subtitle={total > 0 ? t('admin.users.totalCount', { count: total }) : t('admin.users.subtitle')}
          accent="violet"
        />

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Scope tabs */}
        {!isSearching && (
          <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5">
            <div className="inline-flex min-w-full gap-1 rounded-lg border border-border/50 bg-card/50 p-1 sm:min-w-0 sm:w-full">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setScope(s); setPage(1) }}
                  className={cn(
                    'min-h-9 shrink-0 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-1',
                    scope === s
                      ? 'bg-primary/10 text-primary dark:bg-primary/20'
                      : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                  )}
                >
                  {t(SCOPE_LABEL_KEYS[s])}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              {t('common.error', 'Ошибка загрузки')}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {isSearching ? t('admin.users.searchEmpty') : t('admin.users.listEmpty')}
            </div>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {items.map((u) => (
                  <UserMobileCard
                    key={u.id}
                    user={u}
                    t={t}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="w-[1%] whitespace-nowrap px-3 py-2">{t('admin.users.id')}</th>
                      <th className="w-[7rem] max-w-[7rem] px-3 py-2">{t('admin.users.telegramId')}</th>
                      <th className="px-3 py-2">{t('admin.users.username')}</th>
                      <th className="hidden px-3 py-2 sm:table-cell">{t('admin.users.expireAt')}</th>
                      <th className="px-3 py-2">{t('admin.users.status')}</th>
                      <th className="hidden px-3 py-2 md:table-cell">{t('admin.users.tariff')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        t={t}
                        tariffs={tariffs}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {!isSearching && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                {t('admin.prev')}
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                {t('admin.next')}
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
