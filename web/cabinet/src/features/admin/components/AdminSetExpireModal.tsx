import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Loader2, type LucideIcon } from 'lucide-react'

import { AdminModal } from './AdminModal'
import type { AdminSectionIconAccent } from '../utils/adminSectionIconAccents'
import {
  AdminDatePicker,
  dateToExpireIso,
  defaultExpireDate,
  parseIsoToLocalDateTime,
} from './AdminDatePicker'
import { formatAdminDateTime } from '../utils/datetime'

interface AdminSetExpireModalProps {
  open: boolean
  onClose: () => void
  title: string
  minDate?: Date
  isPending?: boolean
  onApply: (iso: string) => void
  error?: string | null
  onClearError?: () => void
  icon?: LucideIcon
  iconAccent?: AdminSectionIconAccent
}

export function AdminSetExpireModal({
  open,
  onClose,
  title,
  minDate,
  isPending,
  onApply,
  error,
  onClearError,
  icon = Calendar,
  iconAccent = 'amber',
}: AdminSetExpireModalProps) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const [date, setDate] = useState<Date | null>(null)

  useEffect(() => {
    if (open) {
      setDate(defaultExpireDate())
    }
  }, [open])

  const handleClose = () => {
    onClearError?.()
    onClose()
  }

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title={title}
      panelClassName="sm:max-w-md"
      icon={icon}
      iconAccent={iconAccent}
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t('admin.users.extendPickDate')}</p>
        <AdminDatePicker
          value={date}
          onChange={setDate}
          minDate={minDate}
        />
        {date && (
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatAdminDateTime(dateToExpireIso(date), dateLocale)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
          >
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!date) return
              onApply(dateToExpireIso(date))
            }}
            disabled={isPending || !date}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('admin.users.extendApply')}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}

export { parseIsoToLocalDateTime, defaultExpireDate, dateToExpireIso }
