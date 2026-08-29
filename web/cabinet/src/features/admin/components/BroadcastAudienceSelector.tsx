import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface AudienceItem {
  audience: string
  label: string
  count: number
}

interface BroadcastAudienceSelectorProps {
  audiences: AudienceItem[]
  isLoading: boolean
  selectedAudience: string
  onSelectAudience: (audience: string) => void
  audienceLabels: Record<string, string>
}

const AUDIENCE_GROUPS = {
  active: ['active_all', 'active_paid', 'active_trial'],
  inactive: ['inactive_all', 'inactive_paid', 'inactive_trial'],
  other: ['all', 'test_broadcast'],
}

export function BroadcastAudienceSelector({
  audiences,
  isLoading,
  selectedAudience,
  onSelectAudience,
  audienceLabels,
}: BroadcastAudienceSelectorProps) {
  const { t } = useTranslation()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    other: true,
    active: false,
    inactive: false,
  })

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  const getGroupItems = (groupKey: string): AudienceItem[] => {
    const audienceKeys = AUDIENCE_GROUPS[groupKey as keyof typeof AUDIENCE_GROUPS] || []
    return audiences.filter((aud) => audienceKeys.includes(aud.audience))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {Object.entries(AUDIENCE_GROUPS).map(([groupKey, audienceKeys]) => {
        const groupItems = getGroupItems(groupKey)
        if (groupItems.length === 0) return null

        const isExpanded = expandedGroups[groupKey]
        const groupLabels: Record<string, string> = {
          active: t('admin.broadcast.audienceGroup.active', 'Active'),
          inactive: t('admin.broadcast.audienceGroup.inactive', 'Inactive'),
          other: t('admin.broadcast.audienceGroup.other', 'Other'),
        }

        return (
          <div key={groupKey} className="rounded-lg border border-border/50 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(groupKey)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <span>{groupLabels[groupKey as keyof typeof groupLabels]}</span>
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
            {isExpanded && (
              <div className="border-t border-border/50 space-y-1 p-2">
                {groupItems.map((aud) => (
                  <button
                    key={aud.audience}
                    onClick={() => onSelectAudience(aud.audience)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      selectedAudience === aud.audience
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-border hover:bg-accent',
                    )}
                  >
                    <div className="font-medium">{audienceLabels[aud.audience] ?? aud.audience}</div>
                    <div className="text-xs text-muted-foreground">
                      {aud.count} {t('admin.broadcast.recipients')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
