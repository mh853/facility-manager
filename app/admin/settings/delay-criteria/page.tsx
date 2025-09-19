'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  Settings,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

// 지연/위험 기준 타입 정의
interface DelayCriteria {
  self: {
    delayed: number;
    risky: number;
  };
  subsidy: {
    delayed: number;
    risky: number;
  };
  as: {
    delayed: number;
    risky: number;
  };
  etc: {
    delayed: number;
    risky: number;
  };
}

// 기본값
const DEFAULT_CRITERIA: DelayCriteria = {
  self: { delayed: 7, risky: 14 },
  subsidy: { delayed: 14, risky: 20 },
  as: { delayed: 3, risky: 7 },
  etc: { delayed: 7, risky: 10 }
};

export default function DelayCriteriaSettingsPage() {
  const [criteria, setCriteria] = useState<DelayCriteria>(DEFAULT_CRITERIA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  // 설정 로드
  useEffect(() => {
    loadCriteria();
  }, []);

  const loadCriteria = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/delay-criteria');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setCriteria(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load criteria:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 설정 저장
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage({ type: null, text: '' });

      const response = await fetch('/api/settings/delay-criteria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(criteria)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: '설정이 성공적으로 저장되었습니다.' });
      } else {
        throw new Error(result.message || '저장에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('Failed to save criteria:', error);
      setMessage({ type: 'error', text: error.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  // 기본값으로 리셋
  const handleReset = () => {
    setCriteria(DEFAULT_CRITERIA);
    setMessage({ type: null, text: '' });
  };

  // 업무 타입별 기준 업데이트
  const updateCriteria = (taskType: keyof DelayCriteria, type: 'delayed' | 'risky', value: number) => {
    setCriteria(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        [type]: value
      }
    }));
    setMessage({ type: null, text: '' });
  };

  // 업무 타입 한글명
  const taskTypeLabels = {
    self: '자비 설치',
    subsidy: '보조금',
    as: 'AS',
    etc: '기타'
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="지연/위험 업무 기준 설정"
        description="업무 타입별로 지연 업무와 위험 업무를 판단하는 기준 일수를 설정할 수 있습니다."
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">설정을 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="지연/위험 업무 기준 설정"
      description="업무 타입별로 지연 업무와 위험 업무를 판단하는 기준 일수를 설정할 수 있습니다."
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            기본값 리셋
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto">

        {/* 알림 메시지 */}
        {message.type && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* 설정 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(taskTypeLabels).map(([taskType, label]) => (
                <div key={taskType} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      taskType === 'self' ? 'bg-blue-500' :
                      taskType === 'subsidy' ? 'bg-green-500' :
                      taskType === 'as' ? 'bg-orange-500' :
                      'bg-gray-500'
                    }`} />
                    {label}
                  </h3>

                  <div className="space-y-4">
                    {/* 지연 기준 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-gray-700">지연 기준</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={criteria[taskType as keyof DelayCriteria].delayed}
                          onChange={(e) => updateCriteria(
                            taskType as keyof DelayCriteria,
                            'delayed',
                            parseInt(e.target.value) || 1
                          )}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">일</span>
                      </div>
                    </div>

                    {/* 위험 기준 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-700">위험 기준</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={criteria[taskType as keyof DelayCriteria].risky}
                          onChange={(e) => updateCriteria(
                            taskType as keyof DelayCriteria,
                            'risky',
                            parseInt(e.target.value) || 1
                          )}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">일</span>
                      </div>
                    </div>

                    {/* 설명 */}
                    <div className="text-xs text-gray-500 mt-2 pl-6">
                      시작일로부터 각각 {criteria[taskType as keyof DelayCriteria].delayed}일, {criteria[taskType as keyof DelayCriteria].risky}일 경과 시 해당 상태로 분류됩니다.
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 안내 사항 */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📌 설정 안내</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• 지연 기준: 시작일로부터 설정된 일수가 지나면 '지연 업무'로 분류됩니다.</li>
                <li>• 위험 기준: 시작일로부터 설정된 일수가 지나면 '위험 업무'로 분류됩니다.</li>
                <li>• 일반적으로 위험 기준은 지연 기준보다 더 큰 값으로 설정합니다.</li>
                <li>• 설정 변경은 즉시 모든 업무 목록에 반영됩니다.</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}