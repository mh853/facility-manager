-- Communication Boards Schema (공지사항, 전달사항, 캘린더)
-- 루트 페이지 개편을 위한 커뮤니케이션 보드 테이블 생성

-- ========================================
-- 1. 공지사항 (Announcements) 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- 공지사항 인덱스
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);

-- 공지사항 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER announcements_updated_at_trigger
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- ========================================
-- 2. 전달사항 (Messages) 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- 전달사항 인덱스
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);

-- 전달사항 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at_trigger
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

-- ========================================
-- 3. 캘린더 이벤트 (Calendar Events) 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('todo', 'schedule')),
    is_completed BOOLEAN DEFAULT false,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- 캘린더 이벤트 인덱스
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_author_id ON calendar_events(author_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_completed ON calendar_events(is_completed) WHERE event_type = 'todo' AND is_deleted = false;

-- 캘린더 이벤트 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_events_updated_at_trigger
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- ========================================
-- 4. Row Level Security (RLS) 정책 설정
-- ========================================

-- RLS 활성화
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 공지사항 RLS 정책
-- Level 1+ (AUTHENTICATED): 읽기 가능
-- Level 3+ (SUPER_ADMIN): 쓰기/수정/삭제 가능
CREATE POLICY "announcements_read_policy"
    ON announcements FOR SELECT
    USING (
        is_deleted = false AND
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "announcements_insert_policy"
    ON announcements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 3
        )
    );

CREATE POLICY "announcements_update_policy"
    ON announcements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 3
        )
    );

CREATE POLICY "announcements_delete_policy"
    ON announcements FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 3
        )
    );

-- 전달사항 RLS 정책
-- Level 1+ (AUTHENTICATED): 모든 작업 가능
CREATE POLICY "messages_read_policy"
    ON messages FOR SELECT
    USING (
        is_deleted = false AND
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "messages_insert_policy"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "messages_update_policy"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "messages_delete_policy"
    ON messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

-- 캘린더 이벤트 RLS 정책
-- Level 1+ (AUTHENTICATED): 모든 작업 가능
CREATE POLICY "calendar_events_read_policy"
    ON calendar_events FOR SELECT
    USING (
        is_deleted = false AND
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "calendar_events_insert_policy"
    ON calendar_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "calendar_events_update_policy"
    ON calendar_events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

CREATE POLICY "calendar_events_delete_policy"
    ON calendar_events FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.employee_id::text = auth.uid()::text
            AND employees.permission_level >= 1
        )
    );

-- ========================================
-- 5. 샘플 데이터 (개발/테스트용)
-- ========================================

-- 공지사항 샘플
INSERT INTO announcements (title, content, author_id, author_name, is_pinned)
VALUES
    ('시스템 업데이트 안내', '2025년 1월 15일 00:00 ~ 02:00 사이 시스템 정기 점검이 예정되어 있습니다.', 'admin', '관리자', true),
    ('새해 인사', '2025년 새해를 맞이하여 임직원 여러분께 인사드립니다.', 'admin', '관리자', false),
    ('보안 정책 변경 안내', '비밀번호 정책이 강화되었습니다. 최소 10자 이상, 특수문자 포함 필수입니다.', 'admin', '관리자', false);

-- 전달사항 샘플
INSERT INTO messages (title, content, author_id, author_name)
VALUES
    ('회의록 공유', '2025-01-10 주간 회의록을 공유합니다. 첨부파일을 확인해주세요.', 'user1', '김철수'),
    ('업무 협조 요청', 'A 프로젝트 관련 자료 검토 부탁드립니다.', 'user2', '이영희'),
    ('자료 요청', 'B 사업장 견적서 양식이 필요합니다.', 'user3', '박민수');

-- 캘린더 이벤트 샘플
INSERT INTO calendar_events (title, description, event_date, event_type, is_completed, author_id, author_name)
VALUES
    ('프로젝트 마감', 'A 프로젝트 최종 보고서 제출', CURRENT_DATE + INTERVAL '7 days', 'todo', false, 'user1', '김철수'),
    ('정기 회의', '월간 전체 회의', CURRENT_DATE + INTERVAL '3 days', 'schedule', false, 'admin', '관리자'),
    ('견적서 제출', 'C 사업장 견적서 작성 및 제출', CURRENT_DATE + INTERVAL '5 days', 'todo', false, 'user2', '이영희'),
    ('고객 미팅', 'D 고객사 방문 미팅', CURRENT_DATE + INTERVAL '10 days', 'schedule', false, 'user3', '박민수');

-- 완료
COMMENT ON TABLE announcements IS '공지사항 - Level 3+ 쓰기, Level 1+ 읽기';
COMMENT ON TABLE messages IS '전달사항 - Level 1+ 모든 작업';
COMMENT ON TABLE calendar_events IS '캘린더 이벤트 - Level 1+ 모든 작업, todo/schedule 타입 구분';
