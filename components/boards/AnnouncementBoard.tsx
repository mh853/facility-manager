'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Pin, Plus, Calendar } from 'lucide-react';

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

/**
 * 공지사항 보드 컴포넌트
 * - 카드 스타일로 최근 5개 표시
 * - 상단 고정 게시물 우선 표시
 * - Level 3+ (SUPER_ADMIN) 작성/수정/삭제 가능
 * - Level 1+ (AUTHENTICATED) 읽기 가능
 */
export default function AnnouncementBoard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(0); // TODO: 실제 사용자 권한 레벨 가져오기

  /**
   * 공지사항 목록 조회
   */
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/announcements?limit=5');
      const result = await response.json();

      if (result.success) {
        setAnnouncements(result.data);
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

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  /**
   * 공지사항 클릭 핸들러
   */
  const handleAnnouncementClick = (announcement: Announcement) => {
    // TODO: 모달 열기
    console.log('공지사항 클릭:', announcement);
  };

  /**
   * 새 공지사항 작성 버튼 클릭
   */
  const handleCreateClick = () => {
    // TODO: 작성 모달 열기
    console.log('새 공지사항 작성');
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
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">공지사항</h2>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded"></div>
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
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">공지사항</h2>
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
          <Bell className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">공지사항</h2>
          <span className="text-sm text-gray-500">({announcements.length})</span>
        </div>
        {userLevel >= 3 && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            작성
          </button>
        )}
      </div>

      {/* 공지사항 목록 */}
      <div className="p-6">
        {announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                onClick={() => handleAnnouncementClick(announcement)}
                className={`
                  p-4 rounded-lg border cursor-pointer transition-all
                  hover:shadow-md hover:border-blue-300
                  ${announcement.is_pinned
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.is_pinned && (
                        <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                      <h3 className="font-medium text-gray-900 truncate">
                        {announcement.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
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

      {/* 더보기 링크 */}
      {announcements.length > 0 && (
        <div className="p-4 border-t">
          <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            전체 공지사항 보기
          </button>
        </div>
      )}
    </div>
  );
}
