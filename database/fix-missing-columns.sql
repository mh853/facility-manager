-- 누락된 데이터베이스 컬럼 수정 스크립트
-- 2025-09-01
-- Supabase SQL Editor에서 실행하세요

-- 1. facility_summary 컬럼 추가 (시설 정보 요약용)
ALTER TABLE business_info 
ADD COLUMN IF NOT EXISTS facility_summary JSONB DEFAULT '{}';

-- 2. business_management_code 컬럼 추가 (사업장 관리 코드)
ALTER TABLE business_info 
ADD COLUMN IF NOT EXISTS business_management_code INTEGER;

-- 3. annual_emission_amount 컬럼이 없다면 추가 (air_permit_info 테이블용)
ALTER TABLE air_permit_info 
ADD COLUMN IF NOT EXISTS annual_emission_amount DECIMAL(10,2);

-- 4. 필요한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_info_facility_summary 
ON business_info USING GIN (facility_summary);

CREATE INDEX IF NOT EXISTS idx_business_info_management_code 
ON business_info(business_management_code);

-- 5. 컬럼 설명 추가
COMMENT ON COLUMN business_info.facility_summary IS 
'시설 정보 요약 데이터: {
  "outlets": [
    {
      "outlet": 1, 
      "discharge_count": 5, 
      "prevention_count": 3,
      "discharge_facilities": ["보일러", "건조기"],
      "prevention_facilities": ["집진기", "흡착탑"]
    }
  ],
  "totals": {
    "total_outlets": 2,
    "total_discharge": 15,
    "total_prevention": 8
  },
  "last_updated": "2025-09-01T10:00:00Z"
}';

COMMENT ON COLUMN business_info.business_management_code IS 
'사업장 관리 코드 (정수형)';

-- 6. 기존 데이터 유지하면서 기본값 설정
UPDATE business_info 
SET facility_summary = '{}' 
WHERE facility_summary IS NULL;

-- 실행 완료 확인
SELECT 'Schema update completed successfully' as status;