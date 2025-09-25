-- 중복 알림 문제 해결: PostgreSQL 자동 알림 트리거 비활성화
--
-- 문제:
-- 1. API에서 createTaskAssignmentNotifications() 함수로 올바른 발신자로 알림 생성 (알림 1)
-- 2. API에서 직접 task_notifications 테이블에 삽입 (알림 2) - 이미 제거됨
-- 3. PostgreSQL 트리거가 자동으로 'system'을 발신자로 하여 알림 생성 (알림 3) - 이 파일에서 제거
--
-- 해결: PostgreSQL 트리거를 비활성화하여 API에서만 알림을 관리하도록 함

-- 1. 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_task_notifications ON facility_tasks;

-- 2. 확인 메시지
SELECT 'PostgreSQL 자동 알림 트리거가 비활성화되었습니다. 이제 API에서만 알림을 생성합니다.' as status;

-- 3. 기존 중복 알림 정리 (선택사항)
-- 참고: 이 부분은 운영환경에서 신중히 실행해야 합니다.
--
-- DELETE FROM task_notifications
-- WHERE created_at > '2024-01-01'  -- 최근 생성된 알림만 대상
-- AND metadata->>'assigned_by' = 'system'  -- 시스템에서 자동 생성된 알림
-- AND task_id IN (
--     SELECT DISTINCT task_id
--     FROM task_notifications
--     WHERE created_at > '2024-01-01'
--     GROUP BY task_id
--     HAVING COUNT(*) > 1  -- 중복된 알림이 있는 업무만
-- );

COMMIT;