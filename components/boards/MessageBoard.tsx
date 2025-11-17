'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus, Calendar, Trash2, Edit2 } from 'lucide-react';
import MessageModal from '@/components/modals/MessageModal';
import AllMessagesModal from '@/components/modals/AllMessagesModal';

/**
 * 전달사항 데이터 타입
 */
interface Message {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * 전달사항 보드 컴포넌트
 * - 리스트 스타일로 최근 10개 표시
 * - 인라인 편집 가능
 * - Level 1+ (AUTHENTICATED) 모든 작업 가능
 */
export default function MessageBoard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1); // TODO: 실제 사용자 권한 레벨 가져오기
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>('view');
  const [isAllModalOpen, setIsAllModalOpen] = useState(false);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 5;

  /**
   * 전달사항 목록 조회
   */
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messages?page=${currentPage}&limit=${itemsPerPage}`);
      const result = await response.json();

      if (result.success) {
        const newTotal = result.pagination?.total || result.data.length;
        const maxPage = Math.max(1, Math.ceil(newTotal / itemsPerPage));

        // 현재 페이지가 유효하지 않으면 첫 페이지로
        if (currentPage > maxPage && newTotal > 0) {
          setCurrentPage(1);
          return;
        }

        setMessages(result.data);
        setTotalCount(newTotal);
      } else {
        setError(result.error || '전달사항을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('[전달사항 조회 오류]', err);
      setError('전달사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [currentPage]);

  /**
   * 전달사항 클릭 핸들러 (바로 수정 모드로 열기)
   */
  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  /**
   * 새 전달사항 작성 버튼 클릭
   */
  const handleCreateClick = () => {
    setSelectedMessage(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  /**
   * 전달사항 수정 버튼 클릭
   */
  const handleEditClick = (e: React.MouseEvent, message: Message) => {
    e.stopPropagation();
    setSelectedMessage(message);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  /**
   * 모달 닫기 및 목록 새로고침
   */
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedMessage(null);
  };

  /**
   * 모달 성공 처리 (생성/수정/삭제 후)
   */
  const handleModalSuccess = () => {
    fetchMessages();
  };

  /**
   * 전달사항 삭제 버튼 클릭
   */
  const handleDeleteClick = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();

    if (!confirm('이 전달사항을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        // 목록 새로고침 (페이지 유효성 검사 포함)
        fetchMessages();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('[전달사항 삭제 오류]', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '오늘';
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">전달사항</h2>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">전달사항</h2>
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
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold">전달사항</h2>
          <span className="text-sm text-gray-500">({messages.length})</span>
        </div>
        {userLevel >= 1 && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            작성
          </button>
        )}
      </div>

      {/* 전달사항 목록 */}
      <div className="p-6 h-[400px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 전달사항이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => handleMessageClick(message)}
                onMouseEnter={() => setHoveredId(message.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="
                  p-3 rounded-lg border border-gray-200 cursor-pointer
                  hover:bg-gray-50 hover:border-green-200 transition-all
                  flex items-center justify-between gap-3
                "
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {message.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(message.created_at)}
                    </span>
                    <span>·</span>
                    <span>{message.author_name}</span>
                  </div>
                </div>

                {/* 액션 버튼 (호버 시 표시) */}
                {userLevel >= 1 && hoveredId === message.id && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => handleEditClick(e, message)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, message.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {messages.length > 0 && (
        <div className="p-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
              className="px-3 py-1.5 text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
          <button
            onClick={() => setIsAllModalOpen(true)}
            className="w-full text-sm text-green-600 hover:text-green-700 font-medium"
          >
            전체 전달사항 보기
          </button>
        </div>
      )}

      {/* 전달사항 모달 */}
      <MessageModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        message={selectedMessage}
        mode={modalMode}
        onSuccess={handleModalSuccess}
      />

      {/* 전체 전달사항 모달 */}
      <AllMessagesModal
        isOpen={isAllModalOpen}
        onClose={() => setIsAllModalOpen(false)}
        onMessageClick={(message) => {
          setSelectedMessage(message);
          setModalMode('edit');
          setIsModalOpen(true);
        }}
      />
    </div>
  );
}
