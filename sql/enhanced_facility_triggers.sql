-- 향상된 시설 업무 트리거 시스템
-- 키워드 알림, 관리자 특별 알림, 상세한 알림 유형 지원

-- ============================================================================
-- 1. 향상된 시설 업무 변경 트리거 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_facility_task_changes()
RETURNS TRIGGER AS $$
DECLARE
  assignee_data jsonb;
  assignee_record jsonb;
  old_assignee_data jsonb;
  notification_count INTEGER := 0;
  keyword_count INTEGER := 0;
  admin_notification_needed BOOLEAN := false;
BEGIN
  -- INSERT (새 업무 생성)
  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE '🆕 새 시설 업무 생성: % (ID: %)', NEW.title, NEW.id;

    -- 각 담당자에게 할당 알림 생성
    IF NEW.assignees IS NOT NULL AND jsonb_array_length(NEW.assignees) > 0 THEN
      FOR assignee_record IN SELECT * FROM jsonb_array_elements(NEW.assignees)
      LOOP
        -- 즉시 할당 알림 생성
        INSERT INTO task_notifications (
          user_id, task_id, business_name, message,
          notification_type, priority, metadata
        ) VALUES (
          assignee_record->>'id',
          NEW.id::text,
          NEW.business_name,
          '📋 [새 업무 할당] ' || NEW.title || ' - ' || NEW.business_name,
          'assignment',
          CASE WHEN NEW.priority = 'high' THEN 'urgent' ELSE 'high' END,
          jsonb_build_object(
            'task_type', NEW.task_type,
            'due_date', NEW.due_date,
            'created_by', NEW.created_by_name,
            'auto_generated', true,
            'immediate_action_required', true
          )
        );

        notification_count := notification_count + 1;
      END LOOP;
    END IF;

    -- 키워드 기반 알림 생성
    SELECT create_keyword_notifications(
      NEW.title,
      COALESCE(NEW.description, ''),
      NEW.business_name,
      NEW.id::text,
      'assignment'
    ) INTO keyword_count;

    -- 고우선순위 업무면 관리자에게 특별 알림
    IF NEW.priority = 'high' THEN
      admin_notification_needed := true;

      INSERT INTO notifications (
        title, message, category, priority,
        related_resource_type, related_resource_id,
        is_system_notification, created_by_name, metadata
      ) VALUES (
        '🚨 [관리자] 고우선순위 업무 생성',
        '고우선순위 업무가 생성되었습니다: ' || NEW.title || ' (' || NEW.business_name || ')',
        'task_created',
        'critical',
        'facility_task',
        NEW.id::text,
        true,
        'Task Monitor',
        jsonb_build_object(
          'target_permission_levels', ARRAY[3, 4],
          'task_priority', NEW.priority,
          'business_name', NEW.business_name,
          'alert_type', 'admin_high_priority'
        )
      );
    END IF;

    RAISE NOTICE '✅ 업무 생성 알림: 개인 %건, 키워드 %건, 관리자 알림: %',
                 notification_count, keyword_count, admin_notification_needed;

  -- UPDATE (업무 수정)
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE NOTICE '🔄 시설 업무 수정: % (ID: %)', NEW.title, NEW.id;

    -- 상태 변경 알림
    IF OLD.status != NEW.status THEN
      IF NEW.assignees IS NOT NULL AND jsonb_array_length(NEW.assignees) > 0 THEN
        FOR assignee_record IN SELECT * FROM jsonb_array_elements(NEW.assignees)
        LOOP
          INSERT INTO task_notifications (
            user_id, task_id, business_name, message,
            notification_type, priority, metadata
          ) VALUES (
            assignee_record->>'id',
            NEW.id::text,
            NEW.business_name,
            '🔄 [상태 변경] ' || NEW.title || ': ' || OLD.status || ' → ' || NEW.status,
            'status_change',
            CASE WHEN NEW.status IN ('completed', 'cancelled') THEN 'normal' ELSE 'high' END,
            jsonb_build_object(
              'old_status', OLD.status,
              'new_status', NEW.status,
              'modified_by', NEW.last_modified_by_name,
              'auto_generated', true
            )
          );

          notification_count := notification_count + 1;
        END LOOP;
      END IF;

      -- 상태 변경 키워드 알림
      SELECT create_keyword_notifications(
        NEW.title,
        COALESCE(NEW.description, ''),
        NEW.business_name,
        NEW.id::text,
        'status_change'
      ) INTO keyword_count;
    END IF;

    -- 담당자 변경 알림
    IF OLD.assignees::text != NEW.assignees::text THEN
      -- 새 담당자들에게 알림
      IF NEW.assignees IS NOT NULL AND jsonb_array_length(NEW.assignees) > 0 THEN
        FOR assignee_record IN SELECT * FROM jsonb_array_elements(NEW.assignees)
        LOOP
          -- 기존 담당자가 아닌 경우에만 새 할당 알림 생성
          IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(OLD.assignees) as old_assignee
            WHERE old_assignee->>'id' = assignee_record->>'id'
          ) THEN
            INSERT INTO task_notifications (
              user_id, task_id, business_name, message,
              notification_type, priority, metadata
            ) VALUES (
              assignee_record->>'id',
              NEW.id::text,
              NEW.business_name,
              '👥 [담당자 재할당] ' || NEW.title || ' - 새로 담당자로 지정되었습니다',
              'reassignment',
              'urgent',
              jsonb_build_object(
                'previous_assignees', OLD.assignees,
                'new_assignees', NEW.assignees,
                'modified_by', NEW.last_modified_by_name,
                'auto_generated', true,
                'immediate_action_required', true
              )
            );

            notification_count := notification_count + 1;
          END IF;
        END LOOP;
      END IF;

      -- 관리자에게 담당자 변경 알림
      INSERT INTO notifications (
        title, message, category, priority,
        related_resource_type, related_resource_id,
        is_system_notification, created_by_name, metadata
      ) VALUES (
        '👥 [관리자] 담당자 변경',
        '업무 담당자가 변경되었습니다: ' || NEW.title || ' (' || NEW.business_name || ')',
        'task_assigned',
        'medium',
        'facility_task',
        NEW.id::text,
        true,
        'Task Monitor',
        jsonb_build_object(
          'target_permission_levels', ARRAY[3, 4],
          'change_type', 'assignee_update',
          'modified_by', NEW.last_modified_by_name
        )
      );
    END IF;

    -- 우선순위가 높아진 경우 관리자 알림
    IF OLD.priority != 'high' AND NEW.priority = 'high' THEN
      INSERT INTO notifications (
        title, message, category, priority,
        related_resource_type, related_resource_id,
        is_system_notification, created_by_name, metadata
      ) VALUES (
        '⬆️ [관리자] 업무 우선순위 상승',
        '업무 우선순위가 높음으로 변경되었습니다: ' || NEW.title || ' (' || NEW.business_name || ')',
        'task_updated',
        'high',
        'facility_task',
        NEW.id::text,
        true,
        'Task Monitor',
        jsonb_build_object(
          'target_permission_levels', ARRAY[3, 4],
          'old_priority', OLD.priority,
          'new_priority', NEW.priority,
          'alert_type', 'priority_escalation'
        )
      );
    END IF;

    RAISE NOTICE '✅ 업무 수정 알림: 개인 %건, 키워드 %건', notification_count, keyword_count;

  -- DELETE (업무 삭제 - 드문 경우)
  ELSIF TG_OP = 'DELETE' THEN
    RAISE NOTICE '🗑️ 시설 업무 삭제: % (ID: %)', OLD.title, OLD.id;

    -- 담당자들에게 삭제 알림
    IF OLD.assignees IS NOT NULL AND jsonb_array_length(OLD.assignees) > 0 THEN
      FOR assignee_record IN SELECT * FROM jsonb_array_elements(OLD.assignees)
      LOOP
        INSERT INTO task_notifications (
          user_id, task_id, business_name, message,
          notification_type, priority, metadata
        ) VALUES (
          assignee_record->>'id',
          OLD.id::text,
          OLD.business_name,
          '🗑️ [업무 삭제] ' || OLD.title || '이(가) 삭제되었습니다',
          'deletion',
          'normal',
          jsonb_build_object(
            'deleted_at', NOW(),
            'auto_generated', true
          )
        );
      END LOOP;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. 트리거 재생성 (기존 트리거 교체)
-- ============================================================================

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS facility_task_changes_trigger ON facility_tasks;

-- 새 트리거 생성
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks' AND table_schema = 'public') THEN
        CREATE TRIGGER facility_task_changes_trigger
          AFTER INSERT OR UPDATE OR DELETE ON facility_tasks
          FOR EACH ROW EXECUTE FUNCTION notify_facility_task_changes();

        RAISE NOTICE '✅ 향상된 facility_task_changes_trigger 생성 완료';
    ELSE
        RAISE NOTICE '⚠️ facility_tasks 테이블이 존재하지 않음';
    END IF;
END $$;

-- ============================================================================
-- 3. 관리자 알림 뷰 생성 (권한 기반 필터링)
-- ============================================================================

CREATE OR REPLACE VIEW admin_notifications AS
SELECT
  n.*,
  CASE
    WHEN n.metadata->>'target_permission_levels' IS NOT NULL
    THEN (n.metadata->>'target_permission_levels')::int[]
    ELSE ARRAY[3, 4]
  END as target_permission_levels
FROM notifications n
WHERE n.is_system_notification = true
  AND (
    n.metadata->>'alert_type' IN ('admin_high_priority', 'admin_summary', 'priority_escalation')
    OR n.metadata->>'target_permission_levels' IS NOT NULL
  );

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🔔 향상된 시설 업무 알림 시스템 완료!';
    RAISE NOTICE '✅ 즉시 할당 알림, 상태 변경 알림, 재할당 알림 활성화';
    RAISE NOTICE '🏷️ 키워드 기반 맞춤 알림 시스템 연동';
    RAISE NOTICE '👥 관리자 특별 알림 (권한 3,4) 활성화';
    RAISE NOTICE '📊 admin_notifications 뷰로 관리자 알림 필터링 가능';
END $$;