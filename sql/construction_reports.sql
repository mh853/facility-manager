-- sql/construction_reports.sql
-- 착공신고서 저장 테이블

CREATE TABLE IF NOT EXISTS construction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  business_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  report_number TEXT UNIQUE NOT NULL,

  -- 신고서 데이터 (JSON 형식으로 저장)
  report_data JSONB NOT NULL,

  -- 날짜 정보
  report_date DATE NOT NULL,
  subsidy_approval_date DATE NOT NULL,

  -- 금액 정보
  government_notice_price NUMERIC(12, 2) NOT NULL,
  subsidy_amount NUMERIC(12, 2) NOT NULL,
  self_payment NUMERIC(12, 2) NOT NULL,

  -- 파일 경로 (Supabase Storage)
  file_path TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID,
  created_by_name TEXT,
  created_by_email TEXT,

  -- 삭제 플래그
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_construction_reports_business_id ON construction_reports(business_id);
CREATE INDEX IF NOT EXISTS idx_construction_reports_report_date ON construction_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_construction_reports_created_at ON construction_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_construction_reports_report_number ON construction_reports(report_number);

-- Updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_construction_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER construction_reports_updated_at
  BEFORE UPDATE ON construction_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_construction_reports_updated_at();

-- 코멘트 추가
COMMENT ON TABLE construction_reports IS '착공신고서 정보';
COMMENT ON COLUMN construction_reports.business_id IS '사업장 ID (business_info 테이블 참조)';
COMMENT ON COLUMN construction_reports.report_number IS '신고서 번호 (자동 생성)';
COMMENT ON COLUMN construction_reports.report_data IS '신고서 전체 데이터 (JSON)';
COMMENT ON COLUMN construction_reports.report_date IS '신고서 작성일';
COMMENT ON COLUMN construction_reports.subsidy_approval_date IS '보조금 승인일';
COMMENT ON COLUMN construction_reports.government_notice_price IS '환경부고시가';
COMMENT ON COLUMN construction_reports.subsidy_amount IS '보조금 승인액';
COMMENT ON COLUMN construction_reports.self_payment IS '자부담액';
COMMENT ON COLUMN construction_reports.file_path IS 'Supabase Storage 파일 경로';
