'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Building2, User, FileText } from 'lucide-react';
import { Project, Employee, Department } from '@/types';

interface ProjectModalProps {
  project?: Project;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Project>) => void;
  employees: Employee[];
  departments: Department[];
}

export default function ProjectModal({
  project,
  isOpen,
  onClose,
  onSubmit,
  employees,
  departments
}: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project_type: '자체자금' as '자체자금' | '보조금',
    business_name: '',
    status: 'planning' as Project['status'],
    department_id: '',
    manager_id: '',
    start_date: '',
    expected_end_date: '',
    total_budget: '',
    subsidy_amount: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        project_type: project.project_type,
        business_name: project.business_name || '',
        status: project.status,
        department_id: project.department_id || '',
        manager_id: project.manager_id || '',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        expected_end_date: project.expected_end_date ? project.expected_end_date.split('T')[0] : '',
        total_budget: project.total_budget?.toString() || '',
        subsidy_amount: project.subsidy_amount?.toString() || ''
      });
    } else {
      // 새 프로젝트 생성시 초기값
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: '',
        description: '',
        project_type: '자체자금',
        business_name: '',
        status: 'planning',
        department_id: '',
        manager_id: '',
        start_date: today,
        expected_end_date: '',
        total_budget: '',
        subsidy_amount: ''
      });
    }
    setErrors({});
  }, [project, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '프로젝트명을 입력해주세요.';
    }

    if (!formData.business_name.trim()) {
      newErrors.business_name = '사업장명을 입력해주세요.';
    }

    if (!formData.department_id) {
      newErrors.department_id = '담당 부서를 선택해주세요.';
    }

    if (!formData.manager_id) {
      newErrors.manager_id = '담당자를 선택해주세요.';
    }

    if (!formData.start_date) {
      newErrors.start_date = '시작일을 선택해주세요.';
    }

    if (formData.expected_end_date && formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.expected_end_date);
      if (endDate <= startDate) {
        newErrors.expected_end_date = '완료 예정일은 시작일보다 늦어야 합니다.';
      }
    }

    if (formData.project_type === '보조금' && !formData.subsidy_amount) {
      newErrors.subsidy_amount = '보조금 프로젝트는 보조금 금액을 입력해주세요.';
    }

    if (formData.subsidy_amount && formData.total_budget) {
      const totalBudget = parseFloat(formData.total_budget);
      const subsidyAmount = parseFloat(formData.subsidy_amount);
      if (subsidyAmount > totalBudget) {
        newErrors.subsidy_amount = '보조금 금액은 총 예산보다 클 수 없습니다.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const submitData: Partial<Project> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        project_type: formData.project_type,
        business_name: formData.business_name.trim(),
        status: formData.status,
        department_id: formData.department_id,
        manager_id: formData.manager_id,
        start_date: formData.start_date,
        expected_end_date: formData.expected_end_date || undefined,
        total_budget: formData.total_budget ? parseFloat(formData.total_budget) : undefined,
        subsidy_amount: formData.subsidy_amount ? parseFloat(formData.subsidy_amount) : undefined
      };

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('프로젝트 저장 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getStatusOptions = () => [
    { value: 'planning', label: '계획' },
    { value: 'in_progress', label: '진행중' },
    { value: 'completed', label: '완료' },
    { value: 'on_hold', label: '보류' },
    { value: 'cancelled', label: '취소' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {project ? '프로젝트 수정' : '새 프로젝트 생성'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              기본 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로젝트명 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="프로젝트명을 입력하세요"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로젝트 유형 *
                </label>
                <select
                  value={formData.project_type}
                  onChange={(e) => handleChange('project_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="자체자금">자체자금</option>
                  <option value="보조금">보조금</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상태
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {getStatusOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사업장명 *
                </label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => handleChange('business_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.business_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="사업장명을 입력하세요"
                />
                {errors.business_name && <p className="mt-1 text-sm text-red-600">{errors.business_name}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로젝트 설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="프로젝트에 대한 상세 설명을 입력하세요"
                />
              </div>
            </div>
          </div>

          {/* 담당 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5" />
              담당 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  담당 부서 *
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => handleChange('department_id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.department_id ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">부서를 선택하세요</option>
                  {departments.filter(dept => dept.is_active).map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.department_id && <p className="mt-1 text-sm text-red-600">{errors.department_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  담당자 *
                </label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => handleChange('manager_id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.manager_id ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">담당자를 선택하세요</option>
                  {employees
                    .filter(emp => emp.is_active && (!formData.department_id || emp.department_id === formData.department_id))
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                </select>
                {errors.manager_id && <p className="mt-1 text-sm text-red-600">{errors.manager_id}</p>}
              </div>
            </div>
          </div>

          {/* 일정 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              일정 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작일 *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.start_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.start_date && <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  완료 예정일
                </label>
                <input
                  type="date"
                  value={formData.expected_end_date}
                  onChange={(e) => handleChange('expected_end_date', e.target.value)}
                  min={formData.start_date}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.expected_end_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.expected_end_date && <p className="mt-1 text-sm text-red-600">{errors.expected_end_date}</p>}
              </div>
            </div>
          </div>

          {/* 예산 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              예산 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  총 예산 (원)
                </label>
                <input
                  type="number"
                  value={formData.total_budget}
                  onChange={(e) => handleChange('total_budget', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  보조금 금액 (원)
                  {formData.project_type === '보조금' && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="number"
                  value={formData.subsidy_amount}
                  onChange={(e) => handleChange('subsidy_amount', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.subsidy_amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0"
                  min="0"
                  step="1000"
                  max={formData.total_budget || undefined}
                />
                {errors.subsidy_amount && <p className="mt-1 text-sm text-red-600">{errors.subsidy_amount}</p>}
              </div>
            </div>

            {formData.total_budget && formData.subsidy_amount && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                자체 부담금: {(parseFloat(formData.total_budget) - parseFloat(formData.subsidy_amount)).toLocaleString()}원
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? '저장 중...' : (project ? '수정' : '생성')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}