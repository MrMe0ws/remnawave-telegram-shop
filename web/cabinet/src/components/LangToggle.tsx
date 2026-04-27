import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { setLanguage } from '@/i18n'

export function LangToggle() {
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
      onClick={toggle}
      className="font-mono text-xs"
      aria-label="Switch language"
    >
      {isRu ? 'EN' : 'RU'}
    </Button>
  )
}
