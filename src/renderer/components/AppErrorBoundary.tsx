import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[renderer] React error boundary caught:', error, errorInfo.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-boundary" role="alert">
          <div className="app-error-boundary__panel">
            <h1>Axonize could not finish loading.</h1>
            <p>The renderer hit an unexpected startup error.</p>
            <pre>{this.state.error.stack ?? this.state.error.message}</pre>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
