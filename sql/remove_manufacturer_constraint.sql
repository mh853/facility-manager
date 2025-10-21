-- 제조사 CHECK 제약 조건 완전 제거
-- 목적: 어떤 제조사명이든 입력 가능하도록 유연성 확보

BEGIN;

-- business_info 테이블의 manufacturer CHECK 제약 조건 삭제
ALTER TABLE business_info
DROP CONSTRAINT IF EXISTS business_info_manufacturer_check;

-- manufacturer_pricing 테이블의 manufacturer CHECK 제약 조건 삭제
ALTER TABLE manufacturer_pricing
DROP CONSTRAINT IF EXISTS manufacturer_pricing_manufacturer_check;

COMMIT;

-- 확인
SELECT 'CHECK 제약 조건이 삭제되었습니다. 이제 어떤 제조사명이든 입력 가능합니다.' as message;
