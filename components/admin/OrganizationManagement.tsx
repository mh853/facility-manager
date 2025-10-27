'use client';

import React, { useState, useEffect } from 'react';
import {
  Building,
  Users,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  MoreVertical,
  UserPlus
} from 'lucide-react';

// 타입 정의
interface Department {
  id: number;
  name: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  teams?: Team[];
}

interface Team {
  id: number;
  name: string;
  description?: string;
  department_id: number;
  display_order?: number;
  is_active?: boolean;
  manager_user_id?: string;
  created_at: string;
  updated_at: string;
  department?: {
    id: number;
    name: string;
  };
}

interface ImpactAnalysis {
  canDelete: boolean;
  affectedTeams?: number;
  affectedNotifications?: number;
  affectedUsers?: number;
  teams?: Team[];
}

// 모달 타입
type ModalType = 'department' | 'team' | 'delete' | null;

export default function OrganizationManagement() {
  // 상태 관리
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({
    type: null, text: ''
  });

  // 모달 상태
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingItem, setEditingItem] = useState<Department | Team | null>(null);
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: 0,
    manager_user_id: ''
  });

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // 부서 목록 로드 (팀 포함)
      const deptResponse = await fetch('/api/organization/departments?include_inactive=false');
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(deptData.data || []);
        }
      }

      // 전체 팀 목록 로드
      const teamResponse = await fetch('/api/organization/teams?include_inactive=false');
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        if (teamData.success) {
          setTeams(teamData.data || []);
        }
      }

    } catch (error) {
      console.error('Failed to load organization data:', error);
      setMessage({ type: 'error', text: '조직 데이터를 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지 자동 클리어
  useEffect(() => {
    if (message.type) {
      const timer = setTimeout(() => {
        setMessage({ type: null, text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 모달 열기
  const openModal = (type: ModalType, item?: Department | Team) => {
    setModalType(type);
    setEditingItem(item || null);

    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        department_id: 'department_id' in item ? item.department_id : 0,
        manager_user_id: 'manager_user_id' in item ? item.manager_user_id || '' : ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        department_id: 0,
        manager_user_id: ''
      });
    }
  };

  // 모달 닫기
  const closeModal = () => {
    setModalType(null);
    setEditingItem(null);
    setImpactData(null);
    setFormData({ name: '', description: '', department_id: 0, manager_user_id: '' });
  };

  // 부서 생성/수정
  const handleSaveDepartment = async () => {
    try {
      setSaving(true);
      const isEdit = editingItem !== null;
      const url = '/api/organization/departments';
      const method = isEdit ? 'PUT' : 'POST';

      const body = isEdit
        ? { ...formData, id: editingItem!.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: isEdit ? '부서가 성공적으로 수정되었습니다.' : '부서가 성공적으로 생성되었습니다.'
        });
        closeModal();
        loadData();
      } else {
        throw new Error(result.error || '저장에 실패했습니다.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  // 팀 생성/수정
  const handleSaveTeam = async () => {
    try {
      setSaving(true);
      const isEdit = editingItem !== null;
      const url = '/api/organization/teams';
      const method = isEdit ? 'PUT' : 'POST';

      const body = isEdit
        ? { ...formData, id: editingItem!.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: isEdit ? '팀이 성공적으로 수정되었습니다.' : '팀이 성공적으로 생성되었습니다.'
        });
        closeModal();
        loadData();
      } else {
        throw new Error(result.error || '저장에 실패했습니다.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  // 삭제 영향도 분석
  const analyzeDeleteImpact = async (type: 'department' | 'team', item: Department | Team) => {
    try {
      const endpoint = type === 'department'
        ? `/api/organization/departments?id=${item.id}&force=false`
        : `/api/organization/teams?id=${item.id}&force=false`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setImpactData(result.impact);
        openModal('delete', item);
      } else {
        throw new Error(result.error || '영향도 분석에 실패했습니다.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '영향도 분석 중 오류가 발생했습니다.' });
    }
  };

  // 삭제 실행
  const handleDelete = async () => {
    if (!editingItem) return;

    try {
      setSaving(true);
      const type = 'department_id' in editingItem ? 'team' : 'department';
      const endpoint = type === 'department'
        ? `/api/organization/departments?id=${editingItem.id}&force=true`
        : `/api/organization/teams?id=${editingItem.id}&force=true`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `${type === 'department' ? '부서' : '팀'}가 성공적으로 삭제되었습니다.`
        });
        closeModal();
        loadData();
      } else {
        throw new Error(result.error || '삭제에 실패했습니다.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '삭제 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">조직 구조를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 메시지 알림 */}
      {message.type && (
        <div className={`p-4 rounded-lg border ${
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

      {/* 액션 버튼 */}
      <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
        <button
          onClick={() => openModal('department')}
          className="flex items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3 h-3 md:w-4 md:h-4" />
          <span className="hidden sm:inline">새 부서 추가</span>
          <span className="sm:hidden">부서 추가</span>
        </button>
        <button
          onClick={() => openModal('team')}
          className="flex items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-2 text-sm md:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-3 h-3 md:w-4 md:h-4" />
          <span className="hidden sm:inline">새 팀 추가</span>
          <span className="sm:hidden">팀 추가</span>
        </button>
      </div>

      {/* 조직 구조 */}
      <div className="space-y-3 md:space-y-4">
        {departments.map((department) => (
          <div key={department.id} className="bg-white border border-gray-200 rounded-lg">
            {/* 부서 헤더 */}
            <div className="px-3 md:px-4 lg:px-6 py-3 md:py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">{department.name}</h3>
                    {department.description && (
                      <p className="text-xs md:text-sm text-gray-600 truncate">{department.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openModal('department', department)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="부서 수정"
                  >
                    <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={() => analyzeDeleteImpact('department', department)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="부서 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 부서 내 팀들 */}
            <div className="p-3 md:p-4 lg:p-6">
              {department.teams && department.teams.length > 0 ? (
                <div className="space-y-2 md:space-y-3">
                  {department.teams.map((team) => (
                    <div key={team.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg gap-2">
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <Users className="w-3 h-3 md:w-4 md:h-4 text-green-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs md:text-sm font-medium text-gray-900 truncate block">{team.name}</span>
                          {team.description && (
                            <span className="text-[10px] md:text-xs text-gray-600 truncate block">{team.description}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 md:gap-1">
                        <button
                          onClick={() => openModal('team', team)}
                          className="p-1 md:p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="팀 수정"
                        >
                          <Edit className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </button>
                        <button
                          onClick={() => analyzeDeleteImpact('team', team)}
                          className="p-1 md:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="팀 삭제"
                        >
                          <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8 text-gray-500">
                  <Users className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs md:text-sm">이 부서에는 아직 팀이 없습니다.</p>
                  <button
                    onClick={() => {
                      setFormData(prev => ({ ...prev, department_id: department.id }));
                      openModal('team');
                    }}
                    className="mt-2 text-xs md:text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    첫 번째 팀 추가하기
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 모달들 */}
      {modalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">

            {/* 부서/팀 추가/수정 모달 */}
            {(modalType === 'department' || modalType === 'team') && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingItem ?
                      (modalType === 'department' ? '부서 수정' : '팀 수정') :
                      (modalType === 'department' ? '새 부서 추가' : '새 팀 추가')
                    }
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 이름 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {modalType === 'department' ? '부서명' : '팀명'} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={modalType === 'department' ? '부서명을 입력하세요' : '팀명을 입력하세요'}
                      required
                    />
                  </div>

                  {/* 설명 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="설명을 입력하세요 (선택사항)"
                    />
                  </div>

                  {/* 팀일 경우 소속 부서 선택 */}
                  {modalType === 'team' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">소속 부서 *</label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value={0}>부서를 선택하세요</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={modalType === 'department' ? handleSaveDepartment : handleSaveTeam}
                    disabled={isSaving || !formData.name || (modalType === 'team' && !formData.department_id)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </>
            )}

            {/* 삭제 확인 모달 */}
            {modalType === 'delete' && editingItem && impactData && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-red-600">
                    {'department_id' in editingItem ? '팀' : '부서'} 삭제 확인
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">
                          '{editingItem.name}' {'department_id' in editingItem ? '팀을' : '부서를'} 삭제하시겠습니까?
                        </p>
                        <p className="text-sm text-red-600 mt-1">
                          이 작업은 되돌릴 수 없으며, 다음과 같은 영향이 있습니다:
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 영향도 분석 결과 */}
                  <div className="space-y-2 text-sm">
                    {impactData.affectedTeams !== undefined && impactData.affectedTeams > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-500" />
                        <span>하위 팀 {impactData.affectedTeams}개가 함께 삭제됩니다.</span>
                      </div>
                    )}
                    {impactData.affectedNotifications !== undefined && impactData.affectedNotifications > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span>관련 알림 {impactData.affectedNotifications}개가 재할당됩니다.</span>
                      </div>
                    )}
                    {impactData.affectedUsers !== undefined && impactData.affectedUsers > 0 && (
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-blue-500" />
                        <span>사용자 {impactData.affectedUsers}명의 할당이 해제됩니다.</span>
                      </div>
                    )}
                    {!impactData.canDelete && (
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        <span>현재 상태에서는 삭제할 수 없습니다.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isSaving ? '삭제 중...' : '삭제 확인'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 안내 사항 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">🏢 조직 관리 안내</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• 부서와 팀의 생성, 수정, 삭제를 관리할 수 있습니다.</li>
          <li>• 조직 변경 시 관련 알림 시스템이 자동으로 업데이트됩니다.</li>
          <li>• 삭제 시 영향도를 분석하여 안전한 조직 구조 관리가 가능합니다.</li>
          <li>• 모든 변경 사항은 변경 히스토리에 기록되어 추적할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}