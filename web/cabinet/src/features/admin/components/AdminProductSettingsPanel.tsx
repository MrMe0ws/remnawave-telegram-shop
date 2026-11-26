import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { AdminSettingsGroupEditor } from './AdminSettingsGroupEditor'
import { useAdminSettingsDraft } from '../hooks/useAdminSettingsDraft'
import {
  ADMIN_PRODUCT_SETTINGS_GROUPS,
  sortSettingsGroupsByOrder,
  type AdminSettingsGroupId,
} from '../utils/adminSettingsGroups'

/**
 * Продуктовые настройки под списком тарифов: витрина цен, триал и трафик,
 * HWID и устройства, курс Telegram Stars.
 *
 * Раньше жили отдельной вкладкой «Продукт» на странице «Настройки бота», из-за
 * чего прайс был разорван: цена тарифа — здесь, цена доп. устройства и курс
 * звёзд — на другом экране. Группы те же самые, источник данных тот же
 * (`GET/PATCH /admin/settings`), изменилось только место показа.
 */
/** `initialOpen` — группа, которую раскрыть и показать сразу (ссылка вида `?open=stars`). */
export function AdminProductSettingsPanel({ initialOpen }: { initialOpen?: string | null } = {}) {
  const { t } = useTranslation()
  const {
    groups,
    isLoading,
    isError,
    draft,
    setDraftValue,
    togglingKey,
    savingGroup,
    isGroupSaving,
    handleToggle,
    handleInstantEnum,
    handleSaveSection,
  } = useAdminSettingsDraft()

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialOpen ? [initialOpen] : []))
  const scrolled = useRef(false)

  const allowed = new Set<AdminSettingsGroupId>(ADMIN_PRODUCT_SETTINGS_GROUPS)
  const productGroups = sortSettingsGroupsByOrder(
    (groups ?? []).filter((g) => allowed.has(g.id as AdminSettingsGroupId)),
  )

  // Пришли по ссылке на конкретную группу — прокручиваем к ней, когда группы загрузятся.
  useEffect(() => {
    if (!initialOpen || isLoading || scrolled.current) return
    const el = document.getElementById(`product-settings-${initialOpen}`)
    if (!el) return
    scrolled.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [initialOpen, isLoading])

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {t('admin.settings.loadError')}
      </div>
    )
  }

  return (
    <section className="space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="admin-stagger grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {productGroups.map((group) => (
            <div key={group.id} id={`product-settings-${group.id}`} className="scroll-mt-24">
            <AdminSettingsGroupEditor
              group={group}
              draft={draft}
              searchQuery=""
              expanded={expanded.has(group.id)}
              onToggleExpand={() =>
                setExpanded((prev) => {
                  const next = new Set(prev)
                  if (next.has(group.id)) next.delete(group.id)
                  else next.add(group.id)
                  return next
                })
              }
              onDraftChange={setDraftValue}
              onToggle={handleToggle}
              onInstantEnum={handleInstantEnum}
              onSave={(keys) => handleSaveSection(group.id, keys)}
              saving={isGroupSaving(group.id)}
              sectionSaving={savingGroup === group.id}
              togglingKey={togglingKey}
            />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
