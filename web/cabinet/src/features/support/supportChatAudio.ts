/**
 * Мягкий chime при новом ответе поддержки (Web Audio API).
 */
export { ensureFortuneAudio as ensureSupportChatAudio } from '@/features/fortune/fortuneWheelAudio'

export function playSupportReplyChime(ctx: AudioContext): void {
  const t0 = ctx.currentTime + 0.02

  const playTone = (freq: number, start: number, peak: number, duration: number) => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    g.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    osc.connect(g)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  // Тихий двухнотный «колокольчик», без резких гармоник
  playTone(392.0, t0, 0.055, 0.55)
  playTone(523.25, t0 + 0.14, 0.04, 0.65)
}
