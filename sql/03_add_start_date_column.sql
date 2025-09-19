-- ===============================================
-- 3단계: facility_tasks 테이블에 start_date 컬럼 추가
-- 시작일 저장 기능 추가
-- ===============================================

-- 전제조건 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks') THEN
        RAISE EXCEPTION 'facility_tasks 테이블이 존재하지 않습니다. 먼저 01_create_facility_tasks_table.sql을 실행하세요.';
    END IF;
END $$;

-- 1. start_date 컬럼 추가 (이미 존재하는 경우 무시)
ALTER TABLE facility_tasks
ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. start_date 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_facility_tasks_start_date ON facility_tasks(start_date);

-- 3. 기존 업데이트 트리거 수정 (start_date 변경 시에도 updated_at 업데이트)
CREATE OR REPLACE FUNCTION update_facility_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거는 이미 존재하므로 별도로 생성하지 않음

-- 4. 설명 추가
COMMENT ON COLUMN facility_tasks.start_date IS '업무 시작일 (계획된 또는 실제 시작일)';

-- 5. 기존 데이터에 대한 기본값 설정 (선택사항)
-- 기존 업무들의 시작일을 생성일로 설정 (업무에 따라 조정 필요)
-- UPDATE facility_tasks
-- SET start_date = created_at::date
-- WHERE start_date IS NULL;

-- 완료 메시지
SELECT
    'start_date 컬럼이 성공적으로 추가되었습니다!' as message,
    count(*) as total_tasks,
    count(start_date) as tasks_with_start_date
FROM facility_tasks;

-- 6. 사용 예시 쿼리들
/*
-- 특정 기간에 시작된 업무 조회
SELECT * FROM facility_tasks
WHERE start_date >= '2024-01-01' AND start_date <= '2024-12-31';

-- 시작일과 마감일이 모두 있는 업무의 소요 기간 계산
SELECT
    title,
    start_date,
    due_date,
    CASE
        WHEN start_date IS NOT NULL AND due_date IS NOT NULL
        THEN due_date - start_date
        ELSE NULL
    END as planned_duration_days
FROM facility_tasks
WHERE start_date IS NOT NULL AND due_date IS NOT NULL;

-- 시작일별 업무 통계
SELECT
    start_date,
    count(*) as task_count,
    count(*) FILTER (WHERE status IN ('completion', 'subsidy_payment')) as completed_tasks
FROM facility_tasks
WHERE start_date IS NOT NULL
GROUP BY start_date
ORDER BY start_date DESC;
*/