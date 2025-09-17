'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function TestAuthFrontend() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    // AuthContext 상태 테스트
    const results = {
      isAuthenticated,
      isLoading,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department
      } : null,
      timestamp: new Date().toISOString()
    };

    setTestResults(results);
    console.log('🔍 [TEST-AUTH-FRONTEND] AuthContext 상태:', results);
  }, [user, isLoading, isAuthenticated]);

  const handleTestKakaoLogin = () => {
    console.log('🔐 [TEST-AUTH-FRONTEND] 카카오 로그인 테스트 시작');
    login('kakao');
  };

  const handleTestLogout = async () => {
    console.log('🚪 [TEST-AUTH-FRONTEND] 로그아웃 테스트 시작');
    await logout();
  };

  const handleTestApiCall = async () => {
    try {
      console.log('🔍 [TEST-AUTH-FRONTEND] API 호출 테스트 시작');
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      console.log('📡 [TEST-AUTH-FRONTEND] API 응답:', data);

      setTestResults(prev => ({
        ...prev,
        apiTest: {
          success: data.success,
          user: data.data?.user,
          permissions: data.data?.permissions
        }
      }));
    } catch (error) {
      console.error('❌ [TEST-AUTH-FRONTEND] API 호출 실패:', error);
      setTestResults(prev => ({
        ...prev,
        apiTest: {
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">인증 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AuthContext 프론트엔드 테스트</h1>

        {/* 인증 상태 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">현재 인증 상태</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">인증 여부:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isAuthenticated ? '인증됨' : '미인증'}
              </span>
            </div>
            <div>
              <span className="font-medium">로딩 상태:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${isLoading ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                {isLoading ? '로딩중' : '완료'}
              </span>
            </div>
          </div>
        </div>

        {/* 사용자 정보 */}
        {user && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">사용자 정보</h2>
            <div className="space-y-2">
              <div><span className="font-medium">ID:</span> {user.id}</div>
              <div><span className="font-medium">이메일:</span> {user.email}</div>
              <div><span className="font-medium">이름:</span> {user.name}</div>
              <div><span className="font-medium">권한:</span>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  user.role === 3 ? 'bg-purple-100 text-purple-800' :
                  user.role === 2 ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role === 3 ? '관리자' : user.role === 2 ? '운영자' : '일반 사용자'} (레벨 {user.role})
                </span>
              </div>
              <div><span className="font-medium">부서:</span> {user.department || 'N/A'}</div>
              <div><span className="font-medium">활성 상태:</span> {user.isActive ? '활성' : '비활성'}</div>
            </div>
          </div>
        )}

        {/* 테스트 버튼들 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">테스트 기능</h2>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={handleTestKakaoLogin}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                카카오 로그인 테스트
              </button>

              {isAuthenticated && (
                <button
                  onClick={handleTestLogout}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  로그아웃 테스트
                </button>
              )}

              <button
                onClick={handleTestApiCall}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                인증 API 호출 테스트
              </button>
            </div>
          </div>
        </div>

        {/* 테스트 결과 */}
        {testResults && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">테스트 결과</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}