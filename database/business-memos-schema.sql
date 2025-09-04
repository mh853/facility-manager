-- Business Memos Table Schema
-- Created: 2025-09-04
-- Purpose: Store business-related memos with CRUD functionality

CREATE TABLE IF NOT EXISTS business_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  
  -- Memo Content
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- User Tracking (준비용 - 계정 시스템 준비 중)
  created_by VARCHAR(100) DEFAULT '관리자',
  updated_by VARCHAR(100) DEFAULT '관리자',
  
  -- Status Management
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Indexing for performance
  CONSTRAINT business_memos_business_id_idx FOREIGN KEY (business_id) REFERENCES business_info(id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_business_memos_business_id ON business_memos(business_id);
CREATE INDEX IF NOT EXISTS idx_business_memos_created_at ON business_memos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_memos_active ON business_memos(is_active, is_deleted);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_business_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_memos_updated_at
  BEFORE UPDATE ON business_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_business_memos_updated_at();

-- RLS (Row Level Security) - 향후 계정 시스템을 위한 준비
ALTER TABLE business_memos ENABLE ROW LEVEL SECURITY;

-- 임시 정책 (모든 접근 허용 - 계정 시스템 구현 후 수정 예정)
CREATE POLICY "Enable all access for business_memos" ON business_memos
  FOR ALL USING (true);

-- 데이터 검증을 위한 제약 조건
ALTER TABLE business_memos 
  ADD CONSTRAINT check_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
  ADD CONSTRAINT check_content_not_empty CHECK (LENGTH(TRIM(content)) > 0);

-- 샘플 데이터를 위한 코멘트
COMMENT ON TABLE business_memos IS '사업장별 업무 메모 관리 테이블 - 진행 현황 및 특이사항 기록용';
COMMENT ON COLUMN business_memos.title IS '메모 제목 (최대 200자)';
COMMENT ON COLUMN business_memos.content IS '메모 내용 (텍스트)';
COMMENT ON COLUMN business_memos.created_by IS '메모 작성자 (향후 계정 시스템 연동)';
COMMENT ON COLUMN business_memos.updated_by IS '메모 수정자 (향후 계정 시스템 연동)';