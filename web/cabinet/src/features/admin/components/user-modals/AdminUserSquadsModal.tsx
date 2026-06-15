import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { AdminModalSaveFooter } from '../AdminModalSaveFooter'
import { AdminCheckbox } from '../AdminCheckbox'
import { cn } from '@/lib/utils'
import { formatAdminApiError } from '../../utils/formatAdminApiError'
import {
  useAdminUserSetSquads,
  type AdminSquadDTO,
  type AdminUserPanelResponse,
} from '../../hooks/useAdminUsers'

function normalizeSquads(squads?: AdminSquadDTO[] | null): AdminSquadDTO[] {
  return squads ?? []
}

interface Props {
  open: boolean
  onClose: () => void
  userId: number
  panel: AdminUserPanelResponse
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function AdminUserSquadsModal({
  open,
  onClose,
  userId,
  panel,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation()
  const rw = panel.rw!
  const setSquads = useAdminUserSetSquads(userId)

  const initialUuids = normalizeSquads(rw.active_squads).map((s) => s.uuid)
  const [draftSquads, setDraftSquads] = useState<string[]>(initialUuids)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraftSquads(normalizeSquads(rw.active_squads).map((s) => s.uuid))
      setError(null)
    }
  }, [open, rw.active_squads])

  const toggleSquad = (uuid: string) => {
    setDraftSquads((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid],
    )
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSave = () => {
    setError(null)
    const sorted = [...draftSquads].sort()
    const sortedInitial = [...initialUuids].sort()
    const unchanged = sorted.length === sortedInitial.length && sorted.every((u, i) => u === sortedInitial[i])
    if (unchanged) {
      handleClose()
      return
    }

    setSquads.mutate(draftSquads, {
      onSuccess: () => {
        onSuccess?.(t('admin.feedback.saved'))
        handleClose()
      },
      onError: (e) => {
        const msg = formatAdminApiError(e, t)
        setError(msg)
        onError?.(msg)
      },
    })
  }

  const hasChanges = (() => {
    const sorted = [...draftSquads].sort()
    const sortedInitial = [...initialUuids].sort()
    return sorted.length !== sortedInitial.length || sorted.some((u, i) => u !== sortedInitial[i])
  })()

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title={t('admin.users.subscription.squads')}
      icon={Layers}
      iconAccent="indigo"
      panelClassName="sm:max-w-lg"
      footer={
        <AdminModalSaveFooter
          onCancel={handleClose}
          onSave={handleSave}
          isPending={setSquads.isPending}
          saveDisabled={!hasChanges}
        />
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {panel.available_squads.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.noData')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {panel.available_squads.map((sq: AdminSquadDTO) => (
              <label
                key={sq.uuid}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  draftSquads.includes(sq.uuid)
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/50 hover:bg-accent/50',
                )}
              >
                <AdminCheckbox
                  checked={draftSquads.includes(sq.uuid)}
                  onChange={() => toggleSquad(sq.uuid)}
                  aria-label={sq.name}
                />
                <span className="truncate">{sq.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </AdminModal>
  )
}
