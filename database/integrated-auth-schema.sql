-- ===============================================
-- 시설 관리 시스템 통합 인증 및 업무 관리 스키마
-- 기존 employees 테이블과 호환되는 점진적 확장 설계
-- ===============================================

-- 1. 기존 employees 테이블과 호환되는 통합 사용자 테이블
-- employees 테이블을 확장하여 소셜 로그인 지원
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS
    provider VARCHAR(20) CHECK (provider IN ('kakao', 'naver', 'google', 'system') OR provider IS NULL);
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS
    provider_id VARCHAR(100);
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS
    avatar_url TEXT;
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS
    last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS
    email_verified_at TIMESTAMP WITH TIME ZONE;

-- 소셜 계정 연동 관리 테이블
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 연결
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 소셜 프로바이더 정보
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('kakao', 'naver', 'google')),
    provider_id VARCHAR(100) NOT NULL,
    provider_email VARCHAR(255),
    provider_name VARCHAR(100),

    -- 프로바이더별 추가 정보
    provider_data JSONB DEFAULT '{}',

    -- 연동 상태
    is_active BOOLEAN DEFAULT true,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(provider, provider_id),
    UNIQUE(user_id, provider)
);

-- 2. 확장된 업무 관리 테이블 (기존 facility_tasks 확장)
-- facility_tasks를 기반으로 협업 기능 추가
ALTER TABLE IF EXISTS facility_tasks ADD COLUMN IF NOT EXISTS
    created_by UUID REFERENCES employees(id);
ALTER TABLE IF EXISTS facility_tasks ADD COLUMN IF NOT EXISTS
    updated_by UUID REFERENCES employees(id);
ALTER TABLE IF EXISTS facility_tasks ADD COLUMN IF NOT EXISTS
    collaboration_status VARCHAR(20) DEFAULT 'none' CHECK (collaboration_status IN ('none', 'requested', 'accepted', 'rejected'));

-- 업무 협조 요청 관리 테이블
CREATE TABLE IF NOT EXISTS task_collaborations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 업무 연결 (facility_tasks 또는 tasks 테이블 모두 지원)
    facility_task_id UUID REFERENCES facility_tasks(id) ON DELETE CASCADE,
    project_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

    -- 협조 요청 정보
    requester_id UUID NOT NULL REFERENCES employees(id),
    requested_to_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),

    -- 요청 내용
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('support', 'review', 'approval', 'information', 'resource')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- 상태 관리
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),

    -- 일정
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date DATE,
    responded_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 응답 및 피드백
    response_message TEXT,
    completion_notes TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건: facility_task_id 또는 project_task_id 중 하나는 반드시 있어야 함
    CONSTRAINT task_reference_check CHECK (
        (facility_task_id IS NOT NULL AND project_task_id IS NULL) OR
        (facility_task_id IS NULL AND project_task_id IS NOT NULL)
    )
);

-- 3. 주간 보고서 시스템
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 보고서 기본 정보
    user_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),

    -- 보고 기간
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    -- 보고서 내용
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,

    -- 업무 현황 (JSON 형태로 유연하게 저장)
    completed_tasks JSONB DEFAULT '[]',
    ongoing_tasks JSONB DEFAULT '[]',
    planned_tasks JSONB DEFAULT '[]',

    -- 성과 지표
    achievements TEXT,
    challenges TEXT,
    next_week_goals TEXT,

    -- 협조 요청 현황
    collaboration_requests_sent INTEGER DEFAULT 0,
    collaboration_requests_received INTEGER DEFAULT 0,
    collaboration_requests_completed INTEGER DEFAULT 0,

    -- 상태 관리
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved')),

    -- 승인 관리
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES employees(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comments TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(user_id, week_start_date)
);

-- 4. 사용자 세션 확장 (기존 토큰 시스템과 병행)
CREATE TABLE IF NOT EXISTS user_sessions_extended (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 연결
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- 세션 정보
    session_token VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255),

    -- 로그인 방식
    login_method VARCHAR(20) NOT NULL CHECK (login_method IN ('password', 'kakao', 'naver', 'google')),

    -- 세션 상태
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 디바이스 정보
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 인덱스 생성
-- ===============================================

-- 소셜 계정 인덱스
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);

-- 협조 요청 인덱스
CREATE INDEX IF NOT EXISTS idx_task_collaborations_facility_task ON task_collaborations(facility_task_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborations_project_task ON task_collaborations(project_task_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborations_requester ON task_collaborations(requester_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborations_requested_to ON task_collaborations(requested_to_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborations_status ON task_collaborations(status);
CREATE INDEX IF NOT EXISTS idx_task_collaborations_due_date ON task_collaborations(due_date);

-- 주간 보고서 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_department ON weekly_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_status ON weekly_reports(status);

-- 확장 세션 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_user ON user_sessions_extended(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_token ON user_sessions_extended(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_active ON user_sessions_extended(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_extended_expires ON user_sessions_extended(expires_at);

-- employees 테이블 소셜 로그인 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_provider ON employees(provider, provider_id) WHERE provider IS NOT NULL;

-- ===============================================
-- 트리거 함수 및 트리거 생성
-- ===============================================

-- updated_at 자동 업데이트 트리거 (기존에 없다면 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 새 테이블들에 updated_at 트리거 적용
CREATE TRIGGER update_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_collaborations_updated_at
    BEFORE UPDATE ON task_collaborations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_reports_updated_at
    BEFORE UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- RLS (Row Level Security) 정책
-- ===============================================

-- 소셜 계정 RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social accounts" ON social_accounts
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can view all social accounts" ON social_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level = 3
        )
    );

-- 협조 요청 RLS
ALTER TABLE task_collaborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view related collaborations" ON task_collaborations
    FOR SELECT USING (
        requester_id::text = auth.uid()::text OR
        requested_to_id::text = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level >= 2
        )
    );

CREATE POLICY "Users can create collaboration requests" ON task_collaborations
    FOR INSERT WITH CHECK (requester_id::text = auth.uid()::text);

CREATE POLICY "Users can update own requests or received requests" ON task_collaborations
    FOR UPDATE USING (
        requester_id::text = auth.uid()::text OR
        requested_to_id::text = auth.uid()::text
    );

-- 주간 보고서 RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weekly reports" ON weekly_reports
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Managers can view department reports" ON weekly_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees e1, employees e2
            WHERE e1.id::text = auth.uid()::text
            AND e2.id = weekly_reports.user_id
            AND e1.permission_level >= 2
            AND (e1.department = e2.department OR e1.permission_level = 3)
        )
    );

-- 확장 세션 RLS
ALTER TABLE user_sessions_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON user_sessions_extended
    FOR ALL USING (user_id::text = auth.uid()::text);

-- ===============================================
-- 유틸리티 함수들
-- ===============================================

-- 소셜 계정 연동 함수
CREATE OR REPLACE FUNCTION link_social_account(
    p_user_id UUID,
    p_provider VARCHAR(20),
    p_provider_id VARCHAR(100),
    p_provider_email VARCHAR(255),
    p_provider_name VARCHAR(100),
    p_provider_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    social_account_id UUID;
BEGIN
    INSERT INTO social_accounts (
        user_id, provider, provider_id, provider_email,
        provider_name, provider_data
    ) VALUES (
        p_user_id, p_provider, p_provider_id, p_provider_email,
        p_provider_name, p_provider_data
    )
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        provider_email = EXCLUDED.provider_email,
        provider_name = EXCLUDED.provider_name,
        provider_data = EXCLUDED.provider_data,
        is_active = true,
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO social_account_id;

    RETURN social_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 협조 요청 생성 함수
CREATE OR REPLACE FUNCTION create_collaboration_request(
    p_facility_task_id UUID DEFAULT NULL,
    p_project_task_id UUID DEFAULT NULL,
    p_requester_id UUID,
    p_requested_to_id UUID,
    p_request_type VARCHAR(50),
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'medium',
    p_due_date DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    collaboration_id UUID;
BEGIN
    INSERT INTO task_collaborations (
        facility_task_id, project_task_id, requester_id, requested_to_id,
        request_type, title, description, priority, due_date
    ) VALUES (
        p_facility_task_id, p_project_task_id, p_requester_id, p_requested_to_id,
        p_request_type, p_title, p_description, p_priority, p_due_date
    )
    RETURNING id INTO collaboration_id;

    -- 관련 업무에 협조 상태 업데이트
    IF p_facility_task_id IS NOT NULL THEN
        UPDATE facility_tasks
        SET collaboration_status = 'requested', updated_at = NOW()
        WHERE id = p_facility_task_id;
    END IF;

    RETURN collaboration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 주간 보고서 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_weekly_report_template(
    p_user_id UUID,
    p_week_start_date DATE
)
RETURNS UUID AS $$
DECLARE
    report_id UUID;
    week_end_date DATE;
    user_name VARCHAR(100);
    department_name VARCHAR(100);
BEGIN
    -- 주간 종료일 계산
    week_end_date := p_week_start_date + INTERVAL '6 days';

    -- 사용자 정보 조회
    SELECT e.name, d.name
    INTO user_name, department_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.id = p_user_id;

    -- 주간 보고서 템플릿 생성
    INSERT INTO weekly_reports (
        user_id, week_start_date, week_end_date,
        title, summary,
        completed_tasks, ongoing_tasks, planned_tasks
    ) VALUES (
        p_user_id, p_week_start_date, week_end_date,
        user_name || '님의 ' || TO_CHAR(p_week_start_date, 'YYYY-MM-DD') || ' 주간 보고서',
        '이번 주 주요 업무 내용을 요약해주세요.',
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
    )
    ON CONFLICT (user_id, week_start_date) DO NOTHING
    RETURNING id INTO report_id;

    RETURN report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- 편의 뷰 생성
-- ===============================================

-- 통합 사용자 정보 뷰 (employees + social_accounts)
CREATE OR REPLACE VIEW user_profile_view AS
SELECT
    e.id,
    e.employee_id,
    e.name,
    e.email,
    e.permission_level,
    e.department,
    e.team,
    e.position,
    e.phone,
    e.mobile,
    e.is_active,
    e.provider,
    e.avatar_url,
    e.last_login_at,
    e.created_at,
    e.updated_at,

    -- 연동된 소셜 계정 정보
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'provider', sa.provider,
                'provider_email', sa.provider_email,
                'linked_at', sa.linked_at,
                'last_used_at', sa.last_used_at
            )
        ) FILTER (WHERE sa.is_active = true),
        '[]'::json
    ) as social_accounts
FROM employees e
LEFT JOIN social_accounts sa ON e.id = sa.user_id AND sa.is_active = true
GROUP BY e.id;

-- 협조 요청 대시보드 뷰
CREATE OR REPLACE VIEW collaboration_dashboard AS
SELECT
    tc.*,
    requester.name as requester_name,
    requester.email as requester_email,
    requested_to.name as requested_to_name,
    requested_to.email as requested_to_email,
    d.name as department_name,

    -- 관련 업무 정보
    CASE
        WHEN tc.facility_task_id IS NOT NULL THEN ft.title
        WHEN tc.project_task_id IS NOT NULL THEN pt.title
    END as task_title,

    CASE
        WHEN tc.facility_task_id IS NOT NULL THEN ft.business_name
        WHEN tc.project_task_id IS NOT NULL THEN pr.business_name
    END as business_name

FROM task_collaborations tc
LEFT JOIN employees requester ON tc.requester_id = requester.id
LEFT JOIN employees requested_to ON tc.requested_to_id = requested_to.id
LEFT JOIN departments d ON tc.department_id = d.id
LEFT JOIN facility_tasks ft ON tc.facility_task_id = ft.id
LEFT JOIN tasks pt ON tc.project_task_id = pt.id
LEFT JOIN projects pr ON pt.project_id = pr.id;

-- 주간 보고서 요약 뷰
CREATE OR REPLACE VIEW weekly_reports_summary AS
SELECT
    wr.*,
    e.name as user_name,
    e.email as user_email,
    d.name as department_name,
    reviewer.name as reviewer_name,

    -- 업무 통계
    JSONB_ARRAY_LENGTH(wr.completed_tasks) as completed_count,
    JSONB_ARRAY_LENGTH(wr.ongoing_tasks) as ongoing_count,
    JSONB_ARRAY_LENGTH(wr.planned_tasks) as planned_count

FROM weekly_reports wr
LEFT JOIN employees e ON wr.user_id = e.id
LEFT JOIN departments d ON wr.department_id = d.id
LEFT JOIN employees reviewer ON wr.reviewed_by = reviewer.id;

-- ===============================================
-- 초기 데이터 설정
-- ===============================================

-- 기존 employees 테이블의 provider 정보 업데이트 (NULL 값을 'system'으로)
UPDATE employees
SET provider = 'system'
WHERE provider IS NULL AND password_hash IS NOT NULL;

-- ===============================================
-- 코멘트 및 문서화
-- ===============================================

COMMENT ON TABLE social_accounts IS '소셜 로그인 계정 연동 관리 테이블';
COMMENT ON TABLE task_collaborations IS '업무 협조 요청 관리 테이블 - facility_tasks와 tasks 모두 지원';
COMMENT ON TABLE weekly_reports IS '주간 보고서 시스템 테이블';
COMMENT ON TABLE user_sessions_extended IS '확장된 사용자 세션 관리 테이블';

COMMENT ON COLUMN task_collaborations.request_type IS '협조 요청 유형: support(지원), review(검토), approval(승인), information(정보), resource(자원)';
COMMENT ON COLUMN weekly_reports.status IS '보고서 상태: draft(작성중), submitted(제출), reviewed(검토완료), approved(승인)';