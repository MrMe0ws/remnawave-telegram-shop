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
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground hover:bg-muted/60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
        className,
      )}
    >
      <ArrowLeft size={15} aria-hidden />
    </button>
  )
}
