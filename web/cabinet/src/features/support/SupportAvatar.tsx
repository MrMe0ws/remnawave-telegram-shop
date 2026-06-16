import { DecorSupportIcon } from '@/features/decor/decorNavIcons'

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

/** Аватар поддержки в чате: кастомный логотип или иконка по умолчанию. */
export function SupportAvatar() {
  const { data } = useAuthBootstrap()
  const logoUrl = data?.support_logo_url?.trim()

  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain" decoding="async" />
      ) : (
        <DecorSupportIcon className="size-4 text-primary" />
      )}
    </div>
  )
}
