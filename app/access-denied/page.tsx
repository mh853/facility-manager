'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Home, ArrowLeft } from 'lucide-react';

export default function AccessDeniedPage() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // 인증되지 않은 사용자는 홈으로 리다이렉트
    if (!isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* 아이콘 */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-red-600" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          접근 권한이 없습니다
        </h1>

        {/* 설명 */}
        <div className="text-gray-600 mb-8 space-y-2">
          <p>이 페이지에 접근할 수 있는 권한이 없습니다.</p>
          {user && (
            <p className="text-sm">
              현재 계정: <span className="font-medium">{user.name}</span>
              <br />
              권한 레벨: <span className="font-medium">
                {user.role === 3 ? '관리자' : user.role === 2 ? '실사담당자' : '일반사용자'}
              </span>
            </p>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            관리자 권한이 필요한 페이지입니다. 접근 권한이 필요하시면 시스템 관리자에게 문의하세요.
          </p>
        </div>

        {/* 액션 버튼들 */}
        <div className="space-y-3">
          <button
            onClick={goBack}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전 페이지로 돌아가기
          </button>

          <a
            href="/"
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로 이동
          </a>
        </div>

        {/* 연락처 정보 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            문의사항이 있으시면 IT팀으로 연락주세요.
            <br />
            <span className="font-medium">facility@blueon-iot.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}