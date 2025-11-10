-- 영업비용 조정 테이블 생성
-- 생성일: 2025-11-10
-- 설명: 사업장별 영업비용 수동 조정을 위한 테이블

-- 1. 영업비용 조정 테이블
CREATE TABLE IF NOT EXISTS operating_cost_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES business_info(id) NOT NULL,
    adjustment_amount DECIMAL(10,2) NOT NULL,
    adjustment_reason TEXT,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add', 'subtract')),
    applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES employees(id),
    UNIQUE(business_id)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_operating_cost_adj_business ON operating_cost_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_operating_cost_adj_date ON operating_cost_adjustments(applied_date);
CREATE INDEX IF NOT EXISTS idx_operating_cost_adj_type ON operating_cost_adjustments(adjustment_type);

-- 3. 트리거 함수: 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_operating_cost_adj_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS trigger_operating_cost_adj_updated_at ON operating_cost_adjustments;
CREATE TRIGGER trigger_operating_cost_adj_updated_at
    BEFORE UPDATE ON operating_cost_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_operating_cost_adj_updated_at();

-- 5. RLS (Row Level Security) 설정
ALTER TABLE operating_cost_adjustments ENABLE ROW LEVEL SECURITY;

-- 권한 2 이상만 조회 가능
CREATE POLICY "operating_cost_adj_view_policy" ON operating_cost_adjustments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 2
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 권한 3 이상만 생성/수정/삭제 가능
CREATE POLICY "operating_cost_adj_modify_policy" ON operating_cost_adjustments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = auth.uid()
            AND employees.permission_level >= 3
            AND employees.is_active = true
            AND employees.is_deleted = false
        )
    );

-- 6. 테이블 주석
COMMENT ON TABLE operating_cost_adjustments IS '영업비용 사업장별 수동 조정 테이블';
COMMENT ON COLUMN operating_cost_adjustments.adjustment_amount IS '조정 금액 (양수)';
COMMENT ON COLUMN operating_cost_adjustments.adjustment_type IS 'add: 추가, subtract: 차감';
COMMENT ON COLUMN operating_cost_adjustments.adjustment_reason IS '조정 사유';
COMMENT ON COLUMN operating_cost_adjustments.applied_date IS '조정 적용 날짜';
