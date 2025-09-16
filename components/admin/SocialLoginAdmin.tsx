'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ApprovalRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  provider: 'kakao' | 'naver' | 'google';
  provider_user_id: string;
  requested_permission_level: number;
  requested_department: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  approved_by?: string;
  approval_reason?: string;
}

interface DomainPolicy {
  id: string;
  email_domain: string;
  auto_approve: boolean;
  default_permission_level: number;
  default_department?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

const PROVIDER_NAMES = {
  kakao: '카카오',
  naver: '네이버',
  google: '구글'
};

const PERMISSION_LEVELS = {
  1: '일반 사용자',
  2: '담당자',
  3: '관리자'
};

export default function SocialLoginAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'approvals' | 'policies'>('approvals');

  // 승인 요청 관련 상태
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState('pending');

  // 정책 관련 상태
  const [policies, setPolicies] = useState<DomainPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [showPolicyForm, setShowPolicyForm] = useState(false);

  // 새 정책 폼 상태
  const [newPolicy, setNewPolicy] = useState({
    email_domain: '',
    auto_approve: false,
    default_permission_level: 1,
    default_department: '',
    description: ''
  });

  // 권한 확인
  if (!user || (user as any).permission_level < 3) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  // 승인 요청 목록 로드
  const loadApprovals = async () => {
    try {
      setApprovalsLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/admin/social-approvals?status=${approvalStatus}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setApprovals(result.data.approvals || []);
      }
    } catch (error) {
      console.error('❌ 승인 요청 로드 실패:', error);
    } finally {
      setApprovalsLoading(false);
    }
  };

  // 정책 목록 로드
  const loadPolicies = async () => {
    try {
      setPoliciesLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/admin/social-policies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setPolicies(result.data.policies || []);
      }
    } catch (error) {
      console.error('❌ 정책 로드 실패:', error);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // 승인/거부 처리
  const handleApproval = async (approvalId: string, action: 'approved' | 'rejected', reason?: string) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/admin/social-approvals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approvalId, action, reason })
      });

      const result = await response.json();
      if (result.success) {
        alert(result.data.message);
        loadApprovals(); // 목록 새로고침
      } else {
        alert('처리 실패: ' + result.error.message);
      }
    } catch (error) {
      console.error('❌ 승인 처리 실패:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // 새 정책 생성
  const handleCreatePolicy = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/admin/social-policies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPolicy)
      });

      const result = await response.json();
      if (result.success) {
        alert('정책이 생성되었습니다.');
        setShowPolicyForm(false);
        setNewPolicy({
          email_domain: '',
          auto_approve: false,
          default_permission_level: 1,
          default_department: '',
          description: ''
        });
        loadPolicies(); // 목록 새로고침
      } else {
        alert('생성 실패: ' + result.error.message);
      }
    } catch (error) {
      console.error('❌ 정책 생성 실패:', error);
      alert('생성 중 오류가 발생했습니다.');
    }
  };

  // 정책 상태 토글
  const togglePolicyStatus = async (policyId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/admin/social-policies/${policyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      const result = await response.json();
      if (result.success) {
        loadPolicies(); // 목록 새로고침
      } else {
        alert('상태 변경 실패: ' + result.error.message);
      }
    } catch (error) {
      console.error('❌ 정책 상태 변경 실패:', error);
      alert('변경 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadApprovals();
    } else {
      loadPolicies();
    }
  }, [activeTab, approvalStatus]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">소셜 로그인 관리</h1>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'approvals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            승인 요청 관리
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'policies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            도메인 정책 관리
          </button>
        </nav>
      </div>

      {/* 승인 요청 관리 탭 */}
      {activeTab === 'approvals' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <div>
              <label className="mr-2">상태 필터:</label>
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1"
              >
                <option value="pending">대기 중</option>
                <option value="approved">승인됨</option>
                <option value="rejected">거부됨</option>
                <option value="all">전체</option>
              </select>
            </div>
          </div>

          {approvalsLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {approvals.length === 0 ? (
                  <li className="px-6 py-4 text-center text-gray-500">
                    승인 요청이 없습니다.
                  </li>
                ) : (
                  approvals.map((approval) => (
                    <li key={approval.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {approval.requester_name} ({approval.requester_email})
                            </p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              approval.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              approval.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {approval.approval_status === 'pending' ? '대기' :
                               approval.approval_status === 'approved' ? '승인' : '거부'}
                            </span>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                {PROVIDER_NAMES[approval.provider]} 로그인 •{' '}
                                {PERMISSION_LEVELS[approval.requested_permission_level as keyof typeof PERMISSION_LEVELS]}
                                {approval.requested_department && ` • ${approval.requested_department}`}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <p>
                                {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                              </p>
                            </div>
                          </div>
                          {approval.processed_at && (
                            <p className="mt-1 text-sm text-gray-500">
                              처리: {approval.approved_by} ({new Date(approval.processed_at).toLocaleDateString('ko-KR')})
                              {approval.approval_reason && ` - ${approval.approval_reason}`}
                            </p>
                          )}
                        </div>
                        {approval.approval_status === 'pending' && (
                          <div className="ml-4 flex space-x-2">
                            <button
                              onClick={() => handleApproval(approval.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('거부 사유를 입력하세요:');
                                if (reason) handleApproval(approval.id, 'rejected', reason);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                            >
                              거부
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 도메인 정책 관리 탭 */}
      {activeTab === 'policies' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-medium">도메인별 승인 정책</h2>
            <button
              onClick={() => setShowPolicyForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              새 정책 추가
            </button>
          </div>

          {/* 새 정책 생성 폼 */}
          {showPolicyForm && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-md font-medium mb-3">새 도메인 정책</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일 도메인</label>
                  <input
                    type="text"
                    placeholder="example.com"
                    value={newPolicy.email_domain}
                    onChange={(e) => setNewPolicy({...newPolicy, email_domain: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 권한 레벨</label>
                  <select
                    value={newPolicy.default_permission_level}
                    onChange={(e) => setNewPolicy({...newPolicy, default_permission_level: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value={1}>일반 사용자</option>
                    <option value={2}>담당자</option>
                    <option value={3}>관리자</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기본 부서</label>
                  <input
                    type="text"
                    placeholder="부서명 (선택사항)"
                    value={newPolicy.default_department}
                    onChange={(e) => setNewPolicy({...newPolicy, default_department: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="flex items-center mt-6">
                    <input
                      type="checkbox"
                      checked={newPolicy.auto_approve}
                      onChange={(e) => setNewPolicy({...newPolicy, auto_approve: e.target.checked})}
                      className="mr-2"
                    />
                    자동 승인
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    placeholder="정책 설명 (선택사항)"
                    value={newPolicy.description}
                    onChange={(e) => setNewPolicy({...newPolicy, description: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    rows={2}
                  />
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={handleCreatePolicy}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                >
                  생성
                </button>
                <button
                  onClick={() => setShowPolicyForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {policiesLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {policies.length === 0 ? (
                  <li className="px-6 py-4 text-center text-gray-500">
                    설정된 정책이 없습니다.
                  </li>
                ) : (
                  policies.map((policy) => (
                    <li key={policy.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-indigo-600">
                              @{policy.email_domain}
                            </p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              policy.auto_approve ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {policy.auto_approve ? '자동 승인' : '수동 승인'}
                            </span>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              policy.is_active ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {policy.is_active ? '활성' : '비활성'}
                            </span>
                          </div>
                          <div className="mt-1">
                            <p className="text-sm text-gray-500">
                              기본 권한: {PERMISSION_LEVELS[policy.default_permission_level as keyof typeof PERMISSION_LEVELS]}
                              {policy.default_department && ` • 부서: ${policy.default_department}`}
                            </p>
                            {policy.description && (
                              <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              생성: {policy.created_by} ({new Date(policy.created_at).toLocaleDateString('ko-KR')})
                            </p>
                          </div>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePolicyStatus(policy.id, policy.is_active)}
                            className={`px-3 py-1 rounded text-sm ${
                              policy.is_active
                                ? 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {policy.is_active ? '비활성화' : '활성화'}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}