-- 견적서 자동화 시스템 스키마
-- 생성일: 2025-11-07

-- 1. 견적서 템플릿 설정 테이블
CREATE TABLE IF NOT EXISTS estimate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) NOT NULL DEFAULT 'IoT 견적서',

    -- 공급자 정보 (고정)
    supplier_company_name VARCHAR(255) NOT NULL DEFAULT '주식회사 블루온',
    supplier_address TEXT NOT NULL,
    supplier_registration_number VARCHAR(50) NOT NULL,
    supplier_representative VARCHAR(100) NOT NULL,
    supplier_business_type VARCHAR(100),
    supplier_business_category VARCHAR(100),
    supplier_phone VARCHAR(50),
    supplier_fax VARCHAR(50),

    -- 안내사항 (수정 가능)
    terms_and_conditions TEXT NOT NULL DEFAULT '',

    -- 부가세율
    vat_rate DECIMAL(5,2) DEFAULT 10.0,

    -- 메타데이터
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- 2. 견적서 이력 테이블
CREATE TABLE IF NOT EXISTS estimate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 연결 정보
    business_id UUID REFERENCES business_info(id) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES estimate_templates(id) NOT NULL,

    -- 공급받는자 정보 (스냅샷)
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT,
    customer_registration_number VARCHAR(50),
    customer_representative VARCHAR(100),
    customer_business_type VARCHAR(100),
    customer_business_category VARCHAR(100),
    customer_phone VARCHAR(50),

    -- 견적 항목 (JSON - 측정기기, 추가공사비, 협의사항)
    estimate_items JSONB NOT NULL,

    -- 금액 정보
    subtotal DECIMAL(12,2) NOT NULL, -- 공급가액 합계
    vat_amount DECIMAL(12,2) NOT NULL, -- 세액 합계
    total_amount DECIMAL(12,2) NOT NULL, -- 총 합계

    -- 템플릿 정보 스냅샷
    terms_and_conditions TEXT,
    supplier_info JSONB NOT NULL,

    -- 파일 정보
    pdf_file_path TEXT,
    pdf_file_url TEXT,

    -- 메타데이터
    estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
    estimate_number VARCHAR(50), -- 견적서 번호
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_estimate_history_business ON estimate_history(business_id);
CREATE INDEX IF NOT EXISTS idx_estimate_history_date ON estimate_history(estimate_date DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_history_created ON estimate_history(created_at DESC);

-- 기본 템플릿 데이터 삽입
INSERT INTO estimate_templates (
    template_name,
    supplier_company_name,
    supplier_address,
    supplier_registration_number,
    supplier_representative,
    supplier_business_type,
    supplier_business_category,
    supplier_phone,
    supplier_fax,
    terms_and_conditions
) VALUES (
    'IoT 견적서',
    '주식회사 블루온',
    '경상북도 고령군 대가야읍 낫질로 285',
    '679-86-02827',
    '김경수',
    '제조업',
    '전동기및발전기',
    '1661-5543',
    '031-8077-2054',
    '□ VPN 무선 첨부 시 VPN 단 별도의 통신료 약 16,000원(부가세포함)의 발생
□ VPN 유선 첨부 시 통화료 제공 자료 참고 및 현지 확인 필요
□ A/S는 2년 (고객 하자시 경우 유상)
□ 금결: 현금중고시 2년 12월후부터 확인가능
□ 달품기한: 부주일로 부터 1개월
□ 유효기간: 발행일로 부터 1개월
□ 지불조건(보조금): 국비 + 지방비 90%, 사업자부담 10% / 지자체 확정시시(사부담금 10%, 중공금가액 10%) 신입금
   보조금 신청 시 통품 전액 공급가의 부가세(10%)는 사업장 부담이 원칙(환경부 지침)
'
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE estimate_templates IS '견적서 템플릿 설정 (공급자 정보, 안내사항)';
COMMENT ON TABLE estimate_history IS '견적서 생성 이력 (스냅샷 저장)';

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 견적서 자동화 시스템 스키마 생성 완료';
END $$;
