import type { AdminCustomerDTO, AdminTariffBriefDTO } from '@/lib/types/admin'
import type { UserEditModalKey } from './types'
import type { AdminUserPanelResponse } from '../../hooks/useAdminUsers'
import { AdminUserTrafficModal } from './AdminUserTrafficModal'
import { AdminUserSquadsModal } from './AdminUserSquadsModal'
import { AdminUserTariffModal } from './AdminUserTariffModal'
import { AdminUserDescriptionModal } from './AdminUserDescriptionModal'
import { AdminUserDevicesModal } from './AdminUserDevicesModal'

interface Props {
  userId: number
  panel: AdminUserPanelResponse | null | undefined
  customer: AdminCustomerDTO
  tariffs?: AdminTariffBriefDTO[]
  tariffsEnabled?: boolean
  activeModal: UserEditModalKey | null
  onClose: () => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function AdminUserEditModals({
  userId,
  panel,
  customer,
  tariffs,
  tariffsEnabled,
  activeModal,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const rwReady = panel?.has_rw_user && panel?.rw
  const modalCommon = panel
    ? { userId, panel, onClose, onSuccess, onError }
    : null
  const tariffList = tariffs ?? []

  return (
    <>
      {rwReady && modalCommon && (
        <>
          <AdminUserTrafficModal open={activeModal === 'traffic'} {...modalCommon} />
          <AdminUserSquadsModal open={activeModal === 'squads'} {...modalCommon} />
          <AdminUserDescriptionModal open={activeModal === 'description'} {...modalCommon} />
          <AdminUserDevicesModal open={activeModal === 'devices'} {...modalCommon} />
        </>
      )}
      {tariffsEnabled && tariffList.length > 0 && (
        <AdminUserTariffModal
          open={activeModal === 'tariff'}
          userId={userId}
          customer={panel?.customer ?? customer}
          tariffs={tariffList}
          onClose={onClose}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </>
  )
}
