'use client';

import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Users,
  Building2
} from 'lucide-react';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import { Task, Employee, Department, Project } from '@/types';

interface TaskStats {
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      // 병렬로 데이터 로드
      const [tasksResponse, employeesResponse, departmentsResponse, projectsResponse] = await Promise.all([
        fetch('/api/tasks', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/employees?active_only=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/departments?active_only=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [tasksResult, employeesResult, departmentsResult, projectsResult] = await Promise.all([
        tasksResponse.json(),
        employeesResponse.json(),
        departmentsResponse.json(),
        projectsResponse.json()
      ]);

      if (tasksResult.success) {
        setTasks(tasksResult.data);
        // 통계 계산
        const taskData = tasksResult.data;
        const taskStats: TaskStats = {
          total_tasks: taskData.length,
          pending_tasks: taskData.filter((t: Task) => t.status === 'todo').length,
          in_progress_tasks: taskData.filter((t: Task) => t.status === 'in_progress').length,
          completed_tasks: taskData.filter((t: Task) => t.status === 'completed').length,
          overdue_tasks: taskData.filter((t: Task) =>
            t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
          ).length
        };
        setStats(taskStats);
      }

      if (employeesResult.success) {
        setEmployees(employeesResult.data);
      }

      if (departmentsResult.success) {
        setDepartments(departmentsResult.data);
      }

      if (projectsResult.success) {
        setProjects(projectsResult.data);
      }

    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (data: Partial<Task>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/tasks', {
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
        alert('업무가 생성되었습니다.');
      } else {
        alert(result.error || '업무 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('업무 생성 실패:', error);
      alert('업무 생성에 실패했습니다.');
    }
  };

  const updateTask = async (data: Partial<Task>) => {
    if (!editingTask) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
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
        setEditingTask(null);
        alert('업무가 수정되었습니다.');
      } else {
        alert(result.error || '업무 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('업무 수정 실패:', error);
      alert('업무 수정에 실패했습니다.');
    }
  };

  const deleteTask = async (task: Task) => {
    if (!confirm(`"${task.title}" 업무를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        await loadData();
        alert('업무가 삭제되었습니다.');
      } else {
        alert(result.error || '업무 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('업무 삭제 실패:', error);
      alert('업무 삭제에 실패했습니다.');
    }
  };

  // 필터링된 업무 목록
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    // 담당자 부서로 필터링
    const assignedEmployee = employees.find(emp => emp.id === task.assigned_to);
    const matchesDepartment = departmentFilter === 'all' ||
                             (assignedEmployee && assignedEmployee.department_id === departmentFilter);

    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment;
  });

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
          <ClipboardList className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">업무 관리</h1>
            <p className="text-gray-600">시설 점검 및 관리 업무를 체계적으로 추적하고 관리합니다.</p>
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
            업무 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">전체 업무</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_tasks}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">활성: {stats.in_progress_tasks}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">완료된 업무</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completed_tasks}</p>
            <div className="flex items-center gap-1 mt-1">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">
                완료율: {stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">지연된 업무</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.overdue_tasks}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600">주의 필요</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">대기 업무</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending_tasks}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-sm text-gray-600">배정 대기중</span>
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
                placeholder="업무명, 설명으로 검색..."
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
              <option value="할당대기">할당대기</option>
              <option value="진행중">진행중</option>
              <option value="완료">완료</option>
              <option value="보류">보류</option>
              <option value="취소">취소</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">모든 우선순위</option>
              <option value="높음">높음</option>
              <option value="보통">보통</option>
              <option value="낮음">낮음</option>
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
        {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || departmentFilter !== 'all') && (
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
              {priorityFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  우선순위: {priorityFilter}
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
                  setPriorityFilter('all');
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

      {/* 업무 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            업무 목록 ({filteredTasks.length})
          </h2>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">업무가 없습니다</h3>
            <p className="text-gray-600 mb-4">
              {tasks.length === 0
                ? '첫 번째 업무를 생성해보세요.'
                : '검색 조건에 맞는 업무를 찾을 수 없습니다.'
              }
            </p>
            {tasks.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                첫 번째 업무 생성
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={setEditingTask}
                onView={setViewingTask}
                onDelete={deleteTask}
                projects={projects}
                employees={employees}
              />
            ))}
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      <TaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createTask}
        projects={projects}
        employees={employees}
        departments={departments}
      />

      {/* 수정 모달 */}
      <TaskModal
        task={editingTask || undefined}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={updateTask}
        projects={projects}
        employees={employees}
        departments={departments}
      />

      {/* 상세보기 모달 (추후 구현) */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-xl font-semibold mb-4">업무 상세보기</h2>
            <p className="text-gray-600 mb-4">상세보기 컴포넌트는 별도로 구현될 예정입니다.</p>
            <button
              onClick={() => setViewingTask(null)}
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