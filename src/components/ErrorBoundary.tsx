import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>{this.props.fallbackTitle ?? '界面出错了'}</h2>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            className="btn-create"
            onClick={() => this.setState({ error: null })}
          >
            尝试恢复
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
