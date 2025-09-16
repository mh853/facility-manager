// components/auth/UserStatusHandler.tsx - 사용자 상태별 플로우 처리

'use client';

import React from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Mail, Phone } from 'lucide-react';

interface UserStatus {
  type: 'pending' | 'approved' | 'rejected' | 'suspended' | 'first_login';
  message?: string;
  approvalId?: string;
  rejectionReason?: string;
  adminContact?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  estimatedWaitTime?: string;
}

interface UserStatusHandlerProps {
  status: UserStatus;
  onRetry?: () => void;
  onContactAdmin?: () => void;
  onCheckStatus?: (approvalId: string) => Promise<void>;
  className?: string;
}

export default function UserStatusHandler({
  status,
  onRetry,
  onContactAdmin,
  onCheckStatus,
  className = ''
}: UserStatusHandlerProps) {

  // 상태별 설정
  const getStatusConfig = () => {
    switch (status.type) {
      case 'pending':
        return {
          icon: <Clock className="w-8 h-8 text-yellow-500" />,
          title: '승인 대기 중',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          buttonColor: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
        };

      case 'approved':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500" />,
          title: '계정 승인 완료',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          buttonColor: 'bg-green-100 hover:bg-green-200 text-green-800'
        };

      case 'rejected':
        return {
          icon: <XCircle className="w-8 h-8 text-red-500" />,
          title: '계정 승인 거부',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          buttonColor: 'bg-red-100 hover:bg-red-200 text-red-800'
        };

      case 'suspended':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-orange-500" />,
          title: '계정 일시 정지',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          buttonColor: 'bg-orange-100 hover:bg-orange-200 text-orange-800'
        };

      case 'first_login':
        return {
          icon: <CheckCircle className="w-8 h-8 text-blue-500" />,
          title: '환영합니다!',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          buttonColor: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
        };
    }
  };

  const config = getStatusConfig();

  // 상태별 메시지 생성
  const getStatusMessage = () => {
    if (status.message) return status.message;

    switch (status.type) {
      case 'pending':
        return `관리자의 승인이 필요합니다. ${status.estimatedWaitTime || '1-2 영업일'} 내에 승인 여부를 알려드리겠습니다.`;

      case 'approved':
        return '계정이 성공적으로 승인되었습니다. 이제 시스템을 이용하실 수 있습니다.';

      case 'rejected':
        return status.rejectionReason || '승인 요청이 거부되었습니다. 자세한 내용은 관리자에게 문의해주세요.';

      case 'suspended':
        return '계정이 일시적으로 정지되었습니다. 자세한 내용은 관리자에게 문의해주세요.';

      case 'first_login':
        return '시설관리시스템에 처음 로그인하셨습니다. 아래 버튼을 클릭하여 시작하세요.';
    }
  };

  // 액션 버튼들
  const renderActions = () => {
    switch (status.type) {
      case 'pending':
        return (
          <div className="space-y-3">
            {status.approvalId && onCheckStatus && (
              <button
                onClick={() => onCheckStatus(status.approvalId!)}
                className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${config.buttonColor}`}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                승인 상태 확인
              </button>
            )}

            {onContactAdmin && (
              <button
                onClick={onContactAdmin}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4 mr-2" />
                관리자 문의
              </button>
            )}
          </div>
        );

      case 'approved':
        return (
          <button
            onClick={onRetry}
            className={`w-full flex items-center justify-center px-4 py-3 rounded-md text-base font-medium transition-colors ${config.buttonColor}`}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            로그인 계속하기
          </button>
        );

      case 'rejected':
      case 'suspended':
        return (
          <div className="space-y-3">
            {onContactAdmin && (
              <button
                onClick={onContactAdmin}
                className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${config.buttonColor}`}
              >
                <Mail className="w-4 h-4 mr-2" />
                관리자에게 문의하기
              </button>
            )}

            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              다른 계정으로 로그인
            </button>
          </div>
        );

      case 'first_login':
        return (
          <button
            onClick={onRetry}
            className={`w-full flex items-center justify-center px-4 py-3 rounded-md text-base font-medium transition-colors ${config.buttonColor}`}
          >
            시작하기
          </button>
        );
    }
  };

  return (
    <div className={`max-w-md mx-auto ${className}`}>
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-6 shadow-sm`}>
        {/* 상태 아이콘 및 제목 */}
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3">
            {config.icon}
          </div>
          <h3 className={`text-lg font-semibold ${config.textColor}`}>
            {config.title}
          </h3>
        </div>

        {/* 상태 메시지 */}
        <div className={`text-sm ${config.textColor} text-center mb-6 leading-relaxed`}>
          {getStatusMessage()}
        </div>

        {/* 액션 버튼들 */}
        {renderActions()}

        {/* 관리자 연락처 정보 */}
        {status.adminContact && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600 text-center space-y-1">
              <div className="font-medium">관리자 연락처</div>
              {status.adminContact.name && (
                <div>{status.adminContact.name}</div>
              )}
              {status.adminContact.email && (
                <div className="flex items-center justify-center">
                  <Mail className="w-3 h-3 mr-1" />
                  <a
                    href={`mailto:${status.adminContact.email}`}
                    className="text-blue-600 hover:text-blue-500"
                  >
                    {status.adminContact.email}
                  </a>
                </div>
              )}
              {status.adminContact.phone && (
                <div className="flex items-center justify-center">
                  <Phone className="w-3 h-3 mr-1" />
                  <a
                    href={`tel:${status.adminContact.phone}`}
                    className="text-blue-600 hover:text-blue-500"
                  >
                    {status.adminContact.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 예상 대기 시간 (승인 대기 중일 때만) */}
        {status.type === 'pending' && status.estimatedWaitTime && (
          <div className="mt-4 p-3 bg-yellow-100 rounded-md">
            <div className="text-xs text-yellow-800 text-center">
              <Clock className="w-4 h-4 inline mr-1" />
              예상 처리 시간: {status.estimatedWaitTime}
            </div>
          </div>
        )}
      </div>

      {/* 도움말 */}
      <div className="mt-4 text-center text-xs text-gray-500">
        {status.type === 'pending' && (
          <div>
            승인 알림을 받으려면 이메일을 확인해주세요.<br />
            스팸 폴더도 함께 확인해보세요.
          </div>
        )}

        {(status.type === 'rejected' || status.type === 'suspended') && (
          <div>
            문제가 지속되면 시스템 관리자에게 직접 연락해주세요.
          </div>
        )}
      </div>
    </div>
  );
}

// 상태 확인을 위한 유틸리티 훅
export function useUserStatusCheck() {
  const checkApprovalStatus = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/auth/approvals/${approvalId}`);
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          status: result.data.status,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error?.message || '상태 확인 중 오류가 발생했습니다.'
        };
      }
    } catch (error) {
      console.error('승인 상태 확인 오류:', error);
      return {
        success: false,
        error: '네트워크 오류가 발생했습니다.'
      };
    }
  };

  const contactAdmin = (message?: string) => {
    const subject = encodeURIComponent('시설관리시스템 계정 문의');
    const body = encodeURIComponent(
      message ||
      `안녕하세요.\n\n시설관리시스템 계정과 관련하여 문의드립니다.\n\n사용자 정보:\n- 이메일: [여기에 이메일 입력]\n- 문의 내용: [여기에 문의 내용 입력]\n\n감사합니다.`
    );

    // 기본 관리자 이메일 (환경변수에서 가져오거나 기본값 사용)
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@facility-manager.com';
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  };

  return {
    checkApprovalStatus,
    contactAdmin
  };
}