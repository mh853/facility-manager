'use client';

import { useState, useEffect, useMemo } from 'react';
import { workTaskAPI } from '@/lib/api-client';
import { WorkTask } from '@/types/work-management';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clock,
  User,
  Building2,
  Filter,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  Circle,
  Calendar,
  ArrowRight
} from 'lucide-react';

interface TaskListProps {
  businessId?: string;
  showCreateButton?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: WorkTask) => void;
}

const STATUS_COLORS = {
  '대기': 'bg-gray-100 text-gray-800',
  '진행중': 'bg-blue-100 text-blue-800',
  '완료': 'bg-green-100 text-green-800',
  '해결불가': 'bg-red-100 text-red-800',
  '이관됨': 'bg-yellow-100 text-yellow-800',
  '취소됨': 'bg-gray-100 text-gray-600'
};

const PRIORITY_COLORS = {
  1: 'text-red-600',
  2: 'text-orange-600',
  3: 'text-yellow-600',
  4: 'text-blue-600',
  5: 'text-gray-600'
};

const STATUS_ICONS = {
  '대기': Circle,
  '진행중': Clock,
  '완료': CheckCircle,
  '해결불가': AlertCircle,
  '이관됨': ArrowRight,
  '취소됨': Circle
};

export default function TaskList({
  businessId,
  showCreateButton = true,
  onCreateTask,
  onTaskClick
}: TaskListProps) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useAuth();

  // 필터링된 업무 목록
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = !searchTerm ||
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.content.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesPriority = !priorityFilter || task.priority.toString() === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter]);

  const loadTasks = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        page,
        limit: 20,
        ...(businessId && { businessId }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(searchTerm && { search: searchTerm })
      };

      const response = await workTaskAPI.getTasks(params);

      if (response.success && response.data) {
        setTasks(response.data.data);
        setCurrentPage(response.data.pagination.currentPage);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setError(response.error?.message || '업무 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('업무 목록 조회 오류:', error);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks(1);
  }, [businessId, statusFilter, priorityFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        loadTasks(1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === '완료' || status === '취소됨') return false;
    return new Date(dueDate) < new Date();
  };

  const getPriorityText = (priority: number) => {
    const texts = { 1: '최고', 2: '높음', 3: '보통', 4: '낮음', 5: '최저' };
    return texts[priority as keyof typeof texts] || '보통';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {businessId ? '사업장 업무' : '업무 목록'}
          </h2>
          {showCreateButton && onCreateTask && (
            <button
              onClick={onCreateTask}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              업무 등록
            </button>
          )}
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="업무 제목 또는 내용 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 상태 필터 */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">모든 상태</option>
              <option value="대기">대기</option>
              <option value="진행중">진행중</option>
              <option value="완료">완료</option>
              <option value="해결불가">해결불가</option>
              <option value="이관됨">이관됨</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">모든 우선순위</option>
              <option value="1">최고</option>
              <option value="2">높음</option>
              <option value="3">보통</option>
              <option value="4">낮음</option>
              <option value="5">최저</option>
            </select>
          </div>
        </div>
      </div>

      {/* 업무 목록 */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">{error}</p>
              <button
                onClick={() => loadTasks(currentPage)}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Circle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">표시할 업무가 없습니다.</p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const StatusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS];
            const isTaskOverdue = task.dueDate && isOverdue(task.dueDate.toString(), task.status);

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 제목 및 상태 */}
                    <div className="flex items-center gap-3 mb-2">
                      <StatusIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}`}>
                        {task.status}
                      </span>
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                        {getPriorityText(task.priority)}
                      </span>
                    </div>

                    {/* 내용 */}
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {task.content}
                    </p>

                    {/* 메타 정보 */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>담당: {task.assignee?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>요청: {task.requester?.name}</span>
                      </div>
                      {task.business && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>{task.business.businessName}</span>
                        </div>
                      )}
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 ${isTaskOverdue ? 'text-red-600' : ''}`}>
                          <Calendar className="w-3 h-3" />
                          <span>마감: {formatDate(task.dueDate.toString())}</span>
                          {isTaskOverdue && <span className="text-red-600 font-medium">(지연)</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 진행률 */}
                  {task.progressPercentage > 0 && (
                    <div className="ml-4 flex-shrink-0">
                      <div className="text-xs text-gray-500 mb-1">진행률</div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progressPercentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 text-center">
                        {task.progressPercentage}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {tasks.length}개 업무 중 {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, tasks.length)}개 표시
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadTasks(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => loadTasks(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}