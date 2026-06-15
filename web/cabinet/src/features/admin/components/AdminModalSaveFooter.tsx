import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface Props {
  onCancel: () => void
  onSave: () => void
  isPending?: boolean
  saveDisabled?: boolean
}

export function AdminModalSaveFooter({ onCancel, onSave, isPending, saveDisabled }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        {t('admin.cancel')}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isPending || saveDisabled}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t('admin.save')}
      </button>
    </div>
  )
}
