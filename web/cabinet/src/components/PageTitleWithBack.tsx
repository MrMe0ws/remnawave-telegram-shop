import { CabinetBackButton } from '@/components/CabinetBackButton'

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
  return (
    <div>
      <div className="flex items-center gap-3">
        {showBack ? <CabinetBackButton /> : null}
        <h1 className={titleClassName}>{title}</h1>
      </div>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
