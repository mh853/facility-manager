-- PDF 출력을 위한 추가 필드 마이그레이션
-- 대기필증 정보 테이블에 시설번호, 그린링크코드, 메모 필드 추가

-- 1. air_permit_info 테이블에 새로운 필드 추가
ALTER TABLE air_permit_info 
ADD COLUMN IF NOT EXISTS facility_number VARCHAR(100), -- 시설번호
ADD COLUMN IF NOT EXISTS green_link_code VARCHAR(100), -- 그린링크코드
ADD COLUMN IF NOT EXISTS memo TEXT; -- 메모

-- 2. 인덱스 추가 (검색 성능 향상을 위해)
CREATE INDEX IF NOT EXISTS idx_air_permit_facility_number ON air_permit_info(facility_number);
CREATE INDEX IF NOT EXISTS idx_air_permit_green_link_code ON air_permit_info(green_link_code);

-- 3. 기존 데이터에 대한 기본값 설정 (필요시)
UPDATE air_permit_info 
SET 
    facility_number = '',
    green_link_code = '',
    memo = ''
WHERE 
    facility_number IS NULL 
    OR green_link_code IS NULL 
    OR memo IS NULL;

-- 4. 주석 추가
COMMENT ON COLUMN air_permit_info.facility_number IS '시설번호 - PDF 출력용';
COMMENT ON COLUMN air_permit_info.green_link_code IS '그린링크코드 - PDF 출력용';
COMMENT ON COLUMN air_permit_info.memo IS '메모 - PDF 출력용 추가 정보';