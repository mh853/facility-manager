-- 택배 주소 관리 시스템
-- 자주 사용하는 택배 주소를 저장하고 관리

-- ============================================================================
-- 1. 택배 주소 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 주소 정보
  name VARCHAR(100) NOT NULL,  -- 주소 별칭 (예: "본사", "경기 창고", "부산 지사")
  recipient VARCHAR(100) NOT NULL,  -- 수령인
  phone VARCHAR(20) NOT NULL,  -- 연락처
  address TEXT NOT NULL,  -- 전체 주소
  postal_code VARCHAR(10),  -- 우편번호

  -- 기본 주소 설정
  is_default BOOLEAN DEFAULT FALSE,  -- 기본 주소 여부

  -- 사용 통계
  use_count INTEGER DEFAULT 0,  -- 사용 횟수
  last_used_at TIMESTAMPTZ,  -- 마지막 사용일

  -- 메타 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  is_active BOOLEAN DEFAULT TRUE,  -- 활성화 여부
  notes TEXT  -- 메모
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_is_default ON delivery_addresses(is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_is_active ON delivery_addresses(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_use_count ON delivery_addresses(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_last_used ON delivery_addresses(last_used_at DESC);

-- 코멘트
COMMENT ON TABLE delivery_addresses IS '발주서 작성시 사용할 택배 주소 관리';
COMMENT ON COLUMN delivery_addresses.name IS '주소 별칭 (빠른 선택용)';
COMMENT ON COLUMN delivery_addresses.is_default IS '기본 주소 여부 (하나만 TRUE 가능)';
COMMENT ON COLUMN delivery_addresses.use_count IS '사용 횟수 (자동 증가)';

-- ============================================================================
-- 2. 기본 주소 자동 관리 트리거
-- ============================================================================
-- 새로운 기본 주소 설정 시 기존 기본 주소 해제
CREATE OR REPLACE FUNCTION manage_default_delivery_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- 다른 모든 주소의 기본 설정 해제
    UPDATE delivery_addresses
    SET is_default = FALSE
    WHERE id != NEW.id AND is_default = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manage_default_delivery_address
  BEFORE INSERT OR UPDATE OF is_default
  ON delivery_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION manage_default_delivery_address();

-- ============================================================================
-- 3. 초기 데이터 (블루온 본사)
-- ============================================================================
INSERT INTO delivery_addresses (name, recipient, phone, address, postal_code, is_default, created_by)
VALUES (
  '블루온 본사',
  '블루온 IoT',
  '010-0000-0000',
  '서울특별시 강남구 테헤란로 123',
  '06234',
  TRUE,
  (SELECT id FROM employees WHERE permission_level = 4 LIMIT 1)
) ON CONFLICT DO NOTHING;
