import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mirror Link] UI crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state" style={{ height: '100vh' }}>
          <div className="error-state-icon">!</div>
          <div className="error-state-message">Something went wrong</div>
          <div className="error-state-detail">{this.state.error}</div>
          <button
            className="btn btn--primary"
            style={{ marginTop: 12 }}
            onClick={() => this.setState({ hasError: false, error: '' })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
