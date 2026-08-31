import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Механика программы схемой, а не списком шагов.
 *
 * «Ссылка → оплата → бонус» — это на самом деле поток, и список из четырёх
 * пунктов заставляет читать то, что можно показать. Импульсы, бегущие по
 * связям, дочитывают за текст: бонус приходит не один раз.
 *
 * Разметка одна на обе версии — направление задаёт брейкпоинт: на широком
 * экране колонки, на узком строки, и связки поворачиваются вместе с ними.
 * Второй копии схемы под мобильный нет.
 *
 * Общий компонент, потому что схему одинаково просят обе программы:
 * партнёрская считает проценты, реферальная — дни, а поток у них один и тот же.
 */

export interface OfferFlowNode {
  icon: LucideIcon
  title: string
  text?: string
  /** Вместо пояснения — итог узла: сумма, счётчик, что угодно живое. */
  value?: ReactNode
  /** Узел-результат: тот, ради которого всё и затевалось. */
  accent?: boolean
}

export function OfferFlow({ nodes, className }: { nodes: OfferFlowNode[]; className?: string }) {
  // Колонки собираются по числу узлов: между каждой парой — колонка под связку.
  const columns = Array.from({ length: nodes.length * 2 - 1 }, (_, i) => (i % 2 ? 'auto' : '1fr')).join(' ')

  return (
    <div
      className={cn('cabinet-flow-grid', className)}
      style={{ ['--cabinet-flow-cols' as string]: columns } as CSSProperties}
    >
      {nodes.map((node, i) => (
        <FlowStep key={node.title} node={node} index={i} last={i === nodes.length - 1} />
      ))}
    </div>
  )
}

function FlowStep({ node, index, last }: { node: OfferFlowNode; index: number; last: boolean }) {
  const { icon: Icon, title, text, value, accent } = node
  return (
    <>
      <div
        className={cn(
          'rounded-xl border p-4',
          accent ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-border bg-muted',
        )}
      >
        <div
          className={cn(
            'mb-2.5 flex size-8 items-center justify-center rounded-lg',
            accent
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              // Именно /15: значения 12 нет в шкале прозрачности Tailwind,
              // класс bg-primary/12 не генерируется и фон просто не рисуется.
              : 'bg-primary/15 text-primary',
          )}
        >
          <Icon size={17} />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        {value ?? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>}
      </div>
      {/*
        Смещение по времени — по позиции связки, чтобы импульсы шли очередью,
        а не тремя синхронными точками: синхронные читаются как мигание.
      */}
      {last ? null : <Connector delay={`${index * 0.5}s`} />}
    </>
  )
}

function Connector({ delay }: { delay: string }) {
  return (
    <div className="cabinet-flow-link" aria-hidden>
      <span className="cabinet-flow-line" />
      <span className="cabinet-flow-pulse" style={{ animationDelay: delay }} />
    </div>
  )
}
