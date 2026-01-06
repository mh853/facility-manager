-- dashboard_layouts 테이블 생성
-- 사용자별 대시보드 레이아웃 설정 저장

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL DEFAULT '{
    "widgets": [
      {"id": "organization", "visible": true, "order": 1},
      {"id": "revenue", "visible": true, "order": 2},
      {"id": "receivable", "visible": true, "order": 3},
      {"id": "installation", "visible": true, "order": 4}
    ]
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_dashboard_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dashboard_layouts_updated_at
BEFORE UPDATE ON dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_layouts_updated_at();

COMMENT ON TABLE dashboard_layouts IS '사용자별 대시보드 위젯 레이아웃 설정';
COMMENT ON COLUMN dashboard_layouts.layout_config IS '위젯 표시 여부 및 순서 설정 (JSONB)';
