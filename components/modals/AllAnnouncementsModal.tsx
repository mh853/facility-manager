'use client';

import React, { useEffect, useState } from 'react';
import { X, Bell, Pin, Calendar } from 'lucide-react';

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

interface AllAnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnnouncementClick: (announcement: Announcement) => void;
}

/**
 * 전체 공지사항 목록 모달
 */
export default function AllAnnouncementsModal({
  isOpen,
  onClose,
  onAnnouncementClick
}: AllAnnouncementsModalProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  /**
   * 모달이 열릴 때 전체 공지사항 로드
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1); // 모달 열 때 페이지 초기화
      fetchAllAnnouncements();
    }
  }, [isOpen]);

  /**
   * 페이지 변경 시 데이터 로드
   */
  useEffect(() => {
    if (isOpen && currentPage > 1) {
      fetchAllAnnouncements();
    }
  }, [currentPage, isOpen]);

  /**
   * 전체 공지사항 조회
   */
  const fetchAllAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/announcements?page=${currentPage}&limit=${itemsPerPage}`);
      const result = await response.json();

      if (result.success) {
        setAnnouncements(result.data);
        setTotalCount(result.pagination?.total || result.data.length);
      } else {
        setError(result.error || '공지사항을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('[공지사항 조회 오류]', err);
      setError('공지사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  전체 공지사항
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  총 {announcements.length}개의 공지사항
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:rotate-90"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-gradient-to-b from-white to-gray-50/30">
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
              <Bell className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p>{error}</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>등록된 공지사항이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  onClick={() => {
                    onAnnouncementClick(announcement);
                    onClose();
                  }}
                  className={`
                    p-5 rounded-xl border cursor-pointer transition-all
                    hover:shadow-md hover:border-blue-300
                    ${announcement.is_pinned
                      ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {announcement.is_pinned && (
                          <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                        <h3 className="font-semibold text-gray-900 truncate">
                          {announcement.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(announcement.created_at)}
                        </span>
                        <span>·</span>
                        <span>{announcement.author_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-blue-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
          {/* 페이지네이션 */}
          {announcements.length > 0 && (
            <div className="flex items-center justify-center p-4 gap-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
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
