'use client';

import { useState, useEffect } from 'react';
import { UserCheck, UserX, Clock, Mail, Building2 } from 'lucide-react';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  social_provider: string;
  social_email: string;
  profile_image_url?: string;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

export default function UserApprovalManager() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingUsers();
    loadDepartments();
  }, []);

  const loadPendingUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/users/approve', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setPendingUsers(result.data);
      } else {
        console.error('승인 대기 목록 로드 실패:', result.error);
      }
    } catch (error) {
      console.error('승인 대기 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/departments?active_only=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('부서 목록 로드 실패:', error);
    }
  };

  const approveUser = async (
    userId: string,
    departmentId: string,
    permissionLevel: number,
    role: string
  ) => {
    try {
      setApprovingUserId(userId);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          department_id: departmentId,
          permission_level: permissionLevel,
          role: role
        })
      });

      const result = await response.json();

      if (result.success) {
        // ✅ 즉시 UI에서 승인된 사용자 제거 (낙관적 업데이트)
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
        alert('사용자가 승인되었습니다.');
        // 백그라운드에서 최신 데이터 로드 (동기화)
        loadPendingUsers();
        return true; // 성공 반환
      } else {
        alert(result.error || '승인 처리에 실패했습니다.');
        return false; // 실패 반환
      }
    } catch (error) {
      console.error('사용자 승인 실패:', error);
      alert('승인 처리에 실패했습니다.');
      return false; // 실패 반환
    } finally {
      setApprovingUserId(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return '🌐';
      case 'kakao':
        return '💬';
      case 'naver':
        return '📘';
      default:
        return '👤';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'kakao':
        return 'Kakao';
      case 'naver':
        return 'Naver';
      default:
        return provider;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <UserCheck className="w-8 h-8 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 승인 관리</h1>
          <p className="text-gray-600">신규 가입한 사용자들의 계정 승인을 관리합니다.</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">승인 대기</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingUsers.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">활성 부서</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <UserCheck className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">오늘 가입</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {pendingUsers.filter(user =>
              new Date(user.created_at).toDateString() === new Date().toDateString()
            ).length}
          </p>
        </div>
      </div>

      {/* 승인 대기 목록 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">승인 대기 목록</h2>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>승인 대기 중인 사용자가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingUsers.map((user) => (
              <UserApprovalCard
                key={user.id}
                user={user}
                departments={departments}
                isApproving={approvingUserId === user.id}
                onApprove={approveUser}
                getProviderIcon={getProviderIcon}
                getProviderName={getProviderName}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 사용자 승인 카드 컴포넌트
function UserApprovalCard({
  user,
  departments,
  isApproving,
  onApprove,
  getProviderIcon,
  getProviderName,
  formatDate
}: {
  user: PendingUser;
  departments: Department[];
  isApproving: boolean;
  onApprove: (userId: string, departmentId: string, permissionLevel: number, role: string) => Promise<boolean>;
  getProviderIcon: (provider: string) => string;
  getProviderName: (provider: string) => string;
  formatDate: (dateString: string) => string;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedPermission, setSelectedPermission] = useState(1);
  const [selectedRole, setSelectedRole] = useState('staff');
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  const handleApprove = async () => {
    if (!selectedDepartment) {
      alert('부서를 선택해주세요.');
      return;
    }

    // ✅ 승인 완료를 기다린 후 폼 닫기
    const success = await onApprove(user.id, selectedDepartment, selectedPermission, selectedRole);
    if (success) {
      setShowApprovalForm(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start gap-4">
        {/* 프로필 이미지 */}
        <div className="flex-shrink-0">
          {user.profile_image_url ? (
            <img
              src={user.profile_image_url}
              alt={user.name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-gray-600">
                {user.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
              <span>{getProviderIcon(user.social_provider)}</span>
              <span>{getProviderName(user.social_provider)}</span>
            </div>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>가입일: {formatDate(user.created_at)}</span>
            </div>
          </div>

          {/* 승인 폼 */}
          {showApprovalForm && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    부서 *
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">부서 선택</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    권한 레벨
                  </label>
                  <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 - 일반 사용자</option>
                    <option value={2}>2 - 팀장</option>
                    <option value={3}>3 - 관리자</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    역할
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">직원</option>
                    <option value="team_leader">팀장</option>
                    <option value="manager">관리자</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleApprove}
                  disabled={isApproving || !selectedDepartment}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm transition-colors"
                >
                  {isApproving ? '승인 중...' : '승인'}
                </button>
                <button
                  onClick={() => setShowApprovalForm(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {!showApprovalForm && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowApprovalForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              승인
            </button>
            <button
              onClick={() => {
                if (confirm(`${user.name}님의 가입 요청을 거부하시겠습니까?`)) {
                  // 거부 로직은 추후 구현
                  console.log('사용자 거부:', user.id);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 text-sm transition-colors"
            >
              <UserX className="w-4 h-4" />
              거부
            </button>
          </div>
        )}
      </div>
    </div>
  );
}