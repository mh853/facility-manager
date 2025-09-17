'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  DollarSign,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  FileText,
  Activity,
  Users,
  TrendingUp
} from 'lucide-react';
import { Project, Task } from '@/types';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onEdit: (project: Project) => void;
}

export default function ProjectDetail({ projectId, onBack, onEdit }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'timeline' | 'budget'>('overview');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const [projectResponse, tasksResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/tasks?project_id=${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [projectResult, tasksResult] = await Promise.all([
        projectResponse.json(),
        tasksResponse.json()
      ]);

      if (projectResult.success) {
        setProject(projectResult.data);
      }

      if (tasksResult.success) {
        setTasks(tasksResult.data);
      }

    } catch (error) {
      console.error('프로젝트 데이터 로드 실패:', error);
      alert('프로젝트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusText = (status: string) => {
    switch (status) {
      case 'todo':
        return '할 일';
      case 'in_progress':
        return '진행중';
      case 'review':
        return '검토';
      case 'completed':
        return '완료';
      case 'blocked':
        return '차단됨';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'text-gray-500';
      case 'medium':
        return 'text-blue-500';
      case 'high':
        return 'text-orange-500';
      case 'urgent':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '0원';
    return amount.toLocaleString() + '원';
  };

  const getProgressPercentage = () => {
    if (!project?.task_stats || project.task_stats.total === 0) {
      return project?.progress_percentage || 0;
    }
    return Math.round((project.task_stats.completed / project.task_stats.total) * 100);
  };

  const getBudgetUsagePercentage = () => {
    if (!project?.total_budget || !project?.current_budget_used) return 0;
    return Math.round((project.current_budget_used / project.total_budget) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">프로젝트를 찾을 수 없습니다</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                project.project_type === '자체자금' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {project.project_type}
              </span>
            </div>
            <p className="text-gray-600">{project.description || '설명이 없습니다.'}</p>
          </div>
        </div>
        <button
          onClick={() => onEdit(project)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          프로젝트 수정
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: '개요', icon: FileText },
            { id: 'tasks', label: '작업', icon: CheckCircle },
            { id: 'timeline', label: '타임라인', icon: Calendar },
            { id: 'budget', label: '예산', icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 내용 */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 기본 정보 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">프로젝트 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">사업장</p>
                      <p className="font-medium text-gray-900">{project.business_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">담당자</p>
                      <p className="font-medium text-gray-900">{project.manager?.name || '미지정'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">담당 부서</p>
                      <p className="font-medium text-gray-900">{project.department?.name || '미지정'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">시작일</p>
                      <p className="font-medium text-gray-900">{formatDate(project.start_date)}</p>
                    </div>
                  </div>
                  {project.expected_end_date && (
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">완료 예정일</p>
                        <p className="font-medium text-gray-900">{formatDate(project.expected_end_date)}</p>
                      </div>
                    </div>
                  )}
                  {project.actual_end_date && (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-gray-600">실제 완료일</p>
                        <p className="font-medium text-gray-900">{formatDate(project.actual_end_date)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 진행률 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">프로젝트 진행률</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">전체 진행률</span>
                    <span className="text-2xl font-bold text-gray-900">{getProgressPercentage()}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  {project.task_stats && (
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{project.task_stats.total}</p>
                        <p className="text-sm text-gray-600">전체 작업</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{project.task_stats.completed}</p>
                        <p className="text-sm text-gray-600">완료</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{project.task_stats.in_progress}</p>
                        <p className="text-sm text-gray-600">진행중</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-400">{project.task_stats.pending}</p>
                        <p className="text-sm text-gray-600">대기</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 사이드바 */}
            <div className="space-y-6">
              {/* 예산 정보 */}
              {(project.total_budget || project.subsidy_amount) && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">예산 정보</h3>
                  <div className="space-y-3">
                    {project.total_budget && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">총 예산</span>
                        <span className="font-medium">{formatCurrency(project.total_budget)}</span>
                      </div>
                    )}
                    {project.subsidy_amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">보조금</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(project.subsidy_amount)}</span>
                      </div>
                    )}
                    {project.current_budget_used && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">사용 예산</span>
                        <span className="font-medium text-red-600">{formatCurrency(project.current_budget_used)}</span>
                      </div>
                    )}
                    {project.total_budget && project.subsidy_amount && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-600">자체 부담</span>
                        <span className="font-medium">{formatCurrency(project.total_budget - project.subsidy_amount)}</span>
                      </div>
                    )}
                  </div>

                  {project.total_budget && project.current_budget_used && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">예산 사용률</span>
                        <span className="font-medium">{getBudgetUsagePercentage()}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            getBudgetUsagePercentage() > 90 ? 'bg-red-500' :
                            getBudgetUsagePercentage() > 75 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(getBudgetUsagePercentage(), 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 최근 활동 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-600">프로젝트가 생성되었습니다</span>
                  </div>
                  {/* 추후 실제 활동 로그로 교체 */}
                  <p className="text-sm text-gray-500">활동 로그는 추후 구현될 예정입니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* 작업 헤더 */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">프로젝트 작업</h3>
              <button
                onClick={() => setShowTaskModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                작업 추가
              </button>
            </div>

            {/* 작업 목록 */}
            <div className="bg-white rounded-lg border border-gray-200">
              {tasks.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">작업이 없습니다</h3>
                  <p className="text-gray-600 mb-4">첫 번째 작업을 추가해보세요.</p>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    작업 추가
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {tasks.map(task => (
                    <div key={task.id} className="p-6 hover:bg-gray-50 group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">{task.title}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskStatusColor(task.status)}`}>
                              {getTaskStatusText(task.status)}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority).replace('text-', 'bg-')}`} />
                          </div>
                          {task.description && (
                            <p className="text-gray-600 mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {task.assignee && (
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {task.assignee.name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {/* TODO: 작업 삭제 */}}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">프로젝트 타임라인</h3>
            <p className="text-gray-600">타임라인 뷰는 추후 구현될 예정입니다.</p>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">예산 관리</h3>
            <p className="text-gray-600">예산 관리 기능은 추후 구현될 예정입니다.</p>
          </div>
        )}
      </div>

      {/* 작업 생성/수정 모달 (간단 버전) */}
      {(showTaskModal || editingTask) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {editingTask ? '작업 수정' : '새 작업 추가'}
            </h2>
            <p className="text-gray-600 mb-4">작업 관리 기능은 별도 컴포넌트로 구현될 예정입니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}