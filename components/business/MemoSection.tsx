'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquarePlus, MessageSquare, Edit3, Trash2 } from 'lucide-react';
import { TokenManager } from '@/lib/api-client';

interface Memo {
  id?: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

interface MemoSectionProps {
  businessId: string;
  businessName: string;
  userPermission: number;
}

export function MemoSection({ businessId, businessName, userPermission }: MemoSectionProps) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [memoForm, setMemoForm] = useState({ title: '', content: '' });
  const [isSaving, setIsSaving] = useState(false);

  // 메모 목록 로드
  useEffect(() => {
    if (!businessId) return;

    const fetchMemos = async () => {
      try {
        setLoading(true);
        const token = TokenManager.getToken();
        const response = await fetch(`/api/businesses/${businessId}/memos`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (data.success && data.data && data.data.memos) {
          setMemos(data.data.memos);
        }
      } catch (error) {
        console.error('메모 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemos();
  }, [businessId]);

  // 메모 추가
  const handleAddMemo = async () => {
    if (!memoForm.title.trim() || !memoForm.content.trim()) return;

    setIsSaving(true);
    try {
      const token = TokenManager.getToken();
      const response = await fetch(`/api/businesses/${businessId}/memos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memoForm)
      });

      const data = await response.json();
      if (data.success && data.data && data.data.memo) {
        setMemos(prev => [data.data.memo, ...prev]);
        setMemoForm({ title: '', content: '' });
        setIsAddingMemo(false);
      } else {
        alert('메모 추가 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('메모 추가 오류:', error);
      alert('메모 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 메모 수정
  const handleEditMemo = async () => {
    if (!editingMemo?.id || !memoForm.title.trim() || !memoForm.content.trim()) return;

    setIsSaving(true);
    try {
      const token = TokenManager.getToken();
      const response = await fetch(`/api/businesses/${businessId}/memos/${editingMemo.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memoForm)
      });

      const data = await response.json();
      if (data.success && data.data && data.data.memo) {
        setMemos(prev => prev.map(m => m.id === editingMemo.id ? data.data.memo : m));
        setMemoForm({ title: '', content: '' });
        setEditingMemo(null);
      } else {
        alert('메모 수정 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('메모 수정 오류:', error);
      alert('메모 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 메모 삭제
  const handleDeleteMemo = async (memo: Memo) => {
    if (!memo.id || !confirm('이 메모를 삭제하시겠습니까?')) return;

    try {
      const token = TokenManager.getToken();
      const response = await fetch(`/api/businesses/${businessId}/memos/${memo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setMemos(prev => prev.filter(m => m.id !== memo.id));
      } else {
        alert('메모 삭제 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('메모 삭제 오류:', error);
      alert('메모 삭제 중 오류가 발생했습니다.');
    }
  };

  const startEditMemo = (memo: Memo) => {
    setEditingMemo(memo);
    setMemoForm({
      title: memo.title,
      content: memo.content
    });
    setIsAddingMemo(false);
  };

  const cancelEdit = () => {
    setEditingMemo(null);
    setIsAddingMemo(false);
    setMemoForm({ title: '', content: '' });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h4 className="text-base font-semibold text-gray-900">메모</h4>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
              {memos.length}개
            </span>
          </div>
          {!isAddingMemo && !editingMemo && userPermission >= 1 && (
            <button
              onClick={() => setIsAddingMemo(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              추가
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">{businessName}</p>
      </div>

      {/* 메모 추가/수정 폼 */}
      {(isAddingMemo || editingMemo) && (
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="text-sm font-medium text-indigo-600 mb-3">
            {editingMemo ? '메모 수정' : '새 메모 추가'}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={memoForm.title}
                onChange={(e) => setMemoForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="메모 제목"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">내용</label>
              <textarea
                value={memoForm.content}
                onChange={(e) => setMemoForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="메모 내용"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={editingMemo ? handleEditMemo : handleAddMemo}
                disabled={isSaving || !memoForm.title.trim() || !memoForm.content.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isSaving ? '저장 중...' : (editingMemo ? '수정' : '추가')}
              </button>
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메모 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-gray-500 py-8">
            메모를 불러오는 중...
          </div>
        ) : memos.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            작성된 메모가 없습니다
          </div>
        ) : (
          memos.map((memo) => {
            const isAutoMemo = memo.title?.startsWith('[자동]');
            return (
              <div
                key={memo.id}
                className={`bg-white rounded-lg p-3 border-l-4 ${
                  isAutoMemo ? 'border-gray-300' : 'border-indigo-400'
                } shadow-sm`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isAutoMemo ? 'text-gray-400' : 'text-indigo-500'}`} />
                      <h5 className={`text-sm font-medium truncate ${isAutoMemo ? 'text-gray-600' : 'text-gray-900'}`}>
                        {memo.title}
                      </h5>
                      {isAutoMemo && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                          자동
                        </span>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed break-words ${isAutoMemo ? 'text-gray-500' : 'text-gray-700'}`}>
                      {memo.content}
                    </p>
                  </div>
                  {!isAutoMemo && memo.id && userPermission >= 1 && (
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => startEditMemo(memo)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="메모 수정"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMemo(memo)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="메모 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span>작성: {new Date(memo.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })} ({memo.created_by})</span>
                  {memo.updated_at !== memo.created_at && (
                    <span className="text-xs text-gray-400">수정됨</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
