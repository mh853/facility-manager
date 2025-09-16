'use client';

import { useState, useEffect } from 'react';
import { workTaskAPI, employeeAPI, integrationAPI } from '@/lib/api-client';
import { Employee, WorkTask, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus } from '@/types/work-management';
import { useAuth } from '@/contexts/AuthContext';
import {
  X,
  Save,
  User,
  Calendar,
  Flag,
  Building2,
  FileText,
  Tag,
  AlertCircle
} from 'lucide-react';

interface TaskFormProps {
  task?: WorkTask | null;
  businessId?: string;
  onClose: () => void;
  onSave: (task: WorkTask) => void;
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '최고', color: 'text-red-600' },
  { value: 2, label: '높음', color: 'text-orange-600' },
  { value: 3, label: '보통', color: 'text-yellow-600' },
  { value: 4, label: '낮음', color: 'text-blue-600' },
  { value: 5, label: '최저', color: 'text-gray-600' }
];

const STATUS_OPTIONS = [
  { value: '대기', label: '대기' },
  { value: '진행중', label: '진행중' },
  { value: '완료', label: '완료' },
  { value: '해결불가', label: '해결불가' },
  { value: '이관됨', label: '이관됨' }
];

export default function TaskForm({ task, businessId, onClose, onSave }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 3,
    status: '대기',
    assigneeId: '',
    startDate: '',
    dueDate: '',
    businessId: businessId || '',
    category: '',
    tags: [] as string[],
    progressPercentage: 0,
    notes: ''
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  const { user } = useAuth();
  const isEditing = !!task;

  useEffect(() => {
    loadEmployees();
    if (!businessId) {
      loadBusinesses();
    }

    if (task) {
      setFormData({
        title: task.title,
        content: task.content,
        priority: task.priority,
        status: task.status,
        assigneeId: task.assigneeId,
        startDate: task.startDate ? task.startDate.toString().split('T')[0] : '',
        dueDate: task.dueDate ? task.dueDate.toString().split('T')[0] : '',
        businessId: task.businessId || '',
        category: task.category || '',
        tags: task.tags || [],
        progressPercentage: task.progressPercentage || 0,
        notes: task.notes || ''
      });
    }
  }, [task, businessId]);

  const loadEmployees = async () => {
    try {
      const response = await employeeAPI.getEmployees({ limit: 100 });
      if (response.success && response.data) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('직원 목록 조회 오류:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      // 기존 business-list API 활용
      const response = await fetch('/api/business-list');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.businesses) {
          setBusinesses(data.businesses);
        }
      }
    } catch (error) {
      console.error('사업장 목록 조회 오류:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEditing && task) {
        // 업무 수정
        const updateData: UpdateTaskRequest = {
          title: formData.title,
          content: formData.content,
          priority: formData.priority as TaskPriority,
          status: formData.status as TaskStatus,
          assigneeId: formData.assigneeId,
          startDate: formData.startDate ? new Date(formData.startDate) : undefined,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          progressPercentage: formData.progressPercentage,
          notes: formData.notes,
          category: formData.category,
          tags: formData.tags
        };

        const response = await workTaskAPI.updateTask(task.id, updateData);

        if (response.success && response.data) {
          onSave(response.data);
        } else {
          setError(response.error?.message || '업무 수정에 실패했습니다.');
        }
      } else {
        // 새 업무 생성
        const createData: CreateTaskRequest = {
          title: formData.title,
          content: formData.content,
          priority: formData.priority as TaskPriority,
          assigneeId: formData.assigneeId,
          startDate: formData.startDate ? new Date(formData.startDate) : undefined,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          businessId: formData.businessId || undefined,
          category: formData.category,
          tags: formData.tags
        };

        const response = await workTaskAPI.createTask(createData);

        if (response.success && response.data) {
          onSave(response.data);
        } else {
          setError(response.error?.message || '업무 생성에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('업무 저장 오류:', error);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? '업무 수정' : '새 업무 등록'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 제목 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                업무 제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="업무 제목을 입력하세요"
              />
            </div>

            {/* 담당자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                담당자 *
              </label>
              <select
                value={formData.assigneeId}
                onChange={(e) => setFormData(prev => ({ ...prev, assigneeId: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">담당자를 선택하세요</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.position || '직급 없음'})
                  </option>
                ))}
              </select>
            </div>

            {/* 우선순위 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Flag className="w-4 h-4 inline mr-2" />
                우선순위
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PRIORITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 (수정 시에만) */}
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상태
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 사업장 */}
            {!businessId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  관련 사업장
                </label>
                <select
                  value={formData.businessId}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">사업장을 선택하세요</option>
                  {businesses.map(business => (
                    <option key={business} value={business}>
                      {business}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 시설점검, 문서작업, 고객응대"
              />
            </div>

            {/* 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                시작일
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 마감일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                마감일
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 진행률 (수정 시에만) */}
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  진행률: {formData.progressPercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.progressPercentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, progressPercentage: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* 업무 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              업무 내용 *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="업무 내용을 상세히 입력하세요"
            />
          </div>

          {/* 진행 메모 (수정 시에만) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                진행 메모
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="업무 진행 상황이나 특이사항을 입력하세요"
              />
            </div>
          )}

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-2" />
              태그
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="태그를 입력하고 Enter를 누르세요"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                추가
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 버튼들 */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}