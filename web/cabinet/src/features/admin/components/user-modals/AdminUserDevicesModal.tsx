import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone } from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { AdminModalSaveFooter } from '../AdminModalSaveFooter'
import { AdminDeviceLimitEditor } from '../AdminDeviceLimitEditor'
import { formatAdminApiError } from '../../utils/formatAdminApiError'
import { baseLimitFromTotal } from '../../utils/deviceLimit'
import {
  useAdminUserDevices,
  useAdminUserSetHwidLimit,
  useAdminUserExtraHwid,
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

export function AdminUserDevicesModal({
  open,
  onClose,
  userId,
  panel,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation()
  const rw = panel.rw!
  const customer = panel.customer
  const totalLimit = rw.hwid_device_limit ?? 1
  const storedExtra = customer?.extra_hwid ?? 0
  const initialBase = baseLimitFromTotal(totalLimit, customer)

  const { data: devicesData, isLoading: devicesLoading } = useAdminUserDevices(open ? userId : null)
  const setHwid = useAdminUserSetHwidLimit(userId)
  const extraHwid = useAdminUserExtraHwid(userId)

  const [draftBase, setDraftBase] = useState(initialBase)
  const [draftExtra, setDraftExtra] = useState(storedExtra)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraftBase(baseLimitFromTotal(totalLimit, customer))
      setDraftExtra(storedExtra)
      setError(null)
    }
  }, [open, totalLimit, storedExtra, customer])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const targetTotal = draftBase + draftExtra
  const extraDelta = draftExtra - storedExtra
  const totalChanged = targetTotal !== totalLimit
  const hasChanges = draftBase !== initialBase || extraDelta !== 0

  const handleSave = async () => {
    setError(null)

    if (!hasChanges) {
      handleClose()
      return
    }

    try {
      if (extraDelta !== 0) {
        await extraHwid.mutateAsync(extraDelta)
      }
      if (totalChanged) {
        await setHwid.mutateAsync(targetTotal)
      }
      onSuccess?.(t('admin.feedback.saved'))
      handleClose()
    } catch (e) {
      const msg = formatAdminApiError(e, t)
      setError(msg)
      onError?.(msg)
    }
  }

  const isPending = setHwid.isPending || extraHwid.isPending

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title={t('admin.users.subscription.devicesTitle')}
      icon={Smartphone}
      iconAccent="cyan"
      panelClassName="sm:max-w-2xl"
      bodyClassName="p-0"
      footer={
        <AdminModalSaveFooter
          onCancel={handleClose}
          onSave={() => void handleSave()}
          isPending={isPending}
          saveDisabled={!hasChanges}
        />
      }
    >
      <div className="p-4 sm:p-5">
        {error && (
          <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <AdminDeviceLimitEditor
          userId={userId}
          customer={customer}
          totalLimit={totalLimit}
          devices={devicesData?.items ?? []}
          devicesLoading={devicesLoading}
          variant="plain"
          compact
          deferSave
          draftBase={draftBase}
          draftExtra={draftExtra}
          onDraftBaseChange={setDraftBase}
          onDraftExtraChange={setDraftExtra}
          onSuccess={(msg) => onSuccess?.(msg ?? t('admin.feedback.deviceDeleted'))}
          onError={(e) => {
            const msg = formatAdminApiError(e, t)
            setError(msg)
            onError?.(msg)
          }}
        />
      </div>
    </AdminModal>
  )
}
