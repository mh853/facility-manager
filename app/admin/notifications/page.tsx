'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Send, Users, User, Building, Filter, Search, Calendar, Trash2, Eye, BarChart3 } from 'lucide-react';
import AdminLayout from '@/components/ui/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { TierNotificationProvider, useTierNotifications, CreateTierNotificationRequest, NotificationTier } from '@/contexts/TierNotificationContext';

function NotificationManagementContent() {
  const { user } = useAuth();
  const { createNotification, refreshNotifications, notifications } = useTierNotifications();

  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'analytics'>('create');
  const [isLoading, setIsLoading] = useState(false);

  // 알림 생성 폼 상태
  const [createForm, setCreateForm] = useState<CreateTierNotificationRequest>({
    title: '',
    message: '',
    category: 'general',
    priority: 'medium',
    notification_tier: 'company',
    target_user_id: '',
    target_team_id: undefined,
    target_department_id: undefined,
    related_resource_type: '',
    related_resource_id: '',
    related_url: '',
    expires_at: '',
    metadata: {}
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    tier: 'all' as 'all' | NotificationTier,
    priority: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
    category: 'all',
    search: ''
  });

  // 사용자 및 팀 목록 (실제 구현에서는 API에서 가져와야 함)
  const [users, setUsers] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [teams, setTeams] = useState<Array<{id: number; name: string; department_name: string}>>([]);
  const [departments, setDepartments] = useState<Array<{id: number; name: string}>>([]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 실제 구현에서는 API를 통해 데이터를 가져와야 함
      setUsers([
        { id: '1', name: '김철수', email: 'kim@company.com' },
        { id: '2', name: '이영희', email: 'lee@company.com' },
        { id: '3', name: '박민수', email: 'park@company.com' }
      ]);

      setTeams([
        { id: 1, name: '프론트엔드팀', department_name: '개발팀' },
        { id: 2, name: '백엔드팀', department_name: '개발팀' },
        { id: 3, name: 'QA팀', department_name: '개발팀' }
      ]);

      setDepartments([
        { id: 1, name: '개발팀' },
        { id: 2, name: '영업팀' },
        { id: 3, name: '관리팀' }
      ]);

      await refreshNotifications();
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
    }
  };

  // 알림 생성 처리
  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 유효성 검사
      if (!createForm.title.trim() || !createForm.message.trim()) {
        alert('제목과 메시지를 입력해주세요.');
        return;
      }

      if (createForm.notification_tier === 'personal' && !createForm.target_user_id) {
        alert('개인 알림은 대상 사용자를 선택해야 합니다.');
        return;
      }

      if (createForm.notification_tier === 'team' && !createForm.target_team_id && !createForm.target_department_id) {
        alert('팀 알림은 대상 팀 또는 부서를 선택해야 합니다.');
        return;
      }

      await createNotification(createForm);

      // 폼 초기화
      setCreateForm({
        title: '',
        message: '',
        category: 'general',
        priority: 'medium',
        notification_tier: 'company',
        target_user_id: '',
        target_team_id: undefined,
        target_department_id: undefined,
        related_resource_type: '',
        related_resource_id: '',
        related_url: '',
        expires_at: '',
        metadata: {}
      });

      alert('알림이 성공적으로 생성되었습니다.');
    } catch (error) {
      console.error('알림 생성 실패:', error);
      alert('알림 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 필터링된 알림 목록
  const filteredNotifications = notifications.filter(notification => {
    if (filters.tier !== 'all' && notification.tier !== filters.tier) return false;
    if (filters.priority !== 'all' && notification.priority !== filters.priority) return false;
    if (filters.category !== 'all' && notification.category !== filters.category) return false;
    if (filters.search && !notification.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !notification.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // 통계 계산
  const stats = {
    total: notifications.length,
    byTier: {
      personal: notifications.filter(n => n.tier === 'personal').length,
      team: notifications.filter(n => n.tier === 'team').length,
      company: notifications.filter(n => n.tier === 'company').length
    },
    byPriority: {
      critical: notifications.filter(n => n.priority === 'critical').length,
      high: notifications.filter(n => n.priority === 'high').length,
      medium: notifications.filter(n => n.priority === 'medium').length,
      low: notifications.filter(n => n.priority === 'low').length
    },
    unread: notifications.filter(n => !n.isRead).length
  };

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'create'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>알림 생성</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>알림 관리</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>통계</span>
            </div>
          </button>
        </nav>
      </div>

      {/* 알림 생성 탭 */}
      {activeTab === 'create' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">새 알림 생성</h2>

          <form onSubmit={handleCreateNotification} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="알림 제목을 입력하세요"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">일반</option>
                  <option value="system">시스템</option>
                  <option value="maintenance">점검</option>
                  <option value="security">보안</option>
                  <option value="task">업무</option>
                  <option value="announcement">공지사항</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메시지 *
              </label>
              <textarea
                value={createForm.message}
                onChange={(e) => setCreateForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="알림 내용을 입력하세요"
                required
              />
            </div>

            {/* 계층 및 우선순위 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  알림 계층 *
                </label>
                <select
                  value={createForm.notification_tier}
                  onChange={(e) => setCreateForm(prev => ({
                    ...prev,
                    notification_tier: e.target.value as NotificationTier,
                    target_user_id: '',
                    target_team_id: undefined,
                    target_department_id: undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="personal">개인 알림</option>
                  <option value="team">팀 알림</option>
                  <option value="company">전사 알림</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  우선순위
                </label>
                <select
                  value={createForm.priority}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                  <option value="critical">긴급</option>
                </select>
              </div>
            </div>

            {/* 대상 선택 */}
            {createForm.notification_tier === 'personal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  대상 사용자 *
                </label>
                <select
                  value={createForm.target_user_id}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, target_user_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">사용자를 선택하세요</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createForm.notification_tier === 'team' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    대상 팀
                  </label>
                  <select
                    value={createForm.target_team_id || ''}
                    onChange={(e) => setCreateForm(prev => ({
                      ...prev,
                      target_team_id: e.target.value ? parseInt(e.target.value) : undefined,
                      target_department_id: undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">팀을 선택하세요</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.department_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    또는 대상 부서
                  </label>
                  <select
                    value={createForm.target_department_id || ''}
                    onChange={(e) => setCreateForm(prev => ({
                      ...prev,
                      target_department_id: e.target.value ? parseInt(e.target.value) : undefined,
                      target_team_id: undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">부서를 선택하세요</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 추가 옵션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관련 URL
                </label>
                <input
                  type="url"
                  value={createForm.related_url}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, related_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  만료 일시
                </label>
                <input
                  type="datetime-local"
                  value={createForm.expires_at}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 전송 버튼 */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{isLoading ? '전송 중...' : '알림 전송'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 알림 관리 탭 */}
      {activeTab === 'manage' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">알림 관리</h2>
            <button
              onClick={refreshNotifications}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <span>새로고침</span>
            </button>
          </div>

          {/* 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계층</label>
              <select
                value={filters.tier}
                onChange={(e) => setFilters(prev => ({ ...prev, tier: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">모든 계층</option>
                <option value="personal">개인</option>
                <option value="team">팀</option>
                <option value="company">전사</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">모든 우선순위</option>
                <option value="critical">긴급</option>
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">모든 카테고리</option>
                <option value="general">일반</option>
                <option value="system">시스템</option>
                <option value="maintenance">점검</option>
                <option value="security">보안</option>
                <option value="task">업무</option>
                <option value="announcement">공지사항</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="제목, 내용 검색"
                />
              </div>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="space-y-4">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map(notification => (
                <div key={notification.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium text-gray-900">{notification.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          notification.tier === 'personal' ? 'bg-blue-100 text-blue-800' :
                          notification.tier === 'team' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {notification.tier === 'personal' ? '개인' : notification.tier === 'team' ? '팀' : '전사'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          notification.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          notification.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {notification.priority}
                        </span>
                        {!notification.isRead && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            읽지 않음
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>생성: {new Date(notification.createdAt).toLocaleString('ko-KR')}</span>
                        {notification.createdByName && <span>생성자: {notification.createdByName}</span>}
                        <span>카테고리: {notification.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                필터 조건에 맞는 알림이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 통계 탭 */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* 전체 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체 알림</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">개인 알림</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.byTier.personal}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">팀 알림</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.byTier.team}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Building className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전사 알림</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.byTier.company}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* 우선순위별 통계 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">우선순위별 분포</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.byPriority.critical}</div>
                <div className="text-sm text-gray-500">긴급</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.byPriority.high}</div>
                <div className="text-sm text-gray-500">높음</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.byPriority.medium}</div>
                <div className="text-sm text-gray-500">보통</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.byPriority.low}</div>
                <div className="text-sm text-gray-500">낮음</div>
              </div>
            </div>
          </div>

          {/* 읽음 상태 통계 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">읽음 상태</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{stats.unread}</div>
                <div className="text-sm text-gray-500">읽지 않음</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.total - stats.unread}</div>
                <div className="text-sm text-gray-500">읽음</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationManagementPage() {
  return (
    <TierNotificationProvider>
      <AdminLayout
        title="알림 관리"
        description="3-tier 알림 시스템 관리 - 개인, 팀, 전사 알림 생성 및 관리"
      >
        <NotificationManagementContent />
      </AdminLayout>
    </TierNotificationProvider>
  );
}