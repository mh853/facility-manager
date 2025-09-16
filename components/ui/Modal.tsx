// components/ui/Modal.tsx - Enhanced Modal Component
'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: ReactNode
  actions?: ReactNode
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  actions,
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = ''
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full ${sizeClasses[size]} max-h-[90vh] bg-white rounded-xl shadow-2xl 
        transform transition-all duration-200 scale-100 opacity-100
        flex flex-col ${className}
      `}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex-1">
              {title && (
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              )}
            </div>
            
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className="border-t border-gray-200 p-6">
            <div className="flex justify-end gap-3">
              {actions}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Modal Action Button Components
export const ModalActions = {
  Cancel: ({ onClick, children = '취소' }: { onClick?: () => void, children?: ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
    >
      {children}
    </button>
  ),

  Confirm: ({ 
    onClick, 
    children = '확인', 
    variant = 'primary',
    disabled = false,
    loading = false 
  }: { 
    onClick?: () => void
    children?: ReactNode
    variant?: 'primary' | 'danger' | 'success'
    disabled?: boolean
    loading?: boolean
  }) => {
    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    }

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`
          px-4 py-2 text-sm font-medium text-white rounded-lg 
          focus:ring-2 focus:ring-offset-2 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${loading ? 'cursor-wait' : ''}
        `}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
}

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'primary',
  loading = false
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      actions={
        <>
          <ModalActions.Cancel onClick={onClose}>
            {cancelText}
          </ModalActions.Cancel>
          <ModalActions.Confirm 
            onClick={onConfirm} 
            variant={variant}
            loading={loading}
          >
            {confirmText}
          </ModalActions.Confirm>
        </>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  )
}