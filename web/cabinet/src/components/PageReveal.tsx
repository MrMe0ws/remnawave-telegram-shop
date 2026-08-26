import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

/**
 * Появление блоков кабинета «лесенкой» — тот же приём, что на лендинге
 * (см. features/landing/components/LandingMotion.tsx), но с двумя отличиями:
 *
 *  - анимация играет только при ПЕРВОМ заходе на страницу за текущую загрузку
 *    приложения: возврат на уже виденную страницу рисуется сразу, иначе навигация
 *    туда-обратно превращается в мигание;
 *  - оркестрация через variants, поэтому шаг «лесенки» задаётся один раз на
 *    контейнере, а не руками в каждом блоке.
 *
 * При prefers-reduced-motion всё рендерится статично.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Страницы, на которых «лесенка» уже отыграла, и время регистрации.
 *
 * Время нужно из-за React.StrictMode: в dev он размонтирует и монтирует компонент
 * повторно, и без окна допуска вторая жизнь считалась бы «не первым заходом» —
 * анимации не было бы видно на локальной сборке.
 */
const revealedRoutes = new Map<string, number>()
const STRICT_MODE_REMOUNT_MS = 500

/** true — на этот ключ ещё не заходили за текущую загрузку приложения. */
export function useFirstPageVisit(routeKey: string): boolean {
  const decided = useRef<boolean | null>(null)
  if (decided.current === null) {
    const seenAt = revealedRoutes.get(routeKey)
    decided.current = seenAt == null || Date.now() - seenAt < STRICT_MODE_REMOUNT_MS
    revealedRoutes.set(routeKey, Date.now())
  }
  return decided.current
}

/** Внутри контейнера, который сейчас анимируется, — иначе RevealItem рендерится статично. */
const RevealActiveContext = createContext(false)

interface PageRevealProps {
  children: ReactNode
  className?: string
  /** Ключ памяти «уже показывали»; по умолчанию — pathname. */
  routeKey?: string
  /** Пауза перед первым блоком, с. */
  delay?: number
  /** Шаг «лесенки» между блоками, с. */
  stagger?: number
  /**
   * Обернуть прямых детей в `RevealItem` автоматически.
   *
   * Для страниц, где расставлять `RevealItem` руками пришлось бы вперемешку
   * с порталами и вложенными условиями. Ограничение: `<>…</>` считается одним
   * блоком, поэтому «лесенка» получается грубее, чем при ручной разметке.
   */
  wrapChildren?: boolean
}

/**
 * Контейнер страницы. Оборачивать им корневой блок (обычно тот, что несёт `space-y-*`),
 * а прямые дети заворачивать в `RevealItem` — тогда отступы остаются на своих местах.
 */
export function PageReveal({
  children,
  className,
  routeKey,
  delay = 0.04,
  stagger = 0.07,
  wrapChildren = false,
}: PageRevealProps) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const firstVisit = useFirstPageVisit(routeKey ?? pathname)
  const animate = firstVisit && !reduce

  if (!animate) {
    return (
      <RevealActiveContext.Provider value={false}>
        <div className={className}>{children}</div>
      </RevealActiveContext.Provider>
    )
  }

  const content = wrapChildren
    ? Children.map(children, (child, i) =>
        // Невалидные дети (null / false от условного рендера, голый текст) оставляем как есть:
        // обёртка вокруг них дала бы пустой div и лишний шаг «лесенки».
        isValidElement(child) ? <RevealItem key={i}>{child}</RevealItem> : child,
      )
    : children

  return (
    <RevealActiveContext.Provider value>
      <motion.div
        className={className}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { delayChildren: delay, staggerChildren: stagger } },
        }}
      >
        {content}
      </motion.div>
    </RevealActiveContext.Provider>
  )
}

interface RevealItemProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Стартовое смещение по вертикали, px. */
  y?: number
  duration?: number
}

/** Один шаг «лесенки». Вне `PageReveal` (или при повторном заходе) — обычный div. */
export function RevealItem({ children, className, style, y = 14, duration = 0.45 }: RevealItemProps) {
  const active = useContext(RevealActiveContext)

  if (!active) {
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
      variants={{ hidden: { opacity: 0, y }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
