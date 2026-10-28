import { SpiderSvg } from './DecorEffects'
import { HolidayTrim } from './HolidayAtmosphere'
import { NewYearHeaderDecor } from './NewYearScene'
import { useCabinetDecorTheme } from './useCabinetDecorTheme'

function NeonHeaderAccent() {
  return (
    <div className="cabinet-decor-neon-header pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden>
      <div className="cabinet-decor-neon-header__line" />
    </div>
  )
}

/** halloween: тлеющая кромка шапки и паучок, спускающийся с неё на нити. */
function HalloweenHeaderAccent() {
  return (
    <div className="cabinet-decor-hw-header pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden>
      <div className="cabinet-decor-hw-header__line" />
      <span className="cabinet-hw-spider cabinet-hw-spider--header">
        <span className="cabinet-hw-spider__drop">
          <span className="cabinet-hw-spider__body">
            <SpiderSvg />
          </span>
        </span>
      </span>
    </div>
  )
}

/** Декор нижнего края sticky-хедера (гирлянда, неон, флажки, сосульки). */
export function CabinetDecorHeader() {
  const theme = useCabinetDecorTheme()

  if (theme === 'new_year') return <NewYearHeaderDecor />
  if (theme === 'neon') return <NeonHeaderAccent />
  if (theme === 'halloween') return <HalloweenHeaderAccent />
  if (theme === 'halloween_2') return <HolidayTrim theme="halloween" />
  if (theme === 'new_year_2') return <HolidayTrim theme="new_year" />
  return null
}
