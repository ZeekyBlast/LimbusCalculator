import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { message?: string }

/**
 * Keeps a render crash inside one screen from blanking the whole page. React gives no hook
 * equivalent, so this stays a class component.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('ErrorBoundary caught a render error', error, info.componentStack)
  }

  render(): ReactNode {
    const { message } = this.state
    if (message === undefined) return this.props.children
    return <p role="alert" className="text-blood-bright">Something went wrong: {message}. Reload the page to recover.</p>
  }
}
