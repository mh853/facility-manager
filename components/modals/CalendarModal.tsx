'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Calendar as CalendarIcon } from 'lucide-react';

/**
 * 캘린더 이벤트 데이터 타입
 */
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: 'todo' | 'schedule';
  is_completed: boolean;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  mode: 'view' | 'create' | 'edit';
  initialDate?: string; // 초기 날짜 (생성 모드용)
  onSuccess?: () => void;
}

/**
 * 캘린더 모달 컴포넌트
 * - 보기/작성/수정 모드 지원
 * - todo/schedule 타입 구분
 * - Level 1+ (AUTHENTICATED) 작성/수정 권한
 */
export default function CalendarModal({
  isOpen,
  onClose,
  event,
  mode,
  initialDate,
  onSuccess
}: CalendarModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<'todo' | 'schedule'>('schedule');
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'view' | 'create' | 'edit'>(mode);

  /**
   * 로컬 타임존에서 날짜를 YYYY-MM-DD 형식으로 변환
   */
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 모달이 열릴 때 기존 데이터 로드
  useEffect(() => {
    if (isOpen) {
      setInternalMode(mode);
      if (event && (mode === 'view' || mode === 'edit')) {
        setTitle(event.title);
        setDescription(event.description || '');
        setEventDate(event.event_date);
        setEventType(event.event_type);
        setIsCompleted(event.is_completed);
      } else if (mode === 'create') {
        setTitle('');
        setDescription('');
        setEventDate(initialDate || formatLocalDate(new Date()));
        setEventType('schedule');
        setIsCompleted(false);
      }
      setError(null);
    }
  }, [isOpen, event, mode, initialDate]);

  if (!isOpen) return null;

  /**
   * 저장 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !eventDate) {
      setError('제목과 날짜를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: 실제 사용자 정보 가져오기
      const authorId = 'temp_user_id';
      const authorName = '사용자';

      if (internalMode === 'create') {
        // 생성
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || null,
            event_date: eventDate,
            event_type: eventType,
            is_completed: eventType === 'todo' ? isCompleted : false,
            author_id: authorId,
            author_name: authorName
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '이벤트 생성에 실패했습니다.');
          return;
        }
      } else if (internalMode === 'edit' && event) {
        // 수정
        const response = await fetch(`/api/calendar/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || null,
            event_date: eventDate,
            event_type: eventType,
            is_completed: eventType === 'todo' ? isCompleted : false
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '이벤트 수정에 실패했습니다.');
          return;
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[캘린더 이벤트 저장 오류]', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 삭제 처리
   */
  const handleDelete = async () => {
    if (!event) return;

    if (!confirm('이 이벤트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/calendar/${event.id}`, {
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
      console.error('[캘린더 이벤트 삭제 오류]', err);
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-purple-100/20">
        {/* 헤더 */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {internalMode === 'create' ? '일정 추가' : internalMode === 'edit' ? '일정 수정' : '일정 상세'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {internalMode === 'create' ? '새로운 일정을 등록하세요' : internalMode === 'edit' ? '일정 정보를 수정하세요' : '일정 상세 정보'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-purple-50 rounded-xl transition-all duration-200 hover:rotate-90"
              disabled={loading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-gradient-to-b from-white to-gray-50/30">
          {internalMode === 'view' && event ? (
            // 보기 모드
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 rounded-2xl p-6 border border-purple-100/50">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                  {event.event_type === 'todo' && (
                    event.is_completed ? (
                      <CheckSquare className="w-6 h-6 text-green-600" />
                    ) : (
                      <Square className="w-6 h-6 text-blue-600" />
                    )
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 rounded-lg border border-purple-100">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-700">{new Date(event.event_date).toLocaleDateString('ko-KR')}</span>
                  </span>
                  <span className={`px-3 py-1.5 rounded-lg font-medium ${
                    event.event_type === 'todo' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                  }`}>
                    {event.event_type === 'todo' ? '할일' : '일정'}
                  </span>
                  {event.event_type === 'todo' && (
                    <span className={`px-3 py-1.5 rounded-lg font-medium ${
                      event.is_completed ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {event.is_completed ? '완료' : '진행중'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                  <span className="font-medium">{event.author_name}</span>
                  <span>·</span>
                  <span>{new Date(event.created_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              {event.description && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-600 mb-2">설명</p>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                  placeholder="일정 제목을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 min-h-[120px] bg-white resize-none"
                  placeholder="일정 설명을 입력하세요 (선택사항)"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    날짜 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    타입 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as 'todo' | 'schedule')}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                    disabled={loading}
                  >
                    <option value="schedule">일정</option>
                    <option value="todo">할일</option>
                  </select>
                </div>
              </div>

              {eventType === 'todo' && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="isCompleted"
                      checked={isCompleted}
                      onChange={(e) => setIsCompleted(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                      disabled={loading}
                    />
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                      완료됨
                    </span>
                  </label>
                </div>
              )}

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
        <div className="flex items-center justify-between p-6 border-t border-purple-100/50 bg-gradient-to-r from-gray-50 to-purple-50/30">
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
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                disabled={loading}
              >
                수정
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                {loading ? '처리 중...' : internalMode === 'create' ? '추가' : '저장'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
