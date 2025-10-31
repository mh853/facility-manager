-- ============================================
-- 무선 라우터 재고 관리 테이블
-- ============================================

-- 라우터 재고 테이블
CREATE TABLE IF NOT EXISTS router_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 라우터 기본 정보
  product_name VARCHAR(255) NOT NULL,           -- 라우터 상품명
  serial_number VARCHAR(100) UNIQUE NOT NULL,   -- S/N (시리얼 넘버)
  mac_address VARCHAR(17),                      -- MAC 주소
  imei VARCHAR(15),                             -- IMEI 번호

  -- 입고 정보
  received_date DATE,                           -- 입고일
  received_batch VARCHAR(50),                   -- 입고 배치 번호 (같은 날 입고된 그룹)
  supplier VARCHAR(255),                        -- 공급 업체명

  -- 출고 정보
  shipped_date DATE,                            -- 출고일
  shipped_batch VARCHAR(50),                    -- 출고 배치 번호

  -- 할당 정보
  assigned_business_id UUID REFERENCES business_info(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,         -- 할당 일시
  assigned_by UUID,                             -- 할당한 사용자 ID
  order_management_id UUID REFERENCES order_management(id) ON DELETE SET NULL,

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'in_stock',        -- in_stock(재고), assigned(할당됨), installed(설치완료)

  -- 메타 정보
  notes TEXT,                                   -- 비고
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_router_serial ON router_inventory(serial_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_router_status ON router_inventory(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_router_business ON router_inventory(assigned_business_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_router_shipped ON router_inventory(shipped_date) WHERE is_deleted = FALSE;

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_router_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_router_inventory_updated_at ON router_inventory;

CREATE TRIGGER trigger_router_inventory_updated_at
  BEFORE UPDATE ON router_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_router_inventory_updated_at();

-- RLS (Row Level Security) 정책
ALTER TABLE router_inventory ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Router inventory is viewable by authenticated users" ON router_inventory;
DROP POLICY IF EXISTS "Router inventory is manageable by authenticated users" ON router_inventory;

-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Router inventory is viewable by authenticated users"
  ON router_inventory FOR SELECT
  TO authenticated
  USING (is_deleted = FALSE);

-- 인증된 사용자만 삽입, 수정, 삭제 가능
CREATE POLICY "Router inventory is manageable by authenticated users"
  ON router_inventory FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 주석
COMMENT ON TABLE router_inventory IS '무선 라우터 재고 관리 테이블';
COMMENT ON COLUMN router_inventory.product_name IS '라우터 상품명';
COMMENT ON COLUMN router_inventory.serial_number IS '시리얼 넘버 (S/N)';
COMMENT ON COLUMN router_inventory.mac_address IS 'MAC 주소';
COMMENT ON COLUMN router_inventory.imei IS 'IMEI 번호';
COMMENT ON COLUMN router_inventory.received_date IS '입고일';
COMMENT ON COLUMN router_inventory.shipped_date IS '출고일 (업체에서 발송한 날짜)';
COMMENT ON COLUMN router_inventory.status IS '상태: in_stock(재고), assigned(할당됨), installed(설치완료)';
