// components/auth/SocialLoginButtons.tsx - 소셜 로그인 버튼 컴포넌트

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SocialLoginButtonsProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
  className?: string;
}

// 소셜 제공자 타입
type SocialProvider = 'kakao' | 'naver' | 'google';

// 소셜 제공자별 설정 (한국 사용자 최적화)
const SOCIAL_PROVIDERS = {
  kakao: {
    name: '카카오',
    fullName: '카카오로 간편 로그인',
    color: 'bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] shadow-sm',
    textColor: 'text-[#191919]',
    priority: 1,
    description: '가장 많이 사용하는 로그인',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.4c-5.3 0-9.6 3.4-9.6 7.6 0 2.6 1.7 4.9 4.3 6.3l-.9 3.3c-.1.3.2.6.5.4l4.1-2.7c.5.1 1 .1 1.6.1 5.3 0 9.6-3.4 9.6-7.6S17.3 2.4 12 2.4z"/>
      </svg>
    )
  },
  naver: {
    name: '네이버',
    fullName: '네이버로 간편 로그인',
    color: 'bg-[#03C75A] hover:bg-[#02B74A] text-white shadow-sm',
    textColor: 'text-white',
    priority: 2,
    description: '비즈니스 계정 연동',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
      </svg>
    )
  },
  google: {
    name: '구글',
    fullName: '구글로 간편 로그인',
    color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm',
    textColor: 'text-gray-700',
    priority: 3,
    description: '글로벌 계정 연동',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    )
  }
};

export default function SocialLoginButtons({
  onSuccess,
  onError,
  redirectTo = '/admin',
  className = ''
}: SocialLoginButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<SocialProvider | null>(null);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);

  // 소셜 로그인 처리
  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoading(provider);
    setPendingApproval(null);

    try {
      console.log(`🔍 [SOCIAL-LOGIN] ${provider} 로그인 시작`);

      // 소셜 제공자별 OAuth URL로 리다이렉트
      const authUrl = getSocialAuthUrl(provider);

      // 구글은 COOP 오류로 인해 리다이렉트 방식 사용
      if (provider === 'google') {
        console.log('🔄 [SOCIAL-LOGIN] 구글 리다이렉트 방식 사용');
        window.location.href = authUrl;
        return;
      }

      // 모바일 환경 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 새 창에서 소셜 로그인 진행 (모바일 최적화) - 카카오, 네이버용
      const popup = window.open(
        authUrl,
        `${provider}-login`,
        isMobile
          ? 'width=400,height=600,scrollbars=yes,resizable=yes,location=yes,toolbar=no'
          : 'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error(
          isMobile
            ? '팝업이 차단되었습니다. 브라우저 설정에서 팝업 허용 후 다시 시도해주세요.'
            : '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'
        );
      }

      // 팝업에서 메시지 수신 대기
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'SOCIAL_LOGIN_SUCCESS') {
          window.removeEventListener('message', messageListener);
          popup.close();

          console.log('✅ [SOCIAL-LOGIN] 로그인 성공:', event.data.data);

          const { token, user, isNewUser } = event.data.data;

          // JWT 토큰을 localStorage에 저장
          localStorage.setItem('auth_token', token);

          if (onSuccess) {
            onSuccess({ user, isNewUser, provider });
          } else {
            router.push(redirectTo);
          }
        } else if (event.data.type === 'SOCIAL_LOGIN_ERROR') {
          window.removeEventListener('message', messageListener);
          popup.close();

          console.error('❌ [SOCIAL-LOGIN] 로그인 실패:', event.data.error);

          const errorCode = event.data.error?.code;
          const errorMessage = event.data.error?.message || '로그인 중 오류가 발생했습니다.';

          if (errorCode === 'APPROVAL_PENDING') {
            setPendingApproval(event.data.error?.details?.requestId);
          } else if (onError) {
            onError(errorMessage);
          }
        }
      };

      window.addEventListener('message', messageListener);

      // 팝업 닫힘 감지
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setLoading(null);
        }
      }, 1000);

    } catch (error) {
      console.error(`❌ [SOCIAL-LOGIN] ${provider} 오류:`, error);

      const errorMessage = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(null);
    }
  };

  // 소셜 제공자별 OAuth URL 생성
  const getSocialAuthUrl = (provider: SocialProvider): string => {
    const baseUrl = window.location.origin;

    switch (provider) {
      case 'kakao':
        // 간단한 자동 가입 버전 사용
        return `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/auth/social/kakao-simple/callback')}&response_type=code&scope=profile_nickname,account_email`;
      case 'naver':
        const state = Math.random().toString(36).substring(7);
        sessionStorage.setItem('naver_state', state);
        return `https://nid.naver.com/oauth2.0/authorize?client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/auth/social/naver-simple/callback')}&response_type=code&state=${state}`;
      case 'google':
        return `https://accounts.google.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/auth/social/google-simple/callback')}&response_type=code&scope=openid%20email%20profile`;
      default:
        throw new Error('지원하지 않는 소셜 로그인 제공자입니다.');
    }
  };

  // 승인 상태 확인
  const checkApprovalStatus = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/auth/approvals/${approvalId}`);
      const result = await response.json();

      if (result.success && result.data.status === 'approved') {
        setPendingApproval(null);
        router.push('/auth/login?approved=true');
      }
    } catch (error) {
      console.error('❌ [SOCIAL-LOGIN] 승인 상태 확인 오류:', error);
    }
  };

  if (pendingApproval) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">승인 대기 중</h3>
              <p className="text-sm text-yellow-700 mt-1">
                관리자 승인이 필요합니다. 승인 후 다시 로그인해주세요.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => checkApprovalStatus(pendingApproval)}
                  className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md"
                >
                  승인 상태 확인
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setPendingApproval(null)}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          다른 방법으로 로그인
        </button>
      </div>
    );
  }

  // 우선순위에 따라 정렬
  const sortedProviders = Object.entries(SOCIAL_PROVIDERS)
    .sort(([, a], [, b]) => a.priority - b.priority);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 헤더 - 한국어 친화적 메시지 */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          간편하게 로그인하세요
        </h3>
        <p className="text-sm text-gray-600">
          소셜 계정으로 빠르고 안전하게 시작하세요
        </p>
      </div>

      {/* 소셜 로그인 버튼들 */}
      <div className="space-y-3">
        {sortedProviders.map(([provider, config]) => (
          <button
            key={provider}
            onClick={() => handleSocialLogin(provider as SocialProvider)}
            disabled={loading === provider}
            className={`
              w-full group relative overflow-hidden
              flex items-center justify-center px-6 py-4 rounded-xl
              font-medium text-base transition-all duration-200 ease-in-out
              touch-manipulation
              ${config.color}
              ${loading === provider
                ? 'opacity-60 cursor-not-allowed transform scale-95'
                : 'hover:transform hover:scale-[1.02] active:scale-[0.98]'
              }
              focus:outline-none focus:ring-4 focus:ring-blue-100
            `}
            aria-label={`${config.fullName} 버튼`}
          >
            {loading === provider ? (
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>로그인 중...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 w-full">
                <div className="flex-shrink-0">
                  {config.icon}
                </div>
                <div className="flex-grow text-center">
                  <div className="font-semibold">
                    {config.fullName}
                  </div>
                  {provider === 'kakao' && (
                    <div className="text-xs opacity-80 mt-0.5">
                      {config.description}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 w-5"> {/* 균형을 위한 공간 */}
                  <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="text-center text-xs text-gray-500 mt-4">
        소셜 로그인 시 서비스 이용약관 및 개인정보처리방침에 동의한 것으로 간주됩니다.
      </div>
    </div>
  );
}

// 소셜 로그인 상태 표시 컴포넌트
export function SocialLoginStatus({ user }: { user: any }) {
  if (!user || !user.socialAccount) return null;

  const provider = SOCIAL_PROVIDERS[user.socialAccount.provider as SocialProvider];
  if (!provider) return null;

  return (
    <div className="flex items-center text-sm text-gray-600">
      <span className="mr-2">{provider.icon}</span>
      <span>{provider.name}로 로그인됨</span>
      {user.socialAccount.isFirstLogin && (
        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
          신규
        </span>
      )}
    </div>
  );
}