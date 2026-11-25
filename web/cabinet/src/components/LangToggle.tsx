import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FlagRu, FlagUs } from '@/components/LangFlags'
import { setLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import { hapticSelection } from '@/lib/haptic'

interface LangToggleProps {
  className?: string
  /**
   * Показать флаг текущего языка вместо подписи следующего (как в профиле).
   * Включено в шапке админки; на лендинге и экране входа остаются буквы.
   */
  flag?: boolean
}

export function LangToggle({ className, flag = false }: LangToggleProps) {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'

  const toggle = () => {
    const next = isRu ? 'en' : 'ru'
    setLanguage(next)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        hapticSelection()
        toggle()
      }}
      className={cn('font-mono text-xs', className)}
      aria-label="Switch language"
      title={flag ? (isRu ? 'Русский' : 'English') : undefined}
    >
      {flag ? (isRu ? <FlagRu /> : <FlagUs />) : isRu ? 'EN' : 'RU'}
    </Button>
  )
}
