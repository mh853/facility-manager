'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';

interface SocialApproval {
  id: string;
  provider: 'kakao' | 'naver' | 'google';
  requester_name: string;
  requester_email: string;
  email_domain: string;
  requested_permission_level: number;
  requested_department: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  request_data: any;
  created_at: string;
  processed_at: string | null;
  approved_by: string | null;
  approval_reason: string | null;
}

interface SocialPolicy {
  id: string;
  email_domain: string;
  auto_approve: boolean;
  default_permission_level: number;
  default_department: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

export default function SocialLoginAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'approvals' | 'policies'>('approvals');
  const [approvals, setApprovals] = useState<SocialApproval[]>([]);
  const [policies, setPolicies] = useState<SocialPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상태 필터
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // 새 정책 모달 상태
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    email_domain: '',
    auto_approve: false,
    default_permission_level: 1,
    default_department: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth-token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      // Mock data for now since API endpoints don't exist
      setApprovals([]);
      setPolicies([]);

    } catch (err) {
      console.error('데이터 로드 오류:', err);
      setError(err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (approvalId: string, action: 'approved' | 'rejected', reason?: string) => {
    try {
      // Mock implementation - would call API in real app
      await loadData();
      alert(`승인 요청이 ${action === 'approved' ? '승인' : '거부'}되었습니다.`);
    } catch (err) {
      console.error('승인 처리 오류:', err);
      alert(err instanceof Error ? err.message : '승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleCreatePolicy = async () => {
    try {
      if (!newPolicy.email_domain) {
        alert('이메일 도메인을 입력해주세요.');
        return;
      }

      // Mock implementation - would call API in real app
      setShowPolicyModal(false);
      setNewPolicy({
        email_domain: '',
        auto_approve: false,
        default_permission_level: 1,
        default_department: '',
        description: ''
      });
      await loadData();
      alert('정책이 성공적으로 생성되었습니다.');

    } catch (err) {
      console.error('정책 생성 오류:', err);
      alert(err instanceof Error ? err.message : '정책 생성 중 오류가 발생했습니다.');
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'approved': return '승인됨';
      case 'rejected': return '거부됨';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">소셜 로그인 관리</h1>
          <p className="mt-2 text-gray-600">소셜 로그인 승인 요청과 도메인 정책을 관리합니다.</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('approvals')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'approvals'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                승인 요청 ({approvals.filter(a => a.approval_status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveTab('policies')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'policies'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                도메인 정책 ({policies.length})
              </button>
            </nav>
          </div>
        </div>

        {/* 승인 요청 탭 */}
        {activeTab === 'approvals' && (
          <div>
            {/* 필터 */}
            <div className="mb-6 flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">상태 필터:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  <option value="all">전체</option>
                  <option value="pending">대기중</option>
                  <option value="approved">승인됨</option>
                  <option value="rejected">거부됨</option>
                </select>
              </div>
              <button
                onClick={loadData}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm hover:bg-gray-200"
              >
                새로고침
              </button>
            </div>

            {/* 승인 요청 목록 */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="text-center py-12">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">승인 요청이 없습니다</h3>
                <p className="text-sm text-gray-500">현재 처리할 소셜 로그인 승인 요청이 없습니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* 정책 관리 탭 */}
        {activeTab === 'policies' && (
          <div>
            {/* 새 정책 추가 버튼 */}
            <div className="mb-6">
              <button
                onClick={() => setShowPolicyModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                새 정책 추가
              </button>
            </div>

            {/* 정책 목록 */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="text-center py-12">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">정책이 없습니다</h3>
                <p className="text-sm text-gray-500">새 정책을 추가하여 도메인별 승인 규칙을 설정하세요.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 새 정책 생성 모달 */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">새 도메인 정책 추가</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일 도메인</label>
                  <input
                    type="text"
                    value={newPolicy.email_domain}
                    onChange={(e) => setNewPolicy({...newPolicy, email_domain: e.target.value})}
                    placeholder="example.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newPolicy.auto_approve}
                      onChange={(e) => setNewPolicy({...newPolicy, auto_approve: e.target.checked})}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">자동 승인</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 권한 레벨</label>
                  <select
                    value={newPolicy.default_permission_level}
                    onChange={(e) => setNewPolicy({...newPolicy, default_permission_level: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value={1}>레벨 1 (일반 사용자)</option>
                    <option value={2}>레벨 2 (관리자)</option>
                    <option value={3}>레벨 3 (최고 관리자)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 부서</label>
                  <input
                    type="text"
                    value={newPolicy.default_department}
                    onChange={(e) => setNewPolicy({...newPolicy, default_department: e.target.value})}
                    placeholder="부서명 (선택사항)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    value={newPolicy.description}
                    onChange={(e) => setNewPolicy({...newPolicy, description: e.target.value})}
                    placeholder="정책 설명 (선택사항)"
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handleCreatePolicy}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}