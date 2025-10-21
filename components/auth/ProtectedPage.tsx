// components/auth/ProtectedPage.tsx - 새로운 인증 보호 컴포넌트

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard, AuthResult, AuthUser } from '@/lib/auth/AuthGuard';
import { AuthLevel } from '@/lib/auth/AuthLevels';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedPageProps {
  /** 컴포넌트가 요구하는 권한 레벨 */
  requiredLevel: AuthLevel;

  /** 자식 컴포넌트 */
  children: React.ReactNode;

  /** 권한 부족 시 표시할 커스텀 메시지 */
  fallbackMessage?: string;

  /** 권한 부족 시 리다이렉트할 URL (기본값 사용 시 생략) */
  redirectTo?: string;

  /** 로딩 중 표시할 컴포넌트 */
  loadingComponent?: React.ReactNode;
}

/**
 * 페이지 레벨 인증 보호 컴포넌트
 * 새로운 AuthGuard 시스템을 사용하여 권한 기반 접근 제어 제공
 */
export function ProtectedPage({
  requiredLevel,
  children,
  fallbackMessage,
  redirectTo,
  loadingComponent
}: ProtectedPageProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);

  useEffect(() => {
    async function checkAccess() {
      // 현재 페이지 경로 가져오기
      const pathname = window.location.pathname;

      // AuthGuard로 권한 확인
      const result = await AuthGuard.checkPageAccess(pathname, user as AuthUser);
      setAuthResult(result);

      // 접근 거부 시 리다이렉트
      if (!result.allowed && result.redirectTo) {
        const targetUrl = redirectTo || result.redirectTo;
        router.push(targetUrl);
      }
    }

    // 인증 로딩이 완료된 후 권한 확인
    if (!loading) {
      checkAccess();
    }
  }, [user, loading, requiredLevel, router, redirectTo]);

  // 로딩 중
  if (loading || !authResult) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 접근 거부
  if (!authResult.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-6">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>

          <p className="text-gray-600 mb-6">
            {fallbackMessage || authResult.error || '이 페이지에 접근할 권한이 없습니다.'}
          </p>

          {/* 권한 정보 표시 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <p className="text-gray-700">
              <span className="font-medium">현재 권한:</span> {AuthGuard.getLevelName(authResult.userLevel)}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">필요 권한:</span> {AuthGuard.getLevelName(authResult.requiredLevel)}
            </p>
            {authResult.bypassed && (
              <p className="text-blue-600 mt-2">
                🔧 개발 모드 - 인증 우회 활성화
              </p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.back()}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              이전 페이지로 돌아가기
            </button>

            <button
              onClick={() => router.push('/admin')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              메인 대시보드로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 접근 허용 - 자식 컴포넌트 렌더링
  return (
    <div data-auth-level={authResult.userLevel} data-required-level={authResult.requiredLevel}>
      {authResult.bypassed && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                🔧 <strong>개발 모드</strong> - 인증이 우회되었습니다. 운영 환경에서는 정상적인 권한 확인이 적용됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

/**
 * 컴포넌트 레벨 권한 확인 훅
 */
export function useComponentAuth(requiredLevel: AuthLevel) {
  const { user } = useAuth();
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);

  useEffect(() => {
    const result = AuthGuard.checkComponentAccess(requiredLevel, user as AuthUser);
    setAuthResult(result);
  }, [user, requiredLevel]);

  return authResult;
}