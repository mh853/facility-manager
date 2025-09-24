'use client';

import React, { useState, useEffect } from 'react';
import {
  Building,
  Users,
  Bell,
  Settings,
  UserPlus,
  ArrowUpDown,
  History,
  TestTube,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';
import InteractiveOrganizationChart from '@/components/admin/InteractiveOrganizationChart';
import {
  organizationRealtimeManager,
  OrganizationChangeNotification,
  NotificationValidator
} from '@/lib/organization/realtime-notifications';

// 타입 정의
interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  position_level: number;
  position_title: string;
  permission_level: number;
  is_active: boolean;
  profile_photo_url?: string;
  hire_date?: string;
  primary_department_id?: string;
  primary_department?: string;
  primary_team_id?: string;
  primary_team?: string;
  team_memberships: any[];
  leadership_role?: string;
  org_management_scope?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  teams?: any[];
  manager_id?: string;
  deputy_manager_id?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  department_id: string;
  leader_id?: string;
  deputy_leader_id?: string;
}

interface TestResult {
  test_name: string;
  status: 'success' | 'failed' | 'pending';
  message: string;
  timestamp: string;
}

// 통합 조직 관리 대시보드
const OrganizationDashboard: React.FC = () => {
  // 상태 관리
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [realtimeNotifications, setRealtimeNotifications] = useState<OrganizationChangeNotification[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [organizationStats, setOrganizationStats] = useState({
    total_employees: 0,
    total_departments: 0,
    total_teams: 0,
    recent_changes: 0,
    pending_notifications: 0
  });

  // 실시간 알림 설정
  useEffect(() => {
    console.log('🚀 조직 관리 대시보드 초기화 시작');

    // 브라우저 알림 권한 요청
    organizationRealtimeManager.requestNotificationPermission();

    // 전체 조직 변경 실시간 구독
    const channel = organizationRealtimeManager.subscribeToOrganizationChanges(
      'all',
      undefined,
      (notification) => {
        console.log('📥 실시간 조직 변경 알림 수신:', notification);
        setRealtimeNotifications(prev => [notification, ...prev.slice(0, 49)]);

        // 통계 업데이트
        setOrganizationStats(prev => ({
          ...prev,
          recent_changes: prev.recent_changes + 1,
          pending_notifications: prev.pending_notifications + 1
        }));
      }
    );

    // 업무 담당자 변경도 구독
    const taskChannel = organizationRealtimeManager.subscribeToTaskAssignmentChanges(
      undefined,
      undefined,
      (notification) => {
        console.log('📥 업무 담당자 변경 알림 수신:', notification);
        setRealtimeNotifications(prev => [notification, ...prev.slice(0, 49)]);
      }
    );

    setIsRealtimeConnected(true);

    // 초기 통계 로드
    loadOrganizationStats();

    return () => {
      organizationRealtimeManager.unsubscribe();
      setIsRealtimeConnected(false);
      console.log('📪 실시간 구독 해제 완료');
    };
  }, []);

  // 조직 통계 로드
  const loadOrganizationStats = async () => {
    try {
      const [membersResponse, deptResponse] = await Promise.all([
        fetch('/api/organization/members?include_all=true'),
        fetch('/api/organization/departments')
      ]);

      const [membersData, deptData] = await Promise.all([
        membersResponse.json(),
        deptResponse.json()
      ]);

      if (membersData.success && deptData.success) {
        const totalTeams = (deptData.data || []).reduce((acc: number, dept: any) =>
          acc + (dept.teams?.length || 0), 0
        );

        setOrganizationStats({
          total_employees: membersData.data?.length || 0,
          total_departments: deptData.data?.length || 0,
          total_teams: totalTeams,
          recent_changes: 0,
          pending_notifications: 0
        });
      }
    } catch (error) {
      console.error('조직 통계 로드 오류:', error);
    }
  };

  // 테스트 모드 실행
  const runSystemTests = async () => {
    setIsTestMode(true);
    setTestResults([]);

    const tests = [
      {
        name: '실시간 연결 테스트',
        fn: () => NotificationValidator.testRealtimeConnection()
      },
      {
        name: '알림 발송 테스트',
        fn: () => NotificationValidator.testNotificationDelivery(
          'team_join',
          'test-employee-id'
        )
      },
      {
        name: '알림 전달 검증',
        fn: () => NotificationValidator.validateNotificationDelivery(
          new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간 전
          new Date()
        ).then(result => result.success_rate > 90)
      }
    ];

    for (const test of tests) {
      const startTime = new Date().toISOString();
      setTestResults(prev => [...prev, {
        test_name: test.name,
        status: 'pending',
        message: '테스트 실행 중...',
        timestamp: startTime
      }]);

      try {
        const success = await test.fn();
        setTestResults(prev => prev.map(result =>
          result.test_name === test.name
            ? {
                ...result,
                status: success ? 'success' : 'failed',
                message: success ? '테스트 성공' : '테스트 실패',
                timestamp: new Date().toISOString()
              }
            : result
        ));
      } catch (error) {
        setTestResults(prev => prev.map(result =>
          result.test_name === test.name
            ? {
                ...result,
                status: 'failed',
                message: `테스트 오류: ${error}`,
                timestamp: new Date().toISOString()
              }
            : result
        ));
      }
    }

    setIsTestMode(false);
  };

  // 알림 지우기
  const clearNotifications = () => {
    setRealtimeNotifications([]);
    setOrganizationStats(prev => ({
      ...prev,
      pending_notifications: 0
    }));
  };

  // 이벤트 핸들러들
  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSelectedTeam(null);
    setSelectedDepartment(null);
  };

  const handleTeamSelect = (team: Team, members: Employee[]) => {
    setSelectedTeam(team);
    setSelectedEmployee(null);
    setSelectedDepartment(null);
  };

  const handleDepartmentSelect = (department: Department, members: Employee[]) => {
    setSelectedDepartment(department);
    setSelectedEmployee(null);
    setSelectedTeam(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">통합 조직 관리</h1>
                <p className="text-sm text-gray-600">실시간 조직도 및 알림 관리</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* 실시간 상태 표시 */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isRealtimeConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                <Activity className={`w-4 h-4 ${isRealtimeConnected ? 'animate-pulse' : ''}`} />
                {isRealtimeConnected ? '실시간 연결됨' : '연결 끊김'}
              </div>

              {/* 알림 토글 */}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg transition-colors ${
                  showNotifications
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={showNotifications ? '알림 숨기기' : '알림 보기'}
              >
                {showNotifications ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>

              {/* 테스트 모드 */}
              <button
                onClick={runSystemTests}
                disabled={isTestMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isTestMode
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                }`}
              >
                <TestTube className={`w-4 h-4 ${isTestMode ? 'animate-spin' : ''}`} />
                {isTestMode ? '테스트 중...' : '시스템 테스트'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 대시보드 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 직원</p>
                <p className="text-3xl font-bold text-gray-900">{organizationStats.total_employees}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">부서</p>
                <p className="text-3xl font-bold text-gray-900">{organizationStats.total_departments}</p>
              </div>
              <Building className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">팀</p>
                <p className="text-3xl font-bold text-gray-900">{organizationStats.total_teams}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최근 변경</p>
                <p className="text-3xl font-bold text-gray-900">{organizationStats.recent_changes}</p>
              </div>
              <ArrowUpDown className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">실시간 알림</p>
                <p className="text-3xl font-bold text-gray-900">{organizationStats.pending_notifications}</p>
              </div>
              <Bell className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 대화형 조직도 */}
          <div className="lg:col-span-2">
            <InteractiveOrganizationChart
              onEmployeeSelect={handleEmployeeSelect}
              onTeamSelect={handleTeamSelect}
              onDepartmentSelect={handleDepartmentSelect}
              selectedEmployeeId={selectedEmployee?.id}
              showNotifications={showNotifications}
            />
          </div>

          {/* 사이드 패널 */}
          <div className="space-y-6">
            {/* 선택된 항목 상세 정보 */}
            {selectedEmployee && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  직원 상세 정보
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">이름</p>
                    <p className="text-gray-900">{selectedEmployee.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">직급</p>
                    <p className="text-gray-900">{selectedEmployee.position_title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">소속</p>
                    <p className="text-gray-900">
                      {selectedEmployee.primary_department} • {selectedEmployee.primary_team}
                    </p>
                  </div>
                  {selectedEmployee.leadership_role && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">역할</p>
                      <p className="text-blue-600 font-medium">{selectedEmployee.leadership_role}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 실시간 알림 패널 */}
            {showNotifications && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    실시간 알림
                    {realtimeNotifications.length > 0 && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                        {realtimeNotifications.length}
                      </span>
                    )}
                  </h3>
                  {realtimeNotifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      모두 지우기
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {realtimeNotifications.length > 0 ? (
                    realtimeNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">
                              {notification.employee?.name}님 조직 변경
                            </p>
                            <p className="text-xs text-blue-700">
                              {notification.change_type} • {notification.changer?.name}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {new Date(notification.changed_at).toLocaleString('ko-KR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">실시간 알림이 없습니다.</p>
                      <p className="text-sm text-gray-400">
                        조직 변경 시 여기에 표시됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 테스트 결과 패널 */}
            {testResults.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  시스템 테스트 결과
                </h3>
                <div className="space-y-3">
                  {testResults.map((result) => (
                    <div
                      key={result.test_name}
                      className={`p-3 rounded-lg border ${
                        result.status === 'success'
                          ? 'bg-green-50 border-green-200'
                          : result.status === 'failed'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                        {result.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                        {result.status === 'pending' && <Clock className="w-4 h-4 text-yellow-600 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{result.test_name}</p>
                          <p className="text-xs text-gray-600">{result.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationDashboard;