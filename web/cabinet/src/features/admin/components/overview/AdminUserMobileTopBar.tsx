import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'

interface Props {
  /** Подпись между кнопками: «#1560». */
  label: string
  onOpenActions: () => void
}

/**
 * Верхняя строка карточки на телефоне.
 *
 * На узком экране общий хедер админки и хлебные крошки съедали первый экран
 * ради навигации, которая внутри карточки не нужна: отсюда есть ровно два
 * пути — назад к списку и меню действий. Хедер на этой странице скрывается
 * (см. `mobileBareHeader` в AdminPageMeta), а его место занимает эта строка.
 */
export function AdminUserMobileTopBar({ label, onOpenActions }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mb-3 flex items-center gap-2 lg:hidden">
      <button
        type="button"
        onClick={() => navigate('/admin/users')}
        aria-label={t('admin.users.backToList')}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </button>
      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onOpenActions}
        aria-label={t('admin.actions')}
        className="ms-auto inline-flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </div>
  )
}
