// 지자체 보조금 공고 모니터링 시스템 타입 정의

export type AnnouncementStatus = 'new' | 'reviewing' | 'applied' | 'expired' | 'not_relevant';
export type RegionType = 'metropolitan' | 'basic';
export type CrawlStatus = 'success' | 'failed' | 'partial';

// 보조금 공고
export interface SubsidyAnnouncement {
  id: string;

  // 지자체 정보
  region_code: string;
  region_name: string;
  region_type: RegionType;

  // 공고 정보
  title: string;
  content?: string;
  source_url: string;

  // AI 추출 정보
  application_period_start?: string;  // ISO date
  application_period_end?: string;    // ISO date
  budget?: string;
  target_description?: string;
  support_amount?: string;

  // 메타데이터
  is_relevant: boolean;
  relevance_score?: number;
  keywords_matched?: string[];

  // 상태
  status: AnnouncementStatus;
  is_read: boolean;
  notes?: string;

  // 타임스탬프
  published_at?: string;
  crawled_at: string;
  created_at: string;
  updated_at: string;
}

// 지자체 정보
export interface LocalGovernment {
  id: string;
  region_code: string;
  region_name: string;
  region_type: RegionType;
  parent_region_code?: string;
  website_url?: string;
  announcement_url?: string;
  is_active: boolean;
  last_crawled_at?: string;
  crawl_success_count: number;
  crawl_fail_count: number;
  created_at: string;
  updated_at: string;
}

// 크롤링 로그
export interface CrawlLog {
  id: string;
  region_code?: string;
  status: CrawlStatus;
  announcements_found: number;
  relevant_found: number;
  error_message?: string;
  duration_ms?: number;
  created_at: string;
}

// API 응답
export interface AnnouncementsResponse {
  success: boolean;
  data?: {
    announcements: SubsidyAnnouncement[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  error?: string;
}

// 필터 옵션
export interface AnnouncementFilters {
  status?: AnnouncementStatus | 'all';
  isRelevant?: boolean;
  isRead?: boolean;
  regionCode?: string;
  regionType?: RegionType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'published_at' | 'created_at' | 'application_period_end' | 'relevance_score';
  sortOrder?: 'asc' | 'desc';
}

// Gemini AI 분석 결과
export interface GeminiAnalysisResult {
  is_relevant: boolean;
  relevance_score: number;
  keywords_matched: string[];
  extracted_info: {
    application_period_start?: string;
    application_period_end?: string;
    budget?: string;
    target_description?: string;
    support_amount?: string;
  };
  reasoning?: string;
}

// 크롤링 요청
export interface CrawlRequest {
  region_codes?: string[];  // 특정 지자체만 크롤링 (없으면 전체)
  force?: boolean;          // 이미 크롤링한 URL도 다시 처리
  enable_phase2?: boolean;  // Phase 2 환경기관 크롤링 활성화 (기본값: false)
}

// 크롤링 결과
export interface CrawlResult {
  success: boolean;
  total_regions: number;
  successful_regions: number;
  failed_regions: number;
  new_announcements: number;
  relevant_announcements: number;
  duration_ms: number;
  errors?: Array<{
    region_code: string;
    error: string;
  }>;
}

// 대시보드 통계
export interface SubsidyDashboardStats {
  total_announcements: number;
  relevant_announcements: number;
  unread_count: number;
  new_this_week: number;
  expiring_soon: number;  // 마감 7일 이내
  by_status: Record<AnnouncementStatus, number>;
  by_region_type: Record<RegionType, number>;
  recent_crawl?: CrawlLog;
}
