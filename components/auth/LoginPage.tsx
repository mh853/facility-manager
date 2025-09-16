// components/auth/LoginPage.tsx - 한국 사용자 최적화 로그인 페이지

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import SocialLoginButtons from './SocialLoginButtons';
import { Building2, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginPageProps {
  title?: string;
  subtitle?: string;
  redirectTo?: string;
  showSocialLogin?: boolean;
  className?: string;
}

export default function LoginPage({
  title = '시설관리시스템',
  subtitle = '효율적인 시설 관리를 위한 통합 솔루션',
  redirectTo = '/dashboard',
  showSocialLogin = true,
  className = ''
}: LoginPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading: authLoading } = useAuth();

  // 폼 상태 관리
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // URL 파라미터에서 메시지 확인
  useEffect(() => {
    const approved = searchParams?.get('approved');
    const error = searchParams?.get('error');
    const message = searchParams?.get('message');

    if (approved === 'true') {
      setSuccess('계정이 승인되었습니다. 다시 로그인해주세요.');
    }

    if (error) {
      setError(decodeURIComponent(error));
    }

    if (message) {
      setSuccess(decodeURIComponent(message));
    }
  }, [searchParams]);

  // 폼 입력 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // 에러 상태 초기화
    if (error) setError(null);
  };

  // 이메일/패스워드 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Email/password login not implemented - using social login only
      const result = { success: false, error: '이메일 로그인은 현재 지원되지 않습니다. 소셜 로그인을 사용해주세요.' };

      if (result.success) {
        // 로그인 상태 유지 설정
        if (formData.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }

        setSuccess('로그인에 성공했습니다.');

        // 0.5초 후 리다이렉트 (사용자 피드백을 위해)
        setTimeout(() => {
          router.push(redirectTo);
        }, 500);
      } else {
        setError(result.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 소셜 로그인 성공 처리
  const handleSocialSuccess = (user: any) => {
    setSuccess(`${user.name}님, 환영합니다!`);
    setTimeout(() => {
      router.push(redirectTo);
    }, 500);
  };

  // 소셜 로그인 에러 처리
  const handleSocialError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 ${className}`}>
      <div className="flex min-h-screen">
        {/* 왼쪽 브랜딩 섹션 (데스크톱에서만) */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 items-center justify-center">
          <div className="max-w-md text-white">
            <div className="mb-8">
              <Building2 className="w-16 h-16 mb-6" />
              <h1 className="text-4xl font-bold mb-4">{title}</h1>
              <p className="text-xl text-blue-100">{subtitle}</p>
            </div>

            <div className="space-y-4 text-blue-100">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-300" />
                <span>효율적인 시설 정보 관리</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-300" />
                <span>실시간 업무 협업</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-300" />
                <span>모바일 최적화된 업무 환경</span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 로그인 폼 섹션 */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* 모바일 헤더 */}
            <div className="lg:hidden text-center">
              <div className="flex justify-center mb-4">
                <Building2 className="w-12 h-12 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
              <p className="text-gray-600">{subtitle}</p>
            </div>

            {/* 데스크톱 헤더 */}
            <div className="hidden lg:block text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">로그인</h2>
              <p className="text-gray-600">계속하려면 로그인이 필요합니다</p>
            </div>

            {/* 성공/에러 메시지 */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-green-800 text-sm">{success}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* 소셜 로그인 섹션 */}
            {showSocialLogin && (
              <div className="space-y-6">
                <SocialLoginButtons
                  onSuccess={handleSocialSuccess}
                  onError={handleSocialError}
                  redirectTo={redirectTo}
                />

                {/* 구분선 */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">또는 이메일로 로그인</span>
                  </div>
                </div>
              </div>
            )}

            {/* 이메일 로그인 폼 */}
            <form onSubmit={handleEmailLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  이메일 주소
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="example@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="비밀번호를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
                    로그인 상태 유지
                  </label>
                </div>

                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  비밀번호 찾기
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || authLoading}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading || authLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </button>
            </form>

            {/* 회원가입 링크 */}
            <div className="text-center">
              <span className="text-sm text-gray-600">
                계정이 없으신가요?{' '}
                <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                  회원가입
                </Link>
              </span>
            </div>

            {/* 고객지원 링크 */}
            <div className="text-center text-xs text-gray-500 space-y-1">
              <div>
                로그인에 문제가 있으신가요?{' '}
                <Link href="/support" className="text-blue-600 hover:text-blue-500">
                  고객지원
                </Link>
              </div>
              <div>
                <Link href="/privacy" className="hover:text-gray-700">개인정보처리방침</Link>
                {' • '}
                <Link href="/terms" className="hover:text-gray-700">이용약관</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}