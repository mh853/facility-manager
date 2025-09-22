'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Circle,
  Pause,
  X,
  Edit,
  FileText,
  Tag,
  BarChart3,
  History
} from 'lucide-react';
import { TokenManager } from '@/lib/api-client';

interface TaskDetail {
  id: string;
  title: string;
  description: string;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  progress_percentage: number;
  is_urgent: boolean;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  status_name: string;
  status_color: string;
  status_icon: string;
  status_type: string;
  created_by_name: string;
  created_by_email: string;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_to_department: string;
  assigned_to_position: string;
  tags: string[];
  attachment_count: number;
  subtask_count: number;
}

interface TaskHistory {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  created_at: string;
  changer: {
    name: string;
    email: string;
  };
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId) {
      loadTaskDetail();
    }
  }, [taskId]);

  const loadTaskDetail = async () => {
    try {
      setLoading(true);
      const token = TokenManager.getToken();

      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('업무 정보를 불러올 수 없습니다.');
      }

      const result = await response.json();
      if (result.success) {
        setTask(result.data.task);
        setHistory(result.data.history || []);
      } else {
        setError(result.message || '업무 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return { label: '낮음', color: 'text-green-600 bg-green-100' };
      case 2: return { label: '보통', color: 'text-blue-600 bg-blue-100' };
      case 3: return { label: '높음', color: 'text-yellow-600 bg-yellow-100' };
      case 4: return { label: '긴급', color: 'text-red-600 bg-red-100' };
      default: return { label: '보통', color: 'text-blue-600 bg-blue-100' };
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return '업무 생성';
      case 'status_changed': return '상태 변경';
      case 'assigned': return '담당자 변경';
      case 'progress_updated': return '진행률 업데이트';
      default: return action;
    }
  };

  if (loading) {
    return (
      <AdminLayout title="업무 상세" description="업무 정보 및 히스토리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">업무 정보를 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="업무 상세" description="업무 정보 및 히스토리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">오류가 발생했습니다</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!task) {
    return (
      <AdminLayout title="업무 상세" description="업무 정보 및 히스토리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">업무를 찾을 수 없습니다</h3>
            <p className="text-gray-600 mb-4">요청한 업무가 존재하지 않거나 삭제되었습니다.</p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const priorityInfo = getPriorityLabel(task.priority);

  return (
    <AdminLayout
      title={task.title}
      description="업무 상세 정보"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록으로
          </button>
          <button
            onClick={() => router.push(`/admin/tasks/${taskId}/edit`)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            수정
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 카드 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: task.category_color + '20',
                      color: task.category_color
                    }}
                  >
                    {task.category_name}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityInfo.color}`}
                  >
                    {priorityInfo.label}
                  </span>
                  {task.is_urgent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-red-600 bg-red-100">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      긴급
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {getStatusIcon(task.status_icon)}
                  <span
                    className="font-medium"
                    style={{ color: task.status_color }}
                  >
                    {task.status_name}
                  </span>
                </div>
              </div>
            </div>

            {task.description && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">업무 설명</h3>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* 진행률 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">진행률</h3>
                <span className="text-sm font-medium text-gray-600">{task.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${task.progress_percentage}%` }}
                ></div>
              </div>
            </div>

            {/* 태그 */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">태그</h3>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-gray-700 bg-gray-100"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 히스토리 카드 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <History className="w-5 h-5 mr-2" />
              업무 히스토리
            </h2>

            {history.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">히스토리가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={item.id} className="relative">
                    {index < history.length - 1 && (
                      <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200"></div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {getActionLabel(item.action)}
                          </h4>
                          <time className="text-xs text-gray-500">
                            {formatDateTime(item.created_at)}
                          </time>
                        </div>
                        <p className="text-sm text-gray-600">
                          {item.new_value}
                          {item.old_value && item.new_value && item.old_value !== item.new_value && (
                            <span className="text-gray-400">
                              {' '} (이전: {item.old_value})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          by {item.changer.name}
                        </p>
                        {item.change_reason && (
                          <p className="text-xs text-gray-600 mt-1 italic">
                            {item.change_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 사이드바 정보 */}
        <div className="space-y-6">
          {/* 담당자 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              담당자 정보
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">담당자</h4>
                <p className="text-sm text-gray-900">{task.assigned_to_name}</p>
                <p className="text-xs text-gray-500">{task.assigned_to_email}</p>
                {task.assigned_to_department && (
                  <p className="text-xs text-gray-500">
                    {task.assigned_to_department} • {task.assigned_to_position}
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">생성자</h4>
                <p className="text-sm text-gray-900">{task.created_by_name}</p>
                <p className="text-xs text-gray-500">{task.created_by_email}</p>
              </div>
            </div>
          </div>

          {/* 일정 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              일정 정보
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">시작일</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(task.start_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">마감일</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(task.due_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">예상 시간</span>
                <span className="text-sm font-medium text-gray-900">
                  {task.estimated_hours ? `${task.estimated_hours}시간` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">실제 시간</span>
                <span className="text-sm font-medium text-gray-900">
                  {task.actual_hours ? `${task.actual_hours}시간` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              추가 정보
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">첨부파일</span>
                <span className="text-sm font-medium text-gray-900">
                  {task.attachment_count}개
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">하위 업무</span>
                <span className="text-sm font-medium text-gray-900">
                  {task.subtask_count}개
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">생성일</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(task.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">수정일</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(task.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}