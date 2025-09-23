-- 안전한 Supabase Realtime 트리거 설정 (중복 방지)
-- 기존 publication 멤버십을 확인하고 안전하게 추가

-- ============================================================================
-- 1. 현재 Realtime Publication 상태 확인
-- ============================================================================

-- 현재 supabase_realtime publication에 포함된 테이블 조회
SELECT
  schemaname,
  tablename,
  'already_in_publication' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- 2. 안전한 Realtime Publication 추가
-- ============================================================================

-- notifications 테이블을 publication에 안전하게 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'notifications'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        RAISE NOTICE '✅ notifications 테이블이 supabase_realtime에 추가됨';
    ELSE
        RAISE NOTICE '⚠️ notifications 테이블이 이미 supabase_realtime에 포함됨';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️ notifications 테이블이 이미 publication에 존재함 (무시)';
END $$;

-- task_notifications 테이블을 publication에 안전하게 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'task_notifications'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_notifications;
        RAISE NOTICE '✅ task_notifications 테이블이 supabase_realtime에 추가됨';
    ELSE
        RAISE NOTICE '⚠️ task_notifications 테이블이 이미 supabase_realtime에 포함됨';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️ task_notifications 테이블이 이미 publication에 존재함 (무시)';
END $$;

-- facility_tasks 테이블을 publication에 안전하게 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'facility_tasks'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE facility_tasks;
        RAISE NOTICE '✅ facility_tasks 테이블이 supabase_realtime에 추가됨';
    ELSE
        RAISE NOTICE '⚠️ facility_tasks 테이블이 이미 supabase_realtime에 포함됨';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⚠️ facility_tasks 테이블이 이미 publication에 존재함 (무시)';
END $$;

-- ============================================================================
-- 3. 시설 업무 변경 시 자동 알림 생성 함수 (개선된 버전)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_facility_task_changes()
RETURNS TRIGGER AS $$
DECLARE
  notification_message TEXT;
  old_status_label TEXT;
  new_status_label TEXT;
  assignee_ids TEXT[];
  assignee_id TEXT;
BEGIN
  -- 상태 레이블 매핑
  SELECT CASE COALESCE(OLD.status, '')
    WHEN 'customer_contact' THEN '고객연락'
    WHEN 'site_inspection' THEN '현장조사'
    WHEN 'quotation' THEN '견적'
    WHEN 'contract' THEN '계약'
    WHEN 'deposit_confirm' THEN '계약금확인'
    WHEN 'product_order' THEN '제품주문'
    WHEN 'product_shipment' THEN '제품출하'
    WHEN 'installation_schedule' THEN '설치협의'
    WHEN 'installation' THEN '설치'
    WHEN 'balance_payment' THEN '잔금결제'
    WHEN 'document_complete' THEN '서류완료'
    WHEN 'subsidy_payment' THEN '보조금지급'
    WHEN 'on_hold' THEN '보류'
    WHEN 'completed' THEN '완료'
    WHEN 'cancelled' THEN '취소'
    ELSE COALESCE(OLD.status, '알 수 없음')
  END INTO old_status_label;

  SELECT CASE NEW.status
    WHEN 'customer_contact' THEN '고객연락'
    WHEN 'site_inspection' THEN '현장조사'
    WHEN 'quotation' THEN '견적'
    WHEN 'contract' THEN '계약'
    WHEN 'deposit_confirm' THEN '계약금확인'
    WHEN 'product_order' THEN '제품주문'
    WHEN 'product_shipment' THEN '제품출하'
    WHEN 'installation_schedule' THEN '설치협의'
    WHEN 'installation' THEN '설치'
    WHEN 'balance_payment' THEN '잔금결제'
    WHEN 'document_complete' THEN '서류완료'
    WHEN 'subsidy_payment' THEN '보조금지급'
    WHEN 'on_hold' THEN '보류'
    WHEN 'completed' THEN '완료'
    WHEN 'cancelled' THEN '취소'
    ELSE NEW.status
  END INTO new_status_label;

  -- 담당자 ID 추출 (assignees JSON 배열에서)
  IF NEW.assignees IS NOT NULL THEN
    BEGIN
      SELECT ARRAY(
        SELECT jsonb_extract_path_text(value, 'id')
        FROM jsonb_array_elements(NEW.assignees)
        WHERE jsonb_extract_path_text(value, 'id') IS NOT NULL
          AND jsonb_extract_path_text(value, 'id') != ''
      ) INTO assignee_ids;
    EXCEPTION
      WHEN OTHERS THEN
        assignee_ids := ARRAY[]::TEXT[];
    END;
  END IF;

  -- INSERT 이벤트 (새 업무 생성)
  IF TG_OP = 'INSERT' THEN
    -- 전역 알림 생성 (안전한 방식)
    BEGIN
      INSERT INTO notifications (
        title, message, category, priority,
        related_resource_type, related_resource_id, related_url,
        metadata, created_by_id, created_by_name, is_system_notification
      ) VALUES (
        '새 시설 업무 등록',
        format('"%s" 업무가 새로 등록되었습니다. (%s)',
          COALESCE(NEW.title, '제목 없음'), COALESCE(NEW.business_name, '사업장 미지정')),
        'task_created',
        CASE WHEN NEW.priority = 'high' THEN 'high'::notification_priority
             ELSE 'medium'::notification_priority
        END,
        'facility_task', NEW.id::text,
        format('/admin/tasks?task=%s', NEW.id),
        jsonb_build_object(
          'task_type', COALESCE(NEW.task_type, 'unknown'),
          'business_name', COALESCE(NEW.business_name, ''),
          'status', NEW.status,
          'created_by', COALESCE(NEW.created_by_name, 'System')
        ),
        NEW.created_by, COALESCE(NEW.created_by_name, 'System'), false
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create global notification for task %: %', NEW.id, SQLERRM;
    END;

    -- 담당자별 개별 알림 생성
    IF assignee_ids IS NOT NULL AND array_length(assignee_ids, 1) > 0 THEN
      FOREACH assignee_id IN ARRAY assignee_ids
      LOOP
        BEGIN
          INSERT INTO task_notifications (
            user_id, task_id, business_name, message,
            notification_type, priority, metadata
          ) VALUES (
            assignee_id, NEW.id::text, COALESCE(NEW.business_name, ''),
            format('"%s" 업무가 담당자로 배정되었습니다. (%s)',
              COALESCE(NEW.title, '제목 없음'), COALESCE(NEW.business_name, '사업장 미지정')),
            'assignment',
            CASE WHEN NEW.priority = 'high' THEN 'high' ELSE 'normal' END,
            jsonb_build_object(
              'task_type', COALESCE(NEW.task_type, 'unknown'),
              'assigned_by', COALESCE(NEW.created_by_name, 'System'),
              'task_id', NEW.id
            )
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to create task notification for user %: %', assignee_id, SQLERRM;
        END;
      END LOOP;
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE 이벤트 (업무 수정)
  IF TG_OP = 'UPDATE' THEN
    -- 상태 변경 감지
    IF COALESCE(OLD.status, '') != NEW.status THEN
      -- 전역 알림 생성
      BEGIN
        INSERT INTO notifications (
          title, message, category, priority,
          related_resource_type, related_resource_id, related_url,
          metadata, created_by_id, created_by_name, is_system_notification
        ) VALUES (
          '시설 업무 상태 변경',
          format('"%s" 업무 상태가 %s에서 %s로 변경되었습니다. (%s)',
            COALESCE(NEW.title, '제목 없음'), old_status_label, new_status_label, COALESCE(NEW.business_name, '사업장 미지정')),
          'task_status_changed',
          CASE WHEN NEW.priority = 'high' THEN 'high'::notification_priority
               ELSE 'medium'::notification_priority
          END,
          'facility_task', NEW.id::text,
          format('/admin/tasks?task=%s', NEW.id),
          jsonb_build_object(
            'old_status', COALESCE(OLD.status, ''),
            'new_status', NEW.status,
            'task_type', COALESCE(NEW.task_type, 'unknown'),
            'business_name', COALESCE(NEW.business_name, ''),
            'modified_by', COALESCE(NEW.last_modified_by_name, 'System')
          ),
          NEW.last_modified_by, COALESCE(NEW.last_modified_by_name, 'System'), false
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to create status change notification for task %: %', NEW.id, SQLERRM;
      END;

      -- 담당자들에게 상태 변경 알림
      IF assignee_ids IS NOT NULL AND array_length(assignee_ids, 1) > 0 THEN
        FOREACH assignee_id IN ARRAY assignee_ids
        LOOP
          BEGIN
            INSERT INTO task_notifications (
              user_id, task_id, business_name, message,
              notification_type, priority, metadata
            ) VALUES (
              assignee_id, NEW.id::text, COALESCE(NEW.business_name, ''),
              format('"%s" 업무 상태가 %s에서 %s로 변경되었습니다. (%s)',
                COALESCE(NEW.title, '제목 없음'), old_status_label, new_status_label, COALESCE(NEW.business_name, '사업장 미지정')),
              'status_change',
              CASE WHEN NEW.priority = 'high' THEN 'high' ELSE 'normal' END,
              jsonb_build_object(
                'old_status', COALESCE(OLD.status, ''),
                'new_status', NEW.status,
                'modified_by', COALESCE(NEW.last_modified_by_name, 'System'),
                'task_id', NEW.id
              )
            );
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING 'Failed to create status change task notification for user %: %', assignee_id, SQLERRM;
          END;
        END LOOP;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- DELETE 이벤트 (업무 삭제)
  IF TG_OP = 'DELETE' THEN
    BEGIN
      INSERT INTO notifications (
        title, message, category, priority,
        related_resource_type, related_resource_id,
        metadata, created_by_name, is_system_notification
      ) VALUES (
        '시설 업무 삭제',
        format('"%s" 업무가 삭제되었습니다. (%s)',
          COALESCE(OLD.title, '제목 없음'), COALESCE(OLD.business_name, '사업장 미지정')),
        'task_completed',
        'low'::notification_priority,
        'facility_task', OLD.id::text,
        jsonb_build_object(
          'task_type', COALESCE(OLD.task_type, 'unknown'),
          'business_name', COALESCE(OLD.business_name, ''),
          'deleted_by', 'System'
        ),
        'System', false
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create deletion notification for task %: %', OLD.id, SQLERRM;
    END;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. 트리거 생성 및 연결 (안전한 방식)
-- ============================================================================

-- 기존 트리거 삭제 (있는 경우)
DROP TRIGGER IF EXISTS facility_task_changes_trigger ON facility_tasks;

-- 새 트리거 생성 (facility_tasks 테이블이 존재하는 경우에만)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks' AND table_schema = 'public') THEN
        CREATE TRIGGER facility_task_changes_trigger
          AFTER INSERT OR UPDATE OR DELETE ON facility_tasks
          FOR EACH ROW EXECUTE FUNCTION notify_facility_task_changes();
        RAISE NOTICE '✅ facility_task_changes_trigger 트리거 생성 완료';
    ELSE
        RAISE NOTICE '⚠️ facility_tasks 테이블이 존재하지 않음 - 트리거 생성 건너뜀';
    END IF;
END $$;

-- ============================================================================
-- 5. 알림 정리 함수 (최적화된 버전)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS TABLE(deleted_notifications INTEGER, deleted_task_notifications INTEGER) AS $$
DECLARE
  notif_count INTEGER;
  task_notif_count INTEGER;
BEGIN
  -- 만료된 전역 알림 삭제
  DELETE FROM notifications WHERE expires_at < NOW();
  GET DIAGNOSTICS notif_count = ROW_COUNT;

  -- 만료된 업무 알림 삭제
  DELETE FROM task_notifications WHERE expires_at < NOW();
  GET DIAGNOSTICS task_notif_count = ROW_COUNT;

  -- 정리 완료 알림 생성 (많이 삭제된 경우만)
  IF notif_count + task_notif_count > 10 THEN
    BEGIN
      INSERT INTO notifications (
        title, message, category, priority,
        is_system_notification, created_by_name
      ) VALUES (
        '알림 정리 완료',
        format('만료된 알림 %s개가 자동으로 정리되었습니다. (전역: %s개, 업무: %s개)',
          notif_count + task_notif_count, notif_count, task_notif_count),
        'system_maintenance',
        'low',
        true,
        'System'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- 정리 알림 생성 실패해도 메인 작업은 성공으로 처리
        NULL;
    END;
  END IF;

  RETURN QUERY SELECT notif_count, task_notif_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. 설정 완료 알림
-- ============================================================================

-- 설정 완료 시스템 알림 생성
INSERT INTO notifications (
  title, message, category, priority,
  is_system_notification, created_by_name, metadata
) VALUES (
  'Supabase Realtime 시스템 활성화',
  'WebSocket 기반 실시간 알림 시스템이 완전히 활성화되었습니다. 시설 업무 변경, 알림 전송이 실시간으로 처리됩니다.',
  'system_update',
  'medium',
  true,
  'System',
  jsonb_build_object(
    'migration_completed', true,
    'realtime_enabled', true,
    'trigger_functions', true,
    'publication_ready', true,
    'setup_time', NOW()
  )
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. 설정 확인 및 결과 출력
-- ============================================================================

-- 현재 Realtime Publication 상태 확인
SELECT
  '🎉 Supabase Realtime 설정 완료' as status,
  array_agg(tablename) as enabled_tables
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('notifications', 'task_notifications', 'facility_tasks');

-- 트리거 확인
SELECT
  'facility_task_changes_trigger 트리거 상태' as trigger_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE t.tgname = 'facility_task_changes_trigger'
      AND c.relname = 'facility_tasks'
    ) THEN '✅ 활성화됨'
    ELSE '❌ 비활성화됨'
  END as status;

-- 완료 메시지 (DO 블록 안에서 RAISE NOTICE 사용)
DO $$
BEGIN
    RAISE NOTICE '🚀 Supabase Realtime 알림 시스템 준비 완료!';
    RAISE NOTICE '✅ 실시간 알림 기능이 활성화되었습니다.';
    RAISE NOTICE '📡 WebSocket 연결을 통해 실시간 업무 변경 알림을 받을 수 있습니다.';
END $$;