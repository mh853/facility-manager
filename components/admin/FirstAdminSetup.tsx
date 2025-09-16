'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemStatus {
  hasAdmins: boolean;
  adminCount: number;
  totalUsers: number;
  pendingApprovals: number;
  admins: Array<{
    name: string;
    email: string;
    createdAt: string;
  }>;
}

export default function FirstAdminSetup() {
  const router = useRouter();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/init-first-admin', {
        method: 'GET'
      });

      const result = await response.json();

      if (result.success) {
        setSystemStatus(result.data);
      } else {
        setError(result.error?.message || '시스템 상태 확인 실패');
      }
    } catch (err) {
      console.error('시스템 상태 확인 오류:', err);
      setError('시스템 상태 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const promoteToFirstAdmin = async () => {
    try {
      setPromoting(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token');
      if (!token) {
        setError('로그인이 필요합니다. 먼저 카카오 로그인을 완료해주세요.');
        return;
      }

      const response = await fetch('/api/admin/init-first-admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`축하합니다! ${result.data.admin.name}님이 첫 관리자가 되었습니다.`);
        // 시스템 상태 다시 확인
        await checkSystemStatus();
        // 3초 후 관리자 페이지로 이동
        setTimeout(() => {
          router.push('/admin');
        }, 3000);
      } else {
        if (result.error?.code === 'ADMIN_EXISTS') {
          setError(`이미 관리자가 존재합니다. 기존 관리자에게 권한 승격을 요청하세요.`);
          setSystemStatus(prev => prev ? { ...prev, hasAdmins: true } : null);
        } else {
          setError(result.error?.message || '관리자 승격 실패');
        }
      }
    } catch (err) {
      console.error('관리자 승격 오류:', err);
      setError('관리자 승격 중 오류가 발생했습니다.');
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">시스템 상태를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!systemStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">시스템 상태 확인 실패</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={checkSystemStatus}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* 헤더 */}
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">시설 관리 시스템 초기 설정</h1>
            <p className="text-blue-100 mt-1">관리자 계정 설정</p>
          </div>

          <div className="px-6 py-6">
            {/* 시스템 현황 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.adminCount}</div>
                <div className="text-sm text-gray-600">관리자</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.totalUsers}</div>
                <div className="text-sm text-gray-600">전체 사용자</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.pendingApprovals}</div>
                <div className="text-sm text-gray-600">대기중인 승인</div>
              </div>
            </div>

            {/* 성공 메시지 */}
            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{success}</p>
                    <p className="text-xs text-green-600 mt-1">3초 후 관리자 페이지로 이동합니다...</p>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 관리자가 없는 경우 - 첫 관리자 등록 */}
            {!systemStatus.hasAdmins ? (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">시스템에 관리자가 없습니다</h2>
                  <p className="text-gray-600 mb-6">
                    소셜 로그인으로 로그인하신 후, 아래 버튼을 클릭하여 첫 관리자가 되어주세요.
                  </p>
                </div>

                <button
                  onClick={promoteToFirstAdmin}
                  disabled={promoting}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {promoting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      관리자로 등록 중...
                    </div>
                  ) : (
                    '첫 관리자가 되기'
                  )}
                </button>

                <div className="mt-6 text-xs text-gray-500">
                  <p>첫 관리자가 되면 다음 권한을 갖게 됩니다:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• 소셜 로그인 승인 요청 관리</li>
                    <li>• 다른 사용자를 관리자로 승격</li>
                    <li>• 도메인별 로그인 정책 설정</li>
                    <li>• 시스템 전체 관리</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* 관리자가 이미 있는 경우 */
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">시스템이 이미 설정되었습니다</h2>
                  <p className="text-gray-600 mb-6">
                    관리자가 {systemStatus.adminCount}명 있습니다. 관리자 권한이 필요하시면 기존 관리자에게 문의하세요.
                  </p>
                </div>

                {/* 기존 관리자 목록 */}
                {systemStatus.admins.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">현재 관리자</h3>
                    <div className="space-y-2">
                      {systemStatus.admins.map((admin, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-900">{admin.name}</span>
                            <span className="text-gray-500 ml-2">({admin.email})</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(admin.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={() => router.push('/login')}
                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200"
                  >
                    로그인 페이지로
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                  >
                    홈페이지로
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}