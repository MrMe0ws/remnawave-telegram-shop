import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type PageTitleWithBackProps = {
  title: string
  subtitle?: string
  showBack?: boolean
  titleClassName?: string
}

export function PageTitleWithBack({
  title,
  subtitle,
  showBack = true,
  titleClassName = 'text-2xl font-semibold',
}: PageTitleWithBackProps) {
  const navigate = useNavigate()

  function handleBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Назад"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground hover:bg-muted/60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            <ArrowLeft size={15} />
          </button>
        ) : null}
        <h1 className={titleClassName}>{title}</h1>
      </div>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
