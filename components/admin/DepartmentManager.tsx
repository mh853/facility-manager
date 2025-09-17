'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Users, ChevronDown, ChevronRight } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  is_active: boolean;
  parent?: { name: string };
  children?: Department[];
  employees?: Employee[];
  employee_count: number;
  total_employees: number;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export default function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/departments?include_employees=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setDepartments(result.data);
      } else {
        console.error('부서 목록 로드 실패:', result.error);
        alert(result.error);
      }
    } catch (error) {
      console.error('부서 목록 로드 실패:', error);
      alert('부서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const createDepartment = async (data: { name: string; parent_id?: string; description?: string }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        await loadDepartments();
        setShowCreateModal(false);
        alert('부서가 생성되었습니다.');
      } else {
        alert(result.error || '부서 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('부서 생성 실패:', error);
      alert('부서 생성에 실패했습니다.');
    }
  };

  const updateDepartment = async (id: string, data: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/departments', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, ...data })
      });

      const result = await response.json();

      if (result.success) {
        await loadDepartments();
        setEditingDepartment(null);
        alert('부서 정보가 업데이트되었습니다.');
      } else {
        alert(result.error || '부서 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('부서 수정 실패:', error);
      alert('부서 수정에 실패했습니다.');
    }
  };

  const deleteDepartment = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        await loadDepartments();
        alert('부서가 삭제되었습니다.');
      } else {
        alert(result.error || '부서 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('부서 삭제 실패:', error);
      alert('부서 삭제에 실패했습니다.');
    }
  };

  const toggleExpanded = (deptId: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepts(newExpanded);
  };

  // 계층 구조로 부서 정리
  const organizeHierarchy = (departments: Department[]): Department[] => {
    const deptMap = new Map<string, Department>();
    const roots: Department[] = [];

    // 먼저 모든 부서를 맵에 저장
    departments.forEach(dept => {
      deptMap.set(dept.id, { ...dept, children: [] });
    });

    // 계층 구조 구성
    departments.forEach(dept => {
      const deptWithChildren = deptMap.get(dept.id)!;
      if (dept.parent_id) {
        const parent = deptMap.get(dept.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(deptWithChildren);
        } else {
          roots.push(deptWithChildren);
        }
      } else {
        roots.push(deptWithChildren);
      }
    });

    return roots;
  };

  const hierarchicalDepts = organizeHierarchy(departments);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">부서 관리</h1>
            <p className="text-gray-600">조직 구조를 관리하고 사용자를 부서별로 분류합니다.</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          부서 추가
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">전체 부서</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">전체 직원</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {departments.reduce((sum, dept) => sum + dept.employee_count, 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">활성 부서</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {departments.filter(dept => dept.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">평균 인원</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {departments.length > 0 ? Math.round(departments.reduce((sum, dept) => sum + dept.employee_count, 0) / departments.length) : 0}
          </p>
        </div>
      </div>

      {/* 부서 목록 (계층 구조) */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">조직 구조</h2>
          <div className="space-y-2">
            {hierarchicalDepts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>등록된 부서가 없습니다.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-700"
                >
                  첫 번째 부서 만들기
                </button>
              </div>
            ) : (
              hierarchicalDepts.map((dept) => (
                <DepartmentTreeNode
                  key={dept.id}
                  department={dept}
                  level={0}
                  isExpanded={expandedDepts.has(dept.id)}
                  onToggleExpand={() => toggleExpanded(dept.id)}
                  onEdit={() => setEditingDepartment(dept)}
                  onDelete={() => {
                    if (confirm(`"${dept.name}" 부서를 삭제하시겠습니까?`)) {
                      deleteDepartment(dept.id);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateDepartmentModal
          departments={departments}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createDepartment}
        />
      )}

      {/* 수정 모달 */}
      {editingDepartment && (
        <EditDepartmentModal
          department={editingDepartment}
          departments={departments}
          onClose={() => setEditingDepartment(null)}
          onSubmit={(data) => updateDepartment(editingDepartment.id, data)}
        />
      )}
    </div>
  );
}

// 부서 트리 노드 컴포넌트
function DepartmentTreeNode({
  department,
  level,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete
}: {
  department: Department & { children?: Department[] };
  level: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasChildren = department.children && department.children.length > 0;
  const paddingLeft = level * 24;

  return (
    <div>
      <div
        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 group"
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        <div className="flex items-center gap-3 flex-1">
          {hasChildren ? (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${department.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Building2 className={`w-4 h-4 ${department.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-medium ${department.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                  {department.name}
                </h3>
                {!department.is_active && (
                  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-full">
                    비활성
                  </span>
                )}
              </div>
              {department.description && (
                <p className="text-sm text-gray-500">{department.description}</p>
              )}
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {department.employee_count}명
                </span>
                {hasChildren && (
                  <span className="text-xs text-gray-500">
                    하위 부서 {department.children?.length}개
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="수정"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 하위 부서들 */}
      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {department.children?.map((child) => (
            <DepartmentTreeNode
              key={child.id}
              department={child}
              level={level + 1}
              isExpanded={false} // 기본적으로 접힘
              onToggleExpand={() => {}} // 하위 레벨 확장 기능은 추후 구현
              onEdit={() => {}} // 하위 레벨 편집 기능은 추후 구현
              onDelete={() => {}} // 하위 레벨 삭제 기능은 추후 구현
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 생성 모달 컴포넌트 (간단 버전)
function CreateDepartmentModal({
  departments,
  onClose,
  onSubmit
}: {
  departments: Department[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('부서명을 입력해주세요.');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      parent_id: parentId || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">새 부서 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              부서명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="부서명을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상위 부서
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">최상위 부서</option>
              {departments.filter(dept => dept.is_active).map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="부서 설명을 입력하세요"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 수정 모달 컴포넌트 (간단 버전)
function EditDepartmentModal({
  department,
  departments,
  onClose,
  onSubmit
}: {
  department: Department;
  departments: Department[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || '');
  const [parentId, setParentId] = useState(department.parent_id || '');
  const [isActive, setIsActive] = useState(department.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('부서명을 입력해주세요.');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      parent_id: parentId || null,
      is_active: isActive
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">부서 수정</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              부서명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상위 부서
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">최상위 부서</option>
              {departments.filter(dept => dept.is_active && dept.id !== department.id).map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              활성 상태
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              수정
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}