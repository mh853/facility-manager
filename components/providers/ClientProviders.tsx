'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Toaster } from 'react-hot-toast';
import ReactQueryProvider from '@/app/providers/ReactQueryProvider';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <AuthProvider>
          <NotificationProvider>
            <ToastProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                    padding: '16px',
                    borderRadius: '8px',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 4000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}