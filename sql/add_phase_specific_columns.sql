-- Phase별 담당자 정보 및 특이사항 컬럼 추가
-- 설치 전 실사, 설치 후, AS 각각 독립적인 데이터 저장

-- 1. 설치 전 실사 (Presurvey) 컬럼
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS presurvey_inspector_name VARCHAR(100);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS presurvey_inspector_contact VARCHAR(20);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS presurvey_inspector_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS presurvey_special_notes TEXT;

-- 2. 설치 후 (Post-Installation) 컬럼
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS postinstall_installer_name VARCHAR(100);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS postinstall_installer_contact VARCHAR(20);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS postinstall_installer_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS postinstall_special_notes TEXT;

-- 3. AS (After Sales) 컬럼
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS aftersales_technician_name VARCHAR(100);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS aftersales_technician_contact VARCHAR(20);
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS aftersales_technician_date DATE;
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS aftersales_special_notes TEXT;

-- 4. 기존 데이터를 presurvey 컬럼으로 마이그레이션 (선택사항)
-- 기존에 입력된 실사자 정보가 있다면 presurvey로 복사
UPDATE business_info
SET
  presurvey_inspector_name = inspector_name,
  presurvey_inspector_contact = inspector_contact,
  presurvey_inspector_date = inspector_date,
  presurvey_special_notes = special_notes
WHERE
  inspector_name IS NOT NULL
  AND presurvey_inspector_name IS NULL;

-- 5. 컬럼 추가 확인
COMMENT ON COLUMN business_info.presurvey_inspector_name IS '설치 전 실사 - 실사자명';
COMMENT ON COLUMN business_info.presurvey_inspector_contact IS '설치 전 실사 - 실사자 연락처';
COMMENT ON COLUMN business_info.presurvey_inspector_date IS '설치 전 실사 - 실사일자';
COMMENT ON COLUMN business_info.presurvey_special_notes IS '설치 전 실사 - 특이사항';

COMMENT ON COLUMN business_info.postinstall_installer_name IS '설치 후 - 설치자명';
COMMENT ON COLUMN business_info.postinstall_installer_contact IS '설치 후 - 설치자 연락처';
COMMENT ON COLUMN business_info.postinstall_installer_date IS '설치 후 - 설치일자';
COMMENT ON COLUMN business_info.postinstall_special_notes IS '설치 후 - 특이사항';

COMMENT ON COLUMN business_info.aftersales_technician_name IS 'AS - AS 담당자명';
COMMENT ON COLUMN business_info.aftersales_technician_contact IS 'AS - AS 담당자 연락처';
COMMENT ON COLUMN business_info.aftersales_technician_date IS 'AS - AS 작업일자';
COMMENT ON COLUMN business_info.aftersales_special_notes IS 'AS - 특이사항';

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_business_presurvey_date ON business_info(presurvey_inspector_date);
CREATE INDEX IF NOT EXISTS idx_business_postinstall_date ON business_info(postinstall_installer_date);
CREATE INDEX IF NOT EXISTS idx_business_aftersales_date ON business_info(aftersales_technician_date);
