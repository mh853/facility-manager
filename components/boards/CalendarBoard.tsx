'use client';

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, CheckSquare, Square } from 'lucide-react';

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

/**
 * 캘린더 보드 컴포넌트
 * - 월별 캘린더 뷰
 * - todo/schedule 타입 구분
 * - todo 타입은 완료 체크박스
 * - Level 1+ (AUTHENTICATED) 모든 작업 가능
 */
export default function CalendarBoard() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1); // TODO: 실제 사용자 권한 레벨 가져오기
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * 현재 월의 시작/종료일 계산
   */
  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    return { startDate, endDate };
  };

  /**
   * 캘린더 이벤트 조회
   */
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getMonthRange(currentDate);
      const response = await fetch(`/api/calendar?start_date=${startDate}&end_date=${endDate}`);
      const result = await response.json();

      if (result.success) {
        setEvents(result.data);
      } else {
        setError(result.error || '캘린더 이벤트를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('[캘린더 조회 오류]', err);
      setError('캘린더 이벤트를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  /**
   * 이전 월로 이동
   */
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  /**
   * 다음 월로 이동
   */
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  /**
   * 오늘로 이동
   */
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  /**
   * 새 이벤트 작성
   */
  const handleCreateClick = () => {
    // TODO: 작성 모달 열기
    console.log('새 이벤트 작성');
  };

  /**
   * 이벤트 클릭
   */
  const handleEventClick = (event: CalendarEvent) => {
    // TODO: 모달 열기
    console.log('이벤트 클릭:', event);
  };

  /**
   * Todo 완료 상태 토글
   */
  const handleToggleComplete = async (e: React.MouseEvent, eventId: string, currentStatus: boolean) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/calendar/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus })
      });

      const result = await response.json();

      if (result.success) {
        // 목록 업데이트
        setEvents(events.map(event =>
          event.id === eventId ? { ...event, is_completed: !currentStatus } : event
        ));
      } else {
        alert(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      console.error('[완료 상태 변경 오류]', err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  /**
   * 특정 날짜의 이벤트 가져오기
   */
  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.event_date === dateString);
  };

  /**
   * 캘린더 날짜 배열 생성
   */
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작

    const days: Date[] = [];
    const current = new Date(startDate);

    // 6주 표시 (42일)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">캘린더</h2>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">캘린더</h2>
          </div>
        </div>
        <div className="text-center py-8 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">캘린더</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-medium min-w-[120px] text-center">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="ml-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
        {userLevel >= 1 && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            일정 추가
          </button>
        )}
      </div>

      {/* 캘린더 그리드 */}
      <div className="p-6">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div
              key={day}
              className={`text-center text-sm font-medium py-2 ${
                index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dateString = day.toISOString().split('T')[0];
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateString === today;
            const dayEvents = getEventsForDate(day);

            return (
              <div
                key={index}
                className={`
                  min-h-[80px] p-2 border rounded
                  ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                  ${isToday ? 'ring-2 ring-purple-500' : ''}
                `}
              >
                <div className={`text-sm font-medium mb-1 ${
                  !isCurrentMonth ? 'text-gray-400' :
                  index % 7 === 0 ? 'text-red-600' :
                  index % 7 === 6 ? 'text-blue-600' :
                  'text-gray-900'
                }`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className={`
                        text-xs p-1 rounded cursor-pointer truncate
                        ${event.event_type === 'todo'
                          ? event.is_completed
                            ? 'bg-gray-100 text-gray-500 line-through'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }
                      `}
                    >
                      {event.event_type === 'todo' && (
                        <span
                          onClick={(e) => handleToggleComplete(e, event.id, event.is_completed)}
                          className="inline-block mr-1"
                        >
                          {event.is_completed ? (
                            <CheckSquare className="w-3 h-3 inline" />
                          ) : (
                            <Square className="w-3 h-3 inline" />
                          )}
                        </span>
                      )}
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 pl-1">
                      +{dayEvents.length - 2}개 더
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span>할일</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-100 rounded"></div>
            <span>일정</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span>완료</span>
          </div>
        </div>
      </div>
    </div>
  );
}
