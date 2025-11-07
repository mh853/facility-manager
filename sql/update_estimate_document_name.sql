-- sql/update_estimate_document_name.sql
-- Update document name format to match estimate history display

DROP VIEW IF EXISTS document_history_detail;

CREATE OR REPLACE VIEW document_history_detail AS
-- 기존 발주서 이력
SELECT
  dh.id,
  dh.business_id,
  bi.business_name,
  bi.address,
  dh.document_type,
  dh.document_name,
  dh.document_data,
  dh.file_format,
  dh.file_path,
  dh.file_size,
  dh.created_by,
  u.name as created_by_name,
  u.email as created_by_email,
  dh.created_at,
  NULL::jsonb as metadata
FROM document_history dh
LEFT JOIN business_info bi ON dh.business_id = bi.id
LEFT JOIN users u ON dh.created_by::text = u.id::text

UNION ALL

-- 견적서 이력 추가 (파일명 형식 변경: YYYYMMDD_사업장명_IoT설치견적서)
SELECT
  eh.id,
  eh.business_id,
  eh.business_name,
  bi.address,
  'estimate' as document_type,
  TO_CHAR(eh.created_at, 'YYYYMMDD') || '_' || eh.business_name || '_IoT설치견적서' as document_name,
  NULL::jsonb as document_data,
  'pdf' as file_format,
  eh.pdf_file_path as file_path,
  NULL::bigint as file_size,
  eh.created_by,
  u.name as created_by_name,
  u.email as created_by_email,
  eh.created_at,
  jsonb_build_object(
    'estimate_number', eh.estimate_number,
    'estimate_date', eh.estimate_date,
    'total_amount', eh.total_amount,
    'subtotal', eh.subtotal,
    'vat_amount', eh.vat_amount,
    'business_name', eh.business_name,
    'customer_address', eh.customer_address,
    'customer_phone', eh.customer_phone,
    'customer_manager', eh.customer_manager,
    'customer_manager_contact', eh.customer_manager_contact,
    'supplier_info', eh.supplier_info,
    'estimate_items', eh.estimate_items,
    'reference_notes', eh.reference_notes,
    'terms_and_conditions', eh.terms_and_conditions,
    'air_permit', eh.air_permit
  ) as metadata
FROM estimate_history eh
LEFT JOIN business_info bi ON eh.business_id = bi.id
LEFT JOIN users u ON eh.created_by::text = u.id::text

ORDER BY created_at DESC;

-- Verify the view
SELECT
  document_name,
  document_type,
  created_at
FROM document_history_detail
WHERE document_type = 'estimate'
ORDER BY created_at DESC
LIMIT 5;
