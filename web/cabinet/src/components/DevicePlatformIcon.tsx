import type { LucideIcon } from 'lucide-react'
import { Laptop, Monitor, Smartphone, Tablet, Tv } from 'lucide-react'

import { cn } from '@/lib/utils'

function normalizePlatform(platform?: string | null): string {
  return platform?.toLowerCase().trim() ?? ''
}

export function resolveDevicePlatformIcon(platform?: string | null): LucideIcon {
  const p = normalizePlatform(platform)

  if (p.includes('tv')) return Tv
  if (p.includes('ipad') || p.includes('tablet')) return Tablet
  if (p.includes('iphone') || p.includes('ios') || p.includes('android')) return Smartphone
  if (p.includes('mac') || p.includes('darwin')) return Laptop
  if (p.includes('windows') || p.includes('linux')) return Monitor

  return Smartphone
}

interface Props {
  platform?: string | null
  className?: string
}

export function DevicePlatformIcon({ platform, className }: Props) {
  const Icon = resolveDevicePlatformIcon(platform)
  return <Icon className={cn('size-4', className)} aria-hidden />
}
