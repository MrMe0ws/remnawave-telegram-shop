import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  stacked?: boolean
  logoSizePx?: number
}

const sizes = {
  // sm — шапка кабинета: название 1.5rem (как text-2xl в дефолтном Tailwind)
  sm: { icon: 38, img: 'h-[38px] w-[38px]', text: 'text-[1.5rem] leading-tight' },
  md: { icon: 38, img: 'h-[38px] w-[38px]', text: 'text-xl' },
  lg: { icon: 38, img: 'h-[38px] w-[38px]', text: 'text-2xl' },
}

const defaultName = 'Cabinet'

export function Logo({ className, size = 'md', stacked = false, logoSizePx }: LogoProps) {
  const { data } = useAuthBootstrap()
  const name = (data?.brand_name?.trim() || defaultName).trim() || defaultName
  const logoUrl = data?.brand_logo_url?.trim()
  const [imgErr, setImgErr] = useState(false)

  useEffect(() => {
    setImgErr(false)
  }, [logoUrl])

  const { icon, img, text } = sizes[size]
  const visualSize = logoSizePx ?? icon
  const showImg = Boolean(logoUrl && !imgErr)

  return (
    <div className={cn('flex items-center gap-2.5', stacked && 'flex-col gap-3', className)}>
      {showImg ? (
        <div className="flex shrink-0 items-center justify-center">
          <img
            src={logoUrl}
            alt=""
            className={cn('block rounded-full object-contain', img)}
            style={{ width: visualSize, height: visualSize }}
            onError={() => setImgErr(true)}
          />
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 p-1.5">
          <Shield size={visualSize} className="text-primary" strokeWidth={1.75} />
        </div>
      )}
      <span className={cn('font-semibold tracking-tight', text, stacked && 'text-center')}>{name}</span>
    </div>
  )
}
