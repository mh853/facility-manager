-- ============================================
-- Performance Optimization - Core Indexes Only
-- ============================================
-- 실행 시간: 약 1-2분
-- 확인 쿼리 제거, 인덱스 생성만 수행
-- ============================================

-- 인덱스 생성 (5개)
CREATE INDEX IF NOT EXISTS idx_document_history_composite ON document_history(business_id, document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_history_business_id ON document_history(business_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_business_id ON contract_history(business_id);
CREATE INDEX IF NOT EXISTS idx_business_info_business_name ON business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_info_business_name_pattern ON business_info(business_name text_pattern_ops);

-- ✅ 완료! 인덱스가 생성되었습니다.
