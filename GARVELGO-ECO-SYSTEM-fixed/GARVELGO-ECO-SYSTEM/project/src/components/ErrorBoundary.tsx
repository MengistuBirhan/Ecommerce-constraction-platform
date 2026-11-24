import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

export const panelStyle: CSSProperties = {
  maxWidth: 560,
  margin: '10vh auto',
  padding: 24,
  fontFamily: 'system-ui, sans-serif',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  lineHeight: 1.5,
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Shows the error message instead of a blank page when something throws while rendering. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Something went wrong / ስህተት ተከስቷል</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
