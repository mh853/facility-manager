-- 대시보드 레이아웃 설정 테이블
-- 사용자별 대시보드 위젯 순서와 표시 여부를 저장

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL DEFAULT '{"widgets": []}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id
ON dashboard_layouts(user_id);

-- 테이블 코멘트
COMMENT ON TABLE dashboard_layouts IS '사용자별 대시보드 레이아웃 설정 (위젯 순서 및 표시 여부)';
COMMENT ON COLUMN dashboard_layouts.user_id IS '사용자 ID (employees 테이블 참조)';
COMMENT ON COLUMN dashboard_layouts.layout_config IS '레이아웃 설정 JSON: { widgets: [{ id: string, visible: boolean, order: number }] }';

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_dashboard_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_dashboard_layouts_updated_at ON dashboard_layouts;
CREATE TRIGGER trigger_update_dashboard_layouts_updated_at
BEFORE UPDATE ON dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_layouts_updated_at();

-- 기본 레이아웃 예시
-- layout_config JSON 구조:
-- {
--   "widgets": [
--     { "id": "organization", "visible": true, "order": 1 },
--     { "id": "revenue", "visible": true, "order": 2 },
--     { "id": "receivable", "visible": true, "order": 3 },
--     { "id": "installation", "visible": true, "order": 4 }
--   ]
-- }
