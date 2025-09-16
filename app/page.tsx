'use client';

import { useEffect, useState, useMemo, useCallback, memo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Building2, LogIn, AlertTriangle } from 'lucide-react';
import UserProfile from '@/components/auth/UserProfile';

// 소셜 로그인 버튼 컴포넌트
function SocialLoginButton({ provider, onClick }: { provider: 'kakao' | 'naver' | 'google'; onClick: () => void }) {
  const configs = {
    kakao: { name: '카카오', color: 'bg-yellow-400 hover:bg-yellow-500', textColor: 'text-black' },
    naver: { name: '네이버', color: 'bg-green-500 hover:bg-green-600', textColor: 'text-white' },
    google: { name: '구글', color: 'bg-red-500 hover:bg-red-600', textColor: 'text-white' }
  };

  const config = configs[provider];

  return (
    <button
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${config.color} ${config.textColor}`}
    >
      {config.name}로 로그인
    </button>
  );
}

// 로그인 컴포넌트
function LoginSection() {
  const { login } = useAuth();

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-600">시설 관리 시스템에 접근하려면 로그인하세요</p>
      </div>

      <div className="space-y-3">
        <SocialLoginButton provider="kakao" onClick={() => login('kakao')} />
        <SocialLoginButton provider="naver" onClick={() => login('naver')} />
        <SocialLoginButton provider="google" onClick={() => login('google')} />
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>등록된 사용자만 로그인할 수 있습니다.</p>
        <p>문의: blueon@blueon-iot.com</p>
      </div>
    </div>
  );
}

// 알림 메시지 컴포넌트
function AlertMessage({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`mb-4 p-4 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      <div className="flex items-center">
        <AlertTriangle className="w-5 h-5 mr-2" />
        <span>{message}</span>
      </div>
    </div>
  );
}

// 인증된 사용자용 메인 컴포넌트
function AuthenticatedHomePage() {
  const [businessList, setBusinessList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // 메모이제이션된 필터링
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return businessList;
    const searchLower = searchTerm.toLowerCase();
    return businessList.filter(business =>
      business.toLowerCase().includes(searchLower)
    );
  }, [searchTerm, businessList]);

  // 사업장 목록 로드 최적화
  const loadBusinessList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/business-list', {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Cache-Control': 'max-age=300' // 5분 캐시
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 데이터 로드 실패`);
      }

      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.businesses)) {
        // '#REF!' 같은 오류 값들을 추가로 필터링
        const cleanBusinesses = data.data.businesses.filter((business: string) =>
          business &&
          typeof business === 'string' &&
          !business.startsWith('#') &&
          !business.includes('REF!') &&
          business.trim().length > 1
        );

        if (cleanBusinesses.length > 0) {
          setBusinessList(cleanBusinesses);
        } else {
          throw new Error('유효한 사업장 데이터가 없습니다');
        }
      } else {
        throw new Error(data.message || '올바르지 않은 응답 형식');
      }
    } catch (err) {
      console.error('🔴 [FRONTEND] 사업장 목록 로드 실패:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(`데이터 로드 실패: ${errorMessage}`);

      // 디버깅 정보 표시
      setBusinessList([
        '❌ 데이터 로드 실패',
        `⚠️ 오류: ${errorMessage}`,
        '🔄 다시 시도하려면 새로고침하세요'
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessList();
  }, [loadBusinessList]);

  // 사업장 선택 핸들러 최적화
  const goToBusiness = useCallback((businessName: string) => {
    // 오류 메시지인 경우 페이지 이동 방지
    if (businessName.includes('❌') || businessName.includes('⚠️') || businessName.includes('🔄')) {
      alert('실제 사업장을 선택해주세요. 현재 표시된 항목은 오류 메시지입니다.');
      return;
    }

    router.push(`/business/${encodeURIComponent(businessName)}`);
  }, [router]);

  // 검색 입력 핸들러 최적화
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">실제 데이터를 로딩하는 중...</p>
          <p className="text-sm text-blue-200 mt-2">Google Sheets에서 사업장 목록을 가져오고 있습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="flex justify-between items-center text-white mb-8">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold mb-4">📋 시설관리 시스템</h1>
              <p className="text-xl text-blue-100">사업장을 선택하여 보고서를 작성하세요</p>
              <p className="text-sm text-blue-200 mt-2">
                ✨ 실사관리 스프레드시트에서 실시간 데이터 로드
              </p>
            </div>
            <div className="ml-4">
              <UserProfile />
            </div>
          </div>

          {/* 메인 카드 */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* 통계 */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <p className="text-center text-gray-600">
                등록된 사업장: <strong className="text-blue-600">{businessList.length}개</strong>
                {businessList.length > 0 && !businessList[0].includes('❌') && !businessList[0].includes('⚠️') && (
                  <span className="ml-2 text-green-600">✅ 실시간 데이터</span>
                )}
              </p>
              {user && (
                <p className="text-center text-sm text-gray-500 mt-1">
                  환영합니다, {user.name}님 ({user.role === 3 ? '관리자' : '실사담당자'})
                </p>
              )}
            </div>

            {/* 검색 */}
            <div className="p-6 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="🔍 사업장 검색..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-lg"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* 사업장 리스트 */}
            <div className="max-h-96 overflow-y-auto">
              {filteredList.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredList.map((business, index) => (
                    <button
                      key={index}
                      onClick={() => goToBusiness(business)}
                      className={`w-full px-6 py-4 text-left transition-colors group flex items-center gap-3 ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'hover:bg-red-50 cursor-help'
                          : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                    >
                      <Building2 className={`w-5 h-5 ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-400 group-hover:text-red-600'
                          : 'text-gray-400 group-hover:text-blue-600'
                      }`} />
                      <span className={`text-lg font-medium ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-600'
                          : 'text-gray-900 group-hover:text-blue-600'
                      }`}>
                        {business}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="bg-gray-50 px-6 py-4 text-center border-t">
              <p className="text-gray-600">💡 모바일에서도 편리하게 사용 가능합니다</p>
              <div className="mt-4 space-x-4">
                <button
                  onClick={loadBusinessList}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  🔄 데이터 새로고침
                </button>
                {user?.role === 3 && (
                  <button
                    onClick={() => router.push('/admin')}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    ⚙️ 관리자 페이지
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// URL 매개변수를 사용하는 컴포넌트
function HomePageContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // URL 매개변수에서 메시지 확인
  const loginSuccess = searchParams?.get('login') === 'success';
  const errorMessage = searchParams?.get('error');

  // 로그인 성공 시 권한에 따른 자동 리다이렉트
  useEffect(() => {
    if (loginSuccess && isAuthenticated && user) {
      console.log('🔄 [REDIRECT] 로그인 성공 감지, 리다이렉트 준비:', {
        role: user.role,
        name: user.name,
        loginSuccess,
        isAuthenticated
      });

      const timer = setTimeout(() => {
        if (user.role === 3) {
          // 관리자: 관리자 페이지로
          console.log('🎯 [REDIRECT] 관리자 페이지로 이동');
          router.push('/admin');
        } else if (user.role >= 2) {
          // 운영자: 업무 페이지로
          console.log('🎯 [REDIRECT] 업무 페이지로 이동');
          router.push('/business');
        } else {
          // 일반 사용자(role: 1)는 홈페이지에 유지
          console.log('🎯 [REDIRECT] 일반 사용자, 홈페이지 유지');
        }
      }, 2000); // 2초 후 리다이렉트

      return () => clearTimeout(timer);
    }
  }, [loginSuccess, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">인증 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 제목 */}
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-4">📋 시설관리 시스템</h1>
            <p className="text-xl text-blue-100">BlueOn IoT 시설 실사관리 시스템</p>
          </div>

          {/* 알림 메시지 */}
          {loginSuccess && (
            <AlertMessage message="로그인이 완료되었습니다!" type="success" />
          )}
          {errorMessage && (
            <AlertMessage message={errorMessage} type="error" />
          )}

          {/* 메인 콘텐츠 */}
          {isAuthenticated ? <AuthenticatedHomePage /> : <LoginSection />}
        </div>
      </div>
    </div>
  );
}

export default memo(function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">페이지를 로딩하는 중...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
});