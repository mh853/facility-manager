-- 계약서 이력 테이블
CREATE TABLE IF NOT EXISTS contract_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('subsidy', 'self_pay')),
  contract_number TEXT NOT NULL UNIQUE,
  contract_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  business_address TEXT,
  business_representative TEXT,
  pdf_file_url TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 계약서 템플릿 테이블
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_type TEXT NOT NULL CHECK (contract_type IN ('subsidy', 'self_pay')),
  template_name TEXT NOT NULL,
  supplier_company_name TEXT DEFAULT '주식회사 블루온',
  supplier_representative TEXT DEFAULT '김 경 수',
  supplier_address TEXT DEFAULT '경상북도 고령군 대가야읍 넷질로285 (1661-5543)',
  terms_and_conditions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_type, is_active)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_contract_history_business_id ON contract_history(business_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_type ON contract_history(contract_type);
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_date ON contract_history(contract_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_history_created_at ON contract_history(created_at DESC);

-- 기본 템플릿 데이터 삽입 (보조금 계약서)
INSERT INTO contract_templates (
  contract_type,
  template_name,
  supplier_company_name,
  supplier_representative,
  supplier_address,
  terms_and_conditions
) VALUES (
  'subsidy',
  '소규모 방지시설 IoT 설치 계약서 (보조금)',
  '주식회사 블루온',
  '김 경 수',
  '경상북도 고령군 대가야읍 넷질로285 (1661-5543)',
  '제1조(계약당사자)부터 제12조(관할법원)까지의 표준 약관'
) ON CONFLICT (contract_type, is_active)
WHERE is_active = TRUE
DO NOTHING;

-- 기본 템플릿 데이터 삽입 (자비 계약서)
INSERT INTO contract_templates (
  contract_type,
  template_name,
  supplier_company_name,
  supplier_representative,
  supplier_address,
  terms_and_conditions
) VALUES (
  'self_pay',
  '소규모 방지시설 IoT 설치 계약서 (자비)',
  '주식회사 블루온',
  '김 경 수',
  '경상북도 고령군 대가야읍 넷질로285 (1661-5543)',
  '제1조(계약당사자)부터 제12조(관할법원)까지의 표준 약관'
) ON CONFLICT (contract_type, is_active)
WHERE is_active = TRUE
DO NOTHING;

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE contract_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 인증된 사용자는 모든 계약서 조회 가능
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contract_history;
CREATE POLICY "Enable read access for authenticated users" ON contract_history
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS 정책: 인증된 사용자는 계약서 생성 가능
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON contract_history;
CREATE POLICY "Enable insert access for authenticated users" ON contract_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 정책: 인증된 사용자는 계약서 수정 가능
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON contract_history;
CREATE POLICY "Enable update access for authenticated users" ON contract_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS 정책: 인증된 사용자는 계약서 삭제 가능 (애플리케이션 레벨에서 권한 4 확인)
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON contract_history;
CREATE POLICY "Enable delete access for authenticated users" ON contract_history
  FOR DELETE
  TO authenticated
  USING (true);

-- 템플릿 RLS 정책
DROP POLICY IF EXISTS "Enable read access for templates" ON contract_templates;
CREATE POLICY "Enable read access for templates" ON contract_templates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable update access for templates" ON contract_templates;
CREATE POLICY "Enable update access for templates" ON contract_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE contract_history IS '계약서 생성 이력 및 PDF 파일 저장';
COMMENT ON TABLE contract_templates IS '계약서 템플릿 설정 (보조금/자비)';
COMMENT ON COLUMN contract_history.contract_type IS 'subsidy: 보조금, self_pay: 자비';
COMMENT ON COLUMN contract_history.contract_number IS '계약서 번호 (예: CONT-20250111-001)';
