'use client';

import { useState, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  Building2
} from 'lucide-react';
import ProjectCard from './ProjectCard';
import ProjectModal from './ProjectModal';
import { Project, ProjectDashboardStats, Employee, Department } from '@/types';

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectDashboardStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      // 병렬로 데이터 로드
      const [projectsResponse, statsResponse, employeesResponse, departmentsResponse] = await Promise.all([
        fetch('/api/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/projects/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/employees?active_only=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/departments?active_only=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [projectsResult, statsResult, employeesResult, departmentsResult] = await Promise.all([
        projectsResponse.json(),
        statsResponse.json(),
        employeesResponse.json(),
        departmentsResponse.json()
      ]);

      if (projectsResult.success) {
        setProjects(projectsResult.data);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }

      if (employeesResult.success) {
        setEmployees(employeesResult.data);
      }

      if (departmentsResult.success) {
        setDepartments(departmentsResult.data);
      }

    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (data: Partial<Project>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        await loadData();
        alert('프로젝트가 생성되었습니다.');
      } else {
        alert(result.error || '프로젝트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 생성 실패:', error);
      alert('프로젝트 생성에 실패했습니다.');
    }
  };

  const updateProject = async (data: Partial<Project>) => {
    if (!editingProject) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        await loadData();
        setEditingProject(null);
        alert('프로젝트가 수정되었습니다.');
      } else {
        alert(result.error || '프로젝트 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 수정 실패:', error);
      alert('프로젝트 수정에 실패했습니다.');
    }
  };

  const deleteProject = async (project: Project) => {
    if (!confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        await loadData();
        alert('프로젝트가 삭제되었습니다.');
      } else {
        alert(result.error || '프로젝트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error);
      alert('프로젝트 삭제에 실패했습니다.');
    }
  };

  // 필터링된 프로젝트 목록
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesType = typeFilter === 'all' || project.project_type === typeFilter;
    const matchesDepartment = departmentFilter === 'all' || project.department_id === departmentFilter;

    return matchesSearch && matchesStatus && matchesType && matchesDepartment;
  });

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + '원';
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">프로젝트 관리</h1>
            <p className="text-gray-600">다중 프로젝트 워크플로우를 관리하고 추적합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {/* TODO: 내보내기 기능 */}}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            프로젝트 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">전체 프로젝트</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_projects}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">활성: {stats.active_projects}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">완료된 프로젝트</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completed_projects}</p>
            <div className="flex items-center gap-1 mt-1">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">
                완료율: {stats.total_projects > 0 ? Math.round((stats.completed_projects / stats.total_projects) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">지연된 프로젝트</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.overdue_projects}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600">주의 필요</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-gray-600">총 예산</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.total_budget)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-sm text-gray-600">
                사용: {formatCurrency(stats.used_budget)} ({stats.total_budget > 0 ? Math.round((stats.used_budget / stats.total_budget) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="프로젝트명, 사업장명, 설명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 필터 */}
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">모든 상태</option>
              <option value="planning">계획</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="on_hold">보류</option>
              <option value="cancelled">취소</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">모든 유형</option>
              <option value="자체자금">자체자금</option>
              <option value="보조금">보조금</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">모든 부서</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 활성 필터 표시 */}
        {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || departmentFilter !== 'all') && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">활성 필터:</span>
            <div className="flex gap-2">
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  검색: {searchTerm}
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  상태: {statusFilter}
                </span>
              )}
              {typeFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  유형: {typeFilter}
                </span>
              )}
              {departmentFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  부서: {departments.find(d => d.id === departmentFilter)?.name}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setDepartmentFilter('all');
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 프로젝트 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            프로젝트 목록 ({filteredProjects.length})
          </h2>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
            <p className="text-gray-600 mb-4">
              {projects.length === 0
                ? '첫 번째 프로젝트를 생성해보세요.'
                : '검색 조건에 맞는 프로젝트를 찾을 수 없습니다.'
              }
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                첫 번째 프로젝트 생성
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={setEditingProject}
                onView={setViewingProject}
                onDelete={deleteProject}
              />
            ))}
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      <ProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createProject}
        employees={employees}
        departments={departments}
      />

      {/* 수정 모달 */}
      <ProjectModal
        project={editingProject || undefined}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSubmit={updateProject}
        employees={employees}
        departments={departments}
      />

      {/* 상세보기 모달 (추후 구현) */}
      {viewingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-xl font-semibold mb-4">프로젝트 상세보기</h2>
            <p className="text-gray-600 mb-4">상세보기 컴포넌트는 별도로 구현될 예정입니다.</p>
            <button
              onClick={() => setViewingProject(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}