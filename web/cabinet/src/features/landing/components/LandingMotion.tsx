import { useCallback, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

/**
 * Примитивы анимации лендинга.
 *
 * Два режима появления:
 *  - `Reveal` — блок проявляется при попадании в вьюпорт (once), для секций ниже первого экрана;
 *  - `Rise`  — блок проявляется сразу после монтирования, для первого экрана (hero/шапка),
 *              иначе whileInView даёт мигание на элементах, уже видимых при загрузке.
 *
 * При `prefers-reduced-motion` всё рендерится статично — без сдвигов и задержек.
 */

const EASE = [0.22, 1, 0.36, 1] as const

interface AnimatedProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Задержка в секундах — задаёт «лесенку» внутри секции. */
  delay?: number
  /** Стартовое смещение по вертикали, px. */
  y?: number
  duration?: number
}

/** Появление при скролле: один раз, чуть раньше, чем блок полностью виден. */
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  y = 26,
  duration = 0.6,
}: AnimatedProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Появление сразу при монтировании — для контента первого экрана. */
export function Rise({
  children,
  className,
  style,
  delay = 0,
  y = 22,
  duration = 0.6,
}: AnimatedProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

const wordVariants: Variants = {
  hidden: { opacity: 0, y: '0.4em', filter: 'blur(6px)' },
  visible: { opacity: 1, y: '0em', filter: 'blur(0px)' },
}

interface WordsRevealProps {
  /** Каждый элемент — отдельное слово или ReactNode (например, подсвеченный фрагмент). */
  segments: ReactNode[]
  className?: string
  delay?: number
  stagger?: number
}

/**
 * Заголовок, «проявляющийся» по словам (как в stars-meows, но с blur-in).
 * Слова остаются inline, поэтому перенос строк работает как в обычном тексте.
 */
export function WordsReveal({
  segments,
  className,
  delay = 0.15,
  stagger = 0.075,
}: WordsRevealProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <span className={className}>
        {segments.map((segment, i) => (
          <span key={i}>
            {segment}
            {i < segments.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={className}>
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={wordVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.65, ease: EASE, delay: delay + i * stagger }}
        >
          {segment}
          {i < segments.length - 1 ? ' ' : null}
        </motion.span>
      ))}
    </span>
  )
}

/**
 * Пятно света под курсором для `.landing-card`: пишет позицию мыши в CSS-переменные
 * --lp-mx/--lp-my. Через inline-style это вызывало бы ререндер на каждое движение,
 * поэтому меняем стиль напрямую на узле.
 */
export function useCardSpotlight() {
  return useCallback((event: React.MouseEvent<HTMLElement>) => {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--lp-mx', `${event.clientX - rect.left}px`)
    el.style.setProperty('--lp-my', `${event.clientY - rect.top}px`)
  }, [])
}
