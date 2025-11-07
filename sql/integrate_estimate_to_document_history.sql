-- sql/integrate_estimate_to_document_history.sql
-- 견적서 이력을 실행 이력에 통합

-- document_history_detail 뷰 재생성 (견적서 포함)
DROP VIEW IF EXISTS document_history_detail;

CREATE OR REPLACE VIEW document_history_detail AS
-- 기존 발주서 이력
SELECT
  dh.id,
  dh.business_id,
  bi.business_name,
  dh.document_type,
  dh.file_format,
  dh.file_path,
  dh.file_size,
  dh.created_by,
  u.name as created_by_name,
  dh.created_at,
  NULL::jsonb as metadata
FROM document_history dh
LEFT JOIN business_info bi ON dh.business_id = bi.id
LEFT JOIN users u ON dh.created_by::text = u.id::text

UNION ALL

-- 견적서 이력 추가
SELECT
  eh.id,
  eh.business_id,
  eh.business_name,
  'estimate' as document_type,
  'pdf' as file_format,
  eh.pdf_file_path as file_path,
  NULL::bigint as file_size,
  eh.created_by,
  u.name as created_by_name,
  eh.created_at,
  jsonb_build_object(
    'estimate_number', eh.estimate_number,
    'estimate_date', eh.estimate_date,
    'total_amount', eh.total_amount,
    'subtotal', eh.subtotal,
    'vat_amount', eh.vat_amount
  ) as metadata
FROM estimate_history eh
LEFT JOIN users u ON eh.created_by::text = u.id::text

ORDER BY created_at DESC;

-- 인덱스 확인 (estimate_history)
CREATE INDEX IF NOT EXISTS idx_estimate_history_business_id ON estimate_history(business_id);
CREATE INDEX IF NOT EXISTS idx_estimate_history_created_at ON estimate_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_history_created_by ON estimate_history(created_by);
