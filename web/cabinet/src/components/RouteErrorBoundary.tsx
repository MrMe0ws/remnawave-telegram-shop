import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Граница ошибок вокруг маршрутов.
 *
 * Без неё любая ошибка рендера обрушивала всё дерево в белый экран. В браузере
 * человек хотя бы перезагрузит вкладку, а в мини-аппе Telegram он видит пустоту,
 * не может открыть консоль и просто закрывает приложение.
 *
 * Границу сбрасываем при смене маршрута: если сломалась одна страница, переход
 * на другую должен вернуть работоспособный интерфейс без перезагрузки.
 */

interface Props {
  children: ReactNode
  /** Смена значения сбрасывает пойманную ошибку. Сюда передаём pathname. */
  resetKey: string
  fallback: (retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Единственный след, по которому потом можно понять, что случилось у пользователя.
    console.error('cabinet: ошибка рендера маршрута', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  private retry = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry)
    return this.props.children
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <ErrorBoundaryInner resetKey={pathname} fallback={(retry) => <ErrorFallback onRetry={retry} />}>
      {children}
    </ErrorBoundaryInner>
  )
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-border bg-card px-6 py-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
        </div>
        <p className="mt-4 text-lg font-semibold">{t('errors.boundaryTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('errors.boundaryHint')}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={onRetry}>{t('errors.retry')}</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('errors.boundaryReload')}
          </Button>
        </div>
      </div>
    </div>
  )
}
