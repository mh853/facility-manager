-- ===============================================
-- 대리점 업무 상태 코드 마이그레이션
-- ===============================================
-- 목적: 기존 자가시설 단계 코드를 대리점 전용 단계 코드로 변경
--
-- 매핑 규칙:
-- 초기 단계 (고객 상담 ~ 계약) → dealer_order_received (발주 수신)
-- 중간 단계 (계약금 ~ 제품 출고) → dealer_invoice_issued (계산서 발행)
-- 설치 단계 (설치 협의 ~ 설치 완료, 잔금) → dealer_payment_confirmed (입금 확인)
-- 완료 단계 (서류 발송 완료) → dealer_product_ordered (제품 발주)
-- ===============================================

-- 1단계: 현재 대리점 업무 상태 확인
SELECT
  task_type,
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY task_type, status
ORDER BY count DESC;

-- 2단계: 대리점 업무 상태 마이그레이션
UPDATE facility_tasks
SET status = CASE
  -- 초기 단계 → 발주 수신
  WHEN status IN ('customer_contact', 'site_inspection', 'quotation', 'contract')
    THEN 'dealer_order_received'

  -- 계약금 확인 ~ 제품 발주/출고 → 계산서 발행
  WHEN status IN ('deposit_confirm', 'product_order', 'product_shipment')
    THEN 'dealer_invoice_issued'

  -- 설치 단계 (설치 협의, 설치 완료) + 잔금 → 입금 확인
  WHEN status IN ('installation_schedule', 'installation', 'balance_payment')
    THEN 'dealer_payment_confirmed'

  -- 서류 발송 완료 → 제품 발주 완료
  WHEN status IN ('document_complete')
    THEN 'dealer_product_ordered'

  -- 이미 대리점 단계인 경우 유지
  WHEN status IN ('dealer_order_received', 'dealer_invoice_issued',
                  'dealer_payment_confirmed', 'dealer_product_ordered')
    THEN status

  -- 기타 예외 상황 → 발주 수신으로 기본값 설정
  ELSE 'dealer_order_received'
END
WHERE task_type = 'dealer';

-- 3단계: 마이그레이션 결과 확인
SELECT
  task_type,
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY task_type, status
ORDER BY
  CASE status
    WHEN 'dealer_order_received' THEN 1
    WHEN 'dealer_invoice_issued' THEN 2
    WHEN 'dealer_payment_confirmed' THEN 3
    WHEN 'dealer_product_ordered' THEN 4
    ELSE 5
  END;

-- 4단계: 개별 업무 상세 확인 (선택사항)
SELECT
  id,
  title,
  business_name,
  status,
  created_at,
  updated_at
FROM facility_tasks
WHERE task_type = 'dealer'
ORDER BY updated_at DESC
LIMIT 20;

-- 완료 메시지
SELECT '✅ 대리점 업무 상태 마이그레이션이 완료되었습니다!' as message;
