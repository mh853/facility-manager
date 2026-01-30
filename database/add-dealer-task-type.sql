-- ===============================================
-- 대리점 업무 타입 추가 마이그레이션
-- ===============================================

-- facility_tasks 테이블의 task_type CHECK 제약조건 업데이트
-- 기존: ('self', 'subsidy', 'etc', 'as')
-- 변경: ('self', 'subsidy', 'etc', 'as', 'dealer')

-- 1단계: 기존 CHECK 제약조건 삭제
ALTER TABLE facility_tasks
DROP CONSTRAINT IF EXISTS facility_tasks_task_type_check;

-- 2단계: 새 CHECK 제약조건 추가 (dealer 포함)
ALTER TABLE facility_tasks
ADD CONSTRAINT facility_tasks_task_type_check
CHECK (task_type IN ('self', 'subsidy', 'etc', 'as', 'dealer'));

-- 3단계: 제약조건 확인
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'facility_tasks'::regclass
  AND contype = 'c'
  AND conname = 'facility_tasks_task_type_check';

-- 4단계: 테스트 데이터 (선택사항)
-- 대리점 업무 타입으로 샘플 데이터 생성 가능 확인
-- INSERT INTO facility_tasks (
--     title,
--     description,
--     business_name,
--     task_type,
--     status,
--     priority,
--     assignee,
--     due_date
-- ) VALUES (
--     '대리점 업무 테스트',
--     '대리점 경유 시설 설치 프로젝트',
--     '테스트 대리점 사업장',
--     'dealer',
--     'dealer_contact',
--     'medium',
--     '테스트담당자',
--     CURRENT_DATE + INTERVAL '30 days'
-- );

-- 완료 메시지
SELECT '✅ 대리점 업무 타입이 성공적으로 추가되었습니다!' as message;
