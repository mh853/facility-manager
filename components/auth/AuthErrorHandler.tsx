// components/auth/AuthErrorHandler.tsx - 인증 에러 및 피드백 시스템

'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Wifi,
  Shield,
  Clock,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

// 에러 타입 정의
export interface AuthError {
  code: string;
  message: string;
  details?: string;
  userMessage?: string;
  retryable?: boolean;
  contactSupport?: boolean;
  helpUrl?: string;
}

// 한국어 에러 메시지 매핑
const ERROR_MESSAGES: Record<string, AuthError> = {
  // 네트워크 에러
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    message: '네트워크 연결을 확인해주세요',
    userMessage: '인터넷 연결이 불안정합니다. 연결 상태를 확인하고 다시 시도해주세요.',
    retryable: true
  },

  // 인증 에러
  'INVALID_CREDENTIALS': {
    code: 'INVALID_CREDENTIALS',
    message: '이메일 또는 비밀번호가 올바르지 않습니다',
    userMessage: '입력하신 이메일 주소와 비밀번호를 다시 확인해주세요.',
    retryable: true
  },

  'ACCOUNT_LOCKED': {
    code: 'ACCOUNT_LOCKED',
    message: '계정이 잠겨있습니다',
    userMessage: '보안을 위해 계정이 일시적으로 잠겼습니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요.',
    retryable: false,
    contactSupport: true
  },

  'ACCOUNT_DISABLED': {
    code: 'ACCOUNT_DISABLED',
    message: '비활성화된 계정입니다',
    userMessage: '계정이 비활성화되어 있습니다. 관리자에게 문의해주세요.',
    retryable: false,
    contactSupport: true
  },

  // 소셜 로그인 에러
  'SOCIAL_LOGIN_FAILED': {
    code: 'SOCIAL_LOGIN_FAILED',
    message: '소셜 로그인에 실패했습니다',
    userMessage: '소셜 로그인 과정에서 문제가 발생했습니다. 다시 시도하거나 다른 로그인 방법을 이용해주세요.',
    retryable: true
  },

  'SOCIAL_ACCOUNT_NOT_LINKED': {
    code: 'SOCIAL_ACCOUNT_NOT_LINKED',
    message: '연결되지 않은 소셜 계정입니다',
    userMessage: '해당 소셜 계정이 시스템에 등록되지 않았습니다. 관리자에게 계정 연동을 요청해주세요.',
    retryable: false,
    contactSupport: true
  },

  'POPUP_BLOCKED': {
    code: 'POPUP_BLOCKED',
    message: '팝업이 차단되었습니다',
    userMessage: '브라우저에서 팝업을 차단하고 있습니다. 팝업 허용 후 다시 시도해주세요.',
    retryable: true,
    helpUrl: 'https://support.google.com/chrome/answer/95472'
  },

  // 권한 에러
  'INSUFFICIENT_PERMISSIONS': {
    code: 'INSUFFICIENT_PERMISSIONS',
    message: '접근 권한이 부족합니다',
    userMessage: '해당 기능을 사용할 권한이 없습니다. 관리자에게 권한 승인을 요청해주세요.',
    retryable: false,
    contactSupport: true
  },

  // 승인 관련 에러
  'PENDING_APPROVAL': {
    code: 'PENDING_APPROVAL',
    message: '승인 대기 중입니다',
    userMessage: '관리자의 계정 승인이 필요합니다. 승인 완료 후 다시 로그인해주세요.',
    retryable: false
  },

  'APPROVAL_REJECTED': {
    code: 'APPROVAL_REJECTED',
    message: '계정 승인이 거부되었습니다',
    userMessage: '계정 승인 요청이 거부되었습니다. 자세한 내용은 관리자에게 문의해주세요.',
    retryable: false,
    contactSupport: true
  },

  // 시스템 에러
  'SERVER_ERROR': {
    code: 'SERVER_ERROR',
    message: '서버 오류가 발생했습니다',
    userMessage: '일시적인 서버 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    retryable: true
  },

  'MAINTENANCE_MODE': {
    code: 'MAINTENANCE_MODE',
    message: '시스템 점검 중입니다',
    userMessage: '현재 시스템 점검 중입니다. 점검 완료 후 다시 이용해주세요.',
    retryable: false
  }
};

interface AuthErrorHandlerProps {
  error: string | AuthError | null;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function AuthErrorHandler({
  error,
  onRetry,
  onContactSupport,
  onDismiss,
  className = ''
}: AuthErrorHandlerProps) {
  const [retrying, setRetrying] = useState(false);

  if (!error) return null;

  // 에러 객체 정규화
  const normalizedError: AuthError = typeof error === 'string'
    ? ERROR_MESSAGES[error] || {
        code: 'UNKNOWN_ERROR',
        message: error,
        userMessage: error,
        retryable: true
      }
    : error;

  // 에러 타입별 아이콘 및 색상 설정
  const getErrorStyle = () => {
    const { code } = normalizedError;

    if (code.includes('NETWORK')) {
      return {
        icon: <Wifi className="w-5 h-5" />,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-500'
      };
    }

    if (code.includes('PERMISSION') || code.includes('LOCKED') || code.includes('DISABLED')) {
      return {
        icon: <Shield className="w-5 h-5" />,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-500'
      };
    }

    if (code.includes('PENDING') || code.includes('APPROVAL')) {
      return {
        icon: <Clock className="w-5 h-5" />,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-500'
      };
    }

    if (code.includes('MAINTENANCE') || code.includes('SERVER')) {
      return {
        icon: <AlertTriangle className="w-5 h-5" />,
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-500'
      };
    }

    // 기본 에러 스타일
    return {
      icon: <AlertCircle className="w-5 h-5" />,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500'
    };
  };

  const style = getErrorStyle();

  // 재시도 처리
  const handleRetry = async () => {
    if (!onRetry || !normalizedError.retryable) return;

    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  // 도움말 링크 열기
  const openHelpUrl = () => {
    if (normalizedError.helpUrl) {
      window.open(normalizedError.helpUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${style.iconColor}`}>
          {style.icon}
        </div>

        <div className="ml-3 flex-1">
          {/* 에러 제목 */}
          <h3 className={`text-sm font-medium ${style.textColor}`}>
            {normalizedError.message}
          </h3>

          {/* 사용자 친화적 설명 */}
          {normalizedError.userMessage && (
            <div className={`mt-2 text-sm ${style.textColor} opacity-90`}>
              {normalizedError.userMessage}
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* 재시도 버튼 */}
            {normalizedError.retryable && onRetry && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className={`
                  inline-flex items-center px-3 py-2 border border-transparent text-sm
                  font-medium rounded-md transition-colors
                  ${style.textColor} bg-white hover:bg-gray-50 border-gray-300
                  ${retrying ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? '재시도 중...' : '다시 시도'}
              </button>
            )}

            {/* 고객지원 버튼 */}
            {normalizedError.contactSupport && onContactSupport && (
              <button
                onClick={onContactSupport}
                className={`
                  inline-flex items-center px-3 py-2 border border-transparent text-sm
                  font-medium rounded-md transition-colors
                  ${style.textColor} bg-white hover:bg-gray-50 border-gray-300
                `}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                고객지원
              </button>
            )}

            {/* 도움말 버튼 */}
            {normalizedError.helpUrl && (
              <button
                onClick={openHelpUrl}
                className={`
                  inline-flex items-center px-3 py-2 border border-transparent text-sm
                  font-medium rounded-md transition-colors
                  ${style.textColor} bg-white hover:bg-gray-50 border-gray-300
                `}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                도움말
              </button>
            )}
          </div>
        </div>

        {/* 닫기 버튼 */}
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className={`
                  inline-flex rounded-md p-1.5 transition-colors
                  ${style.iconColor} hover:bg-gray-100
                `}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 추가 정보 (개발자용 - 개발 환경에서만 표시) */}
      {process.env.NODE_ENV === 'development' && normalizedError.details && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-medium">개발자 정보</summary>
            <pre className="mt-2 whitespace-pre-wrap">{normalizedError.details}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

// 성공 메시지 컴포넌트
interface AuthSuccessMessageProps {
  message: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  hideDelay?: number;
  className?: string;
}

export function AuthSuccessMessage({
  message,
  onDismiss,
  autoHide = true,
  hideDelay = 3000,
  className = ''
}: AuthSuccessMessageProps) {
  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, hideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, hideDelay, onDismiss]);

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
        <div className="ml-3 flex-1">
          <div className="text-sm font-medium text-green-800">
            {message}
          </div>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 text-green-500 hover:bg-green-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 정보 메시지 컴포넌트
interface AuthInfoMessageProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function AuthInfoMessage({
  message,
  onDismiss,
  className = ''
}: AuthInfoMessageProps) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Info className="w-5 h-5 text-blue-500" />
        </div>
        <div className="ml-3 flex-1">
          <div className="text-sm text-blue-800">
            {message}
          </div>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 text-blue-500 hover:bg-blue-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 에러 생성 헬퍼 함수들
export const createAuthError = {
  network: (details?: string): AuthError => ({
    ...ERROR_MESSAGES.NETWORK_ERROR,
    details
  }),

  invalidCredentials: (details?: string): AuthError => ({
    ...ERROR_MESSAGES.INVALID_CREDENTIALS,
    details
  }),

  accountLocked: (details?: string): AuthError => ({
    ...ERROR_MESSAGES.ACCOUNT_LOCKED,
    details
  }),

  socialLoginFailed: (provider: string, details?: string): AuthError => ({
    ...ERROR_MESSAGES.SOCIAL_LOGIN_FAILED,
    userMessage: `${provider} 로그인에 실패했습니다. 다시 시도하거나 다른 방법을 이용해주세요.`,
    details
  }),

  popupBlocked: (): AuthError => ERROR_MESSAGES.POPUP_BLOCKED,

  pendingApproval: (estimatedTime?: string): AuthError => ({
    ...ERROR_MESSAGES.PENDING_APPROVAL,
    userMessage: `관리자의 계정 승인이 필요합니다. ${estimatedTime || '1-2 영업일'} 내에 처리됩니다.`
  }),

  serverError: (details?: string): AuthError => ({
    ...ERROR_MESSAGES.SERVER_ERROR,
    details
  })
};