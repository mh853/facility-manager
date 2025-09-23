-- 시설 업무 트리거 테스트 (facility_tasks 테이블이 있는 경우)
-- 실제 업무 생성/수정 시 자동 알림 생성 테스트

-- ============================================================================
-- 1. facility_tasks 테이블 존재 확인
-- ============================================================================

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks')
    THEN '✅ facility_tasks 테이블 존재 - 트리거 테스트 가능'
    ELSE '❌ facility_tasks 테이블 없음 - 트리거 테스트 불가능'
  END as table_status;

-- ============================================================================
-- 2. 테스트용 시설 업무 생성 (테이블이 있는 경우만)
-- ============================================================================

-- 주의: 실제 facility_tasks 테이블 구조에 맞게 수정 필요
-- 이 쿼리는 예시이며, 실제 테이블 스키마에 따라 조정해야 함

/*
INSERT INTO facility_tasks (
  title,
  business_name,
  status,
  priority,
  task_type,
  assignees,
  created_by,
  created_by_name
) VALUES (
  '🧪 실시간 트리거 테스트 업무',
  '테스트 사업장',
  'customer_contact',
  'high',
  'installation',
  '[{"id": "test-user", "name": "테스트 사용자"}]'::jsonb,
  'test-admin',
  '테스트 관리자'
);
*/

-- ============================================================================
-- 3. 트리거 함수 존재 확인
-- ============================================================================

SELECT
  'notify_facility_task_changes 함수 상태' as function_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'notify_facility_task_changes'
    ) THEN '✅ 함수 존재'
    ELSE '❌ 함수 없음'
  END as status;

-- 트리거 존재 확인
SELECT
  'facility_task_changes_trigger 트리거 상태' as trigger_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE t.tgname = 'facility_task_changes_trigger'
      AND c.relname = 'facility_tasks'
    ) THEN '✅ 트리거 활성화됨'
    ELSE '❌ 트리거 비활성화됨'
  END as status;

-- ============================================================================
-- 4. 알림 생성 확인
-- ============================================================================

-- 최근 5분간 생성된 알림 확인
SELECT
  title,
  message,
  category,
  priority,
  created_at,
  '자동 생성됨' as source
FROM notifications
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- 최근 업무 알림 확인
SELECT
  message,
  notification_type,
  priority,
  task_id,
  business_name,
  created_at
FROM task_notifications
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

DO $$
BEGIN
    RAISE NOTICE '🔍 시설 업무 트리거 테스트 완료';
    RAISE NOTICE '📋 facility_tasks 테이블에 새 업무를 추가하거나 기존 업무를 수정해보세요';
    RAISE NOTICE '🔔 자동으로 알림이 생성되어야 합니다';
END $$;