-- 사용자 ID 불일치 문제 해결
-- task_notifications의 user_id를 실제 employees 테이블의 UUID로 업데이트

-- 1. 현재 상황 확인
SELECT
    '=== 현재 상황 분석 ===' as status,
    (SELECT COUNT(*) FROM task_notifications WHERE user_id = 'user_1') as notifications_with_user_1,
    (SELECT COUNT(*) FROM task_notifications WHERE user_id LIKE '%-%') as notifications_with_uuid,
    (SELECT COUNT(*) FROM employees WHERE is_active = true) as active_employees;

-- 2. 실제 사용자 정보 확인
SELECT
    '=== 활성 사용자 목록 ===' as info,
    id,
    name,
    email
FROM employees
WHERE is_active = true
ORDER BY created_at DESC;

-- 3. user_1을 실제 사용자 UUID로 업데이트 (최문호)
-- 먼저 최문호 사용자의 실제 UUID 찾기
DO $$
DECLARE
    actual_user_id UUID;
    updated_count INTEGER;
BEGIN
    -- 최문호 사용자의 실제 UUID 가져오기
    SELECT id INTO actual_user_id
    FROM employees
    WHERE name = '최문호' AND is_active = true
    LIMIT 1;

    IF actual_user_id IS NOT NULL THEN
        -- user_1을 실제 UUID로 업데이트
        UPDATE task_notifications
        SET user_id = actual_user_id,
            updated_at = NOW()
        WHERE user_id = 'user_1';

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        RAISE NOTICE '✅ user_1을 실제 UUID로 업데이트 완료: %개 알림이 사용자 %에게 할당됨', updated_count, actual_user_id;

        -- 업데이트 결과 확인
        INSERT INTO system_logs (log_type, message, details, created_at)
        VALUES (
            'user_id_fix',
            'Fixed user_id mismatch in task_notifications',
            json_build_object(
                'old_user_id', 'user_1',
                'new_user_id', actual_user_id,
                'updated_count', updated_count,
                'user_name', '최문호'
            ),
            NOW()
        )
        ON CONFLICT DO NOTHING;

    ELSE
        RAISE NOTICE '❌ 최문호 사용자를 찾을 수 없습니다';
    END IF;
END $$;

-- 4. 업데이트 결과 확인
SELECT
    '=== 업데이트 후 확인 ===' as status,
    tn.id,
    tn.user_id,
    e.name as user_name,
    tn.business_name,
    tn.message,
    tn.is_read,
    tn.created_at
FROM task_notifications tn
JOIN employees e ON tn.user_id = e.id
WHERE e.name = '최문호'
ORDER BY tn.created_at DESC
LIMIT 10;

-- 5. 최종 통계
SELECT
    '=== 최종 통계 ===' as info,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
    COUNT(*) FILTER (WHERE is_read = true) as read_count,
    COUNT(DISTINCT user_id) as unique_users
FROM task_notifications;

COMMIT;