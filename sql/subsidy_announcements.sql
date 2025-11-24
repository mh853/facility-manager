-- 지자체 보조금 공고 모니터링 테이블
-- 소규모 대기배출시설 IoT 지원사업 공고 추적용

CREATE TABLE IF NOT EXISTS subsidy_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 지자체 정보
  region_code VARCHAR(10) NOT NULL,           -- 지자체 코드 (예: '11680' 서울 강남구)
  region_name VARCHAR(100) NOT NULL,          -- 지자체명 (예: '서울특별시 강남구')
  region_type VARCHAR(20) NOT NULL,           -- 광역/기초 구분 ('metropolitan', 'basic')

  -- 공고 정보
  title VARCHAR(500) NOT NULL,                -- 공고 제목
  content TEXT,                               -- 공고 내용 (크롤링된 전문)
  source_url VARCHAR(1000) NOT NULL,          -- 원본 URL

  -- AI 추출 정보
  application_period_start DATE,              -- 신청 시작일
  application_period_end DATE,                -- 신청 마감일
  budget VARCHAR(100),                        -- 예산 (예: '5억원', '미정')
  target_description TEXT,                    -- 지원대상 설명
  support_amount VARCHAR(200),                -- 지원금액 (예: '업체당 최대 500만원')

  -- 메타데이터
  is_relevant BOOLEAN DEFAULT false,          -- IoT 지원사업 관련 여부 (AI 판단)
  relevance_score DECIMAL(3,2),               -- 관련성 점수 (0.00 ~ 1.00)
  keywords_matched TEXT[],                    -- 매칭된 키워드 배열

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'new',           -- 상태: new, reviewing, applied, expired, not_relevant
  is_read BOOLEAN DEFAULT false,              -- 읽음 여부
  notes TEXT,                                 -- 담당자 메모

  -- 타임스탬프
  published_at TIMESTAMP WITH TIME ZONE,      -- 공고 게시일
  crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 크롤링 일시
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_announcements_region ON subsidy_announcements(region_code);
CREATE INDEX idx_announcements_relevant ON subsidy_announcements(is_relevant);
CREATE INDEX idx_announcements_status ON subsidy_announcements(status);
CREATE INDEX idx_announcements_published ON subsidy_announcements(published_at DESC);
CREATE INDEX idx_announcements_application_end ON subsidy_announcements(application_period_end);

-- 중복 방지 (같은 URL은 한 번만)
CREATE UNIQUE INDEX idx_announcements_source_url ON subsidy_announcements(source_url);

-- RLS 정책 (인증된 사용자만 접근)
ALTER TABLE subsidy_announcements ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기 가능
CREATE POLICY "Allow read for authenticated users" ON subsidy_announcements
  FOR SELECT TO authenticated USING (true);

-- 서비스 롤만 삽입/수정 가능 (크롤러용)
CREATE POLICY "Allow insert for service role" ON subsidy_announcements
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow update for service role" ON subsidy_announcements
  FOR UPDATE TO service_role USING (true);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_subsidy_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subsidy_announcements_updated_at
  BEFORE UPDATE ON subsidy_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_subsidy_announcements_updated_at();

-- 지자체 목록 테이블 (크롤링 대상)
CREATE TABLE IF NOT EXISTS local_governments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region_code VARCHAR(10) UNIQUE NOT NULL,
  region_name VARCHAR(100) NOT NULL,
  region_type VARCHAR(20) NOT NULL,           -- 'metropolitan' 또는 'basic'
  parent_region_code VARCHAR(10),             -- 상위 광역시도 코드
  website_url VARCHAR(500),                   -- 공식 홈페이지
  announcement_url VARCHAR(500),              -- 공고 게시판 URL
  is_active BOOLEAN DEFAULT true,             -- 크롤링 활성화 여부
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  crawl_success_count INT DEFAULT 0,
  crawl_fail_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 크롤링 로그 테이블
CREATE TABLE IF NOT EXISTS crawl_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region_code VARCHAR(10),
  status VARCHAR(20) NOT NULL,                -- 'success', 'failed', 'partial'
  announcements_found INT DEFAULT 0,
  relevant_found INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crawl_logs_created ON crawl_logs(created_at DESC);
CREATE INDEX idx_crawl_logs_region ON crawl_logs(region_code);

COMMENT ON TABLE subsidy_announcements IS '지자체 보조금 공고 (소규모 대기배출시설 IoT 지원사업)';
COMMENT ON TABLE local_governments IS '크롤링 대상 지자체 목록';
COMMENT ON TABLE crawl_logs IS '크롤링 실행 로그';
