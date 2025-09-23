-- 테스트 알림 정리 및 실제 데이터 연동 준비
-- 시설 업무 관리 실시간 알림 시스템

-- ============================================================================
-- 1. 테스트 데이터 정리
-- ============================================================================

-- 테스트용 알림 삭제
DELETE FROM notifications
WHERE title LIKE '%테스트%'
   OR title LIKE '%🧪%'
   OR message LIKE '%테스트%'
   OR created_by_name = 'System Test'
   OR created_by_name = '테스트 관리자';

DELETE FROM task_notifications
WHERE message LIKE '%테스트%'
   OR user_id = 'test-user';

-- ============================================================================
-- 2. 키워드 기반 알림 설정 테이블 생성
-- ============================================================================

-- 사용자별 키워드 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  keyword VARCHAR(100) NOT NULL,
  alert_types VARCHAR(50)[] NOT NULL DEFAULT ARRAY['status_change'], -- 'status_change', 'assignment', 'deadline'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notification_keywords_user_active
ON notification_keywords(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_notification_keywords_keyword
ON notification_keywords(keyword) WHERE is_active = true;

-- ============================================================================
-- 3. 마감일 및 지연 업무 모니터링 함수
-- ============================================================================

-- 마감일 임박 및 지연 업무 알림 생성 함수
CREATE OR REPLACE FUNCTION check_task_deadlines()
RETURNS TABLE(
  created_deadline_alerts INTEGER,
  created_overdue_alerts INTEGER
) AS $$
DECLARE
  deadline_count INTEGER := 0;
  overdue_count INTEGER := 0;
  task_record RECORD;
BEGIN
  -- 마감일 1일 전 알림 (아직 알림받지 않은 업무)
  FOR task_record IN
    SELECT
      ft.id, ft.title, ft.business_name, ft.due_date, ft.priority,
      jsonb_array_elements(ft.assignees) as assignee_data
    FROM facility_tasks ft
    WHERE ft.due_date::date = (CURRENT_DATE + INTERVAL '1 day')::date
      AND ft.status NOT IN ('completed', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM task_notifications tn
        WHERE tn.task_id = ft.id::text
          AND tn.notification_type = 'deadline_approaching'
      )
  LOOP
    -- 각 담당자에게 마감일 임박 알림 생성
    INSERT INTO task_notifications (
      user_id, task_id, business_name, message,
      notification_type, priority, metadata
    ) VALUES (
      (task_record.assignee_data->>'id'),
      task_record.id::text,
      task_record.business_name,
      '⏰ [마감 임박] ' || task_record.title || ' (내일 마감)',
      'deadline_approaching',
      CASE WHEN task_record.priority = 'high' THEN 'urgent' ELSE 'high' END,
      jsonb_build_object(
        'days_until_due', 1,
        'original_due_date', task_record.due_date,
        'auto_generated', true
      )
    );

    deadline_count := deadline_count + 1;
  END LOOP;

  -- 지연 업무 알림 (마감일이 지난 업무)
  FOR task_record IN
    SELECT
      ft.id, ft.title, ft.business_name, ft.due_date, ft.priority,
      jsonb_array_elements(ft.assignees) as assignee_data,
      (CURRENT_DATE - ft.due_date::date) as days_overdue
    FROM facility_tasks ft
    WHERE ft.due_date::date < CURRENT_DATE
      AND ft.status NOT IN ('completed', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM task_notifications tn
        WHERE tn.task_id = ft.id::text
          AND tn.notification_type = 'overdue'
          AND DATE(tn.created_at) = CURRENT_DATE
      )
  LOOP
    -- 지연 업무 알림 생성
    INSERT INTO task_notifications (
      user_id, task_id, business_name, message,
      notification_type, priority, metadata
    ) VALUES (
      (task_record.assignee_data->>'id'),
      task_record.id::text,
      task_record.business_name,
      '🚨 [업무 지연] ' || task_record.title || ' (' || task_record.days_overdue || '일 지연)',
      'overdue',
      'urgent',
      jsonb_build_object(
        'days_overdue', task_record.days_overdue,
        'original_due_date', task_record.due_date,
        'auto_generated', true
      )
    );

    overdue_count := overdue_count + 1;
  END LOOP;

  -- 관리자(권한 3,4)에게 지연 업무 요약 알림
  IF overdue_count > 0 THEN
    INSERT INTO notifications (
      title, message, category, priority,
      related_resource_type, is_system_notification,
      created_by_name, metadata
    ) VALUES (
      '📊 일일 지연 업무 현황',
      overdue_count || '건의 지연 업무가 발생했습니다. 즉시 확인이 필요합니다.',
      'task_status_changed',
      'high',
      'facility_task_summary',
      true,
      'System Monitor',
      jsonb_build_object(
        'overdue_count', overdue_count,
        'target_permission_levels', ARRAY[3, 4],
        'alert_type', 'admin_summary'
      )
    );
  END IF;

  RETURN QUERY SELECT deadline_count, overdue_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. 키워드 기반 알림 함수
-- ============================================================================

-- 키워드 매칭 알림 생성 함수
CREATE OR REPLACE FUNCTION create_keyword_notifications(
  task_title TEXT,
  task_description TEXT,
  task_business_name TEXT,
  task_id TEXT,
  notification_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  keyword_record RECORD;
  notification_count INTEGER := 0;
BEGIN
  -- 활성화된 키워드 설정 조회
  FOR keyword_record IN
    SELECT nk.user_id, nk.keyword, nk.alert_types, e.name as user_name
    FROM notification_keywords nk
    JOIN employees e ON nk.user_id = e.id
    WHERE nk.is_active = true
      AND (
        task_title ILIKE '%' || nk.keyword || '%' OR
        task_description ILIKE '%' || nk.keyword || '%' OR
        task_business_name ILIKE '%' || nk.keyword || '%'
      )
      AND notification_type = ANY(nk.alert_types)
  LOOP
    -- 키워드 매칭 알림 생성
    INSERT INTO task_notifications (
      user_id, task_id, business_name, message,
      notification_type, priority, metadata
    ) VALUES (
      keyword_record.user_id,
      task_id,
      task_business_name,
      '🏷️ [키워드 알림] "' || keyword_record.keyword || '" - ' || task_title,
      'keyword_match',
      'normal',
      jsonb_build_object(
        'matched_keyword', keyword_record.keyword,
        'original_notification_type', notification_type,
        'auto_generated', true
      )
    );

    notification_count := notification_count + 1;
  END LOOP;

  RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. 일일 모니터링 작업 실행
-- ============================================================================

-- 마감일 및 지연 업무 체크 실행
SELECT * FROM check_task_deadlines();

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🧹 테스트 알림 정리 완료';
    RAISE NOTICE '⚙️ 키워드 알림 시스템 설정 완료';
    RAISE NOTICE '⏰ 마감일/지연 업무 모니터링 활성화';
    RAISE NOTICE '🔔 실제 업무 데이터 알림 시스템 준비 완료';
END $$;