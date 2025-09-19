-- ===============================================
-- 5단계: 업무 진행 현황 및 알림 시스템 구축
-- 사업장별 업무 진행 현황 추적 및 담당자 알림 기능
-- ===============================================

-- 전제조건 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_tasks') THEN
        RAISE EXCEPTION 'facility_tasks 테이블이 존재하지 않습니다. 먼저 01_create_facility_tasks_table.sql을 실행하세요.';
    END IF;
END $$;

-- 1. 업무 진행 현황 메모 테이블 생성
CREATE TABLE IF NOT EXISTS business_progress_notes (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    task_id VARCHAR(255), -- NULL이면 일반 메모, 값이 있으면 특정 업무 관련 자동 메모
    content TEXT NOT NULL,
    note_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'auto' | 'manual'
    created_by VARCHAR(255) NOT NULL, -- 'system' 또는 user_id
    author_name VARCHAR(255), -- 작성자 이름 (수동 메모용)
    metadata JSONB, -- 추가 정보 (알림 타입, 업무 상태 등)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- 2. 업무 알림 테이블 생성
CREATE TABLE IF NOT EXISTS task_notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255), -- 사용자 이름 (조회 최적화용)
    task_id VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(30) NOT NULL, -- 'delay' | 'risk' | 'status_change' | 'assignment' | 'completion'
    priority VARCHAR(10) DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- 알림 만료일 (선택적)
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_business_progress_notes_business_name ON business_progress_notes(business_name);
CREATE INDEX IF NOT EXISTS idx_business_progress_notes_task_id ON business_progress_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_business_progress_notes_created_at ON business_progress_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_progress_notes_type ON business_progress_notes(note_type);

CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_business_name ON task_notifications(business_name);
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_task_notifications_created_at ON task_notifications(created_at DESC);

-- 4. 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_business_progress_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 업데이트 트리거 생성
CREATE TRIGGER trigger_update_business_progress_notes_updated_at
    BEFORE UPDATE ON business_progress_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_business_progress_notes_updated_at();

-- 6. 테이블 및 컬럼 설명 추가
COMMENT ON TABLE business_progress_notes IS '사업장별 업무 진행 현황 메모 (수동 + 자동 생성)';
COMMENT ON COLUMN business_progress_notes.business_name IS '사업장명';
COMMENT ON COLUMN business_progress_notes.task_id IS '관련 업무 ID (NULL이면 일반 메모)';
COMMENT ON COLUMN business_progress_notes.content IS '메모 내용';
COMMENT ON COLUMN business_progress_notes.note_type IS '메모 타입: auto(자동), manual(수동)';
COMMENT ON COLUMN business_progress_notes.created_by IS '생성자: system 또는 user_id';
COMMENT ON COLUMN business_progress_notes.author_name IS '작성자 이름 (수동 메모용)';
COMMENT ON COLUMN business_progress_notes.metadata IS '추가 메타데이터 (JSON)';

COMMENT ON TABLE task_notifications IS '업무 담당자 알림 시스템';
COMMENT ON COLUMN task_notifications.user_id IS '알림 받을 사용자 ID';
COMMENT ON COLUMN task_notifications.task_id IS '관련 업무 ID';
COMMENT ON COLUMN task_notifications.notification_type IS '알림 타입';
COMMENT ON COLUMN task_notifications.priority IS '알림 우선순위';

-- 7. RLS (Row Level Security) 정책 설정 (선택사항)
-- ALTER TABLE business_progress_notes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- 8. 예시 데이터 삽입 (개발용)
-- INSERT INTO business_progress_notes (business_name, content, note_type, created_by, author_name) VALUES
-- ('테스트 업체', '초기 메모입니다.', 'manual', 'user123', '홍길동');

-- 완료 메시지
SELECT
    'business_progress_notes 및 task_notifications 테이블이 성공적으로 생성되었습니다!' as message,
    (SELECT count(*) FROM business_progress_notes) as progress_notes_count,
    (SELECT count(*) FROM task_notifications) as notifications_count;