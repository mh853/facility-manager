'use client';

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, CheckSquare, Square } from 'lucide-react';
import CalendarModal from '@/components/modals/CalendarModal';
import DayEventsModal from '@/components/modals/DayEventsModal';

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
  event_type: 'todo' | 'schedule';
  is_completed: boolean;
  author_id: string;
  author_name: string;
  attached_files?: AttachedFile[]; // 첨부 파일 배열
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>('view');
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);

  // 일별 이벤트 목록 모달
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 스크롤 요청 추적용 ref
  const scrollToBottomRef = React.useRef(false);

  // 캘린더 컨테이너 ref (스크롤 타겟용)
  const calendarRef = React.useRef<HTMLDivElement>(null);

  /**
   * 로컬 타임존에서 날짜를 YYYY-MM-DD 형식으로 변환
   */
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * 현재 월의 시작/종료일 계산
   */
  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = formatLocalDate(new Date(year, month, 1));
    const endDate = formatLocalDate(new Date(year, month + 1, 0));
    return { startDate, endDate };
  };

  /**
   * 캘린더 이벤트 조회
   */
  const fetchEvents = async (scrollToBottom = false) => {
    try {
      setLoading(true);
      const { startDate, endDate } = getMonthRange(currentDate);
      const response = await fetch(`/api/calendar?start_date=${startDate}&end_date=${endDate}`);
      const result = await response.json();

      if (result.success) {
        setEvents(result.data);

        // 스크롤 요청 표시
        if (scrollToBottom) {
          console.log('[캘린더] fetchEvents: 스크롤 요청 설정 - scrollToBottom:', scrollToBottom);
          scrollToBottomRef.current = true;
        }
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
   * 이벤트 목록이 업데이트된 후 스크롤 처리
   */
  useEffect(() => {
    if (scrollToBottomRef.current && !loading && calendarRef.current) {
      console.log('[캘린더 스크롤] 스크롤 시작 - 컴포넌트로 스크롤');

      // 리렌더링 완료 후 스크롤
      setTimeout(() => {
        if (calendarRef.current) {
          console.log('[캘린더 스크롤] scrollIntoView 실행');

          // 캘린더 컴포넌트의 하단으로 스크롤
          calendarRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'end', // 컴포넌트 하단이 뷰포트에 보이도록
            inline: 'nearest'
          });

          scrollToBottomRef.current = false;
          console.log('[캘린더 스크롤] 스크롤 완료');
        }
      }, 300);
    }
  }, [events, loading]);

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
    setSelectedEvent(null);
    setModalMode('create');
    setInitialDate(formatLocalDate(new Date()));
    setIsModalOpen(true);
  };

  /**
   * 이벤트 클릭 (바로 수정 모드로 열기)
   */
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  /**
   * 모달 닫기
   */
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setInitialDate(undefined);
  };

  /**
   * 날짜 클릭 (날짜 영역 클릭 시 해당 날짜의 모든 이벤트 표시)
   */
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayModalOpen(true);
  };

  /**
   * 일별 모달 닫기
   */
  const handleDayModalClose = () => {
    setIsDayModalOpen(false);
    setSelectedDate(null);
  };

  /**
   * 일별 모달에서 이벤트 클릭 (바로 수정 모드로 전환)
   */
  const handleDayModalEventClick = (event: CalendarEvent) => {
    setIsDayModalOpen(false);
    setSelectedEvent(event);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  /**
   * 모달 성공 처리 (생성/수정/삭제 후)
   */
  const handleModalSuccess = () => {
    fetchEvents(true); // 페이지 하단으로 스크롤
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

        // 스크롤 요청 표시
        scrollToBottomRef.current = true;
      } else {
        alert(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      console.error('[완료 상태 변경 오류]', err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  /**
   * 이벤트 삭제 (일별 모달에서 호출)
   */
  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`"${eventTitle}" 일정을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/calendar/${eventId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        // 목록에서 제거
        setEvents(events.filter(event => event.id !== eventId));

        console.log(`✅ [캘린더] 일정 삭제 완료: ${eventTitle}`);
      } else {
        alert(result.error || '일정 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('[일정 삭제 오류]', err);
      alert('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  /**
   * 특정 날짜의 이벤트 가져오기
   */
  const getEventsForDate = (date: Date) => {
    const dateString = formatLocalDate(date);
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
  const today = formatLocalDate(new Date());

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
    <div ref={calendarRef} className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="p-4 md:p-6 border-b space-y-3 md:space-y-0">
        {/* 모바일: 세로 레이아웃, 데스크톱: 가로 레이아웃 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* 타이틀 */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">캘린더</h2>
          </div>

          {/* 네비게이션 컨트롤 */}
          <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4">
            {/* 월 네비게이션 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 md:p-1 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                aria-label="이전 달"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm md:text-base font-medium min-w-[100px] md:min-w-[120px] text-center">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </span>
              <button
                onClick={handleNextMonth}
                className="p-2 md:p-1 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                aria-label="다음 달"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 오늘/일정 추가 버튼 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToday}
                className="px-2.5 py-1.5 md:px-3 md:py-1 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors touch-manipulation"
              >
                오늘
              </button>
              {userLevel >= 1 && (
                <button
                  onClick={handleCreateClick}
                  className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 text-xs md:text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">일정 추가</span>
                  <span className="sm:hidden">추가</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="p-3 md:p-6">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div
              key={day}
              className={`text-center text-xs md:text-sm font-medium py-1 md:py-2 ${
                index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1">
          {calendarDays.map((day, index) => {
            const dateString = formatLocalDate(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateString === today;
            const dayEvents = getEventsForDate(day);

            return (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={`
                  h-[70px] md:h-[110px] p-1 md:p-2 border rounded cursor-pointer flex flex-col touch-manipulation
                  ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                  ${isToday ? 'ring-2 ring-purple-500' : ''}
                  transition-colors
                `}
              >
                <div className={`text-xs md:text-sm font-medium mb-0.5 md:mb-1 flex-shrink-0 ${
                  !isCurrentMonth ? 'text-gray-400' :
                  index % 7 === 0 ? 'text-red-600' :
                  index % 7 === 6 ? 'text-blue-600' :
                  'text-gray-900'
                }`}>
                  {day.getDate()}
                </div>

                {/* 데스크톱: 이벤트 박스 표시 */}
                <div className="hidden md:flex flex-1 flex-col overflow-hidden space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
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

                {/* 모바일: 이벤트 도트 표시 */}
                <div className="md:hidden flex flex-1 items-center justify-center gap-0.5">
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            event.event_type === 'todo'
                              ? event.is_completed
                                ? 'bg-gray-400'
                                : 'bg-blue-500'
                              : 'bg-purple-500'
                          }`}
                          title={event.title}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-gray-600 ml-0.5">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-3 md:mt-4 text-xs text-gray-600">
          {/* 데스크톱: 박스 표시 */}
          <div className="hidden md:flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span>할일</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-100 rounded"></div>
            <span>일정</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span>완료</span>
          </div>

          {/* 모바일: 도트 표시 */}
          <div className="md:hidden flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>할일</span>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>일정</span>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>완료</span>
          </div>
        </div>
      </div>

      {/* 캘린더 모달 */}
      <CalendarModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        event={selectedEvent}
        mode={modalMode}
        initialDate={initialDate}
        onSuccess={handleModalSuccess}
      />

      {/* 일별 이벤트 목록 모달 */}
      <DayEventsModal
        isOpen={isDayModalOpen}
        onClose={handleDayModalClose}
        date={selectedDate}
        events={selectedDate ? getEventsForDate(selectedDate) : []}
        onEventClick={handleDayModalEventClick}
        onToggleComplete={async (eventId, currentStatus) => {
          try {
            const response = await fetch(`/api/calendar/${eventId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_completed: !currentStatus })
            });

            const result = await response.json();

            if (result.success) {
              setEvents(events.map(event =>
                event.id === eventId ? { ...event, is_completed: !currentStatus } : event
              ));

              // 스크롤 요청 표시
              scrollToBottomRef.current = true;
            } else {
              alert(result.error || '상태 변경에 실패했습니다.');
            }
          } catch (err) {
            console.error('[완료 상태 변경 오류]', err);
            alert('상태 변경 중 오류가 발생했습니다.');
          }
        }}
        onCreateEvent={() => {
          // 일별 모달 닫기
          setIsDayModalOpen(false);

          // 캘린더 모달을 생성 모드로 열기 (선택된 날짜로)
          setSelectedEvent(null);
          setModalMode('create');
          setInitialDate(selectedDate ? formatLocalDate(selectedDate) : undefined);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
