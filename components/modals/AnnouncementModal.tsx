'use client';

import React, { useState, useEffect } from 'react';
import { X, Pin, Bell } from 'lucide-react';

/**
 * 공지사항 데이터 타입
 */
interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement?: Announcement | null;
  mode: 'view' | 'create' | 'edit';
  onSuccess?: () => void;
}

/**
 * 공지사항 모달 컴포넌트
 * - 보기/작성/수정 모드 지원
 * - Level 3+ (SUPER_ADMIN) 작성/수정 권한
 */
export default function AnnouncementModal({
  isOpen,
  onClose,
  announcement,
  mode,
  onSuccess
}: AnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'view' | 'create' | 'edit'>(mode);

  // 모달이 열릴 때 기존 데이터 로드
  useEffect(() => {
    if (isOpen) {
      setInternalMode(mode);
      if (announcement && (mode === 'view' || mode === 'edit')) {
        setTitle(announcement.title);
        setContent(announcement.content);
        setIsPinned(announcement.is_pinned);
      } else if (mode === 'create') {
        setTitle('');
        setContent('');
        setIsPinned(false);
      }
      setError(null);
    }
  }, [isOpen, announcement, mode]);

  if (!isOpen) return null;

  /**
   * 저장 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: 실제 사용자 정보 가져오기
      const authorId = 'temp_user_id';
      const authorName = '관리자';

      if (internalMode === 'create') {
        // 생성
        const response = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            is_pinned: isPinned,
            author_id: authorId,
            author_name: authorName
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '공지사항 생성에 실패했습니다.');
          return;
        }
      } else if (internalMode === 'edit' && announcement) {
        // 수정
        const response = await fetch(`/api/announcements/${announcement.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            is_pinned: isPinned
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '공지사항 수정에 실패했습니다.');
          return;
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[공지사항 저장 오류]', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 삭제 처리
   */
  const handleDelete = async () => {
    if (!announcement) return;

    if (!confirm('이 공지사항을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[공지사항 삭제 오류]', err);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-blue-100/20">
        {/* 헤더 */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {internalMode === 'create' ? '공지사항 작성' : internalMode === 'edit' ? '공지사항 수정' : '공지사항'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {internalMode === 'create' ? '새로운 공지사항을 등록하세요' : internalMode === 'edit' ? '공지사항 정보를 수정하세요' : '공지사항 상세 정보'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:rotate-90"
              disabled={loading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-gradient-to-b from-white to-gray-50/30">
          {internalMode === 'view' && announcement ? (
            // 보기 모드
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl p-6 border border-blue-100/50">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{announcement.title}</h3>
                  {announcement.is_pinned && (
                    <Pin className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="font-medium">{announcement.author_name}</span>
                  <span>·</span>
                  <span>{new Date(announcement.created_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">내용</p>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {announcement.content}
                </p>
              </div>
            </div>
          ) : (
            // 작성/수정 모드
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-white"
                  placeholder="공지사항 제목을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 min-h-[200px] bg-white resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                    disabled={loading}
                  />
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Pin className="w-5 h-5 text-blue-600" />
                    상단 고정
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-start gap-2">
                  <span className="text-red-500 text-lg">⚠</span>
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-blue-100/50 bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div>
            {internalMode === 'edit' && (
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all duration-200 hover:shadow-md border-2 border-transparent hover:border-red-200"
                disabled={loading}
              >
                삭제
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-white rounded-xl font-semibold transition-all duration-200 hover:shadow-md border-2 border-gray-200 hover:border-gray-300"
              disabled={loading}
            >
              {internalMode === 'view' ? '닫기' : '취소'}
            </button>
            {internalMode === 'view' ? (
              <button
                onClick={() => setInternalMode('edit')}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                disabled={loading}
              >
                수정
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                {loading ? '처리 중...' : internalMode === 'create' ? '작성' : '저장'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
