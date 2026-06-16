import { decorEffectForTheme } from './decorThemes'
import { isDecorColorOnlyTheme } from './decorThemeAdmin'
import { useCabinetDecorTheme } from './useCabinetDecorTheme'
import { CabinetDecorScene } from './CabinetDecorScene'
import {
  HeartsEffect,
  PumpkinsEffect,
  SnowEffect,
  SparksEffect,
  SpringEffect,
  SunraysEffect,
} from './DecorEffects'

/**
 * Слой частиц между фоном (cabinet-shell-gradient) и контентом.
 * Монтировать внутри layout сразу после градиента.
 */
export function CabinetDecorLayer() {
  const theme = useCabinetDecorTheme()
  const effect = decorEffectForTheme(theme)

  if (theme === 'off' || isDecorColorOnlyTheme(theme)) return null

  let fx = null
  if (effect) {
    switch (effect) {
      case 'snow':
        fx = <SnowEffect />
        break
      case 'sunrays':
        fx = <SunraysEffect />
        break
      case 'pumpkins':
        fx = <PumpkinsEffect />
        break
      case 'hearts':
        fx = <HeartsEffect />
        break
      case 'petals':
        fx = <SpringEffect />
        break
      case 'sparks':
        fx = <SparksEffect />
        break
      default:
        break
    }
  }

  return (
    <div className="cabinet-decor-layer" aria-hidden>
      <CabinetDecorScene />
      {fx}
    </div>
  )
}
