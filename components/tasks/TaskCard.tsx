'use client';

import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Pause,
  X,
  Edit,
  Eye,
  Trash2,
  Building2,
  Target
} from 'lucide-react';
import { Task, Project, Employee } from '@/types';

interface TaskCardProps {
  task: Task;
  projects: Project[];
  employees: Employee[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export default function TaskCard({
  task,
  projects,
  employees,
  onEdit,
  onView,
  onDelete
}: TaskCardProps) {
  // 프로젝트 정보 찾기
  const project = projects.find(p => p.id === task.project_id);

  // 담당자 정보 찾기
  const assignedEmployee = employees.find(emp => emp.id === task.assigned_to);

  // 상태별 색상 및 아이콘
  const getStatusConfig = (status: string) => {
    switch (status) {
      case '할당대기':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          bgColor: 'bg-yellow-50'
        };
      case '진행중':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Target,
          bgColor: 'bg-blue-50'
        };
      case '완료':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          bgColor: 'bg-green-50'
        };
      case '보류':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Pause,
          bgColor: 'bg-gray-50'
        };
      case '취소':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: X,
          bgColor: 'bg-red-50'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
          bgColor: 'bg-gray-50'
        };
    }
  };

  // 우선순위별 색상
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case '높음':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          indicator: 'bg-red-500'
        };
      case '보통':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          indicator: 'bg-yellow-500'
        };
      case '낮음':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          indicator: 'bg-green-500'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          indicator: 'bg-gray-500'
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const StatusIcon = statusConfig.icon;

  // 마감일 체크
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isDueSoon = task.due_date &&
    new Date(task.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) &&
    task.status !== 'completed';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-6 ${statusConfig.bgColor}`}>
      {/* 카드 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {/* 우선순위 인디케이터 */}
            <div className={`w-3 h-3 rounded-full ${priorityConfig.indicator}`}></div>
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {task.title}
            </h3>
          </div>

          {/* 상태 및 우선순위 배지 */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" />
              {task.status}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.color}`}>
              {task.priority}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => onView(task)}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="상세보기"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            title="수정"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 설명 */}
      {task.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* 프로젝트 정보 */}
      {project && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Building2 className="w-4 h-4" />
          <span className="truncate">
            {project.name} - {project.business_name}
          </span>
        </div>
      )}

      {/* 담당자 정보 */}
      {assignedEmployee && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>{assignedEmployee.name}</span>
          <span className="text-xs text-gray-500">
            ({(assignedEmployee as any).position})
          </span>
        </div>
      )}

      {/* 날짜 정보 */}
      <div className="space-y-2">
        {task.due_date && (
          <div className={`flex items-center gap-2 text-sm ${
            isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-600'
          }`}>
            <Calendar className="w-4 h-4" />
            <span>마감: {formatDate(task.due_date)}</span>
            {isOverdue && (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>생성: {formatDate(task.created_at)}</span>
          {task.updated_at !== task.created_at && (
            <span>• 수정: {formatDate(task.updated_at)}</span>
          )}
        </div>
      </div>

      {/* 진행률 표시 (추후 구현 시) */}
      {task.status === 'in_progress' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>진행률</span>
            <span>진행중</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}