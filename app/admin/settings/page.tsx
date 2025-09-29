'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  Settings,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle,
  Bell,
  Users,
  Building,
  User,
  Sliders
} from 'lucide-react';
import OrganizationManagement from '@/components/admin/OrganizationManagement';

// 탭 타입 정의
type SettingsTab = 'delay-criteria' | 'notifications' | 'organization';

// 지연/위험 기준 타입 정의
interface DelayCriteria {
  self: { delayed: number; risky: number; };
  subsidy: { delayed: number; risky: number; };
  as: { delayed: number; risky: number; };
  etc: { delayed: number; risky: number; };
}

// 기본값
const DEFAULT_CRITERIA: DelayCriteria = {
  self: { delayed: 7, risky: 14 },
  subsidy: { delayed: 14, risky: 20 },
  as: { delayed: 3, risky: 7 },
  etc: { delayed: 7, risky: 10 }
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('delay-criteria');

  // 지연 기준 설정 상태
  const [criteria, setCriteria] = useState<DelayCriteria>(DEFAULT_CRITERIA);
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(true);
  const [isSavingCriteria, setIsSavingCriteria] = useState(false);

  // 알림 설정 상태
  const [notificationStats, setNotificationStats] = useState({
    departments: 0,
    teams: 0,
    notifications: 0,
    user_notifications: 0
  });
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // 공통 메시지 상태
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadCriteria();
    loadNotificationStats();
  }, []);

  // 탭 변경 시 메시지 초기화
  useEffect(() => {
    setMessage({ type: null, text: '' });
  }, [activeTab]);

  // 지연 기준 설정 로드
  const loadCriteria = async () => {
    try {
      setIsLoadingCriteria(true);
      const response = await fetch('/api/settings/delay-criteria');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setCriteria(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load criteria:', error);
    } finally {
      setIsLoadingCriteria(false);
    }
  };

  // 알림 통계 로드
  const loadNotificationStats = async () => {
    try {
      setIsLoadingNotifications(true);
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-migration' })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotificationStats(data.counts);
        }
      }
    } catch (error) {
      console.error('Failed to load notification stats:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // 지연 기준 저장
  const handleSaveCriteria = async () => {
    try {
      setIsSavingCriteria(true);
      setMessage({ type: null, text: '' });

      const response = await fetch('/api/settings/delay-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: '지연/위험 업무 기준이 성공적으로 저장되었습니다.' });
      } else {
        throw new Error(result.message || '저장에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('Failed to save criteria:', error);
      setMessage({ type: 'error', text: error.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSavingCriteria(false);
    }
  };

  // 기본값으로 리셋
  const handleResetCriteria = () => {
    setCriteria(DEFAULT_CRITERIA);
    setMessage({ type: null, text: '' });
  };

  // 업무 타입별 기준 업데이트
  const updateCriteria = (taskType: keyof DelayCriteria, type: 'delayed' | 'risky', value: number) => {
    setCriteria(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        [type]: value
      }
    }));
    setMessage({ type: null, text: '' });
  };

  // 업무 타입 한글명
  const taskTypeLabels = {
    self: '자비 설치',
    subsidy: '보조금',
    as: 'AS',
    etc: '기타'
  };

  // 탭 구성
  const tabs = [
    {
      id: 'delay-criteria' as const,
      name: '지연/위험 기준',
      icon: Sliders,
      description: '업무 타입별 지연 및 위험 판단 기준'
    },
    {
      id: 'notifications' as const,
      name: '알림 관리',
      icon: Bell,
      description: '3-tier 알림 시스템 관리'
    },
    {
      id: 'organization' as const,
      name: '조직 관리',
      icon: Building,
      description: '부서 및 팀 구조 관리'
    }
  ];

  // 탭별 액션 버튼 렌더링
  const renderTabActions = () => {
    if (activeTab === 'delay-criteria') {
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetCriteria}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          >
            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">기본값 리셋</span><span className="sm:hidden">리셋</span>
          </button>
          <button
            type="button"
            onClick={handleSaveCriteria}
            disabled={isSavingCriteria}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 md:px-4 md:py-2 text-[10px] sm:text-xs md:text-sm lg:text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSavingCriteria ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            {isSavingCriteria ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <AdminLayout
      title="관리자 설정"
      description="시설 관리 시스템의 주요 설정을 관리합니다"
      actions={renderTabActions()}
    >
      <div className="max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-1 sm:px-4">

        {/* 알림 메시지 */}
        {message.type && (
          <div className={`mb-3 sm:mb-6 p-2 sm:p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-2 sm:mb-4 md:mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 sm:space-x-4 md:space-x-8 px-1 sm:px-4 md:px-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-1.5 sm:py-3 md:py-4 px-0.5 sm:px-1 border-b-2 font-medium text-[10px] sm:text-sm md:text-base transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-0.5 sm:gap-2">
                      <Icon className="w-3 h-3 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">{tab.name}</span>
                      <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 현재 탭 설명 */}
          <div className="px-1 sm:px-4 md:px-6 py-1.5 sm:py-3 bg-gray-50">
            <p className="text-[10px] sm:text-sm md:text-base text-gray-600">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">

          {/* 지연/위험 기준 설정 탭 */}
          {activeTab === 'delay-criteria' && (
            <div className="p-2 sm:p-6">
              {isLoadingCriteria ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">설정을 불러오는 중...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-6">
                    {Object.entries(taskTypeLabels).map(([taskType, label]) => (
                      <div key={taskType} className="border border-gray-200 rounded-lg p-2 sm:p-4">
                        <h3 className="text-sm sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4 flex items-center gap-1 sm:gap-2">
                          <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                            taskType === 'self' ? 'bg-blue-500' :
                            taskType === 'subsidy' ? 'bg-green-500' :
                            taskType === 'as' ? 'bg-orange-500' :
                            'bg-gray-500'
                          }`} />
                          {label}
                        </h3>

                        <div className="space-y-2 sm:space-y-4">
                          {/* 지연 기준 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-medium text-gray-700">지연 기준</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                value={criteria[taskType as keyof DelayCriteria].delayed}
                                onChange={(e) => updateCriteria(
                                  taskType as keyof DelayCriteria,
                                  'delayed',
                                  parseInt(e.target.value) || 1
                                )}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="text-sm text-gray-600">일</span>
                            </div>
                          </div>

                          {/* 위험 기준 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-medium text-gray-700">위험 기준</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                value={criteria[taskType as keyof DelayCriteria].risky}
                                onChange={(e) => updateCriteria(
                                  taskType as keyof DelayCriteria,
                                  'risky',
                                  parseInt(e.target.value) || 1
                                )}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="text-sm text-gray-600">일</span>
                            </div>
                          </div>

                          {/* 설명 */}
                          <div className="text-xs text-gray-500 mt-2 pl-6">
                            시작일로부터 각각 {criteria[taskType as keyof DelayCriteria].delayed}일, {criteria[taskType as keyof DelayCriteria].risky}일 경과 시 해당 상태로 분류됩니다.
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 안내 사항 */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">📌 설정 안내</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• 지연 기준: 시작일로부터 설정된 일수가 지나면 '지연 업무'로 분류됩니다.</li>
                      <li>• 위험 기준: 시작일로부터 설정된 일수가 지나면 '위험 업무'로 분류됩니다.</li>
                      <li>• 일반적으로 위험 기준은 지연 기준보다 더 큰 값으로 설정합니다.</li>
                      <li>• 설정 변경은 즉시 모든 업무 목록에 반영됩니다.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 알림 관리 탭 */}
          {activeTab === 'notifications' && (
            <div className="p-2 sm:p-6">
              {/* 3-tier 알림 시스템 현황 */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-6 mb-3 sm:mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">부서</p>
                      <p className="text-2xl font-bold text-blue-700">{notificationStats.departments}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">팀</p>
                      <p className="text-2xl font-bold text-green-700">{notificationStats.teams}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-900">알림</p>
                      <p className="text-2xl font-bold text-purple-700">{notificationStats.notifications}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-900">사용자 알림</p>
                      <p className="text-2xl font-bold text-orange-700">{notificationStats.user_notifications}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 알림 관리 기능들 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 알림 생성 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    알림 생성
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    개인, 팀, 전사 알림을 생성하고 관리할 수 있습니다.
                  </p>
                  <button
                    onClick={() => router.push('/admin/notifications')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    알림 관리 페이지 열기
                  </button>
                </div>

                {/* 마이그레이션 도구 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-green-600" />
                    시스템 관리
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    3-tier 알림 시스템의 데이터베이스 상태를 확인하고 관리할 수 있습니다.
                  </p>
                  <button
                    onClick={() => router.push('/admin/migrate')}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    시스템 관리 도구 열기
                  </button>
                </div>
              </div>

              {/* 3-tier 시스템 정보 */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">📢 3-Tier 알림 시스템</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• <strong>개인 알림</strong>: 특정 사용자에게만 전달되는 개인적인 알림</li>
                  <li>• <strong>팀 알림</strong>: 특정 팀 또는 부서 구성원에게 전달되는 그룹 알림</li>
                  <li>• <strong>전사 알림</strong>: 모든 직원에게 전달되는 공지사항 및 중요 알림</li>
                  <li>• 각 알림은 우선순위와 만료일을 설정할 수 있으며, 읽음 상태를 추적합니다.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 조직 관리 탭 */}
          {activeTab === 'organization' && (
            <div className="p-2 sm:p-6">
              <OrganizationManagement />
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}