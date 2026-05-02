let turnstileScriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('turnstile is not available on server'))
  }
  if (window.turnstile) {
    return Promise.resolve()
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise
  }
  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('failed to load turnstile')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('failed to load turnstile'))
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}

export async function getTurnstileToken(siteKey: string, action: 'login' | 'register' | 'forgot'): Promise<string> {
  await loadTurnstileScript()
  if (!window.turnstile) {
    throw new Error('turnstile is not available')
  }
  const mount = document.createElement('div')
  mount.style.display = 'none'
  document.body.appendChild(mount)

  return new Promise<string>((resolve, reject) => {
    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      if (mount.parentNode) mount.parentNode.removeChild(mount)
    }
    const fail = (msg: string) => {
      cleanup()
      reject(new Error(msg))
    }
    const timeout = window.setTimeout(() => fail('turnstile timeout'), 12_000)
    const widgetId = window.turnstile!.render(mount, {
      sitekey: siteKey,
      size: 'invisible',
      action,
      callback: (token: string) => {
        window.clearTimeout(timeout)
        cleanup()
        resolve(token)
      },
      'error-callback': () => {
        window.clearTimeout(timeout)
        fail('turnstile verification failed')
      },
      'expired-callback': () => {
        window.clearTimeout(timeout)
        fail('turnstile token expired')
      },
    })
    window.turnstile!.execute(widgetId)
  })
}
