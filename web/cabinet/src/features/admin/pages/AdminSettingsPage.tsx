import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminToggleRow } from '../components/AdminToggleSwitch'
import { AdminSelect } from '../components/AdminSelect'
import { useAdminBotSettings, useAdminBotSettingsPatch } from '../hooks/useAdminBotSettings'
import { useAdminMutationFeedback } from '../hooks/useAdminMutationFeedback'
import {
  ADMIN_SETTINGS_CATEGORIES,
  ADMIN_SETTINGS_DEFAULT_CATEGORY,
  ADMIN_SETTINGS_GROUPS_LIST_ANCHOR,
  ADMIN_SETTINGS_GROUP_ICONS,
  adminSettingsCategoryDef,
  adminSettingsCategoryForGroup,
  adminSettingsGroupAnchor,
  adminSettingsGroupIconStyle,
  scrollToSettingsGroupsList,
  sortSettingsGroupsByOrder,
  splitGroupIntoSubsections,
  type AdminSettingsCategoryId,
  type AdminSettingsGroupId,
} from '../utils/adminSettingsGroups'
import { groupSettingsFieldsForLayout, isTextareaSettingType } from '../utils/adminSettingsFieldLayout'
import { SettingsSubsectionTitle } from '../components/SettingsSubsectionTitle'
import { decorThemeOptionLabelStyle } from '@/features/decor/decorThemeAdmin'
import type { AdminSettingFieldDTO, AdminSettingGroupDTO } from '@/lib/types/admin'

function parseBool(v: string): boolean {
  return v.trim().toLowerCase() === 'true'
}

function fieldLabel(t: (k: string) => string, key: string): string {
  const k = `admin.settings.fields.${key}.label`
  const translated = t(k)
  return translated === k ? key : translated
}

function fieldHint(t: (k: string) => string, key: string): string | undefined {
  const k = `admin.settings.fields.${key}.hint`
  const translated = t(k)
  if (translated === k || translated.trim() === '') return undefined
  return translated
}

function fieldHasHint(t: (k: string) => string, key: string): boolean {
  return fieldHint(t, key) !== undefined
}

function groupIcon(id: string): LucideIcon {
  return ADMIN_SETTINGS_GROUP_ICONS[id as AdminSettingsGroupId] ?? SlidersHorizontal
}

interface GroupEditorProps {
  group: AdminSettingGroupDTO
  draft: Record<string, string>
  searchQuery: string
  expanded: boolean
  categoryBadge?: string
  onToggleExpand: () => void
  onDraftChange: (key: string, value: string) => void
  onToggle: (key: string, value: boolean) => void
  onInstantEnum: (key: string, value: string) => void
  onSave: (keys: string[]) => void
  saving: boolean
  togglingKey: string | null
}

function SettingsGroupEditor({
  group,
  draft,
  searchQuery,
  expanded,
  categoryBadge,
  onToggleExpand,
  onDraftChange,
  onToggle,
  onInstantEnum,
  onSave,
  saving,
  togglingKey,
}: GroupEditorProps) {
  const { t } = useTranslation()
  const Icon = groupIcon(group.id)
  const iconStyle = adminSettingsGroupIconStyle(group.id)
  const q = searchQuery.trim().toLowerCase()

  const fieldMatchesSearch = useCallback(
    (field: AdminSettingFieldDTO) => {
      if (!q) return true
      const label = fieldLabel(t, field.key).toLowerCase()
      return label.includes(q) || field.key.toLowerCase().includes(q)
    },
    [q, t],
  )

  const visibleFields = useMemo(
    () => group.fields.filter(fieldMatchesSearch),
    [group.fields, fieldMatchesSearch],
  )

  const nonInstantKeys = useMemo(
    () => visibleFields.filter((f) => !f.instant).map((f) => f.key),
    [visibleFields],
  )

  const fieldByKey = useMemo(() => {
    const m = new Map<string, AdminSettingFieldDTO>()
    for (const f of group.fields) m.set(f.key, f)
    return m
  }, [group.fields])

  const subsectionBlocks = useMemo(() => {
    const keys = visibleFields.map((f) => f.key)
    return splitGroupIntoSubsections(group.id, keys)
      .map((block) => ({
        def: block.def,
        fields: block.fields
          .map(({ key }) => fieldByKey.get(key))
          .filter(Boolean) as AdminSettingFieldDTO[],
      }))
      .filter((b) => b.fields.length > 0)
  }, [group.id, visibleFields, fieldByKey])

  if (visibleFields.length === 0) {
    return null
  }

  const renderField = (field: AdminSettingFieldDTO, compact = false) => {
    const label = fieldLabel(t, field.key)
    const hint = fieldHint(t, field.key)
    const value = draft[field.key] ?? field.value

    if (field.type === 'bool') {
      return (
        <AdminToggleRow
          key={field.key}
          label={label}
          hint={hint}
          checked={parseBool(value)}
          disabled={togglingKey === field.key || saving}
          onChange={(checked) => onToggle(field.key, checked)}
        />
      )
    }

    const inputId = `setting-${field.key}`
    return (
      <div
        key={field.key}
        className={cn(
          'space-y-1.5',
          compact
            ? 'rounded-lg border border-border/60 bg-card p-2.5 shadow-sm'
            : 'border-b border-border/50 py-3 last:border-0',
        )}
      >
        <label htmlFor={inputId} className="block text-sm font-medium leading-snug text-foreground">
          {label}
        </label>
        {field.type === 'enum' && field.enum_values?.length ? (
          <AdminSelect
            id={inputId}
            value={value}
            options={field.enum_values.map((opt) => ({
              value: opt,
              label: t(`admin.settings.enum.${opt}`, { defaultValue: opt }),
              labelStyle:
                field.key === 'CABINET_DECOR_THEME' ? decorThemeOptionLabelStyle(opt) : undefined,
            }))}
            onChange={(next) => {
              if (next == null) return
              if (field.instant) {
                onInstantEnum(field.key, next)
              } else {
                onDraftChange(field.key, next)
              }
            }}
            placeholder={label}
            ariaLabel={label}
            disabled={togglingKey === field.key || saving}
          />
        ) : isTextareaSettingType(field.type) ? (
          <textarea
            id={inputId}
            rows={3}
            className="admin-input w-full resize-y rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm"
            value={value}
            placeholder={t('admin.settings.csvPlaceholder')}
            onChange={(e) => onDraftChange(field.key, e.target.value)}
          />
        ) : (
          <input
            id={inputId}
            type={field.type === 'float' || field.type === 'int' ? 'number' : 'text'}
            step={field.type === 'float' ? 'any' : '1'}
            min={field.min_int}
            max={field.max_int}
            className="admin-input w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={value}
            onChange={(e) => onDraftChange(field.key, e.target.value)}
          />
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {field.key === 'RUB_PER_STAR' && (
          <p className="text-xs font-medium text-muted-foreground">
            {t('admin.settings.fields.RUB_PER_STAR.envKey')}
          </p>
        )}
      </div>
    )
  }

  const renderFieldsLayout = (fields: AdminSettingFieldDTO[]) => {
    const groups = groupSettingsFieldsForLayout(fields, (key) => fieldHasHint(t, key))

    return groups.map((group, groupIndex) => {
      if (group.kind === 'compact') {
        return (
          <div
            key={`compact-${groupIndex}`}
            className="grid grid-cols-1 gap-2.5 border-b border-border/50 py-3 last:border-0 sm:grid-cols-2 lg:grid-cols-3"
          >
            {group.fields.map((field) => renderField(field, true))}
          </div>
        )
      }

      return group.fields.map((field) => renderField(field, false))
    })
  }

  const renderSubsection = (
    block: { def: (typeof subsectionBlocks)[0]['def']; fields: AdminSettingFieldDTO[] },
    index: number,
  ) => (
    <div key={block.def?.id ?? `flat-${index}`} className="mb-4 last:mb-0">
      {block.def && (
        <SettingsSubsectionTitle icon={block.def.icon}>{t(block.def.titleKey)}</SettingsSubsectionTitle>
      )}
      <div className="rounded-lg border border-border/60 bg-card/80 px-3 shadow-sm">
        {renderFieldsLayout(block.fields)}
      </div>
    </div>
  )

  const groupTitle = t(`admin.settings.groups.${group.id}`)

  return (
    <Card id={adminSettingsGroupAnchor(group.id)} className="cabinet-elevated-card scroll-mt-24 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', iconStyle.box)}>
            <Icon className={cn('size-4', iconStyle.icon)} aria-hidden />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            {categoryBadge && (
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {categoryBadge}
              </span>
            )}
            <p className="truncate text-sm font-semibold uppercase tracking-wide text-foreground sm:text-base sm:normal-case sm:tracking-normal">
              {groupTitle}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-1 border-t border-border/60 pt-4">
              {subsectionBlocks.length === 1 && !subsectionBlocks[0].def ? (
                <div className="rounded-lg border border-border/60 bg-card/80 px-3 shadow-sm">
                  {renderFieldsLayout(subsectionBlocks[0].fields)}
                </div>
              ) : (
                subsectionBlocks.map(renderSubsection)
              )}

              {nonInstantKeys.length > 0 && (
                <div className="flex justify-end pt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => onSave(nonInstantKeys)}
                    className="min-w-[140px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('admin.settings.saving')}
                      </>
                    ) : (
                      t('admin.settings.saveSection')
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

interface CategoryNavProps {
  activeId: AdminSettingsCategoryId
  onSelect: (id: AdminSettingsCategoryId) => void
}

function settingsCategoryTabId(categoryId: AdminSettingsCategoryId): string {
  return `settings-category-tab-${categoryId}`
}

function SettingsCategoryNav({ activeId, onSelect }: CategoryNavProps) {
  const { t } = useTranslation()

  return (
    <div
      role="tablist"
      aria-label={t('admin.settings.categoryNav')}
      className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 lg:overflow-visible"
    >
      <div className="inline-flex min-w-full gap-1 rounded-lg border border-border/50 bg-card/50 p-1 sm:min-w-0 sm:w-full">
        {ADMIN_SETTINGS_CATEGORIES.map((category) => {
          const Icon = category.icon
          const isActive = activeId === category.id
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              id={settingsCategoryTabId(category.id)}
              aria-selected={isActive}
              aria-controls={ADMIN_SETTINGS_GROUPS_LIST_ANCHOR}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(category.id)}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:flex-1',
                isActive
                  ? cn(category.iconStyle.box, category.iconStyle.icon)
                  : 'text-foreground/80 hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon
                className={cn('size-3.5 shrink-0', isActive ? category.iconStyle.icon : undefined)}
                aria-hidden
              />
              <span className="truncate leading-tight">{t(category.titleKey)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useAdminBotSettings()
  const patchMutation = useAdminBotSettingsPatch()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const { feedback, clear, showSuccess, showError } = useAdminMutationFeedback()
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<AdminSettingsCategoryId>(ADMIN_SETTINGS_DEFAULT_CATEGORY)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!data) return
    setDraft((prev) => {
      const next = { ...prev }
      for (const g of data.groups) {
        for (const f of g.fields) {
          if (f.instant || prev[f.key] === undefined) {
            next[f.key] = f.value
          }
        }
      }
      return next
    })
  }, [data])

  const searchFilteredGroups = useMemo(() => {
    if (!data?.groups) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return data.groups

    return data.groups
      .map((group) => {
        const groupTitle = t(`admin.settings.groups.${group.id}`).toLowerCase()
        if (groupTitle.includes(q)) return group
        const fields = group.fields.filter((f) => {
          const label = fieldLabel(t, f.key).toLowerCase()
          return label.includes(q) || f.key.toLowerCase().includes(q)
        })
        if (fields.length === 0) return null
        return { ...group, fields }
      })
      .filter(Boolean) as AdminSettingGroupDTO[]
  }, [data?.groups, searchQuery, t])

  const isSearching = searchQuery.trim().length > 0

  const visibleGroups = useMemo(() => {
    if (isSearching) return sortSettingsGroupsByOrder(searchFilteredGroups)

    const category = adminSettingsCategoryDef(activeCategory)
    if (!category) return []

    const allowed = new Set(category.groups)
    return sortSettingsGroupsByOrder(
      searchFilteredGroups.filter((group) => allowed.has(group.id as AdminSettingsGroupId)),
    )
  }, [activeCategory, isSearching, searchFilteredGroups])

  const categoryBadgeForGroup = useCallback(
    (groupId: string) => {
      if (!isSearching) return undefined
      const categoryId = adminSettingsCategoryForGroup(groupId)
      if (!categoryId) return undefined
      const category = adminSettingsCategoryDef(categoryId)
      return category ? t(category.titleKey) : undefined
    },
    [isSearching, t],
  )

  // Expand all matching groups while searching; collapse only when search ends.
  // Do not reset on visibleGroups/data refetch — that would close sections after saving.
  useEffect(() => {
    if (isSearching) {
      setExpandedGroups(new Set(visibleGroups.map((g) => g.id)))
    }
  }, [isSearching, visibleGroups])

  useEffect(() => {
    if (!isSearching) {
      setExpandedGroups(new Set())
    }
  }, [isSearching])

  const handleToggle = useCallback(
    async (key: string, checked: boolean) => {
      const prev = draft[key]
      setDraft((d) => ({ ...d, [key]: checked ? 'true' : 'false' }))
      setTogglingKey(key)
      try {
        await patchMutation.mutateAsync({ [key]: checked ? 'true' : 'false' })
        showSuccess(t('admin.settings.saved'))
      } catch (err) {
        setDraft((d) => ({ ...d, [key]: prev ?? '' }))
        showError(err)
      } finally {
        setTogglingKey(null)
      }
    },
    [draft, patchMutation, showError, showSuccess, t],
  )

  const handleInstantEnum = useCallback(
    async (key: string, value: string) => {
      const prev = draft[key]
      setDraft((d) => ({ ...d, [key]: value }))
      setTogglingKey(key)
      try {
        await patchMutation.mutateAsync({ [key]: value })
        showSuccess(t('admin.settings.saved'))
      } catch (err) {
        setDraft((d) => ({ ...d, [key]: prev ?? '' }))
        showError(err)
      } finally {
        setTogglingKey(null)
      }
    },
    [draft, patchMutation, showError, showSuccess, t],
  )

  const handleSaveSection = useCallback(
    async (groupId: string, keys: string[]) => {
      const payload: Record<string, string> = {}
      for (const key of keys) {
        payload[key] = draft[key] ?? ''
      }
      setSavingGroup(groupId)
      try {
        await patchMutation.mutateAsync(payload)
        showSuccess(t('admin.settings.saved'))
      } catch (err) {
        showError(err)
      } finally {
        setSavingGroup(null)
      }
    },
    [draft, patchMutation, showError, showSuccess, t],
  )

  const toggleGroupExpanded = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCategoryNav = useCallback((categoryId: AdminSettingsCategoryId) => {
    setActiveCategory(categoryId)
    setExpandedGroups(new Set())
    window.requestAnimationFrame(() => {
      scrollToSettingsGroupsList()
    })
  }, [])

  return (
    <AdminLayout>
      <AdminFeedback feedback={feedback} onDismiss={clear} autoDismissMs={4000} />
      <div className="mx-auto max-w-2xl space-y-4 lg:max-w-5xl">
        <AdminPageHeader
          icon={SlidersHorizontal}
          title={t('admin.settings.title')}
          subtitle={t('admin.settings.subtitle')}
          accent="violet"
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.settings.searchPlaceholder')}
            className="admin-input h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label={t('admin.settings.searchClear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {!isLoading && !isError && !isSearching && (
          <SettingsCategoryNav activeId={activeCategory} onSelect={handleCategoryNav} />
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {t('admin.settings.loadError')}
          </div>
        )}

        {!isLoading && !isError && searchQuery && visibleGroups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.settings.searchEmpty')}</p>
        )}

        {!isLoading && !isError && !isSearching && visibleGroups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.settings.categoryEmpty')}</p>
        )}

        <div
          id={ADMIN_SETTINGS_GROUPS_LIST_ANCHOR}
          role="tabpanel"
          aria-labelledby={settingsCategoryTabId(activeCategory)}
          className="scroll-mt-24 space-y-3"
        >
          {visibleGroups.map((group) => (
            <SettingsGroupEditor
              key={group.id}
              group={group}
              draft={draft}
              searchQuery={searchQuery}
              categoryBadge={categoryBadgeForGroup(group.id)}
              expanded={isSearching || expandedGroups.has(group.id)}
              onToggleExpand={() => toggleGroupExpanded(group.id)}
              onDraftChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
              onToggle={handleToggle}
              onInstantEnum={handleInstantEnum}
              onSave={(keys) => handleSaveSection(group.id, keys)}
              saving={savingGroup === group.id || patchMutation.isPending}
              togglingKey={togglingKey}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
