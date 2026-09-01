import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type CabinetBackButtonProps = {
  className?: string
}

/** Назад: history −1 или замена на «/» (как на страницах с PageTitleWithBack). */
export function CabinetBackButton({ className }: CabinetBackButtonProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  function handleBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t('common.back')}
      /*
       * Отклик как у Button variant="outline": подсветка фона и акцентная
       * обводка на наведении, продавливание на клике, кольцо на фокусе.
       * Стрелка сдвигается влево — тот же приём, что у .cabinet-row-chevron.
       */
      className={cn(
        'group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground',
        'transition-all duration-200',
        // Заливка нейтральная — прозрачное осветление поверх текущего фона,
        // а не серый bg-secondary: он на тёмном фоне читался как пятно.
        'hover:border-[hsl(var(--cabinet-accent)/0.5)] hover:bg-foreground/[0.06] hover:shadow-[0_8px_22px_-10px_hsl(var(--cabinet-accent)/0.5)]',
        'active:scale-[0.94] active:bg-foreground/[0.1] active:duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/[0.12] dark:active:bg-white/[0.16]',
        className,
      )}
    >
      <ArrowLeft
        size={15}
        aria-hidden
        className="transition-transform duration-200 group-hover:-translate-x-0.5"
      />
    </button>
  )
}
