import type { AdminSettingFieldDTO } from '@/lib/types/admin'

export function isTextareaSettingType(type: AdminSettingFieldDTO['type']): boolean {
  return type === 'csv' || type === 'csv_int'
}

/** Компактные поля (число, enum) — можно выводить в сетку 2–3 в ряд на десктопе. */
export function isCompactSettingsField(field: AdminSettingFieldDTO, hasHint: boolean): boolean {
  if (field.type === 'bool') return false
  if (isTextareaSettingType(field.type)) return false
  if (field.type === 'text' || field.type === 'url') return false
  if (hasHint) return false
  if (field.key === 'RUB_PER_STAR') return false
  return field.type === 'int' || field.type === 'float' || field.type === 'enum'
}

export interface SettingsFieldLayoutGroup {
  kind: 'compact' | 'full'
  fields: AdminSettingFieldDTO[]
}

export function groupSettingsFieldsForLayout(
  fields: AdminSettingFieldDTO[],
  hasHint: (key: string) => boolean,
): SettingsFieldLayoutGroup[] {
  const groups: SettingsFieldLayoutGroup[] = []
  let compactBatch: AdminSettingFieldDTO[] = []

  const flushCompact = () => {
    if (compactBatch.length === 0) return
    groups.push({ kind: 'compact', fields: compactBatch })
    compactBatch = []
  }

  for (const field of fields) {
    if (isCompactSettingsField(field, hasHint(field.key))) {
      compactBatch.push(field)
      continue
    }
    flushCompact()
    groups.push({ kind: 'full', fields: [field] })
  }

  flushCompact()
  return groups
}
