-- sql/update_supplier_info.sql
-- 공급자 정보 업데이트 (주식회사 블루온)

UPDATE estimate_templates
SET
    supplier_company_name = '주식회사 블루온',
    supplier_registration_number = '679-86-02827',
    supplier_representative = '김경수',
    supplier_business_type = '제조업',
    supplier_business_category = '전동기및발전기',
    supplier_address = '경상북도 고령군 대가야읍 낫질로 285',
    supplier_phone = '1661-5543',
    supplier_fax = '031-8077-2054',
    updated_at = NOW()
WHERE template_name = 'IoT 설치 견적서'
  AND is_active = TRUE;

-- 업데이트 확인
SELECT
    supplier_company_name,
    supplier_registration_number,
    supplier_representative,
    supplier_business_type,
    supplier_business_category,
    supplier_address,
    supplier_phone,
    supplier_fax
FROM estimate_templates
WHERE template_name = 'IoT 설치 견적서'
  AND is_active = TRUE;
