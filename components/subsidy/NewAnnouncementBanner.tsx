/**
 * New Announcement Banner Component
 *
 * Displays notification when new announcements arrive via Realtime
 */

interface NewAnnouncementBannerProps {
  count: number;
  onRefresh: () => void;
  onDismiss: () => void;
}

export default function NewAnnouncementBanner({
  count,
  onRefresh,
  onDismiss
}: NewAnnouncementBannerProps) {
  if (count === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <div className="bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">
            새로운 공고 {count}건이 추가되었습니다
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-4 py-1.5 bg-white text-indigo-600 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-indigo-500 rounded-md transition-colors"
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
