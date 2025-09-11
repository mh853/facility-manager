'use client';

import React, { createContext, useContext } from 'react';
import { ToastContainer, useToast as useToastHook } from '@/components/ui/Toast';
import type { Toast } from '@/components/ui/Toast';

interface ToastContextType {
  success: (title: string, message?: string, options?: Partial<Toast>) => string;
  error: (title: string, message?: string, options?: Partial<Toast>) => string;
  warning: (title: string, message?: string, options?: Partial<Toast>) => string;
  info: (title: string, message?: string, options?: Partial<Toast>) => string;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, addToast, removeToast, success, error, warning, info, clear } = useToastHook();

  const contextValue: ToastContextType = {
    success,
    error,
    warning,
    info,
    addToast,
    removeToast,
    clear
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}