'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { workTaskAPI } from '@/lib/api-client';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Tag,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Circle,
  Pause,
  X,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface TaskMetadata {
  categories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
  }>;
  statuses: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    status_type: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
  }>;
  priorities: Array<{
    value: number;
    label: string;
    color: string;
    icon: string;
  }>;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  due_date: string;
  created_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  status_name: string;
  status_color: string;
  status_icon: string;
  status_type: string;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_to_department: string;
  created_by_name: string;
  progress_percentage: number;
  is_urgent: boolean;
  attachment_count: number;
  subtask_count: number;
  tags: string[];
}

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [metadata, setMetadata] = useState<TaskMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 및 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);

  // 정렬
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // 보기 모드
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (metadata) {
      loadTasks();
    }
  }, [metadata, currentPage, debouncedSearchTerm, statusFilter, priorityFilter, categoryFilter, assigneeFilter, sortBy, sortOrder]);

  const loadMetadata = async () => {
    try {
      const response = await workTaskAPI.getMetadata();

      if (response.success && response.data) {
        setMetadata(response.data);
        console.log('✅ [TASK-PAGE] 메타데이터 로드 성공:', response.data);
      } else {
        console.error('❌ [TASK-PAGE] 메타데이터 로드 실패:', response.error);
        setError(response.error?.message || '메타데이터를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('❌ [TASK-PAGE] 메타데이터 로드 오류:', error);
      setError('메타데이터를 불러올 수 없습니다.');
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: 10,
        sortBy,
        sortOrder
      };

      if (debouncedSearchTerm) params.search = debouncedSearchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (assigneeFilter !== 'all') params.assignee = assigneeFilter;

      const response = await workTaskAPI.getTasks(params);

      if (response.success && response.data) {
        console.log('🔍 [TASK-PAGE] API 응답 구조:', response.data);
        setTasks((response.data.data || []) as unknown as Task[]);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalTasks(response.data.pagination?.totalItems || 0);
        console.log('✅ [TASK-PAGE] 업무 목록 로드 성공:', response.data.data?.length, '개');
      } else {
        console.error('❌ [TASK-PAGE] 업무 목록 로드 실패:', response.error);
        setError(response.error?.message || '업무 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('❌ [TASK-PAGE] 업무 목록 로드 오류:', error);
      setError('업무 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityInfo = (priority: number) => {
    return metadata?.priorities.find(p => p.value === priority) || metadata?.priorities[1];
  };

  const getPriorityIcon = (priority: number) => {
    const info = getPriorityInfo(priority);
    switch (info?.icon) {
      case 'arrow-up': return <ArrowUp className="w-4 h-4" />;
      case 'arrow-down': return <ArrowDown className="w-4 h-4" />;
      case 'alert-triangle': return <AlertTriangle className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (statusIcon: string) => {
    switch (statusIcon) {
      case 'clock': return <Clock className="w-4 h-4" />;
      case 'play-circle': return <Circle className="w-4 h-4" />;
      case 'check-circle': return <CheckCircle className="w-4 h-4" />;
      case 'pause-circle': return <Pause className="w-4 h-4" />;
      case 'x-circle': return <X className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/admin/tasks/${taskId}`);
  };

  const handleCreateTask = () => {
    router.push('/admin/tasks/create');
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setAssigneeFilter('all');
    setCurrentPage(1);
  };

  if (loading && !tasks.length) {
    return (
      <AdminLayout title="업무 관리" description="업무 등록 및 진행 상황 관리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">업무 목록을 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="업무 관리" description="업무 등록 및 진행 상황 관리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">오류가 발생했습니다</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadTasks}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="업무 관리"
      description="업무 등록 및 진행 상황 관리"
      actions={
        <button
          onClick={handleCreateTask}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>업무 등록</span>
        </button>
      }
    >
      <div className="space-y-6">

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">전체 업무</p>
                <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Circle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">진행 중</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.status_type === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">완료</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.status_type === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">긴급</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.is_urgent || t.priority === 4).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="업무 제목, 담당자로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 필터 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">모든 상태</option>
                {metadata?.statuses.map(status => (
                  <option key={status.id} value={status.name}>{status.name}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">모든 우선순위</option>
                {metadata?.priorities.map(priority => (
                  <option key={priority.value} value={priority.value}>{priority.label}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">모든 카테고리</option>
                {metadata?.categories.map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>

              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">모든 담당자</option>
                {metadata?.employees.map(employee => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>

              <button
                onClick={resetFilters}
                className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          </div>
        </div>

        {/* 업무 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                업무 목록 ({totalTasks}개)
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                >
                  <option value="created_at-desc">최신순</option>
                  <option value="due_date-asc">마감일순</option>
                  <option value="priority-desc">우선순위순</option>
                  <option value="title-asc">제목순</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">업무가 없습니다</h3>
                <p className="text-sm text-gray-500 mb-4">새로운 업무를 등록해보세요.</p>
                <button
                  onClick={handleCreateTask}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  업무 등록
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task.id)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 truncate">
                            {task.title}
                          </h4>
                          {task.is_urgent && (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                              긴급
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: task.status_color }}
                            />
                            <span className="text-sm text-gray-600">{task.status_name}</span>
                          </div>

                          <div className="flex items-center gap-1" style={{ color: getPriorityInfo(task.priority)?.color }}>
                            {getPriorityIcon(task.priority)}
                            <span className="text-sm">{getPriorityInfo(task.priority)?.label}</span>
                          </div>

                          {task.category_name && (
                            <div className="flex items-center gap-1">
                              <Tag className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{task.category_name}</span>
                            </div>
                          )}

                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {new Date(task.due_date).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{task.assigned_to_name}</span>
                            {task.assigned_to_department && (
                              <span className="text-xs text-gray-500">({task.assigned_to_department})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {task.attachment_count > 0 && (
                              <span>{task.attachment_count}개 첨부</span>
                            )}
                            {task.subtask_count > 0 && (
                              <span>{task.subtask_count}개 하위</span>
                            )}
                            <span>{new Date(task.created_at).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>

                        {task.progress_percentage > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>진행률</span>
                              <span>{task.progress_percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${task.progress_percentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* 태그 표시 */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              {task.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-100"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  전체 {totalTasks}개 중 {((currentPage - 1) * 10) + 1}-{Math.min(currentPage * 10, totalTasks)}개 표시
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    이전
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm border rounded-md ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}