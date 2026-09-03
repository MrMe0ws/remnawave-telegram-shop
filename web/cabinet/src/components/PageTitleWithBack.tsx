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
    // Подзаголовок идёт в одной колонке с заголовком, а не под кнопкой «назад»:
    // иначе он выступает влево на 48px и шапка выглядит съехавшей.
    <div className="flex items-start gap-3">
      {showBack ? <CabinetBackButton className="-mt-0.5" /> : null}
      <div className="min-w-0 flex-1">
        <h1 className={titleClassName}>{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  )
}
