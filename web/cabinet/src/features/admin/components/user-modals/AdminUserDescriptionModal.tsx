import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { AdminModalSaveFooter } from '../AdminModalSaveFooter'
import { formatAdminApiError } from '../../utils/formatAdminApiError'
import {
  useAdminUserSetDescription,
  type AdminUserPanelResponse,
} from '../../hooks/useAdminUsers'

interface Props {
  open: boolean
  onClose: () => void
  userId: number
  panel: AdminUserPanelResponse
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function AdminUserDescriptionModal({
  open,
  onClose,
  userId,
  panel,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation()
  const rw = panel.rw!
  const setDescription = useAdminUserSetDescription(userId)

  const initialDescription = rw.description ?? ''
  const [draftDescription, setDraftDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraftDescription(rw.description ?? '')
      setError(null)
    }
  }, [open, rw.description])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSave = () => {
    const trimmed = draftDescription.trim()
    const normalized = trimmed || null
    const initialNormalized = initialDescription.trim() || null

    if (normalized === initialNormalized) {
      handleClose()
      return
    }

    setError(null)
    setDescription.mutate(normalized, {
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

  const hasChanges = (draftDescription.trim() || null) !== (initialDescription.trim() || null)

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title={t('admin.users.subscription.description')}
      icon={FileText}
      iconAccent="slate"
      panelClassName="sm:max-w-lg"
      footer={
        <AdminModalSaveFooter
          onCancel={handleClose}
          onSave={handleSave}
          isPending={setDescription.isPending}
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
        <textarea
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          rows={5}
          className="admin-input w-full resize-y px-3 py-2"
          placeholder={t('admin.users.overview.descriptionEmpty')}
        />
      </div>
    </AdminModal>
  )
}
