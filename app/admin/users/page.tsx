'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Edit,
  Trash2,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  User,
  Eye,
  EyeOff
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  department?: string;
  position?: string;
  permission_level: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  last_login_at?: string;
  password_changed_at?: string;
}

interface SocialApproval {
  id: string;
  provider: 'kakao' | 'naver' | 'google';
  requester_name: string;
  requester_email: string;
  email_domain: string;
  requested_permission_level: number;
  requested_department: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at: string | null;
  approved_by: string | null;
  approval_reason: string | null;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  // 관리자 권한 체크
  useEffect(() => {
    if (user && user.permission_level !== 3) {
      router.push('/admin');
      return;
    }
  }, [user, router]);

  const [activeTab, setActiveTab] = useState<'users' | 'approvals'>('users');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [socialApprovals, setSocialApprovals] = useState<SocialApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // 사용자 편집 모달
  const [editingUser, setEditingUser] = useState<Employee | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // 비밀번호 재설정 모달
  const [resetPasswordUser, setResetPasswordUser] = useState<Employee | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user || user.permission_level !== 3) return;

    try {
      setLoading(true);
      await Promise.all([loadEmployees(), loadSocialApprovals()]);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch('/api/admin/employees', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEmployees(data.data.employees || []);
        }
      } else {
        console.warn('직원 목록 로드 실패');
        setEmployees([]);
      }
    } catch (error) {
      console.error('직원 목록 로드 오류:', error);
      setEmployees([]);
    }
  };

  const loadSocialApprovals = async () => {
    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch('/api/admin/social-approvals?status=pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSocialApprovals(data.data.approvals || []);
        }
      } else {
        setSocialApprovals([]);
      }
    } catch (error) {
      console.error('승인 요청 로드 오류:', error);
      setSocialApprovals([]);
    }
  };

  const handleUserEdit = async (userData: Partial<Employee>) => {
    if (!editingUser) return;

    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch(`/api/admin/employees/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await loadEmployees();
          setShowEditModal(false);
          setEditingUser(null);
          alert('사용자 정보가 성공적으로 업데이트되었습니다.');
        }
      } else {
        throw new Error('사용자 업데이트 실패');
      }
    } catch (error) {
      console.error('사용자 업데이트 오류:', error);
      alert('사용자 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handlePasswordReset = async () => {
    if (!resetPasswordUser || !newPassword) return;

    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch(`/api/admin/employees/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowPasswordModal(false);
          setResetPasswordUser(null);
          setNewPassword('');
          alert('비밀번호가 성공적으로 재설정되었습니다.');
        }
      } else {
        throw new Error('비밀번호 재설정 실패');
      }
    } catch (error) {
      console.error('비밀번호 재설정 오류:', error);
      alert('비밀번호 재설정 중 오류가 발생했습니다.');
    }
  };

  const handleUserToggle = async (userId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch(`/api/admin/employees/${userId}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      });

      if (response.ok) {
        await loadEmployees();
        alert(`사용자가 ${isActive ? '활성화' : '비활성화'}되었습니다.`);
      }
    } catch (error) {
      console.error('사용자 상태 변경 오류:', error);
      alert('사용자 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleApprovalAction = async (approvalId: string, action: 'approved' | 'rejected', reason?: string) => {
    try {
      const token = localStorage.getItem('facility_manager_token');
      const response = await fetch('/api/admin/social-approvals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approvalId, action, reason })
      });

      if (response.ok) {
        await loadSocialApprovals();
        alert(`승인 요청이 ${action === 'approved' ? '승인' : '거부'}되었습니다.`);
      }
    } catch (error) {
      console.error('승인 처리 오류:', error);
      alert('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const getPermissionLabel = (level: number) => {
    switch (level) {
      case 3: return { text: '관리자', color: 'text-red-600 bg-red-50 border-red-200' };
      case 2: return { text: '매니저', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 1: return { text: '일반사용자', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      default: return { text: '사용자', color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'kakao': return '카카오';
      case 'naver': return '네이버';
      case 'google': return '구글';
      default: return provider;
    }
  };

  // 필터링된 사용자 목록
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPermission = permissionFilter === 'all' || emp.permission_level === permissionFilter;

    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && emp.is_active && !emp.is_deleted) ||
                         (statusFilter === 'inactive' && (!emp.is_active || emp.is_deleted));

    return matchesSearch && matchesPermission && matchesStatus;
  });

  if (!user || user.permission_level !== 3) {
    return (
      <AdminLayout title="접근 권한 없음" description="관리자만 접근할 수 있는 페이지입니다">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">접근 권한이 없습니다</h3>
            <p className="text-gray-600">관리자만 사용자 관리 페이지에 접근할 수 있습니다.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout title="사용자 관리" description="시스템 사용자 및 권한 관리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">데이터를 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="사용자 관리" description="시스템 사용자 및 권한 관리">
      <div className="space-y-8">

        {/* 헤더 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">전체 사용자</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">활성 사용자</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(emp => emp.is_active && !emp.is_deleted).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">관리자</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(emp => emp.permission_level === 3).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">승인 대기</p>
                <p className="text-2xl font-bold text-gray-900">{socialApprovals.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                등록된 사용자 ({employees.length})
              </button>
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'approvals'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                승인 요청 ({socialApprovals.length})
              </button>
            </nav>
          </div>

          {/* 사용자 목록 탭 */}
          {activeTab === 'users' && (
            <div className="p-6">
              {/* 검색 및 필터 */}
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="이름, 이메일, 직원번호로 검색..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <select
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">모든 권한</option>
                    <option value={3}>관리자</option>
                    <option value={2}>매니저</option>
                    <option value={1}>일반사용자</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">모든 상태</option>
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              </div>

              {/* 사용자 테이블 */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부서/직급</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">권한</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최근 로그인</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.email}</div>
                              {employee.employee_id && (
                                <div className="text-xs text-gray-400">ID: {employee.employee_id}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{employee.department || '-'}</div>
                          <div className="text-sm text-gray-500">{employee.position || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPermissionLabel(employee.permission_level).color}`}>
                            {getPermissionLabel(employee.permission_level).text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.is_active && !employee.is_deleted
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {employee.is_active && !employee.is_deleted ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.last_login_at
                            ? new Date(employee.last_login_at).toLocaleDateString('ko-KR')
                            : '없음'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(employee);
                                setShowEditModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setResetPasswordUser(employee);
                                setShowPasswordModal(true);
                              }}
                              className="text-orange-600 hover:text-orange-900"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUserToggle(employee.id, !employee.is_active)}
                              className={employee.is_active ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                            >
                              {employee.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredEmployees.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">사용자가 없습니다</h3>
                    <p className="text-sm text-gray-500">조건에 맞는 사용자가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 승인 요청 탭 */}
          {activeTab === 'approvals' && (
            <div className="p-6">
              {socialApprovals.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">승인 요청이 없습니다</h3>
                  <p className="text-sm text-gray-500">현재 처리할 소셜 로그인 승인 요청이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청자</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">소셜 로그인</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청 권한</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청일</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {socialApprovals.map((approval) => (
                        <tr key={approval.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{approval.requester_name}</div>
                              <div className="text-sm text-gray-500">{approval.requester_email}</div>
                              <div className="text-xs text-gray-400">{approval.email_domain}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {getProviderLabel(approval.provider)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              레벨 {approval.requested_permission_level}
                            </div>
                            {approval.requested_department && (
                              <div className="text-xs text-gray-500">{approval.requested_department}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApprovalAction(approval.id, 'approved')}
                                className="bg-green-100 text-green-700 px-3 py-1 rounded-md hover:bg-green-200 transition-colors"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('거부 사유를 입력해주세요:');
                                  if (reason) {
                                    handleApprovalAction(approval.id, 'rejected', reason);
                                  }
                                }}
                                className="bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition-colors"
                              >
                                거부
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 사용자 편집 모달 */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">사용자 정보 수정</h3>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUserEdit({
                  name: formData.get('name') as string,
                  email: formData.get('email') as string,
                  department: formData.get('department') as string,
                  position: formData.get('position') as string,
                  permission_level: parseInt(formData.get('permission_level') as string)
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingUser.name}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={editingUser.email}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
                    <input
                      type="text"
                      name="department"
                      defaultValue={editingUser.department || ''}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">직급</label>
                    <input
                      type="text"
                      name="position"
                      defaultValue={editingUser.position || ''}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">권한 레벨</label>
                    <select
                      name="permission_level"
                      defaultValue={editingUser.permission_level}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value={1}>일반사용자</option>
                      <option value={2}>매니저</option>
                      <option value={3}>관리자</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                    }}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {showPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">비밀번호 재설정</h3>
              <p className="text-sm text-gray-600 mb-4">
                {resetPasswordUser.name}님의 비밀번호를 재설정합니다.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호를 입력하세요"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">최소 8자 이상의 비밀번호를 입력하세요.</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setResetPasswordUser(null);
                    setNewPassword('');
                    setShowPassword(false);
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handlePasswordReset}
                  disabled={newPassword.length < 8}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  비밀번호 재설정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}