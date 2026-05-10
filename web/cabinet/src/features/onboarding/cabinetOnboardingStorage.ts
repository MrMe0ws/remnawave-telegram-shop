/** Ключ в localStorage; значение `'true'` — гайд больше не показываем. */
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed'

export function readOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
  } catch {
    return true
  }
}

export function writeOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
  } catch {
    /* ignore */
  }
}
