import { Component, type ErrorInfo, type ReactNode } from 'react'
import { FeedbackLogDialog } from './FeedbackLogDialog'
import { reportClientError } from '../utils/feedback'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
  feedbackOpen: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, feedbackOpen: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash:', error, info.componentStack)
    void reportClientError(error, {
      kind: 'react-error-boundary',
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>{this.props.fallbackTitle ?? '界面出错了'}</h2>
          <p>{this.state.error.message}</p>
          <div className="error-boundary-actions">
            <button
              type="button"
              className="btn-create"
              onClick={() => this.setState({ error: null, feedbackOpen: false })}
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => this.setState({ feedbackOpen: true })}
            >
              导出错误日志反馈
            </button>
          </div>
          <FeedbackLogDialog
            open={this.state.feedbackOpen}
            onClose={() => this.setState({ feedbackOpen: false })}
          />
        </div>
      )
    }
    return this.props.children
  }
}
