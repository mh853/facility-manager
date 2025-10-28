'use client'

import { useState, useEffect } from 'react'
import { X, Target, Save, Trash2 } from 'lucide-react'
import { DashboardTarget } from '@/types/dashboard'

interface TargetSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'revenue' | 'receivable' | 'installation';
  onSave: () => void;
}

export default function TargetSettingModal({
  isOpen,
  onClose,
  targetType,
  onSave
}: TargetSettingModalProps) {
  const [targets, setTargets] = useState<DashboardTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string>('');
  const [editingValue, setEditingValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadTargets();
    }
  }, [isOpen, targetType]);

  const loadTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/targets?target_type=${targetType}`);
      const result = await response.json();

      if (result.success) {
        setTargets(result.data);
      }
    } catch (error) {
      console.error('Failed to load targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingMonth || !editingValue) {
      alert('월과 목표값을 모두 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/dashboard/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          month: editingMonth,
          target_value: parseFloat(editingValue.replace(/,/g, ''))
        })
      });

      const result = await response.json();

      if (result.success) {
        setEditingMonth('');
        setEditingValue('');
        await loadTargets();
        onSave();
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to save target:', error);
      alert('목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 목표를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/dashboard/targets?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await loadTargets();
        onSave();
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete target:', error);
      alert('목표 삭제에 실패했습니다.');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString();
  };

  const getTargetLabel = () => {
    switch (targetType) {
      case 'revenue':
        return '순이익 목표';
      case 'receivable':
        return '미수금 목표';
      case 'installation':
        return '설치 목표';
    }
  };

  const getUnitLabel = () => {
    return targetType === 'installation' ? '건' : '원';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">{getTargetLabel()} 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 새 목표 입력 */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">새 목표 추가</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  월 선택
                </label>
                <input
                  type="month"
                  value={editingMonth}
                  onChange={(e) => setEditingMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  목표값 ({getUnitLabel()})
                </label>
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (/^\d*$/.test(value)) {
                      setEditingValue(value ? parseInt(value).toLocaleString() : '');
                    }
                  }}
                  placeholder="예: 50,000,000"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !editingMonth || !editingValue}
              className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '목표 저장'}
            </button>
          </div>

          {/* 기존 목표 목록 */}
          <div>
            <h3 className="font-semibold mb-3">설정된 목표 ({targets.length}개)</h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                목표 목록 로딩 중...
              </div>
            ) : targets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                설정된 목표가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {targets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{target.month}</p>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(target.target_value)} {getUnitLabel()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(target.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
