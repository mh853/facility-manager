'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building,
  Users,
  ChevronDown,
  ChevronRight,
  Star,
  Crown,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Bell,
  UserPlus,
  Settings,
  Eye,
  ChevronUp
} from 'lucide-react';

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
  team_memberships: TeamMembership[];
  leadership_role?: string;
  org_management_scope?: string;
}

interface TeamMembership {
  team_id: string;
  team_name: string;
  department_id: string;
  department_name: string;
  is_primary: boolean;
  role_in_team: string;
  joined_at: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  teams?: Team[];
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

interface NotificationCount {
  [key: string]: number;
}

interface InteractiveOrganizationChartProps {
  onEmployeeSelect?: (employee: Employee) => void;
  onTeamSelect?: (team: Team, members: Employee[]) => void;
  onDepartmentSelect?: (department: Department, members: Employee[]) => void;
  selectedEmployeeId?: string | null;
  showNotifications?: boolean;
}

// 구성원 미니 프로필 컴포넌트
const MemberMiniProfile: React.FC<{
  employee: Employee;
  onClick: () => void;
  isSelected: boolean;
  notificationCount?: number;
}> = ({ employee, onClick, isSelected, notificationCount = 0 }) => {
  const getPositionColor = (level: number) => {
    if (level >= 7) return 'from-purple-500 to-purple-600 border-purple-400';
    if (level >= 5) return 'from-blue-600 to-blue-700 border-blue-500';
    if (level >= 3) return 'from-green-500 to-green-600 border-green-400';
    return 'from-gray-500 to-gray-600 border-gray-400';
  };

  const getLeadershipIcon = (role?: string) => {
    switch (role) {
      case '부서장': return <Crown className="w-4 h-4 text-yellow-500" />;
      case '부서장 대리': return <Crown className="w-3 h-3 text-yellow-400" />;
      case '팀장': return <Star className="w-4 h-4 text-orange-500" />;
      case '팀장 대리': return <Star className="w-3 h-3 text-orange-400" />;
      default: return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-gradient-to-r ${getPositionColor(employee.position_level)}
        text-white px-4 py-3 rounded-lg shadow-md cursor-pointer
        hover:shadow-lg transition-all duration-300 transform hover:scale-105
        ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-blue-500' : ''}
        min-w-[180px] max-w-[220px]
      `}
    >
      {/* 알림 뱃지 */}
      {notificationCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
          {notificationCount > 99 ? '99+' : notificationCount}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 프로필 이미지 */}
        <div className="relative">
          {employee.profile_photo_url ? (
            <img
              src={employee.profile_photo_url}
              alt={employee.name}
              className="w-10 h-10 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-sm font-bold">
                {employee.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* 리더십 아이콘 */}
          {employee.leadership_role && (
            <div className="absolute -top-1 -right-1">
              {getLeadershipIcon(employee.leadership_role)}
            </div>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{employee.name}</div>
          <div className="text-xs opacity-90 truncate">
            {employee.position_title}
          </div>
          {employee.primary_team && (
            <div className="text-xs opacity-80 truncate">
              {employee.primary_team}
            </div>
          )}
        </div>
      </div>

      {/* 호버 시 추가 정보 */}
      <div className="mt-2 text-xs opacity-90 flex items-center gap-2">
        <Mail className="w-3 h-3" />
        <span className="truncate">{employee.email}</span>
      </div>

      {/* 다중 팀 소속 표시 */}
      {employee.team_memberships.length > 1 && (
        <div className="mt-1 text-xs opacity-80">
          <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full">
            {employee.team_memberships.length}개 팀 소속
          </span>
        </div>
      )}
    </div>
  );
};

// 팀 노드 컴포넌트
const TeamNode: React.FC<{
  team: Team;
  members: Employee[];
  isExpanded: boolean;
  onToggle: () => void;
  onTeamClick: () => void;
  onMemberClick: (member: Employee) => void;
  selectedEmployeeId?: string | null;
  notificationCounts: NotificationCount;
}> = ({
  team,
  members,
  isExpanded,
  onToggle,
  onTeamClick,
  onMemberClick,
  selectedEmployeeId,
  notificationCounts
}) => {
  const leader = members.find(m => m.leadership_role === '팀장');
  const deputy = members.find(m => m.leadership_role === '팀장 대리');
  const teamNotifications = notificationCounts[`team_${team.id}`] || 0;

  return (
    <div className="flex flex-col items-center">
      {/* 팀 박스 */}
      <div className="relative">
        <div
          className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 min-w-[200px] text-center border border-green-400"
          onClick={onTeamClick}
        >
          {/* 알림 뱃지 */}
          {teamNotifications > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {teamNotifications > 99 ? '99+' : teamNotifications}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-5 h-5" />
            <span className="font-semibold text-lg">{team.name}</span>
          </div>

          {/* 팀 정보 */}
          <div className="text-sm opacity-90 mb-2">
            구성원 {members.length}명
          </div>

          {/* 팀장 정보 */}
          {leader && (
            <div className="text-xs opacity-80 flex items-center justify-center gap-1">
              <Star className="w-3 h-3" />
              <span>팀장: {leader.name}</span>
            </div>
          )}

          {/* 확장/축소 버튼 */}
          {members.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white text-green-600 rounded-full p-1 shadow-md hover:bg-green-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 팀 구성원들 */}
      {isExpanded && members.length > 0 && (
        <div className="flex flex-col items-center mt-6">
          {/* 연결선 */}
          <div className="w-0.5 h-6 bg-gray-300"></div>

          {/* 구성원 그리드 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col items-center">
                {/* 구성원으로의 연결선 */}
                <div className="w-0.5 h-4 bg-gray-300"></div>

                <MemberMiniProfile
                  employee={member}
                  onClick={() => onMemberClick(member)}
                  isSelected={selectedEmployeeId === member.id}
                  notificationCount={notificationCounts[`user_${member.id}`] || 0}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 부서 노드 컴포넌트
const DepartmentNode: React.FC<{
  department: Department;
  members: Employee[];
  isExpanded: boolean;
  onToggle: () => void;
  onDepartmentClick: () => void;
  onTeamClick: (team: Team, teamMembers: Employee[]) => void;
  onMemberClick: (member: Employee) => void;
  selectedEmployeeId?: string | null;
  expandedTeams: Set<string>;
  onTeamToggle: (teamId: string) => void;
  notificationCounts: NotificationCount;
}> = ({
  department,
  members,
  isExpanded,
  onToggle,
  onDepartmentClick,
  onTeamClick,
  onMemberClick,
  selectedEmployeeId,
  expandedTeams,
  onTeamToggle,
  notificationCounts
}) => {
  const manager = members.find(m => m.leadership_role === '부서장');
  const deputy = members.find(m => m.leadership_role === '부서장 대리');
  const deptNotifications = notificationCounts[`dept_${department.id}`] || 0;

  // 팀별 구성원 그룹화
  const teamMemberMap = new Map<string, Employee[]>();
  members.forEach(member => {
    member.team_memberships.forEach(membership => {
      if (membership.department_id === department.id) {
        if (!teamMemberMap.has(membership.team_id)) {
          teamMemberMap.set(membership.team_id, []);
        }
        teamMemberMap.get(membership.team_id)!.push(member);
      }
    });
  });

  return (
    <div className="flex flex-col items-center">
      {/* 부서 박스 */}
      <div className="relative">
        <div
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-5 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 min-w-[250px] text-center border border-blue-500"
          onClick={onDepartmentClick}
        >
          {/* 알림 뱃지 */}
          {deptNotifications > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {deptNotifications > 99 ? '99+' : deptNotifications}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mb-3">
            <Building className="w-6 h-6" />
            <span className="font-bold text-xl">{department.name}</span>
          </div>

          {/* 부서 통계 */}
          <div className="grid grid-cols-2 gap-4 text-sm opacity-90 mb-3">
            <div>
              <div className="font-medium">구성원</div>
              <div className="text-lg font-bold">{members.length}명</div>
            </div>
            <div>
              <div className="font-medium">팀</div>
              <div className="text-lg font-bold">{department.teams?.length || 0}개</div>
            </div>
          </div>

          {/* 부서장 정보 */}
          {manager && (
            <div className="text-xs opacity-80 flex items-center justify-center gap-1 mb-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>부서장: {manager.name}</span>
            </div>
          )}

          {/* 확장/축소 버튼 */}
          {department.teams && department.teams.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white text-blue-600 rounded-full p-2 shadow-md hover:bg-blue-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 하위 팀들 */}
      {isExpanded && department.teams && department.teams.length > 0 && (
        <div className="flex flex-col items-center mt-8">
          {/* 연결선 */}
          <div className="w-0.5 h-8 bg-gray-300"></div>

          {/* 수평선 */}
          {department.teams.length > 1 && (
            <div className="relative mb-6 w-full max-w-4xl">
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gray-300"></div>
            </div>
          )}

          {/* 팀들 */}
          <div className="flex flex-wrap justify-center gap-8 max-w-6xl">
            {department.teams.map((team) => {
              const teamMembers = teamMemberMap.get(team.id) || [];
              return (
                <div key={team.id} className="flex flex-col items-center">
                  {/* 팀으로의 연결선 */}
                  <div className="w-0.5 h-6 bg-gray-300"></div>

                  <TeamNode
                    team={team}
                    members={teamMembers}
                    isExpanded={expandedTeams.has(team.id)}
                    onToggle={() => onTeamToggle(team.id)}
                    onTeamClick={() => onTeamClick(team, teamMembers)}
                    onMemberClick={onMemberClick}
                    selectedEmployeeId={selectedEmployeeId}
                    notificationCounts={notificationCounts}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// 메인 대화형 조직도 컴포넌트
const InteractiveOrganizationChart: React.FC<InteractiveOrganizationChartProps> = ({
  onEmployeeSelect,
  onTeamSelect,
  onDepartmentSelect,
  selectedEmployeeId = null,
  showNotifications = true
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [notificationCounts, setNotificationCounts] = useState<NotificationCount>({});

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 부서 정보와 구성원 정보를 병렬로 로드
      const [deptResponse, membersResponse] = await Promise.all([
        fetch('/api/organization/departments'),
        fetch('/api/organization/members?include_all=true')
      ]);

      const [deptData, membersData] = await Promise.all([
        deptResponse.json(),
        membersResponse.json()
      ]);

      if (deptData.success) {
        setDepartments(deptData.data || []);
        // 기본적으로 모든 부서를 펼친 상태로 표시
        const allDeptIds = new Set((deptData.data || []).map((dept: Department) => dept.id));
        setExpandedDepts(allDeptIds);
      }

      if (membersData.success) {
        setMembers(membersData.data || []);
      }

      // 알림 개수 로드 (선택사항)
      if (showNotifications) {
        await loadNotificationCounts();
      }

    } catch (error) {
      console.error('조직도 데이터 로드 오류:', error);
      setError('조직도 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [showNotifications]);

  // 알림 개수 로드
  const loadNotificationCounts = async () => {
    try {
      // 실제 알림 API 호출 (구현 시)
      // const response = await fetch('/api/notifications/counts');
      // const data = await response.json();
      // setNotificationCounts(data.counts || {});

      // 임시 데모 데이터
      setNotificationCounts({
        'dept_1': 3,
        'team_1': 2,
        'team_2': 1,
        'user_1': 5,
        'user_2': 1
      });
    } catch (error) {
      console.error('알림 개수 로드 오류:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 이벤트 핸들러들
  const handleDepartmentToggle = (deptId: string) => {
    setExpandedDepts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
        // 부서를 축소할 때 하위 팀들도 축소
        departments.find(d => d.id === deptId)?.teams?.forEach(team => {
          setExpandedTeams(prev => {
            const teamSet = new Set(prev);
            teamSet.delete(team.id);
            return teamSet;
          });
        });
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  const handleTeamToggle = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const handleDepartmentClick = (department: Department) => {
    const deptMembers = members.filter(m => m.primary_department_id === department.id);
    onDepartmentSelect?.(department, deptMembers);
  };

  const handleTeamClick = (team: Team, teamMembers: Employee[]) => {
    onTeamSelect?.(team, teamMembers);
  };

  const handleMemberClick = (employee: Employee) => {
    onEmployeeSelect?.(employee);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">대화형 조직도를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">대화형 조직도</h2>
              <p className="text-sm text-gray-600">
                {departments.length}개 부서, {members.length}명 구성원
              </p>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span>부서장</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-orange-500" />
              <span>팀장</span>
            </div>
            {showNotifications && (
              <div className="flex items-center gap-1">
                <Bell className="w-4 h-4 text-red-500" />
                <span>알림</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 조직도 */}
      <div className="p-8 overflow-x-auto">
        {departments.length > 0 ? (
          <div className="flex flex-col items-center">
            {/* 회사명 (최상위) */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-6 rounded-xl shadow-lg text-center border border-indigo-500">
                <div className="flex items-center justify-center gap-3">
                  <Building className="w-7 h-7" />
                  <span className="font-bold text-2xl">주식회사 블루온</span>
                </div>
                <div className="text-sm mt-2 opacity-90">시설 관리 시스템</div>
                <div className="text-xs mt-1 opacity-80">
                  전체 {members.length}명 • {departments.length}개 부서
                </div>
              </div>
            </div>

            {/* 연결선 */}
            <div className="w-0.5 h-8 bg-gray-300 mb-8"></div>

            {/* 부서들을 위한 수평선 */}
            {departments.length > 1 && (
              <div className="relative mb-8 w-full max-w-4xl">
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gray-300"></div>
              </div>
            )}

            {/* 부서들 */}
            <div className="flex flex-wrap justify-center gap-16 max-w-full">
              {departments.map((department) => {
                const deptMembers = members.filter(m => m.primary_department_id === department.id);
                return (
                  <DepartmentNode
                    key={department.id}
                    department={department}
                    members={deptMembers}
                    isExpanded={expandedDepts.has(department.id)}
                    onToggle={() => handleDepartmentToggle(department.id)}
                    onDepartmentClick={() => handleDepartmentClick(department)}
                    onTeamClick={handleTeamClick}
                    onMemberClick={handleMemberClick}
                    selectedEmployeeId={selectedEmployeeId}
                    expandedTeams={expandedTeams}
                    onTeamToggle={handleTeamToggle}
                    notificationCounts={notificationCounts}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Building className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">조직 정보가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-2">
              조직 관리에서 부서와 팀을 추가해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveOrganizationChart;