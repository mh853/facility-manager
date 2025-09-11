'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, RefreshCw } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onRetry?: () => void;
}

interface ToastProps extends Toast {
  onRemove: (id: string) => void;
}

const ToastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
};

const ToastStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
};

const ToastIconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
};

function ToastItem({ id, type, title, message, duration = 1000, action, onRetry, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Slide in animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-remove timer
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        handleRemove();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(id);
    }, 200); // Animation duration
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      handleRemove();
    }
  };

  const handleActionClick = () => {
    if (action?.onClick) {
      action.onClick();
      handleRemove();
    }
  };

  const Icon = ToastIcons[type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm
        ${ToastStyles[type]}
        transition-all duration-200 ease-out
        ${isVisible && !isExiting ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'}
        ${isExiting ? 'transform translate-x-full opacity-0' : ''}
        max-w-sm w-full pointer-events-auto
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar for timed toasts */}
      {duration > 0 && (
        <div className={`absolute top-0 left-0 h-1 bg-current opacity-20`}>
          <div 
            className={`h-full bg-current transition-all ease-linear`}
            style={{ 
              width: '100%',
              animation: `shrink ${duration}ms linear forwards`
            }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start">
          <Icon className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${ToastIconStyles[type]}`} />
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">
              {title}
            </h4>
            {message && (
              <p className="mt-1 text-sm opacity-90">
                {message}
              </p>
            )}
            
            {/* Action buttons */}
            {(action || onRetry) && (
              <div className="mt-3 flex space-x-2">
                {onRetry && (
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    다시 시도
                  </button>
                )}
                {action && (
                  <button
                    onClick={handleActionClick}
                    className="px-2 py-1 text-xs font-medium rounded bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {action.label}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Close button for persistent toasts */}
          {duration === 0 && (
            <button
              onClick={handleRemove}
              className="ml-3 flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Toast container component
export function ToastContainer({ toasts, onRemove }: { 
  toasts: Toast[], 
  onRemove: (id: string) => void 
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// Toast hook for easy usage
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, ...toast };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (title: string, message?: string, options?: Partial<Toast>) => 
    addToast({ type: 'success', title, message, duration: 1000, ...options });

  const error = (title: string, message?: string, options?: Partial<Toast>) => 
    addToast({ type: 'error', title, message, duration: 3000, ...options });

  const warning = (title: string, message?: string, options?: Partial<Toast>) => 
    addToast({ type: 'warning', title, message, duration: 2000, ...options });

  const info = (title: string, message?: string, options?: Partial<Toast>) => 
    addToast({ type: 'info', title, message, duration: 2000, ...options });

  const clear = () => setToasts([]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clear
  };
}