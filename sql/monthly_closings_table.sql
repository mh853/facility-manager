-- 월별 마감 데이터 테이블
CREATE TABLE IF NOT EXISTS monthly_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 기간 정보
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 집계 데이터 (설치일 기준)
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,           -- 총 매출
  sales_commission_costs NUMERIC(12,2) NOT NULL DEFAULT 0,   -- 영업비 지급비용
  installation_costs NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 설치비 지급비용
  miscellaneous_costs NUMERIC(12,2) NOT NULL DEFAULT 0,      -- 기타 비용 합계
  net_profit NUMERIC(12,2) NOT NULL DEFAULT 0,               -- 순이익

  -- 메타 정보
  business_count INTEGER DEFAULT 0,                          -- 해당 월 설치 완료 사업장 수
  is_closed BOOLEAN DEFAULT FALSE,                           -- 마감 여부
  closed_at TIMESTAMP WITH TIME ZONE,                        -- 마감 일시
  closed_by UUID,                                            -- 마감 처리자 (users 테이블 참조)

  -- 시스템 필드
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 고유 제약조건 (연도+월은 유일)
  UNIQUE(year, month)
);

-- 기타 비용 항목 테이블
CREATE TABLE IF NOT EXISTS miscellaneous_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 연관 정보
  monthly_closing_id UUID NOT NULL REFERENCES monthly_closings(id) ON DELETE CASCADE,

  -- 비용 상세
  item_name VARCHAR(255) NOT NULL,                           -- 비용 항목명
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),         -- 비용 금액
  description TEXT,                                           -- 비용 설명

  -- 메타 정보
  created_by UUID,                                           -- 등록자 (users 테이블 참조)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_monthly_closings_year_month ON monthly_closings(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_created_at ON monthly_closings(created_at);
CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_monthly_closing ON miscellaneous_costs(monthly_closing_id);
CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_created_at ON miscellaneous_costs(created_at);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_monthly_closings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_monthly_closings_updated_at
  BEFORE UPDATE ON monthly_closings
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_closings_updated_at();

CREATE OR REPLACE FUNCTION update_miscellaneous_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_miscellaneous_costs_updated_at
  BEFORE UPDATE ON miscellaneous_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_miscellaneous_costs_updated_at();

-- 설명 추가
COMMENT ON TABLE monthly_closings IS '월별 재무 마감 데이터 (설치일 기준 집계)';
COMMENT ON TABLE miscellaneous_costs IS '월별 기타 비용 항목 상세';

COMMENT ON COLUMN monthly_closings.total_revenue IS '총 매출 (해당 월 설치 완료 사업장 매출 합계)';
COMMENT ON COLUMN monthly_closings.sales_commission_costs IS '영업비 지급 비용 합계';
COMMENT ON COLUMN monthly_closings.installation_costs IS '설치비 지급 비용 합계';
COMMENT ON COLUMN monthly_closings.miscellaneous_costs IS '기타 비용 합계 (miscellaneous_costs 테이블 금액 합산)';
COMMENT ON COLUMN monthly_closings.net_profit IS '순이익 (매출 - 영업비 - 설치비 - 기타비용)';
