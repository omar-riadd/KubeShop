import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-text p-6">
          <div
            role="alert"
            className="max-w-md w-full bg-surface border border-border rounded-md p-8 text-center space-y-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-text">Something went wrong</h1>
            <p className="text-sm text-text-muted">
              An unexpected error occurred while rendering this page. Reloading usually resolves the
              issue.
            </p>
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
              className="gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
