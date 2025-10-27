-- 주간 리포트 초기화 스크립트
-- 기존 저장된 리포트를 삭제하여 새로 생성하도록 함

-- 특정 주간의 리포트 삭제 (예: 2025-09-20 주간)
-- DELETE FROM weekly_reports WHERE week_start = '2025-09-20T15:00:00';

-- 모든 리포트 삭제 (전체 재생성)
DELETE FROM weekly_reports;

-- 삭제 결과 확인
SELECT COUNT(*) as deleted_count FROM weekly_reports;
