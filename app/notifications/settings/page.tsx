'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { withAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  Mail,
  Clock,
  Shield,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Info,
  Moon,
  Sun
} from 'lucide-react';
import Link from 'next/link';

function NotificationSettingsPage() {
  const {
    settings,
    updateSettings,
    loading
  } = useNotification();

  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // 브라우저 알림 권한 확인
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 설정 로드
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // 변경사항 추적
  useEffect(() => {
    if (settings && localSettings) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings);
      setHasChanges(hasChanges);
    }
  }, [settings, localSettings]);

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        // 권한이 허용되면 푸시 알림도 활성화
        setLocalSettings(prev => prev ? { ...prev, pushNotificationsEnabled: true } : null);
      }
    }
  };

  // 설정 저장
  const handleSave = async () => {
    if (!localSettings) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateSettings(localSettings);
      setSaveSuccess(true);
      setHasChanges(false);

      // 성공 메시지를 3초 후 숨김
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('설정 저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  // 설정 초기화
  const handleReset = () => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  };

  // 개별 설정 업데이트
  const updateSetting = (key: string, value: any) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  // 테스트 알림 발송
  const sendTestNotification = () => {
    console.log('🔔 [NOTIFICATION TEST] 시작');
    console.log('Notification API 지원:', 'Notification' in window);
    console.log('현재 권한 상태:', Notification.permission);

    if (!('Notification' in window)) {
      console.error('❌ [NOTIFICATION TEST] 브라우저가 Notification API를 지원하지 않습니다.');
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('⚠️ [NOTIFICATION TEST] 알림 권한이 허용되지 않았습니다.');
      alert('알림 권한이 허용되지 않았습니다. 먼저 알림 권한을 허용해주세요.');
      return;
    }

    try {
      const notification = new Notification('테스트 알림', {
        body: '알림 설정이 올바르게 작동하고 있습니다. 이 알림을 클릭하면 닫힙니다.',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: 'test-notification',
        requireInteraction: true, // 사용자가 직접 닫을 때까지 유지
        silent: false // 소리 재생
      });

      console.log('✅ [NOTIFICATION TEST] 알림 생성 성공:', notification);

      notification.onclick = () => {
        console.log('🖱️ [NOTIFICATION TEST] 알림 클릭됨');
        window.focus();
        notification.close();
      };

      notification.onerror = (error) => {
        console.error('❌ [NOTIFICATION TEST] 알림 오류:', error);
      };

      let showTime: number;

      notification.onshow = () => {
        showTime = Date.now();
        console.log('👁️ [NOTIFICATION TEST] 알림 표시됨', new Date().toISOString());
      };

      notification.onclose = () => {
        const closeTime = Date.now();
        const duration = showTime ? closeTime - showTime : 0;
        console.log('🚪 [NOTIFICATION TEST] 알림 닫힘', {
          closedAt: new Date().toISOString(),
          displayDuration: `${duration}ms`,
          tooFast: duration < 100 ? '⚠️ 너무 빨리 닫힘!' : '✅ 정상'
        });
      };

    } catch (error) {
      console.error('❌ [NOTIFICATION TEST] 알림 생성 실패:', error);
      alert(`알림 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  if (loading || !localSettings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-8">
        {/* 헤더 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">알림 설정</h1>
                <p className="text-xs sm:text-base text-gray-600">개인 알림 환경을 설정합니다</p>
              </div>
            </div>

            <Link
              href="/notifications"
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">알림 목록</span>
              <span className="sm:hidden">목록</span>
            </Link>
          </div>

          {/* 저장 상태 */}
          {saveSuccess && (
            <div className="mt-3 sm:mt-4 flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-green-50 text-green-700 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              설정이 성공적으로 저장되었습니다.
            </div>
          )}
        </div>

        {/* 브라우저 알림 권한 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">브라우저 알림 권한</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2 sm:gap-3 flex-1">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-medium text-gray-900">브라우저 푸시 알림</div>
                <div className="text-xs sm:text-sm text-gray-500">
                  실시간 알림을 받기 위해 브라우저 권한이 필요합니다
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                notificationPermission === 'granted'
                  ? 'bg-green-100 text-green-700'
                  : notificationPermission === 'denied'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {notificationPermission === 'granted' && '허용됨'}
                {notificationPermission === 'denied' && '차단됨'}
                {notificationPermission === 'default' && '미설정'}
              </span>

              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotificationPermission}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  권한 요청
                </button>
              )}

              {notificationPermission === 'granted' && (
                <button
                  onClick={sendTestNotification}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  테스트
                </button>
              )}
            </div>
          </div>

          {notificationPermission === 'denied' && (
            <div className="mt-3 sm:mt-4 flex items-start gap-2 p-3 sm:p-4 text-xs sm:text-sm bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">알림이 차단되었습니다</div>
                <div className="mt-1">
                  브라우저 설정에서 이 사이트의 알림을 허용해주세요.
                  주소창 왼쪽의 자물쇠 아이콘을 클릭하여 설정할 수 있습니다.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 알림 카테고리 설정 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">알림 카테고리 설정</h2>
          <div className="space-y-2 sm:space-y-4">
            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📝
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">업무 관련 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">업무 생성, 수정, 할당, 완료 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.taskNotifications}
                  onChange={(e) => updateSetting('taskNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  🔧
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">시스템 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">시스템 점검, 업데이트 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.systemNotifications}
                  onChange={(e) => updateSetting('systemNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  🚨
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">보안 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">보안 경고, 로그인 시도 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.securityNotifications}
                  onChange={(e) => updateSetting('securityNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📊
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">보고서 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">보고서 제출, 승인 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.reportNotifications}
                  onChange={(e) => updateSetting('reportNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 알림 방식 설정 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">알림 방식 설정</h2>
          <div className="space-y-2 sm:space-y-4">
            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">푸시 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500">브라우저 푸시 알림 표시</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.pushNotificationsEnabled}
                  onChange={(e) => updateSetting('pushNotificationsEnabled', e.target.checked)}
                  disabled={notificationPermission !== 'granted'}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">이메일 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500">중요한 알림을 이메일로 발송</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.emailNotificationsEnabled}
                  onChange={(e) => updateSetting('emailNotificationsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {localSettings.soundNotificationsEnabled ? (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">소리 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500">알림 수신 시 소리 재생</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.soundNotificationsEnabled}
                  onChange={(e) => updateSetting('soundNotificationsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 우선순위 설정 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">우선순위별 알림 설정</h2>
          <div className="space-y-2 sm:space-y-4">
            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">긴급 알림</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">즉시 처리가 필요한 중요한 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showCriticalPriority}
                  onChange={(e) => updateSetting('showCriticalPriority', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">높은 우선순위</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">우선 처리가 필요한 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showHighPriority}
                  onChange={(e) => updateSetting('showHighPriority', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">보통 우선순위</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">일반적인 업무 관련 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showMediumPriority}
                  onChange={(e) => updateSetting('showMediumPriority', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium text-gray-900">낮은 우선순위</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">참고용 정보성 알림</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showLowPriority}
                  onChange={(e) => updateSetting('showLowPriority', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 방해 금지 시간 설정 - 모바일 최적화 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">방해 금지 시간</h2>

          <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-medium text-gray-900">방해 금지 모드</div>
                <div className="text-xs sm:text-sm text-gray-500">지정된 시간에는 긴급 알림만 표시</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={localSettings.quietHoursEnabled}
                onChange={(e) => updateSetting('quietHoursEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {localSettings.quietHoursEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">시작 시간</label>
                <div className="relative">
                  <input
                    type="time"
                    value={localSettings.quietHoursStart}
                    onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Clock className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">종료 시간</label>
                <div className="relative">
                  <input
                    type="time"
                    value={localSettings.quietHoursEnd}
                    onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Clock className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 저장 버튼 - 모바일 최적화 */}
        <div className="sticky bottom-3 sm:bottom-6 bg-white rounded-lg shadow-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              {hasChanges ? '변경사항이 있습니다.' : '모든 변경사항이 저장되었습니다.'}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 flex-1 sm:flex-none"
                >
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  초기화
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="flex items-center justify-center gap-1 sm:gap-2 px-4 sm:px-6 py-1.5 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span className="hidden sm:inline">{saving ? '저장 중...' : '설정 저장'}</span>
                <span className="sm:hidden">{saving ? '저장 중...' : '저장'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(NotificationSettingsPage);