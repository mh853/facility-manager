'use client';

import { useState, useEffect } from 'react';
import { ManualAnnouncementRequest } from '@/types/subsidy';
import { TokenManager } from '@/lib/api-client';

interface ManualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (announcementData: ManualAnnouncementRequest, editMode: boolean) => Promise<{ success: boolean; error?: string }>;
  editMode?: boolean;
  existingData?: any; // SubsidyAnnouncement type
}

export default function ManualUploadModal({ isOpen, onClose, onSuccess, editMode = false, existingData }: ManualUploadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ManualAnnouncementRequest>(() => {
    if (editMode && existingData) {
      return {
        region_name: existingData.region_name || '',
        title: existingData.title || '',
        source_url: existingData.source_url || '',
        content: existingData.content || '',
        application_period_start: existingData.application_period_start || '',
        application_period_end: existingData.application_period_end || '',
        budget: existingData.budget || '',
        support_amount: existingData.support_amount || '',
        target_description: existingData.target_description || '',
        published_at: existingData.published_at ? existingData.published_at.split('T')[0] : '',
        notes: existingData.notes || ''
      };
    }
    return {
      region_name: '',
      title: '',
      source_url: '',
      content: '',
      application_period_start: '',
      application_period_end: '',
      budget: '',
      support_amount: '',
      target_description: '',
      published_at: '',
      notes: ''
    };
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // editMode와 existingData가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (editMode && existingData) {
      setFormData({
        region_name: existingData.region_name || '',
        title: existingData.title || '',
        source_url: existingData.source_url || '',
        content: existingData.content || '',
        application_period_start: existingData.application_period_start || '',
        application_period_end: existingData.application_period_end || '',
        budget: existingData.budget || '',
        support_amount: existingData.support_amount || '',
        target_description: existingData.target_description || '',
        published_at: existingData.published_at ? existingData.published_at.split('T')[0] : '',
        notes: existingData.notes || ''
      });
    } else if (!isOpen) {
      // 모달이 닫힐 때 폼 초기화
      setFormData({
        region_name: '',
        title: '',
        source_url: '',
        content: '',
        application_period_start: '',
        application_period_end: '',
        budget: '',
        support_amount: '',
        target_description: '',
        published_at: '',
        notes: ''
      });
      setValidationErrors({});
      setError(null);
    }
  }, [editMode, existingData, isOpen]);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.region_name.trim()) {
      errors.region_name = '지역명을 입력해주세요.';
    }

    if (!formData.title.trim()) {
      errors.title = '제목을 입력해주세요.';
    }

    if (!formData.source_url.trim()) {
      errors.source_url = '출처 URL을 입력해주세요.';
    } else {
      try {
        new URL(formData.source_url);
      } catch {
        errors.source_url = '유효한 URL 형식이 아닙니다.';
      }
    }

    // Validate date range if both dates are provided
    if (formData.application_period_start && formData.application_period_end) {
      const startDate = new Date(formData.application_period_start);
      const endDate = new Date(formData.application_period_end);
      if (endDate < startDate) {
        errors.application_period_end = '마감일은 시작일 이후여야 합니다.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare request body (remove empty strings and commas from number fields)
      const requestBody: Partial<ManualAnnouncementRequest> = {
        region_name: formData.region_name,
        title: formData.title,
        source_url: formData.source_url,
      };

      if (formData.content) requestBody.content = formData.content;
      if (formData.application_period_start) requestBody.application_period_start = formData.application_period_start;
      if (formData.application_period_end) requestBody.application_period_end = formData.application_period_end;
      if (formData.budget) requestBody.budget = removeCommas(formData.budget); // 콤마 제거
      if (formData.support_amount) requestBody.support_amount = removeCommas(formData.support_amount); // 콤마 제거
      if (formData.target_description) requestBody.target_description = formData.target_description;
      if (formData.published_at) requestBody.published_at = formData.published_at;
      if (formData.notes) requestBody.notes = formData.notes;

      // 수정 모드일 경우 id 포함
      const dataToSend = editMode ? { id: existingData?.id, ...requestBody } : requestBody;

      console.log('Sending data to parent:', dataToSend);

      // 부모 컴포넌트의 낙관적 업데이트 함수 호출
      const result = await onSuccess(dataToSend as ManualAnnouncementRequest, editMode);

      if (result.success) {
        // 성공: 폼 초기화 및 모달 닫기
        setFormData({
          region_name: '',
          title: '',
          source_url: '',
          content: '',
          application_period_start: '',
          application_period_end: '',
          budget: '',
          support_amount: '',
          target_description: '',
          published_at: '',
          notes: ''
        });
        setValidationErrors({});
        onClose();
      } else {
        // 실패: 에러 표시 (롤백은 부모가 처리)
        setError(result.error || '저장에 실패했습니다.');
      }

    } catch (err) {
      console.error('Manual announcement submission error:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 숫자에 천 단위 콤마 추가
  const formatNumberWithCommas = (value: string): string => {
    // Remove all non-digit characters
    const numbers = value.replace(/[^\d]/g, '');
    // Add commas
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 콤마 제거하고 숫자만 추출
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  const handleChange = (field: keyof ManualAnnouncementRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 예산/지원금액 필드 전용 핸들러 (천 단위 콤마)
  const handleNumberChange = (field: 'budget' | 'support_amount', value: string) => {
    const formatted = formatNumberWithCommas(value);
    setFormData(prev => ({ ...prev, [field]: formatted }));
    // Clear validation error
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{editMode ? '✏️ 공고 수정' : '✍️ 수동 공고 등록'}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Region Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지역명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.region_name}
                onChange={(e) => handleChange('region_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  validationErrors.region_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="예: 서울특별시, 경기도 성남시"
                disabled={isSubmitting}
              />
              {validationErrors.region_name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.region_name}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공고 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  validationErrors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="공고 제목을 입력하세요"
                disabled={isSubmitting}
              />
              {validationErrors.title && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
              )}
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                출처 URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={formData.source_url}
                onChange={(e) => handleChange('source_url', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  validationErrors.source_url ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://example.com/announcement"
                disabled={isSubmitting}
              />
              {validationErrors.source_url && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.source_url}</p>
              )}
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공고 내용
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="공고의 주요 내용을 입력하세요"
                disabled={isSubmitting}
              />
            </div>

            {/* Application Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  신청 시작일
                </label>
                <input
                  type="date"
                  value={formData.application_period_start}
                  onChange={(e) => handleChange('application_period_start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  신청 마감일
                </label>
                <input
                  type="date"
                  value={formData.application_period_end}
                  onChange={(e) => handleChange('application_period_end', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    validationErrors.application_period_end ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {validationErrors.application_period_end && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.application_period_end}</p>
                )}
              </div>
            </div>

            {/* Budget and Support Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예산 규모
                </label>
                <input
                  type="text"
                  value={formData.budget}
                  onChange={(e) => handleNumberChange('budget', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="예: 10,000,000"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">숫자만 입력하세요 (천 단위 콤마 자동)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  지원 금액
                </label>
                <input
                  type="text"
                  value={formData.support_amount}
                  onChange={(e) => handleNumberChange('support_amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="예: 100,000,000"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">숫자만 입력하세요 (천 단위 콤마 자동)</p>
              </div>
            </div>

            {/* Target Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지원 대상
              </label>
              <input
                type="text"
                value={formData.target_description}
                onChange={(e) => handleChange('target_description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="예: 중소기업, 제조업체"
                disabled={isSubmitting}
              />
            </div>

            {/* Published At */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공고일
              </label>
              <input
                type="date"
                value={formData.published_at}
                onChange={(e) => handleChange('published_at', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="추가 메모사항"
                disabled={isSubmitting}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (editMode ? '수정 중...' : '등록 중...') : (editMode ? '수정하기' : '등록하기')}
              </button>
            </div>
          </form>

          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              💡 <strong>수동 등록 공고는 자동으로 관련도 100%로 설정됩니다.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
