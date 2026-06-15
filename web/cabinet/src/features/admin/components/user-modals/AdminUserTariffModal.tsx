import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { AdminModalSaveFooter } from '../AdminModalSaveFooter'
import { cn } from '@/lib/utils'
import type { AdminCustomerDTO, AdminTariffBriefDTO } from '@/lib/types/admin'
import { formatAdminApiError } from '../../utils/formatAdminApiError'
import { useAdminUserSetTariff } from '../../hooks/useAdminUsers'

interface Props {
  open: boolean
  onClose: () => void
  userId: number
  customer: AdminCustomerDTO
  tariffs: AdminTariffBriefDTO[]
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function AdminUserTariffModal({
  open,
  onClose,
  userId,
  customer,
  tariffs,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation()
  const currentTariffId = customer.current_tariff_id ?? null
  const setTariff = useAdminUserSetTariff(userId)

  const [draftTariffId, setDraftTariffId] = useState<number | null>(currentTariffId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraftTariffId(currentTariffId)
      setError(null)
    }
  }, [open, currentTariffId])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSave = () => {
    if (draftTariffId == null || draftTariffId === currentTariffId) {
      handleClose()
      return
    }

    setError(null)
    setTariff.mutate(draftTariffId, {
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

  const hasChanges = draftTariffId != null && draftTariffId !== currentTariffId

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title={t('admin.users.subscription.tariff')}
      icon={Zap}
      iconAccent="teal"
      panelClassName="sm:max-w-lg"
      footer={
        <AdminModalSaveFooter
          onCancel={handleClose}
          onSave={handleSave}
          isPending={setTariff.isPending}
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
        {tariffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.noData')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tariffs.map((tariff) => (
              <button
                key={tariff.id}
                type="button"
                onClick={() => setDraftTariffId(tariff.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent',
                  draftTariffId === tariff.id && 'border-primary bg-primary/10 text-primary',
                )}
              >
                {tariff.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminModal>
  )
}
