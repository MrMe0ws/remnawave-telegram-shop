import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={t('theme.toggle')}
      aria-label={t('theme.toggle')}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
}
