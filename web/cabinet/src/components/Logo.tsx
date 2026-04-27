import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { icon: 18, img: 'h-[18px] w-[18px]', text: 'text-base' },
  md: { icon: 24, img: 'h-6 w-6', text: 'text-xl' },
  lg: { icon: 32, img: 'h-8 w-8', text: 'text-2xl' },
}

const defaultName = 'Cabinet'

export function Logo({ className, size = 'md' }: LogoProps) {
  const { data } = useAuthBootstrap()
  const name = (data?.brand_name?.trim() || defaultName).trim() || defaultName
  const logoUrl = data?.brand_logo_url?.trim()
  const [imgErr, setImgErr] = useState(false)

  useEffect(() => {
    setImgErr(false)
  }, [logoUrl])

  const { icon, img, text } = sizes[size]
  const showImg = Boolean(logoUrl && !imgErr)

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 p-1.5">
        {showImg ? (
          <img
            src={logoUrl}
            alt=""
            className={cn('object-contain', img)}
            onError={() => setImgErr(true)}
          />
        ) : (
          <Shield size={icon} className="text-primary" strokeWidth={1.75} />
        )}
      </div>
      <span className={cn('font-semibold tracking-tight', text)}>{name}</span>
    </div>
  )
}
