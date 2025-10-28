-- 대시보드 목표 설정 테이블
-- 월별 매출/미수금/설치 목표를 저장하는 테이블

CREATE TABLE IF NOT EXISTS dashboard_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('revenue', 'receivable', 'installation')),
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(target_type, month)
);

-- 인덱스 생성: 타입과 월별 빠른 조회를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_dashboard_targets_type_month
ON dashboard_targets(target_type, month);

-- 테이블 및 컬럼 코멘트
COMMENT ON TABLE dashboard_targets IS '대시보드 월별 목표 설정 테이블';
COMMENT ON COLUMN dashboard_targets.target_type IS '목표 유형 (revenue: 순이익 목표, receivable: 미수금 목표, installation: 설치 건수 목표)';
COMMENT ON COLUMN dashboard_targets.month IS '목표 월 (YYYY-MM 형식, 예: 2025-01)';
COMMENT ON COLUMN dashboard_targets.target_value IS '목표값 (revenue: 원 단위, receivable: 원 단위, installation: 건수)';

-- 업데이트 시 updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_dashboard_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_dashboard_targets_updated_at ON dashboard_targets;
CREATE TRIGGER trigger_update_dashboard_targets_updated_at
BEFORE UPDATE ON dashboard_targets
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_targets_updated_at();

-- 샘플 데이터 삽입 (2025년 1-3월 매출 목표)
INSERT INTO dashboard_targets (target_type, month, target_value) VALUES
  ('revenue', '2025-01', 50000000),
  ('revenue', '2025-02', 55000000),
  ('revenue', '2025-03', 60000000),
  ('revenue', '2025-04', 60000000),
  ('revenue', '2025-05', 65000000),
  ('revenue', '2025-06', 65000000),
  ('installation', '2025-01', 40),
  ('installation', '2025-02', 45),
  ('installation', '2025-03', 50)
ON CONFLICT (target_type, month) DO NOTHING;

-- 테이블 생성 확인
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'dashboard_targets'
ORDER BY ordinal_position;
