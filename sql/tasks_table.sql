-- Task 관리 테이블 생성 SQL
-- 사용법: Supabase SQL Editor에서 실행

-- 1. facility_tasks 테이블 생성
CREATE TABLE IF NOT EXISTS facility_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT,

  -- 사업장 연동
  business_name TEXT NOT NULL, -- business_info 테이블의 business_name과 연동
  business_id UUID, -- business_info 테이블의 id와 연동 (옵션)

  -- 업무 분류
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('self', 'subsidy')),
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'customer_contact', 'site_inspection', 'quotation', 'contract',
    'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
    'installation', 'balance_payment', 'document_complete',
    -- 보조금 전용 단계
    'application_submit', 'document_supplement', 'pre_construction_inspection',
    'pre_construction_supplement', 'completion_inspection', 'completion_supplement',
    'final_document_submit', 'subsidy_payment'
  )),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- 담당자 및 일정
  assignee TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_name ON facility_tasks(business_name);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_status ON facility_tasks(status);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_type ON facility_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee ON facility_tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_due_date ON facility_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_active ON facility_tasks(is_active, is_deleted);

-- 3. RLS (Row Level Security) 설정
ALTER TABLE facility_tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성 (모든 사용자가 읽기/쓰기 가능 - 필요에 따라 조정)
CREATE POLICY "Enable read access for all users" ON facility_tasks
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON facility_tasks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON facility_tasks
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON facility_tasks
  FOR DELETE USING (true);

-- 5. 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. updated_at 자동 업데이트 트리거 생성
CREATE TRIGGER update_facility_tasks_updated_at
  BEFORE UPDATE ON facility_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 샘플 데이터 삽입 (테스트용)
INSERT INTO facility_tasks (title, business_name, task_type, status, priority, assignee, due_date, description) VALUES
('대기배출시설 설치 검토', '농업회사법인 주식회사 건양', 'self', 'site_inspection', 'high', '이준호', '2024-09-20', '2공장 대기배출시설 설치를 위한 현장 실사 진행'),
('보조금 신청 서류 보완', '오메가칼라', 'subsidy', 'document_supplement', 'medium', '김영희', '2024-09-25', '지자체 요청 서류 보완 작업'),
('신규 고객 상담 및 견적', '테크놀로지코리아', 'self', 'quotation', 'low', null, null, '신규 문의 고객 견적서 작성');

-- 8. 비즈니스 연동을 위한 뷰 생성 (옵션)
CREATE OR REPLACE VIEW facility_tasks_with_business AS
SELECT
  t.*,
  b.address,
  b.manager_name,
  b.manager_contact,
  b.local_government
FROM facility_tasks t
LEFT JOIN business_info b ON t.business_name = b.business_name
WHERE t.is_active = true AND t.is_deleted = false;

COMMENT ON TABLE facility_tasks IS '시설 업무 관리 테이블 - 시설 설치 업무 흐름 관리';
COMMENT ON COLUMN facility_tasks.task_type IS '업무 타입: self(자비), subsidy(보조금)';
COMMENT ON COLUMN facility_tasks.status IS '업무 진행 단계 - 자비/보조금 각각의 워크플로우 단계';
COMMENT ON COLUMN facility_tasks.business_name IS 'business_info 테이블과 연동되는 사업장명';