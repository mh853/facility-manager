-- ============================================
-- 문서 자동화 시스템 데이터베이스 스키마
-- Created: 2025-11-03
-- ============================================

-- ============================================
-- 1. document_templates 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS document_templates (
  -- 기본 키
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 템플릿 정보
  name VARCHAR(100) NOT NULL,                 -- 템플릿명 (예: 에코센스 발주서)
  description TEXT,                           -- 설명
  document_type VARCHAR(50) NOT NULL,         -- 문서 타입: purchase_order, estimate, contract
  manufacturer VARCHAR(50),                   -- 제조사 (발주서용: ecosense, gaia_cns, cleanearth, evs)

  -- 파일 정보
  file_path TEXT,                             -- 템플릿 파일 경로
  field_mapping JSONB,                        -- 필드 매핑 정보 (향후 확장용)

  -- 상태
  is_active BOOLEAN DEFAULT TRUE,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),

  -- 제약조건
  CONSTRAINT valid_document_type CHECK (document_type IN ('purchase_order', 'estimate', 'contract', 'other'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_manufacturer ON document_templates(manufacturer);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

-- 테이블 코멘트
COMMENT ON TABLE document_templates IS '문서 자동화 템플릿 관리 테이블';
COMMENT ON COLUMN document_templates.document_type IS '문서 타입: purchase_order(발주서), estimate(견적서), contract(계약서)';
COMMENT ON COLUMN document_templates.manufacturer IS '제조사 (발주서용): ecosense, gaia_cns, cleanearth, evs';

-- ============================================
-- 2. document_history 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS document_history (
  -- 기본 키
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 외래 키
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  business_id UUID REFERENCES business_info(id) ON DELETE CASCADE,

  -- 문서 정보
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(200) NOT NULL,        -- 생성된 문서명
  document_data JSONB NOT NULL,               -- 문서 데이터 스냅샷

  -- 파일 정보
  file_path TEXT,                             -- Supabase Storage 경로
  file_format VARCHAR(10) NOT NULL,           -- excel, pdf
  file_size BIGINT,                           -- 파일 크기 (bytes)

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),

  -- 제약조건
  CONSTRAINT valid_file_format CHECK (file_format IN ('excel', 'pdf'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_document_history_business ON document_history(business_id);
CREATE INDEX IF NOT EXISTS idx_document_history_type ON document_history(document_type);
CREATE INDEX IF NOT EXISTS idx_document_history_created ON document_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_history_created_by ON document_history(created_by);

-- 테이블 코멘트
COMMENT ON TABLE document_history IS '문서 생성 이력 관리 테이블';
COMMENT ON COLUMN document_history.document_data IS '문서 생성 시점의 데이터 스냅샷 (JSON)';
COMMENT ON COLUMN document_history.file_format IS '파일 형식: excel, pdf';

-- ============================================
-- 3. 트리거: 업데이트 시각 자동 갱신
-- ============================================

CREATE OR REPLACE FUNCTION update_document_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_templates_updated_at ON document_templates;

CREATE TRIGGER document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_document_templates_timestamp();

-- ============================================
-- 4. 헬퍼 뷰: 문서 이력 상세 정보
-- ============================================

CREATE OR REPLACE VIEW document_history_detail AS
SELECT
  dh.id,
  dh.template_id,
  dh.business_id,
  dh.document_type,
  dh.document_name,
  dh.document_data,
  dh.file_path,
  dh.file_format,
  dh.file_size,
  dh.created_at,

  -- 템플릿 정보
  dt.name as template_name,
  dt.description as template_description,

  -- 사업장 정보
  bi.business_name,
  bi.address,
  bi.manager_name,
  bi.manufacturer,

  -- 생성자 정보
  e.name as created_by_name,
  e.email as created_by_email

FROM document_history dh
LEFT JOIN document_templates dt ON dh.template_id = dt.id
LEFT JOIN business_info bi ON dh.business_id = bi.id
LEFT JOIN employees e ON dh.created_by = e.id
WHERE bi.is_deleted = FALSE
ORDER BY dh.created_at DESC;

COMMENT ON VIEW document_history_detail IS '문서 이력 상세 정보 뷰 (템플릿 + 사업장 + 생성자 정보 포함)';

-- ============================================
-- 5. 기본 템플릿 데이터 삽입
-- ============================================

INSERT INTO document_templates (name, description, document_type, manufacturer, is_active)
VALUES
  ('에코센스 발주서', '에코센스 제조사용 발주서 템플릿', 'purchase_order', 'ecosense', TRUE),
  ('가이아씨앤에스 발주서', '가이아씨앤에스 제조사용 발주서 템플릿', 'purchase_order', 'gaia_cns', TRUE),
  ('크린어스 발주서', '크린어스 제조사용 발주서 템플릿', 'purchase_order', 'cleanearth', TRUE),
  ('EVS 발주서', 'EVS 제조사용 발주서 템플릿', 'purchase_order', 'evs', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. RLS (Row Level Security) 정책
-- ============================================

-- document_templates 테이블 RLS 활성화
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON document_templates;
CREATE POLICY "Enable read access for all users"
  ON document_templates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON document_templates;
CREATE POLICY "Enable insert for authenticated users only"
  ON document_templates FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON document_templates;
CREATE POLICY "Enable update for authenticated users only"
  ON document_templates FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON document_templates;
CREATE POLICY "Enable delete for authenticated users only"
  ON document_templates FOR DELETE
  USING (true);

-- document_history 테이블 RLS 활성화
ALTER TABLE document_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON document_history;
CREATE POLICY "Enable read access for all users"
  ON document_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON document_history;
CREATE POLICY "Enable insert for authenticated users only"
  ON document_history FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 문서 자동화 시스템 데이터베이스 스키마 생성 완료';
  RAISE NOTICE '   - document_templates 테이블 생성';
  RAISE NOTICE '   - document_history 테이블 생성';
  RAISE NOTICE '   - document_history_detail 뷰 생성';
  RAISE NOTICE '   - 기본 템플릿 데이터 삽입 (발주서 4종)';
  RAISE NOTICE '   - RLS 정책 설정 완료';
END $$;
