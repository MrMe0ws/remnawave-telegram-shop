import { cn, formatTrafficUsageLabel, trafficBarFillClass, trafficUsagePercent } from '@/lib/utils'

type Props = {
  usedGb?: number | null
  limitGb?: number | null
  usageTitle: string
  gigabytesLabel: string
  unlimitedLabel: string
  className?: string
}

export function TrafficUsageBar({
  usedGb,
  limitGb,
  usageTitle,
  gigabytesLabel,
  unlimitedLabel,
  className,
}: Props) {
  const percent = trafficUsagePercent(usedGb, limitGb)
  const fillWidth = percent ?? 100

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground dark:text-slate-300">{usageTitle}</span>
        <span className="text-muted-foreground dark:text-slate-300">
          {formatTrafficUsageLabel(usedGb, limitGb, gigabytesLabel, unlimitedLabel)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted dark:bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all duration-500', trafficBarFillClass(percent))}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
    </div>
  )
}
