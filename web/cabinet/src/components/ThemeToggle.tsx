import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLightThemeAllowed } from '@/components/ThemePolicyProvider'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const lightAllowed = useLightThemeAllowed()
  const { theme, toggle } = useTheme()
  const { t } = useTranslation()

  if (!lightAllowed) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={t('theme.toggle')}
      aria-label={t('theme.toggle')}
      className={cn(className)}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
}
