'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log hydration errors specifically
    if (error.message?.includes('hydrat') || error.message?.includes('Hydrat')) {
      console.error('🚨 Hydration Error Detected:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleClearCache = () => {
    // Clear localStorage and sessionStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      // Force reload with cache bypass
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isHydrationError = this.state.error?.message?.includes('hydrat') ||
                              this.state.error?.message?.includes('Hydrat');

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>

              <h1 className="text-xl font-bold text-gray-900 mb-2">
                {isHydrationError ? '페이지 로딩 오류' : '예상치 못한 오류가 발생했습니다'}
              </h1>

              <p className="text-gray-600 mb-6">
                {isHydrationError
                  ? '페이지 렌더링 중 문제가 발생했습니다. 새로고침을 시도해보세요.'
                  : '일시적인 문제일 수 있습니다. 페이지를 새로고침하거나 홈으로 돌아가세요.'
                }
              </p>

              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  페이지 새로고침
                </button>

                {isHydrationError && (
                  <button
                    onClick={this.handleClearCache}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    캐시 지우고 새로고침
                  </button>
                )}

                <button
                  onClick={this.handleGoHome}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  홈으로 이동
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    개발자 정보 (클릭하여 펼치기)
                  </summary>
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                    <p className="font-semibold mb-2">Error Message:</p>
                    <p className="mb-3 break-words">{this.state.error?.message}</p>

                    {this.state.error?.stack && (
                      <>
                        <p className="font-semibold mb-2">Stack Trace:</p>
                        <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-40">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple hook-based error boundary for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);

    // For development, we might want to show more details
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        errorInfo,
      });
    }
  };
}

export default ErrorBoundary;