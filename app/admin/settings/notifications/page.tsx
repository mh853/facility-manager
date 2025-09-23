'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  BellRing,
  Settings,
  Save,
  RefreshCw,
  Trash2,
  Check,
  X,
  Info,
  Clock,
  Smartphone,
  Mail,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useOptimizedNotifications } from '@/hooks/useOptimizedNotifications';
import { NotificationSettings } from '@/contexts/NotificationContext';

export default function NotificationSettingsPage() {
  const {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings,
    clearCache,
    isCached,
    lastFetch
  } = useOptimizedNotifications();

  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 로컬 설정 초기화 (깜빡임 방지)
  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
  }, [settings, localSettings]);

  // 변경사항 감지
  useEffect(() => {
    if (settings && localSettings) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings);
      setHasChanges(hasChanges);
    }
  }, [settings, localSettings]);

  // 로컬 설정 업데이트
  const updateLocalSetting = useCallback(<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : null);
  }, []);

  // 설정 저장
  const handleSave = useCallback(async () => {
    if (!localSettings || !hasChanges) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateSettings(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('설정 저장 실패:', error);
    } finally {
      setSaving(false);
    }
  }, [localSettings, hasChanges, updateSettings]);

  // 설정 초기화
  const handleReset = useCallback(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // 캐시 상태 정보
  const cacheInfo = useMemo(() => {
    if (!lastFetch) return null;

    const now = new Date();
    const ageInMinutes = Math.floor((now.getTime() - lastFetch.getTime()) / (1000 * 60));

    return {
      lastFetch,
      ageInMinutes,
      isExpired: ageInMinutes > 30
    };
  }, [lastFetch]);

  // 로딩 상태 - 스켈레톤 UI
  if (loading && !localSettings) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 헤더 스켈레톤 */}
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded animate-pulse mb-2 w-1/3" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>

          {/* 설정 카드 스켈레톤 */}
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-4 w-1/4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
                      <div className="h-6 bg-gray-200 rounded-full animate-pulse w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!localSettings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">설정을 불러올 수 없습니다</h2>
          <p className="text-gray-600 mb-4">알림 설정을 불러오는 중 오류가 발생했습니다.</p>
          <button
            onClick={refreshSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Bell className="w-7 h-7 text-blue-600" />
                알림 설정
              </h1>
              <p className="mt-2 text-gray-600">
                시설 관리 시스템의 알림 및 실시간 업데이트 설정을 관리합니다.
              </p>
            </div>

            {/* 상태 정보 */}
            <div className="text-right space-y-1">
              {cacheInfo && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>
                    {cacheInfo.ageInMinutes < 1
                      ? '방금 업데이트됨'
                      : `${cacheInfo.ageInMinutes}분 전 업데이트`
                    }
                  </span>
                  {isCached && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      캐시됨
                    </span>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>동기화 오류</span>
                </div>
              )}
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                hasChanges && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  저장됨
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  변경사항 저장
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              초기화
            </button>

            <button
              onClick={refreshSettings}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>

            <button
              onClick={clearCache}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              캐시 지우기
            </button>
          </div>
        </div>

        {/* 설정 섹션들 */}
        <div className="space-y-8">
          {/* 알림 카테고리 설정 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-blue-600" />
                알림 카테고리
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                수신할 알림 유형을 선택하세요.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {[
                { key: 'taskNotifications', label: '업무 알림', desc: '새로운 업무, 업무 상태 변경 등' },
                { key: 'systemNotifications', label: '시스템 알림', desc: '시스템 업데이트, 유지보수 등' },
                { key: 'securityNotifications', label: '보안 알림', desc: '로그인 시도, 보안 경고 등' },
                { key: 'reportNotifications', label: '보고서 알림', desc: '보고서 제출, 승인 등' },
                { key: 'userNotifications', label: '사용자 알림', desc: '사용자 생성, 권한 변경 등' },
                { key: 'businessNotifications', label: '사업장 알림', desc: '새 사업장 추가, 정보 변경 등' },
                { key: 'fileNotifications', label: '파일 알림', desc: '파일 업로드, 문서 변경 등' },
                { key: 'maintenanceNotifications', label: '유지보수 알림', desc: '예정된 유지보수, 백업 완료 등' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div>
                    <label className="text-sm font-medium text-gray-900 block">{label}</label>
                    <p className="text-xs text-gray-500 mt-1">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings[key as keyof NotificationSettings] as boolean}
                      onChange={(e) => updateLocalSetting(key as keyof NotificationSettings, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 전달 방식 설정 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-600" />
                전달 방식
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                알림을 받을 방법을 선택하세요.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {[
                {
                  key: 'pushNotificationsEnabled',
                  label: '브라우저 알림',
                  desc: '브라우저에서 즉시 알림을 표시합니다',
                  icon: <Smartphone className="w-4 h-4 text-blue-600" />
                },
                {
                  key: 'emailNotificationsEnabled',
                  label: '이메일 알림',
                  desc: '중요한 알림을 이메일로 발송합니다',
                  icon: <Mail className="w-4 h-4 text-green-600" />
                },
                {
                  key: 'soundNotificationsEnabled',
                  label: '소리 알림',
                  desc: '알림 수신 시 소리를 재생합니다',
                  icon: localSettings.soundNotificationsEnabled ?
                    <Volume2 className="w-4 h-4 text-purple-600" /> :
                    <VolumeX className="w-4 h-4 text-gray-400" />
                },
              ].map(({ key, label, desc, icon }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    {icon}
                    <div>
                      <label className="text-sm font-medium text-gray-900 block">{label}</label>
                      <p className="text-xs text-gray-500 mt-1">{desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings[key as keyof NotificationSettings] as boolean}
                      onChange={(e) => updateLocalSetting(key as keyof NotificationSettings, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 우선순위 필터 설정 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                우선순위 필터
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                표시할 알림의 우선순위를 설정하세요.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {[
                { key: 'showCriticalPriority', label: '긴급', color: 'text-red-600 bg-red-100', desc: '즉시 처리가 필요한 알림' },
                { key: 'showHighPriority', label: '높음', color: 'text-orange-600 bg-orange-100', desc: '중요한 알림' },
                { key: 'showMediumPriority', label: '보통', color: 'text-blue-600 bg-blue-100', desc: '일반적인 알림' },
                { key: 'showLowPriority', label: '낮음', color: 'text-gray-600 bg-gray-100', desc: '정보성 알림' },
              ].map(({ key, label, color, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
                      {label}
                    </span>
                    <div>
                      <label className="text-sm font-medium text-gray-900 block">{label} 우선순위</label>
                      <p className="text-xs text-gray-500 mt-1">{desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings[key as keyof NotificationSettings] as boolean}
                      onChange={(e) => updateLocalSetting(key as keyof NotificationSettings, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 방해 금지 시간 설정 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                방해 금지 시간
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                특정 시간대에는 알림을 받지 않도록 설정할 수 있습니다.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* 방해 금지 활성화 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 block">방해 금지 모드</label>
                  <p className="text-xs text-gray-500 mt-1">설정된 시간 동안 알림을 차단합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.quietHoursEnabled}
                    onChange={(e) => updateLocalSetting('quietHoursEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* 시간 설정 */}
              {localSettings.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시작 시간</label>
                    <input
                      type="time"
                      value={localSettings.quietHoursStart}
                      onChange={(e) => updateLocalSetting('quietHoursStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">종료 시간</label>
                    <input
                      type="time"
                      value={localSettings.quietHoursEnd}
                      onChange={(e) => updateLocalSetting('quietHoursEnd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 변경사항 알림 */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <Info className="w-5 h-5" />
            <span>저장되지 않은 변경사항이 있습니다</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}