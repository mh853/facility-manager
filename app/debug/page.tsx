'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setResults(prev => [...prev, logMessage]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testAuth = async () => {
    log('🔍 인증 상태 확인 중...', 'info');

    const authToken = localStorage.getItem('auth_token');
    const cookieToken = document.cookie.split('; ').find(row => row.startsWith('auth_token='));

    log(`localStorage 토큰: ${authToken ? '존재함' : '없음'}`);
    log(`Cookie 토큰: ${cookieToken ? '존재함' : '없음'}`);

    return authToken || (cookieToken ? cookieToken.split('=')[1] : null);
  };

  const testNotificationAPI = async () => {
    setLoading(true);
    try {
      const token = await testAuth();
      if (!token) {
        log('❌ 인증 토큰이 없습니다', 'error');
        return;
      }

      log('📊 알림 API 테스트 시작...', 'info');

      // 업무 알림 API 테스트
      const response = await fetch('/api/notifications?taskNotifications=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      log(`API 응답 상태: ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');

      if (response.ok) {
        const data = await response.json();
        log('✅ API 응답 성공', 'success');
        log(`응답 구조: ${JSON.stringify(Object.keys(data), null, 2)}`);

        const taskNotifications = data.data?.taskNotifications || data.taskNotifications || [];
        log(`업무 알림 개수: ${taskNotifications.length}`);

        if (taskNotifications.length > 0) {
          log(`첫 번째 알림 샘플: ${JSON.stringify(taskNotifications[0], null, 2)}`);
        } else {
          log('⚠️ 업무 알림 데이터가 없습니다', 'warning');
        }
      } else {
        const errorText = await response.text();
        log(`❌ API 오류: ${errorText}`, 'error');
      }

    } catch (error: any) {
      log(`💥 테스트 오류: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const testDatabaseAccess = async () => {
    setLoading(true);
    try {
      log('🗃️ 데이터베이스 접근 테스트...', 'info');

      const response = await fetch('/api/debug/raw-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query_type: 'all' })
      });

      log(`데이터베이스 테스트 응답: ${response.status}`, response.ok ? 'success' : 'error');

      if (response.ok) {
        const data = await response.json();
        log('✅ 데이터베이스 접근 성공', 'success');
        log(`결과: ${JSON.stringify(data, null, 2)}`);
      } else {
        const errorText = await response.text();
        log(`❌ 데이터베이스 접근 실패: ${errorText}`, 'error');
      }

    } catch (error: any) {
      log(`💥 데이터베이스 테스트 오류: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const runFullDiagnosis = async () => {
    clearResults();
    log('🚀 전체 진단 시작...', 'info');

    await testNotificationAPI();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testDatabaseAccess();

    log('✅ 전체 진단 완료', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">🔍 시스템 디버깅 도구</h1>
          <p className="text-gray-600 mb-8">
            알림 시스템의 문제를 진단하고 해결하기 위한 도구입니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <button
              onClick={testAuth}
              disabled={loading}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              1. 인증 확인
            </button>

            <button
              onClick={testNotificationAPI}
              disabled={loading}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              2. 알림 API 테스트
            </button>

            <button
              onClick={testDatabaseAccess}
              disabled={loading}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              3. DB 접근 테스트
            </button>

            <button
              onClick={runFullDiagnosis}
              disabled={loading}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              🚀 전체 진단
            </button>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">진단 결과</h2>
            <button
              onClick={clearResults}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              결과 지우기
            </button>
          </div>

          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center space-x-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                <span>진단 실행 중...</span>
              </div>
            )}

            {results.length === 0 && !loading && (
              <div className="text-gray-500">진단 결과가 여기에 표시됩니다...</div>
            )}

            {results.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}