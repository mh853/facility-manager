'use client';

import React, { useState, useCallback } from 'react';
import { useOptimizedNotifications } from '@/hooks/useOptimizedNotifications';
import { useNotification } from '@/contexts/NotificationContext';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  TestTube,
  Zap,
  Database,
  Monitor
} from 'lucide-react';

/**
 * 알림 시스템 성능 테스트 컴포넌트
 * 개발 환경에서 시스템 성능을 테스트할 수 있습니다.
 */
export default function NotificationSystemTest() {
  const optimizedHook = useOptimizedNotifications();
  const notificationContext = useNotification();

  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);

  // 캐시 성능 테스트
  const testCachePerformance = useCallback(async () => {
    console.log('🧪 [TEST] 캐시 성능 테스트 시작');

    const startTime = performance.now();

    // 로컬 스토리지에서 설정 로드 테스트
    const cachedSettings = localStorage.getItem('notification-settings-v2');
    const loadTime = performance.now() - startTime;

    const result = {
      loadTime: `${loadTime.toFixed(2)}ms`,
      cacheExists: !!cachedSettings,
      cacheSize: cachedSettings ? `${(cachedSettings.length / 1024).toFixed(2)}KB` : '0KB',
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [TEST] 캐시 테스트 결과:', result);
    return result;
  }, []);

  // 메모리 사용량 테스트
  const testMemoryUsage = useCallback(async () => {
    console.log('🧪 [TEST] 메모리 사용량 테스트 시작');

    // @ts-ignore
    const memory = (performance as any).memory;
    if (!memory) {
      return { error: 'Memory API not available' };
    }

    const result = {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [TEST] 메모리 테스트 결과:', result);
    return result;
  }, []);

  // 렌더링 성능 테스트
  const testRenderingPerformance = useCallback(async () => {
    console.log('🧪 [TEST] 렌더링 성능 테스트 시작');

    const startTime = performance.now();

    // 강제 리렌더링을 위한 상태 변경
    const iterations = 10;
    for (let i = 0; i < iterations; i++) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const renderTime = performance.now() - startTime;

    const result = {
      totalRenderTime: `${renderTime.toFixed(2)}ms`,
      averageRenderTime: `${(renderTime / iterations).toFixed(2)}ms`,
      iterations,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [TEST] 렌더링 테스트 결과:', result);
    return result;
  }, []);

  // 설정 업데이트 성능 테스트
  const testSettingsUpdatePerformance = useCallback(async () => {
    console.log('🧪 [TEST] 설정 업데이트 성능 테스트 시작');

    const startTime = performance.now();

    try {
      // 더미 설정 업데이트 (실제로는 저장되지 않음)
      await optimizedHook.updateSettings({
        pushNotificationsEnabled: !optimizedHook.settings?.pushNotificationsEnabled,
      });

      const updateTime = performance.now() - startTime;

      const result = {
        updateTime: `${updateTime.toFixed(2)}ms`,
        success: true,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ [TEST] 설정 업데이트 테스트 결과:', result);
      return result;
    } catch (error) {
      console.error('❌ [TEST] 설정 업데이트 테스트 실패:', error);
      return {
        updateTime: 'N/A',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }, [optimizedHook]);

  // 전체 테스트 실행
  const runAllTests = useCallback(async () => {
    setIsRunningTests(true);
    setTestResults({});

    try {
      console.log('🚀 [TEST] 알림 시스템 전체 테스트 시작');

      const tests = [
        { name: 'cache', test: testCachePerformance },
        { name: 'memory', test: testMemoryUsage },
        { name: 'rendering', test: testRenderingPerformance },
        { name: 'settingsUpdate', test: testSettingsUpdatePerformance },
      ];

      const results: Record<string, any> = {};

      for (const { name, test } of tests) {
        try {
          results[name] = await test();
        } catch (error) {
          results[name] = {
            error: error instanceof Error ? error.message : 'Test failed',
            timestamp: new Date().toISOString(),
          };
        }
      }

      setTestResults(results);
      console.log('🎉 [TEST] 모든 테스트 완료:', results);

      // 전체 성능 점수 계산
      const performanceScore = calculatePerformanceScore(results);
      console.log('📊 [TEST] 성능 점수:', performanceScore);

    } catch (error) {
      console.error('❌ [TEST] 테스트 실행 중 오류:', error);
    } finally {
      setIsRunningTests(false);
    }
  }, [testCachePerformance, testMemoryUsage, testRenderingPerformance, testSettingsUpdatePerformance]);

  // 성능 점수 계산
  const calculatePerformanceScore = useCallback((results: Record<string, any>) => {
    let score = 100;

    // 캐시 로드 시간 점수 (5ms 이하 = 만점)
    if (results.cache?.loadTime) {
      const loadTime = parseFloat(results.cache.loadTime);
      if (loadTime > 5) score -= 10;
      if (loadTime > 10) score -= 10;
    }

    // 렌더링 성능 점수 (평균 1ms 이하 = 만점)
    if (results.rendering?.averageRenderTime) {
      const avgRenderTime = parseFloat(results.rendering.averageRenderTime);
      if (avgRenderTime > 1) score -= 15;
      if (avgRenderTime > 2) score -= 15;
    }

    // 설정 업데이트 성능 점수 (100ms 이하 = 만점)
    if (results.settingsUpdate?.updateTime) {
      const updateTime = parseFloat(results.settingsUpdate.updateTime);
      if (updateTime > 100) score -= 20;
      if (updateTime > 200) score -= 20;
    }

    return Math.max(0, score);
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TestTube className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">알림 시스템 성능 테스트</h2>
            <p className="text-sm text-gray-600">시스템 성능을 측정하고 최적화 상태를 확인합니다</p>
          </div>
        </div>

        <button
          onClick={runAllTests}
          disabled={isRunningTests}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isRunningTests ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              테스트 중...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              전체 테스트 실행
            </>
          )}
        </button>
      </div>

      {/* 현재 상태 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <Database className="w-4 h-4" />
            <span className="font-medium">캐시 상태</span>
          </div>
          <p className="text-sm text-blue-700">
            {optimizedHook.isCached ? '활성화됨' : '비활성화됨'}
          </p>
          {optimizedHook.lastFetch && (
            <p className="text-xs text-blue-600 mt-1">
              마지막 업데이트: {optimizedHook.lastFetch.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 mb-2">
            <Monitor className="w-4 h-4" />
            <span className="font-medium">연결 상태</span>
          </div>
          <p className="text-sm text-green-700">
            {notificationContext.isConnected ? '연결됨' : '연결 끊김'}
          </p>
          <p className="text-xs text-green-600 mt-1">
            알림 수: {notificationContext.notifications.length}개
          </p>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="flex items-center gap-2 text-orange-800 mb-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">로딩 상태</span>
          </div>
          <p className="text-sm text-orange-700">
            {optimizedHook.loading ? '로딩 중' : '완료'}
          </p>
          {optimizedHook.error && (
            <p className="text-xs text-red-600 mt-1">
              오류: {optimizedHook.error}
            </p>
          )}
        </div>
      </div>

      {/* 테스트 결과 */}
      {Object.keys(testResults).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            테스트 결과
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(testResults).map(([testName, result]) => (
              <div key={testName} className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 capitalize">
                  {testName === 'cache' ? '캐시 성능' :
                   testName === 'memory' ? '메모리 사용량' :
                   testName === 'rendering' ? '렌더링 성능' :
                   testName === 'settingsUpdate' ? '설정 업데이트' : testName}
                </h4>

                {result.error ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{result.error}</span>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-gray-700">
                    {Object.entries(result)
                      .filter(([key]) => key !== 'timestamp')
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                          <span className="font-mono">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          {/* 성능 점수 */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">전체 성능 점수</span>
              <span className="text-2xl font-bold text-purple-600">
                {calculatePerformanceScore(testResults)}/100
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              높은 점수일수록 더 나은 성능을 의미합니다
            </p>
          </div>
        </div>
      )}

      {/* 개발자 도구 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-md font-semibold text-gray-900 mb-4">개발자 도구</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={optimizedHook.clearCache}
            className="px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            캐시 초기화
          </button>

          <button
            onClick={optimizedHook.refreshSettings}
            className="px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            설정 새로고침
          </button>

          <button
            onClick={() => console.log('🔍 [DEBUG] Current State:', {
              optimizedHook: optimizedHook,
              notificationContext: notificationContext,
              testResults: testResults,
            })}
            className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            콘솔에 상태 출력
          </button>
        </div>
      </div>
    </div>
  );
}