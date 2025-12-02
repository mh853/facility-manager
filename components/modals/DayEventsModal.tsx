'use client';

import React from 'react';
import { X, Calendar as CalendarIcon, CheckSquare, Square, Plus, Trash2 } from 'lucide-react';
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
  end_date?: string | null; // 기간 설정용 (nullable)
  start_time?: string | null; // 시작 시간 (HH:MM 형식, nullable)
  end_time?: string | null; // 종료 시간 (HH:MM 형식, nullable)
  event_type: 'todo' | 'schedule';
  is_completed: boolean;
  author_id: string;
  author_name: string;
  attached_files?: AttachedFile[]; // 첨부 파일 배열
  labels?: string[]; // 라벨 배열 (예: ["착공실사", "준공실사"])
  business_id?: string | null; // 연결된 사업장 ID (nullable)
  business_name?: string | null; // 사업장명 (검색 최적화용)
  created_at: string;
  updated_at: string;
}

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onToggleComplete: (eventId: string, currentStatus: boolean) => void;
  onCreateEvent: () => void;
  onDelete: (eventId: string, eventTitle: string) => void;
}

/**
 * 특정 날짜의 모든 이벤트를 보여주는 모달
 */
export default function DayEventsModal({
  isOpen,
  onClose,
  date,
  events,
  onEventClick,
  onToggleComplete,
  onCreateEvent,
  onDelete
}: DayEventsModalProps) {
  if (!isOpen || !date) return null;

  // 이벤트를 타입별로 그룹화
  const todoEvents = events.filter(e => e.event_type === 'todo');
  const scheduleEvents = events.filter(e => e.event_type === 'schedule');

  // 할일을 완료 여부로 정렬
  const incompleteTodos = todoEvents.filter(e => !e.is_completed);
  const completedTodos = todoEvents.filter(e => e.is_completed);

  const formattedDate = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {formattedDate}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              총 {events.length}개의 일정
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>등록된 일정이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 진행 중인 할일 */}
              {incompleteTodos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Square className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">
                      할일 ({incompleteTodos.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {incompleteTodos.map(event => (
                      <div
                        key={event.id}
                        className="group bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 cursor-pointer transition-colors"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(event.id, event.is_completed);
                            }}
                            className="mt-0.5 flex-shrink-0"
                          >
                            <Square className="w-5 h-5 text-blue-600 hover:text-blue-700" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {event.title}
                            </h4>
                            {(event.start_time || event.business_name) && (
                              <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                {event.start_time && (
                                  <span className="font-medium">
                                    🕐 {event.start_time.substring(0, 5)}
                                    {event.end_time && ` ~ ${event.end_time.substring(0, 5)}`}
                                  </span>
                                )}
                                {event.business_name && (
                                  <span className="text-blue-600">
                                    🏢 {event.business_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            {event.labels && event.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {event.labels.map((label, idx) => {
                                  const labelColors = getLabelColor(label);
                                  return (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${labelColors.bg} ${labelColors.text}`}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {event.end_date && event.end_date !== event.event_date && (
                              <div className="text-xs text-blue-600 font-medium mt-2">
                                📅 {new Date(event.event_date).toLocaleDateString('ko-KR')} ~ {new Date(event.end_date).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              {event.author_name} · {new Date(event.created_at).toLocaleString('ko-KR')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(event.id, event.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-lg transition-all text-red-600 hover:text-red-700 flex-shrink-0"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일정 */}
              {scheduleEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">
                      일정 ({scheduleEvents.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {scheduleEvents.map(event => (
                      <div
                        key={event.id}
                        className="group bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 cursor-pointer transition-colors"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {event.title}
                            </h4>
                            {(event.start_time || event.business_name) && (
                              <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                {event.start_time && (
                                  <span className="font-medium">
                                    🕐 {event.start_time.substring(0, 5)}
                                    {event.end_time && ` ~ ${event.end_time.substring(0, 5)}`}
                                  </span>
                                )}
                                {event.business_name && (
                                  <span className="text-purple-600">
                                    🏢 {event.business_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            {event.labels && event.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {event.labels.map((label, idx) => {
                                  const labelColors = getLabelColor(label);
                                  return (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${labelColors.bg} ${labelColors.text}`}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {event.end_date && event.end_date !== event.event_date && (
                              <div className="text-xs text-purple-600 font-medium mt-2">
                                📅 {new Date(event.event_date).toLocaleDateString('ko-KR')} ~ {new Date(event.end_date).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              {event.author_name} · {new Date(event.created_at).toLocaleString('ko-KR')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(event.id, event.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-lg transition-all text-red-600 hover:text-red-700 flex-shrink-0"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 완료된 할일 */}
              {completedTodos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-600">
                      완료됨 ({completedTodos.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {completedTodos.map(event => (
                      <div
                        key={event.id}
                        className="group bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors opacity-75"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(event.id, event.is_completed);
                            }}
                            className="mt-0.5 flex-shrink-0"
                          >
                            <CheckSquare className="w-5 h-5 text-gray-500 hover:text-gray-600" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-600 line-through mb-1">
                              {event.title}
                            </h4>
                            {(event.start_time || event.business_name) && (
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                {event.start_time && (
                                  <span className="font-medium">
                                    🕐 {event.start_time.substring(0, 5)}
                                    {event.end_time && ` ~ ${event.end_time.substring(0, 5)}`}
                                  </span>
                                )}
                                {event.business_name && (
                                  <span>
                                    🏢 {event.business_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-500 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            {event.labels && event.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {event.labels.map((label, idx) => {
                                  const labelColors = getLabelColor(label);
                                  return (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${labelColors.bg} ${labelColors.text}`}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {event.end_date && event.end_date !== event.event_date && (
                              <div className="text-xs text-gray-500 font-medium mt-2">
                                📅 {new Date(event.event_date).toLocaleDateString('ko-KR')} ~ {new Date(event.end_date).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-2">
                              {event.author_name} · {new Date(event.created_at).toLocaleString('ko-KR')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(event.id, event.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-lg transition-all text-red-600 hover:text-red-700 flex-shrink-0"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={onCreateEvent}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            일정 추가
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
