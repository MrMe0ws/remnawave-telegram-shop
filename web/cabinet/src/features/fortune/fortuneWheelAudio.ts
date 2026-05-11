/**
 * Звуки колеса фортуны через Web Audio API (без внешних файлов).
 * Рассчитано на жест пользователя перед resume() контекста.
 */

let sharedCtx: AudioContext | null = null

export function getFortuneAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedCtx) {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) return null
    try {
      sharedCtx = new Ctor()
    } catch {
      return null
    }
  }
  return sharedCtx
}

export async function ensureFortuneAudio(): Promise<AudioContext | null> {
  const ctx = getFortuneAudioContext()
  if (!ctx) return null
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx
}

function now(ctx: AudioContext): number {
  return ctx.currentTime
}

function masterGain(ctx: AudioContext, when: number, peak: number, duration: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(peak, when + Math.min(0.02, duration * 0.1))
  g.gain.exponentialRampToValueAtTime(0.001, when + duration)
  g.connect(ctx.destination)
  return g
}

/** Короткий «рывок» при нажатии «Крутить» (до ответа сервера). */
export function playSpinAnticipation(ctx: AudioContext): void {
  const t0 = now(ctx)
  const dur = 0.18
  const g = masterGain(ctx, t0, 0.35, dur)
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, t0)
  osc.frequency.exponentialRampToValueAtTime(520, t0 + dur * 0.85)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)

  const noise = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  }
  noise.buffer = buf
  const nf = ctx.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = 900
  nf.Q.value = 0.7
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.12, t0)
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07)
  noise.connect(nf)
  nf.connect(ng)
  ng.connect(ctx.destination)
  noise.start(t0)
  noise.stop(t0 + 0.08)
}

/** Один «щёлк» сектора у указателя (лёгкий / тяжёлый). */
function playTick(ctx: AudioContext, when: number, heavy: boolean): void {
  const peak = heavy ? 0.22 : 0.11
  const dur = heavy ? 0.045 : 0.028
  const g = masterGain(ctx, when, peak, dur)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(heavy ? 95 : 140, when)
  osc.frequency.exponentialRampToValueAtTime(heavy ? 55 : 85, when + dur)
  osc.connect(g)
  osc.start(when)
  osc.stop(when + dur + 0.01)

  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) {
    ch[i] = (Math.random() * 2 - 1) * 0.5
  }
  const ns = ctx.createBufferSource()
  ns.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.value = heavy ? 400 : 700
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(heavy ? 0.08 : 0.05, when)
  ng.gain.exponentialRampToValueAtTime(0.001, when + 0.018)
  ns.connect(bp)
  bp.connect(ng)
  ng.connect(ctx.destination)
  ns.start(when)
  ns.stop(when + 0.022)
}

/** Низкий «стук» в момент остановки колеса. */
export function playWheelLand(ctx: AudioContext): void {
  const t0 = now(ctx)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.45, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35)
  g.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(88, t0)
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.28)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + 0.36)
}

function winTier(rewardType: string): 'small' | 'medium' | 'large' {
  if (rewardType === 'micro') return 'small'
  if (rewardType === 'days_180' || rewardType === 'days_30' || rewardType === 'days_15') return 'large'
  return 'medium'
}

/** Фанфарный «приз» сразу после остановки. */
export function playWinFanfare(ctx: AudioContext, rewardType: string): void {
  const tier = winTier(rewardType)
  const t0 = now(ctx)
  const base = tier === 'large' ? 392 : tier === 'medium' ? 349.23 : 329.63 // G4, F4, E4
  const intervals =
    tier === 'large'
      ? [0, 0.07, 0.14, 0.22, 0.32, 0.42]
      : tier === 'medium'
        ? [0, 0.08, 0.16, 0.28]
        : [0, 0.1, 0.22]

  const freqs =
    tier === 'large'
      ? [base, base * 1.25, base * 1.5, base * 2, base * 2.5, base * 3]
      : tier === 'medium'
        ? [base, base * 1.2599, base * 1.4983, base * 2]
        : [base, base * 1.2599, base * 1.4983]

  for (let i = 0; i < intervals.length; i++) {
    const when = t0 + intervals[i]
    const f = freqs[Math.min(i, freqs.length - 1)]
    const peak = tier === 'large' ? 0.24 - i * 0.018 : tier === 'medium' ? 0.2 : 0.15
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(Math.max(0.08, peak), when + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, when + (tier === 'small' ? 0.22 : 0.32))
    g.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f, when)
    osc.connect(g)
    osc.start(when)
    osc.stop(when + 0.35)

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(f * 2, when)
    const g2 = ctx.createGain()
    g2.gain.value = tier === 'large' ? 0.07 : 0.045
    osc2.connect(g2)
    g2.connect(g)
    osc2.start(when)
    osc2.stop(when + 0.25)
  }

  // Лёгкое «сверкание» на крупном призе
  if (tier === 'large') {
    const sh = t0 + 0.38
    for (let k = 0; k < 6; k++) {
      const w = sh + k * 0.045
      playTick(ctx, w, false)
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (tier === 'large') {
        navigator.vibrate([14, 28, 14, 45, 22])
      } else if (tier === 'medium') {
        navigator.vibrate([12, 22, 18])
      } else {
        navigator.vibrate([8, 14])
      }
    } catch {
      /* ignore */
    }
  }
}

/** Ошибка спина / сеть — короткий нейтральный тон вниз. */
export function playSpinError(ctx: AudioContext): void {
  const t0 = now(ctx)
  const g = masterGain(ctx, t0, 0.12, 0.25)
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(320, t0)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.22)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + 0.26)
}

export type SpinSoundSchedule = {
  clear: () => void
}

/**
 * Тики «прокрута» с нарастающим интервалом (быстро → медленно), синхронно с ~4.2s анимацией.
 * В конце вызывается onLanded (туда же положить fanfare).
 */
export function scheduleSpinWheelSounds(
  ctx: AudioContext,
  durationMs: number,
  onLanded: () => void,
): SpinSoundSchedule {
  const duration = durationMs / 1000
  const tAudio0 = now(ctx)
  const tickCount = 52
  const ids: number[] = []

  for (let i = 0; i < tickCount; i++) {
    const p = tickCount <= 1 ? 0 : i / (tickCount - 1)
    // Квадратичный прогресс по времени: плотные тики в начале, редкие в конце
    const tRel = duration * Math.pow(p, 1.85)
    const delayMs = tRel * 1000
    const heavy = i >= tickCount - 4
    const id = window.setTimeout(() => {
      playTick(ctx, now(ctx), heavy)
    }, delayMs)
    ids.push(id)
  }

  const landId = window.setTimeout(() => {
    playWheelLand(ctx)
    onLanded()
  }, durationMs)

  ids.push(landId)

  return {
    clear: () => {
      for (const id of ids) {
        window.clearTimeout(id)
      }
    },
  }
}
