-- ============================================
-- 🚀 Disk IO 최적화를 위한 인덱스 생성
-- 코드베이스 분석 기반 최적화
-- ============================================

-- ============================================
-- 1. employees 테이블 (가장 빈번한 조회)
-- ============================================

-- 로그인/인증 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_employees_email
ON employees(email) WHERE is_deleted = false;

-- 활성 직원 조회 (목록, 드롭다운)
CREATE INDEX IF NOT EXISTS idx_employees_active
ON employees(is_active, is_deleted) WHERE is_deleted = false;

-- 부서별 직원 조회
CREATE INDEX IF NOT EXISTS idx_employees_department
ON employees(department) WHERE is_deleted = false AND is_active = true;

-- 권한 레벨별 조회
CREATE INDEX IF NOT EXISTS idx_employees_permission
ON employees(permission_level) WHERE is_deleted = false;

-- employee_id로 조회 (사번 검색)
CREATE INDEX IF NOT EXISTS idx_employees_employee_id
ON employees(employee_id) WHERE is_deleted = false;

-- ============================================
-- 2. business_info 테이블 (사업장 정보)
-- ============================================

-- 사업장명 검색
CREATE INDEX IF NOT EXISTS idx_business_info_name
ON business_info(business_name) WHERE is_deleted = false;

-- 활성 사업장 조회
CREATE INDEX IF NOT EXISTS idx_business_info_active
ON business_info(is_active, is_deleted) WHERE is_deleted = false;

-- 제조사별 조회
CREATE INDEX IF NOT EXISTS idx_business_info_manufacturer
ON business_info(manufacturer) WHERE is_deleted = false AND is_active = true;

-- 영업소별 조회
CREATE INDEX IF NOT EXISTS idx_business_info_sales_office
ON business_info(sales_office) WHERE is_deleted = false AND is_active = true;

-- 진행상태별 조회
CREATE INDEX IF NOT EXISTS idx_business_info_status
ON business_info(progress_status) WHERE is_deleted = false AND is_active = true;

-- 설치일자 범위 조회 (매출 통계)
CREATE INDEX IF NOT EXISTS idx_business_info_installation_date
ON business_info(installation_date) WHERE is_deleted = false AND is_active = true;

-- 복합 인덱스: 매출 대시보드 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_business_info_dashboard
ON business_info(is_active, is_deleted, installation_date, manufacturer, sales_office);

-- ============================================
-- 3. tasks / facility_tasks 테이블 (업무 관리)
-- ============================================

-- 담당자별 업무 조회
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
ON tasks(assignee_id) WHERE is_deleted = false;

-- 상태별 업무 조회
CREATE INDEX IF NOT EXISTS idx_tasks_status
ON tasks(status) WHERE is_deleted = false;

-- 프로젝트별 업무 조회
CREATE INDEX IF NOT EXISTS idx_tasks_project
ON tasks(project_id) WHERE is_deleted = false;

-- 마감일 기준 조회 (일정 관리)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(due_date) WHERE is_deleted = false;

-- 사업장별 업무 조회
CREATE INDEX IF NOT EXISTS idx_tasks_business
ON tasks(business_id) WHERE is_deleted = false;

-- 복합 인덱스: 업무 대시보드
CREATE INDEX IF NOT EXISTS idx_tasks_dashboard
ON tasks(status, assignee_id, due_date) WHERE is_deleted = false;

-- facility_tasks (시설 업무)
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business
ON facility_tasks(business_id);

CREATE INDEX IF NOT EXISTS idx_facility_tasks_status
ON facility_tasks(status);

CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee
ON facility_tasks(assignee_id);

-- ============================================
-- 4. task_notifications 테이블 (알림)
-- ============================================

-- 사용자별 미읽음 알림
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread
ON task_notifications(user_id, is_read) WHERE is_read = false;

-- 업무별 알림
CREATE INDEX IF NOT EXISTS idx_task_notifications_task
ON task_notifications(task_id);

-- 생성일 기준 정렬
CREATE INDEX IF NOT EXISTS idx_task_notifications_created
ON task_notifications(created_at DESC);

-- ============================================
-- 5. notifications 테이블 (일반 알림)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_created
ON notifications(created_at DESC);

-- ============================================
-- 6. uploaded_files / facility_photos 테이블
-- ============================================

-- 사업장별 파일 조회
CREATE INDEX IF NOT EXISTS idx_uploaded_files_business
ON uploaded_files(business_id) WHERE is_deleted = false;

-- 생성일 기준 정렬
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created
ON uploaded_files(created_at DESC) WHERE is_deleted = false;

-- facility_photos
CREATE INDEX IF NOT EXISTS idx_facility_photos_business
ON facility_photos(business_id);

CREATE INDEX IF NOT EXISTS idx_facility_photos_created
ON facility_photos(created_at DESC);

-- ============================================
-- 7. task_comments 테이블 (댓글)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_task_comments_task
ON task_comments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_user
ON task_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_created
ON task_comments(created_at DESC);

-- ============================================
-- 8. task_status_history 테이블 (상태 이력)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_task_status_history_task
ON task_status_history(task_id);

CREATE INDEX IF NOT EXISTS idx_task_status_history_created
ON task_status_history(created_at DESC);

-- ============================================
-- 9. router_inventory 테이블 (라우터 재고)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_router_inventory_status
ON router_inventory(status);

CREATE INDEX IF NOT EXISTS idx_router_inventory_serial
ON router_inventory(serial_number);

-- ============================================
-- 10. measurement_devices 테이블 (측정기기)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_measurement_devices_business
ON measurement_devices(business_id);

-- ============================================
-- 11. air_permit_info 테이블 (대기 허가)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_air_permit_business
ON air_permit_info(business_id);

-- ============================================
-- 12. commission_rates 테이블 (수수료율)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commission_rates_active
ON commission_rates(is_active, effective_from DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_commission_rates_sales_office
ON commission_rates(sales_office) WHERE is_active = true;

-- ============================================
-- 13. business_memos 테이블 (메모)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_business_memos_business
ON business_memos(business_id);

CREATE INDEX IF NOT EXISTS idx_business_memos_created
ON business_memos(created_at DESC);

-- ============================================
-- 14. projects 테이블 (프로젝트)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_status
ON projects(status);

CREATE INDEX IF NOT EXISTS idx_projects_created
ON projects(created_at DESC);

-- ============================================
-- 15. weekly_reports 테이블 (주간 보고서)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_weekly_reports_created
ON weekly_reports(created_at DESC);

-- ============================================
-- 검증: 생성된 인덱스 확인
-- ============================================

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
