'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Calendar,
  User,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit2,
  Eye,
  Trash2,
  DollarSign,
  Target
} from 'lucide-react';
import { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onView: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export default function ProjectCard({ project, onEdit, onView, onDelete }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'on_hold':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning':
        return '계획';
      case 'in_progress':
        return '진행중';
      case 'completed':
        return '완료';
      case 'on_hold':
        return '보류';
      case 'cancelled':
        return '취소';
      default:
        return status;
    }
  };

  const getProjectTypeColor = (type: string) => {
    return type === '자체자금' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800';
  };

  const getPriorityIcon = () => {
    const dueDate = project.expected_end_date ? new Date(project.expected_end_date) : null;
    const today = new Date();

    if (dueDate && dueDate < today && project.status !== 'completed') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }

    if (dueDate && dueDate.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }

    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatBudget = (amount?: number) => {
    if (!amount) return '0원';
    return amount.toLocaleString() + '원';
  };

  const getProgressPercentage = () => {
    if (project.task_stats && project.task_stats.total > 0) {
      return Math.round((project.task_stats.completed / project.task_stats.total) * 100);
    }
    return project.progress_percentage || 0;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${project.project_type === '자체자금' ? 'bg-purple-100' : 'bg-emerald-100'}`}>
            <FolderOpen className={`w-5 h-5 ${project.project_type === '자체자금' ? 'text-purple-600' : 'text-emerald-600'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                {project.name}
              </h3>
              {getPriorityIcon()}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {project.description || '설명이 없습니다.'}
            </p>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getProjectTypeColor(project.project_type)}`}>
                {project.project_type}
              </span>
            </div>
          </div>
        </div>

        {/* 메뉴 버튼 */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                onClick={() => {
                  onView(project);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                상세보기
              </button>
              <button
                onClick={() => {
                  onEdit(project);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                수정
              </button>
              <button
                onClick={() => {
                  onDelete(project);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 프로젝트 정보 */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 className="w-4 h-4" />
          <span>{project.business_name}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>{project.manager?.name || '담당자 미지정'}</span>
          <span className="text-gray-400">·</span>
          <span>{project.department?.name || '부서 미지정'}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>시작: {formatDate(project.start_date)}</span>
          {project.expected_end_date && (
            <>
              <span className="text-gray-400">·</span>
              <span>완료 예정: {formatDate(project.expected_end_date)}</span>
            </>
          )}
        </div>

        {(project.total_budget || project.subsidy_amount) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <DollarSign className="w-4 h-4" />
            <span>총 예산: {formatBudget(project.total_budget)}</span>
            {project.subsidy_amount && project.subsidy_amount > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-emerald-600">보조금: {formatBudget(project.subsidy_amount)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 진행률 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">진행률</span>
          <span className="font-medium text-gray-900">{getProgressPercentage()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* 작업 통계 */}
      {project.task_stats && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">완료: {project.task_stats.completed}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-600">진행: {project.task_stats.in_progress}</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">전체: {project.task_stats.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}