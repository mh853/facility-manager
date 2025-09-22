'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, socialLogin } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 이미 로그인된 사용자는 리다이렉트
  useEffect(() => {
    if (user && !authLoading) {
      const redirectTo = searchParams?.get('redirect') || '/admin'
      router.push(redirectTo)
    }
  }, [user, authLoading, router, searchParams])

  // URL 파라미터에서 성공/오류 메시지 확인
  useEffect(() => {
    const success = searchParams?.get('success')
    const errorParam = searchParams?.get('error')

    if (success === 'true') {
      setSuccessMessage('카카오 로그인이 성공했습니다! 잠시만 기다려주세요...')
      // 성공 시 즉시 admin 페이지로 리다이렉트
      setTimeout(() => {
        const redirectTo = searchParams?.get('redirect') || '/admin'
        window.location.href = redirectTo
      }, 1500) // 1.5초 후 리다이렉트
    }

    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // 소셜 로그인 핸들러
  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'naver') => {
    try {
      setLoading(true)
      setError(null)

      const redirectUri = `${window.location.origin}/api/auth/social/${provider}/callback`
      const loginUrl = `/api/auth/social/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`

      // 소셜 로그인 페이지로 이동
      window.location.href = loginUrl
    } catch (error) {
      console.error(`${provider} 로그인 오류:`, error)
      setError('소셜 로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">시설관리 시스템</h1>
          <p className="text-sm text-gray-600 mt-2">주식회사 블루온</p>
          <p className="text-xs text-gray-500 mt-1">관리자 인증이 필요합니다</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">로그인</h2>
            <p className="text-sm text-gray-600">소셜 계정으로 간편하게 로그인하세요</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <p className="text-sm text-green-600">{successMessage}</p>
              </div>
            </div>
          )}

          {/* 소셜 로그인 버튼들 */}
          <div className="space-y-3">
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="font-medium text-gray-700">Google로 로그인</span>
            </button>

            <button
              onClick={() => handleSocialLogin('kakao')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#3C1E1E">
                  <path d="M12 3C7.03 3 3 6.34 3 10.5c0 2.69 1.73 5.04 4.32 6.4l-1.09 4.02c-.06.22.26.4.44.25L10.5 18.6c.5.05 1 .08 1.5.08 4.97 0 9-3.34 9-7.5S16.97 3 12 3z"/>
                </svg>
              </div>
              <span className="font-medium text-gray-800">카카오로 로그인</span>
            </button>

            <button
              onClick={() => handleSocialLogin('naver')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                  <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
                </svg>
              </div>
              <span className="font-medium">네이버로 로그인</span>
            </button>
          </div>

          {loading && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                로그인 처리 중...
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              소셜 로그인으로 가입하시면 관리자 승인 후 이용 가능합니다.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2025 주식회사 블루온. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}