'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, MessageSquare, Calendar, Search } from 'lucide-react';

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

interface AllMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageClick: (message: Message) => void;
}

/**
 * 전체 전달사항 목록 모달
 */
export default function AllMessagesModal({
  isOpen,
  onClose,
  onMessageClick
}: AllMessagesModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // AbortController ref for cancelling previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 검색어 디바운싱 (300ms)
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * 모달이 열릴 때 검색어 초기화
   * - 데이터 로드는 다른 useEffect에서 자동으로 처리됨 (중복 호출 방지)
   */
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setCurrentPage(1);
      // fetchAllMessages 호출 제거 - 아래 useEffect에서 자동 호출됨
    }
  }, [isOpen]);

  /**
   * 디바운싱된 검색어나 페이지 변경 시 데이터 로드
   */
  useEffect(() => {
    if (isOpen) {
      fetchAllMessages(debouncedSearchQuery, currentPage);
    }
  }, [debouncedSearchQuery, currentPage, isOpen, fetchAllMessages]);

  /**
   * 전체 전달사항 조회
   * - AbortController로 이전 요청 취소
   * - useCallback으로 안정성 확보
   */
  const fetchAllMessages = useCallback(async (search: string = '', page: number = 1) => {
    // 이전 요청이 진행 중이면 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 새 AbortController 생성
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`/api/messages?${params.toString()}`, {
        signal: controller.signal // AbortController 시그널 전달
      });

      const result = await response.json();

      if (result.success) {
        setMessages(result.data);
        setTotalCount(result.pagination?.total || result.data.length);
      } else {
        setError(result.error || '전달사항을 불러오는데 실패했습니다.');
      }
    } catch (err: any) {
      // AbortError는 정상적인 취소이므로 무시
      if (err.name === 'AbortError') {
        console.log('[전달사항 조회] 이전 요청 취소됨');
        return;
      }
      console.error('[전달사항 조회 오류]', err);
      setError('전달사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  전체 전달사항
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {debouncedSearchQuery
                    ? `검색 결과 ${totalCount}개`
                    : `총 ${totalCount}개의 전달사항`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-green-50 rounded-xl transition-all duration-200 hover:rotate-90"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 검색 영역 */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 또는 내용으로 검색..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearchQuery('');
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {debouncedSearchQuery && (
            <p className="text-xs text-gray-500 mt-2">
              "{debouncedSearchQuery}" 검색 결과: {totalCount}개
            </p>
          )}
        </div>

        {/* 본문 */}
        <div className="p-6 pt-3 overflow-y-auto max-h-[calc(90vh-200px)] bg-gradient-to-b from-white to-gray-50/30">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p>{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>
                {debouncedSearchQuery
                  ? `"${debouncedSearchQuery}" 검색 결과가 없습니다`
                  : '등록된 전달사항이 없습니다'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => {
                    onMessageClick(message);
                    onClose();
                  }}
                  className="p-5 rounded-xl border border-gray-200 bg-white cursor-pointer transition-all hover:shadow-md hover:border-green-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-2 truncate">
                        {message.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(message.created_at)}
                        </span>
                        <span>·</span>
                        <span>{message.author_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-green-100 bg-gradient-to-r from-gray-50 to-green-50/30">
          {/* 페이지네이션 */}
          {messages.length > 0 && (
            <div className="flex items-center justify-center p-4 gap-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                className="px-4 py-2 text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
          <div className="flex items-center justify-end p-6 pt-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-white rounded-xl font-semibold transition-all duration-200 hover:shadow-md border-2 border-gray-200 hover:border-gray-300"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
