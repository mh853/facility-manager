-- Phase 1: 다중 담당자 업무 할당 알림 시스템 구현 (수정된 버전)
-- IMMUTABLE 함수 오류 해결

-- 1. facility_tasks 테이블에 assignees 컬럼 추가
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS assignees JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS assignee_count INTEGER DEFAULT 0;

-- 2. assignee_count 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_assignee_count()
RETURNS TRIGGER AS $$
BEGIN
    -- assignees JSONB 배열의 길이 계산
    NEW.assignee_count = COALESCE(jsonb_array_length(NEW.assignees), 0);

    -- 기존 assignee 필드가 있고 assignees가 비어있다면 호환성 유지
    IF NEW.assignee_count = 0 AND NEW.assignee IS NOT NULL AND NEW.assignee != '' THEN
        NEW.assignee_count = 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. assignee_count 자동 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_calculate_assignee_count ON facility_tasks;
CREATE TRIGGER trigger_calculate_assignee_count
    BEFORE INSERT OR UPDATE ON facility_tasks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_assignee_count();

-- 4. 업무 할당 알림 생성 함수
CREATE OR REPLACE FUNCTION create_task_assignment_notifications(
    p_task_id UUID,
    p_assignees JSONB,
    p_business_name TEXT,
    p_task_title TEXT,
    p_task_type TEXT,
    p_task_priority TEXT,
    p_assigned_by TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    assignee JSONB;
    assignee_id TEXT;
    assignee_name TEXT;
    notification_count INTEGER := 0;
    expires_date TIMESTAMPTZ;
BEGIN
    -- 만료일 설정 (30일 후)
    expires_date := NOW() + INTERVAL '30 days';

    -- assignees 배열을 순회하며 각 담당자에게 알림 생성
    FOR assignee IN SELECT jsonb_array_elements(p_assignees)
    LOOP
        assignee_id := assignee->>'id';
        assignee_name := assignee->>'name';

        -- 담당자별 알림 생성
        INSERT INTO task_notifications (
            user_id,
            user_name,
            task_id,
            business_name,
            message,
            notification_type,
            priority,
            metadata,
            is_read,
            created_at,
            expires_at
        ) VALUES (
            assignee_id,
            assignee_name,
            p_task_id,
            p_business_name,
            FORMAT('"%s" 업무가 담당자로 배정되었습니다. (%s)', p_task_title, p_business_name),
            'assignment',
            CASE
                WHEN p_task_priority = 'high' THEN 'high'
                WHEN p_task_priority = 'low' THEN 'low'
                ELSE 'normal'
            END,
            jsonb_build_object(
                'task_id', p_task_id,
                'task_type', p_task_type,
                'assigned_by', COALESCE(p_assigned_by, 'system'),
                'assignment_date', NOW()
            ),
            false,
            NOW(),
            expires_date
        );

        notification_count := notification_count + 1;
    END LOOP;

    RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 업무 할당 변경 시 알림 업데이트 함수
CREATE OR REPLACE FUNCTION update_task_assignment_notifications(
    p_task_id UUID,
    p_old_assignees JSONB,
    p_new_assignees JSONB,
    p_business_name TEXT,
    p_task_title TEXT,
    p_task_type TEXT,
    p_task_priority TEXT,
    p_assigned_by TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    old_assignee JSONB;
    new_assignee JSONB;
    old_assignee_ids TEXT[];
    new_assignee_ids TEXT[];
    removed_count INTEGER := 0;
    added_count INTEGER := 0;
    updated_count INTEGER := 0;
    current_time TIMESTAMPTZ;
    expires_date TIMESTAMPTZ;
BEGIN
    current_time := NOW();
    expires_date := current_time + INTERVAL '30 days';

    -- 기존 담당자 ID 추출
    SELECT array_agg(value->>'id') INTO old_assignee_ids
    FROM jsonb_array_elements(p_old_assignees);

    -- 새 담당자 ID 추출
    SELECT array_agg(value->>'id') INTO new_assignee_ids
    FROM jsonb_array_elements(p_new_assignees);

    -- 제거된 담당자들의 알림 만료 처리 (삭제하지 않고 만료)
    UPDATE task_notifications
    SET
        expires_at = current_time,
        message = message || ' (담당자 변경됨)',
        metadata = metadata || jsonb_build_object('reassigned_at', current_time)
    WHERE task_id = p_task_id
    AND user_id = ANY(COALESCE(old_assignee_ids, ARRAY[]::TEXT[]))
    AND user_id != ALL(COALESCE(new_assignee_ids, ARRAY[]::TEXT[]))
    AND expires_at > current_time;

    GET DIAGNOSTICS removed_count = ROW_COUNT;

    -- 기존 담당자이면서 계속 담당하는 사람들의 알림 업데이트
    UPDATE task_notifications
    SET
        message = FORMAT('"%s" 업무가 담당자로 재배정되었습니다. (%s)', p_task_title, p_business_name),
        metadata = metadata || jsonb_build_object(
            'reassigned_at', current_time,
            'reassigned_by', COALESCE(p_assigned_by, 'system')
        ),
        updated_at = current_time
    WHERE task_id = p_task_id
    AND user_id = ANY(COALESCE(new_assignee_ids, ARRAY[]::TEXT[]))
    AND user_id = ANY(COALESCE(old_assignee_ids, ARRAY[]::TEXT[]))
    AND expires_at > current_time;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- 새로 추가된 담당자들에게 알림 생성
    FOR new_assignee IN SELECT jsonb_array_elements(p_new_assignees)
    LOOP
        IF NOT (COALESCE(old_assignee_ids, ARRAY[]::TEXT[]) @> ARRAY[new_assignee->>'id']) THEN
            INSERT INTO task_notifications (
                user_id,
                user_name,
                task_id,
                business_name,
                message,
                notification_type,
                priority,
                metadata,
                is_read,
                created_at,
                expires_at
            ) VALUES (
                new_assignee->>'id',
                new_assignee->>'name',
                p_task_id,
                p_business_name,
                FORMAT('"%s" 업무가 새 담당자로 배정되었습니다. (%s)', p_task_title, p_business_name),
                'assignment',
                CASE
                    WHEN p_task_priority = 'high' THEN 'high'
                    WHEN p_task_priority = 'low' THEN 'low'
                    ELSE 'normal'
                END,
                jsonb_build_object(
                    'task_id', p_task_id,
                    'task_type', p_task_type,
                    'assigned_by', COALESCE(p_assigned_by, 'system'),
                    'assignment_date', current_time,
                    'new_assignee', true
                ),
                false,
                current_time,
                expires_date
            );

            added_count := added_count + 1;
        END IF;
    END LOOP;

    -- 결과 반환
    RETURN jsonb_build_object(
        'removed_notifications', removed_count,
        'updated_notifications', updated_count,
        'added_notifications', added_count,
        'total_changes', removed_count + updated_count + added_count
    );
END;
$$ LANGUAGE plpgsql;

-- 6. 업무 생성/수정 시 자동 알림 생성 트리거 함수
CREATE OR REPLACE FUNCTION trigger_task_assignment_notifications()
RETURNS TRIGGER AS $$
DECLARE
    assignees_json JSONB;
    current_user_name TEXT := 'system';
    result JSONB;
BEGIN
    -- assignees가 있는 경우에만 알림 처리
    IF NEW.assignees IS NOT NULL AND jsonb_array_length(NEW.assignees) > 0 THEN
        assignees_json := NEW.assignees;
    ELSIF NEW.assignee IS NOT NULL AND NEW.assignee != '' THEN
        -- 기존 assignee 필드 호환성 지원
        assignees_json := jsonb_build_array(
            jsonb_build_object(
                'id', 'user_' || NEW.assignee, -- 임시 ID 생성
                'name', NEW.assignee,
                'email', '',
                'position', ''
            )
        );
    ELSE
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- 새 업무 생성 시 알림 생성
        PERFORM create_task_assignment_notifications(
            NEW.id,
            assignees_json,
            NEW.business_name,
            NEW.title,
            NEW.task_type,
            NEW.priority,
            current_user_name
        );

    ELSIF TG_OP = 'UPDATE' THEN
        -- 업무 수정 시 담당자 변경 확인
        IF OLD.assignees IS DISTINCT FROM NEW.assignees OR OLD.assignee IS DISTINCT FROM NEW.assignee THEN
            -- 담당자 변경된 경우
            result := update_task_assignment_notifications(
                NEW.id,
                COALESCE(OLD.assignees, '[]'::jsonb),
                assignees_json,
                NEW.business_name,
                NEW.title,
                NEW.task_type,
                NEW.priority,
                current_user_name
            );

            RAISE NOTICE '업무 ID % 담당자 변경 알림 처리: %', NEW.id, result;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 업무 테이블 트리거 생성
DROP TRIGGER IF EXISTS trigger_task_notifications ON facility_tasks;
CREATE TRIGGER trigger_task_notifications
    AFTER INSERT OR UPDATE ON facility_tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_task_assignment_notifications();

-- 8. 인덱스 추가 (성능 최적화) - IMMUTABLE 함수 제거
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignees ON facility_tasks USING GIN (assignees);
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_user ON task_notifications(task_id, user_id);

-- expires_at 인덱스는 조건부로 생성 (NOW() 함수 사용하지 않음)
CREATE INDEX IF NOT EXISTS idx_task_notifications_active ON task_notifications(user_id, is_read, created_at DESC)
WHERE is_read = false;

-- 9. 기존 데이터 호환성 처리
DO $$
DECLARE
    task_record RECORD;
    assignee_json JSONB;
BEGIN
    -- assignee 필드가 있지만 assignees가 비어있는 레코드들 처리
    FOR task_record IN
        SELECT id, assignee
        FROM facility_tasks
        WHERE assignee IS NOT NULL
        AND assignee != ''
        AND (assignees IS NULL OR jsonb_array_length(assignees) = 0)
    LOOP
        -- assignee를 assignees 배열로 변환
        assignee_json := jsonb_build_array(
            jsonb_build_object(
                'id', 'user_' || task_record.assignee,
                'name', task_record.assignee,
                'email', '',
                'position', ''
            )
        );

        UPDATE facility_tasks
        SET assignees = assignee_json
        WHERE id = task_record.id;

        RAISE NOTICE '업무 ID %: assignee "%s"를 assignees 배열로 변환', task_record.id, task_record.assignee;
    END LOOP;
END $$;

-- 10. 테스트 데이터 확인
SELECT
    'Phase 1 스키마 업데이트 완료 (IMMUTABLE 오류 수정됨)' as status,
    COUNT(*) as existing_tasks,
    COUNT(*) FILTER (WHERE assignees IS NOT NULL AND jsonb_array_length(assignees) > 0) as tasks_with_assignees,
    COUNT(*) FILTER (WHERE assignee IS NOT NULL AND assignee != '') as tasks_with_legacy_assignee
FROM facility_tasks;

COMMIT;

-- 성공 메시지
SELECT 'Phase 1: 다중 담당자 업무 할당 알림 시스템 준비 완료 (수정됨)' as result;