'use client';

import React from 'react';
import { X, Calendar, CheckSquare, Square, Paperclip } from 'lucide-react';
import { getLabelColor } from '@/lib/label-colors';

/**
 * 첨부 파일 메타데이터 타입
 */
interface AttachedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  uploaded_at: string;
}

/**
 * 캘린더 이벤트 데이터 타입
 */
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date?: string | null;
  event_type: 'todo' | 'schedule';
  is_completed: boolean;
  author_id: string;
  author_name: string;
  attached_files?: AttachedFile[];
  labels?: string[];
  created_at: string;
  updated_at: string;
}

interface FilteredEventsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onToggleComplete: (eventId: string, currentStatus: boolean) => void;
  searchQuery: string;
  selectedLabels: string[];
}

/**
 * 필터링된 이벤트 리스트 모달
 * - 검색/라벨 필터 결과를 리스트 형식으로 표시
 * - 이벤트 클릭 시 수정 모드로 전환
 */
export default function FilteredEventsListModal({
  isOpen,
  onClose,
  events,
  onEventClick,
  onToggleComplete,
  searchQuery,
  selectedLabels
}: FilteredEventsListModalProps) {
  if (!isOpen) return null;

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  /**
   * 기간 이벤트 여부 확인
   */
  const isPeriodEvent = (event: CalendarEvent): boolean => {
    return !!(event.end_date && event.end_date !== event.event_date);
  };

  /**
   * 기간 계산
   */
  const getPeriodDays = (event: CalendarEvent): number => {
    if (!isPeriodEvent(event)) return 1;
    const start = new Date(event.event_date);
    const end = new Date(event.end_date!);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  /**
   * Todo 완료 토글
   */
  const handleToggleComplete = (e: React.MouseEvent, eventId: string, currentStatus: boolean) => {
    e.stopPropagation();
    onToggleComplete(eventId, currentStatus);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-4 md:p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">필터 결과 리스트</h2>
            <div className="text-sm text-gray-600 mt-1">
              {searchQuery && <span>검색: "{searchQuery}"</span>}
              {searchQuery && selectedLabels.length > 0 && <span className="mx-2">•</span>}
              {selectedLabels.length > 0 && (
                <span>
                  라벨: {selectedLabels.map(label => {
                    const colors = getLabelColor(label);
                    return (
                      <span
                        key={label}
                        className={`inline-block ml-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 이벤트 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              필터 조건에 맞는 일정이 없습니다.
            </div>
          ) : (
            events.map((event) => {
              const isPeriod = isPeriodEvent(event);
              const periodDays = isPeriod ? getPeriodDays(event) : 0;

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`
                    p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md
                    ${event.event_type === 'todo'
                      ? event.is_completed
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                      : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Todo 체크박스 */}
                    {event.event_type === 'todo' && (
                      <button
                        onClick={(e) => handleToggleComplete(e, event.id, event.is_completed)}
                        className="mt-1 flex-shrink-0"
                      >
                        {event.is_completed ? (
                          <CheckSquare className="w-5 h-5 text-gray-500" />
                        ) : (
                          <Square className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                    )}

                    {/* 이벤트 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 제목 */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className={`font-semibold ${
                            event.event_type === 'todo' && event.is_completed
                              ? 'text-gray-500 line-through'
                              : 'text-gray-900'
                          }`}
                        >
                          {event.title}
                        </h3>
                        <span
                          className={`
                            px-2 py-0.5 rounded text-xs font-medium
                            ${event.event_type === 'todo'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                            }
                          `}
                        >
                          {event.event_type === 'todo' ? '할일' : '일정'}
                        </span>
                      </div>

                      {/* 날짜 */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDate(event.event_date)}
                          {isPeriod && (
                            <>
                              {' → '}
                              {formatDate(event.end_date!)}
                              <span className="ml-1 text-orange-600 font-semibold">
                                ({periodDays}일)
                              </span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* 설명 */}
                      {event.description && (
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {event.description}
                        </p>
                      )}

                      {/* 라벨 및 첨부파일 */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 라벨 */}
                        {event.labels && event.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {event.labels.map(label => {
                              const colors = getLabelColor(label);
                              return (
                                <span
                                  key={label}
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* 첨부파일 */}
                        {event.attached_files && event.attached_files.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{event.attached_files.length}개</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            총 <span className="font-semibold text-purple-600">{events.length}</span>개의 일정
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
