-- ===============================================
-- Phase 3: 주간 보고서 시스템 마이그레이션
-- weekly_reports 테이블 및 관련 기능 구축
-- ===============================================

-- 1. 마이그레이션 시작 로그
DO $$
BEGIN
    RAISE NOTICE '시작: Phase 3 주간 보고서 시스템 마이그레이션 - %', NOW();
END $$;

-- 2. 주간 보고서 테이블 생성
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 보고서 기본 정보
    user_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),

    -- 보고 기간
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    week_number INTEGER, -- 연도의 몇 번째 주
    year INTEGER,

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
    improvement_suggestions TEXT,

    -- 협조 요청 현황
    collaboration_requests_sent INTEGER DEFAULT 0,
    collaboration_requests_received INTEGER DEFAULT 0,
    collaboration_requests_completed INTEGER DEFAULT 0,

    -- 업무 통계 (자동 계산)
    total_tasks_worked INTEGER DEFAULT 0,
    total_hours_estimated INTEGER DEFAULT 0,
    productivity_score DECIMAL(5,2), -- 생산성 점수 (0-100)

    -- 상태 관리
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'rejected')),

    -- 승인 관리
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES employees(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- 알림 및 일정
    reminder_sent BOOLEAN DEFAULT false,
    due_date DATE, -- 보고서 제출 마감일

    -- 첨부파일 및 메타데이터
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(user_id, week_start_date),
    CHECK (week_end_date = week_start_date + INTERVAL '6 days'),
    CHECK (week_number >= 1 AND week_number <= 53),
    CHECK (productivity_score IS NULL OR (productivity_score >= 0 AND productivity_score <= 100))
);

RAISE NOTICE '✓ weekly_reports 테이블 생성 완료';

-- 3. 보고서 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS weekly_report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 템플릿 정보
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id),

    -- 템플릿 구조
    template_structure JSONB NOT NULL DEFAULT '{
        "sections": [
            {"id": "completed", "title": "완료된 업무", "required": true},
            {"id": "ongoing", "title": "진행 중인 업무", "required": true},
            {"id": "planned", "title": "계획된 업무", "required": true},
            {"id": "achievements", "title": "주요 성과", "required": false},
            {"id": "challenges", "title": "어려움/이슈", "required": false},
            {"id": "goals", "title": "다음 주 목표", "required": true}
        ]
    }',

    -- 자동 데이터 수집 설정
    auto_data_sources JSONB DEFAULT '{}',

    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

RAISE NOTICE '✓ weekly_report_templates 테이블 생성 완료';

-- 4. 보고서 승인 워크플로우 테이블
CREATE TABLE IF NOT EXISTS weekly_report_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 보고서 연결
    report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,

    -- 승인자 정보
    approver_id UUID NOT NULL REFERENCES employees(id),
    approval_level INTEGER NOT NULL, -- 1차, 2차 승인 등

    -- 승인 상태
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delegated')),
    comments TEXT,
    action_date TIMESTAMP WITH TIME ZONE,

    -- 위임 정보 (필요시)
    delegated_to UUID REFERENCES employees(id),
    delegation_reason TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(report_id, approver_id, approval_level)
);

RAISE NOTICE '✓ weekly_report_approvals 테이블 생성 완료';

-- 5. 보고서 통계 및 KPI 테이블
CREATE TABLE IF NOT EXISTS weekly_report_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 기간 정보
    user_id UUID NOT NULL REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),
    week_start_date DATE NOT NULL,

    -- 업무 성과 지표
    tasks_completed INTEGER DEFAULT 0,
    tasks_ongoing INTEGER DEFAULT 0,
    tasks_planned INTEGER DEFAULT 0,
    collaboration_score DECIMAL(5,2), -- 협업 점수

    -- 시간 관리 지표
    hours_worked DECIMAL(8,2),
    overtime_hours DECIMAL(8,2),
    efficiency_score DECIMAL(5,2), -- 효율성 점수

    -- 품질 지표
    task_completion_rate DECIMAL(5,2), -- 완료율
    deadline_adherence_rate DECIMAL(5,2), -- 마감 준수율
    quality_score DECIMAL(5,2), -- 품질 점수

    -- 자동 계산된 메트릭
    auto_calculated_at TIMESTAMP WITH TIME ZONE,
    calculation_version VARCHAR(10) DEFAULT '1.0',

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건
    UNIQUE(user_id, week_start_date)
);

RAISE NOTICE '✓ weekly_report_metrics 테이블 생성 완료';

-- 6. 인덱스 생성
-- weekly_reports 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user
    ON weekly_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_department
    ON weekly_reports(department_id);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week
    ON weekly_reports(week_start_date, week_end_date);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_status
    ON weekly_reports(status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_year_week
    ON weekly_reports(year, week_number);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_due_date
    ON weekly_reports(due_date)
    WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_submitted
    ON weekly_reports(submitted_at)
    WHERE submitted_at IS NOT NULL;

-- weekly_report_templates 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_report_templates_department
    ON weekly_report_templates(department_id);

CREATE INDEX IF NOT EXISTS idx_weekly_report_templates_active
    ON weekly_report_templates(is_active)
    WHERE is_active = true;

-- weekly_report_approvals 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_report_approvals_report
    ON weekly_report_approvals(report_id);

CREATE INDEX IF NOT EXISTS idx_weekly_report_approvals_approver
    ON weekly_report_approvals(approver_id);

CREATE INDEX IF NOT EXISTS idx_weekly_report_approvals_status
    ON weekly_report_approvals(status);

CREATE INDEX IF NOT EXISTS idx_weekly_report_approvals_level
    ON weekly_report_approvals(approval_level);

-- weekly_report_metrics 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_report_metrics_user
    ON weekly_report_metrics(user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_report_metrics_department
    ON weekly_report_metrics(department_id);

CREATE INDEX IF NOT EXISTS idx_weekly_report_metrics_week
    ON weekly_report_metrics(week_start_date);

RAISE NOTICE '✓ 인덱스 생성 완료';

-- 7. 트리거 생성
-- updated_at 트리거들
DROP TRIGGER IF EXISTS update_weekly_reports_updated_at ON weekly_reports;
CREATE TRIGGER update_weekly_reports_updated_at
    BEFORE UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_report_templates_updated_at ON weekly_report_templates;
CREATE TRIGGER update_weekly_report_templates_updated_at
    BEFORE UPDATE ON weekly_report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_report_approvals_updated_at ON weekly_report_approvals;
CREATE TRIGGER update_weekly_report_approvals_updated_at
    BEFORE UPDATE ON weekly_report_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_report_metrics_updated_at ON weekly_report_metrics;
CREATE TRIGGER update_weekly_report_metrics_updated_at
    BEFORE UPDATE ON weekly_report_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 주간 정보 자동 계산 트리거
CREATE OR REPLACE FUNCTION calculate_week_info()
RETURNS TRIGGER AS $$
BEGIN
    NEW.week_number := EXTRACT(WEEK FROM NEW.week_start_date);
    NEW.year := EXTRACT(YEAR FROM NEW.week_start_date);
    NEW.week_end_date := NEW.week_start_date + INTERVAL '6 days';

    -- 기본 마감일 설정 (다음 주 월요일)
    IF NEW.due_date IS NULL THEN
        NEW.due_date := NEW.week_start_date + INTERVAL '7 days';
    END IF;

    -- 부서 정보 자동 설정
    IF NEW.department_id IS NULL THEN
        SELECT department_id INTO NEW.department_id
        FROM employees WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weekly_reports_week_info_trigger ON weekly_reports;
CREATE TRIGGER weekly_reports_week_info_trigger
    BEFORE INSERT OR UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION calculate_week_info();

-- 보고서 상태 변경 시 승인 프로세스 트리거
CREATE OR REPLACE FUNCTION handle_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 제출 상태로 변경 시
    IF OLD.status = 'draft' AND NEW.status = 'submitted' THEN
        NEW.submitted_at := NOW();

        -- 1차 승인자 자동 생성 (직속 상관)
        INSERT INTO weekly_report_approvals (
            report_id, approver_id, approval_level
        )
        SELECT
            NEW.id,
            manager.id,
            1
        FROM employees manager
        WHERE manager.department = (SELECT department FROM employees WHERE id = NEW.user_id)
        AND manager.permission_level >= 2
        AND manager.id != NEW.user_id
        ORDER BY manager.permission_level DESC
        LIMIT 1
        ON CONFLICT DO NOTHING;
    END IF;

    -- 승인 완료 시
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
        NEW.approved_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weekly_reports_status_change_trigger ON weekly_reports;
CREATE TRIGGER weekly_reports_status_change_trigger
    BEFORE UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION handle_report_status_change();

RAISE NOTICE '✓ 트리거 생성 완료';

-- 8. RLS 정책 설정
-- weekly_reports RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own weekly reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can view department reports" ON weekly_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON weekly_reports;

-- 사용자는 자신의 보고서만 관리
CREATE POLICY "Users can manage own weekly reports" ON weekly_reports
    FOR ALL USING (user_id::text = auth.uid()::text);

-- 매니저는 부서 보고서 조회 가능
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

-- 관리자는 모든 보고서 접근
CREATE POLICY "Admins can view all reports" ON weekly_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level = 3
        )
    );

-- weekly_report_templates RLS
ALTER TABLE weekly_report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view templates" ON weekly_report_templates;
DROP POLICY IF EXISTS "Managers can manage templates" ON weekly_report_templates;

CREATE POLICY "Users can view templates" ON weekly_report_templates
    FOR SELECT USING (is_active = true);

CREATE POLICY "Managers can manage templates" ON weekly_report_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level >= 2
        )
    );

-- weekly_report_approvals RLS
ALTER TABLE weekly_report_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approvers can manage approvals" ON weekly_report_approvals;

CREATE POLICY "Approvers can manage approvals" ON weekly_report_approvals
    FOR ALL USING (
        approver_id::text = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM weekly_reports wr
            WHERE wr.id = weekly_report_approvals.report_id
            AND wr.user_id::text = auth.uid()::text
        ) OR
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level = 3
        )
    );

-- weekly_report_metrics RLS
ALTER TABLE weekly_report_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own metrics" ON weekly_report_metrics;
DROP POLICY IF EXISTS "Managers can view department metrics" ON weekly_report_metrics;

CREATE POLICY "Users can view own metrics" ON weekly_report_metrics
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Managers can view department metrics" ON weekly_report_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees e1, employees e2
            WHERE e1.id::text = auth.uid()::text
            AND e2.id = weekly_report_metrics.user_id
            AND e1.permission_level >= 2
            AND (e1.department = e2.department OR e1.permission_level = 3)
        )
    );

RAISE NOTICE '✓ RLS 정책 설정 완료';

-- 9. 주요 유틸리티 함수들
-- 주간 보고서 자동 생성 함수 (개선된 버전)
CREATE OR REPLACE FUNCTION generate_weekly_report_template(
    p_user_id UUID,
    p_week_start_date DATE,
    p_template_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    report_id UUID;
    week_end_date DATE;
    user_info RECORD;
    template_info RECORD;
    auto_data JSONB;
BEGIN
    -- 사용자 정보 조회
    SELECT e.name, e.department, d.name as department_name, d.id as dept_id
    INTO user_info
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.id = p_user_id;

    -- 템플릿 정보 조회 (없으면 기본 템플릿)
    IF p_template_id IS NOT NULL THEN
        SELECT * INTO template_info FROM weekly_report_templates WHERE id = p_template_id;
    ELSE
        SELECT * INTO template_info FROM weekly_report_templates
        WHERE (department_id = user_info.dept_id OR department_id IS NULL)
        AND is_default = true AND is_active = true
        ORDER BY department_id NULLS LAST
        LIMIT 1;
    END IF;

    -- 자동 데이터 수집 (지난 주 업무 데이터)
    auto_data := json_build_object(
        'completed_tasks', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', ft.id,
                    'title', ft.title,
                    'business_name', ft.business_name,
                    'status', ft.status,
                    'completed_at', ft.completed_at
                )
            ), '[]'::json)
            FROM facility_tasks ft
            WHERE ft.assignee = user_info.name
            AND ft.completed_at BETWEEN p_week_start_date AND p_week_start_date + INTERVAL '6 days'
            AND ft.status IN ('balance_payment', 'document_complete', 'subsidy_payment')
        ),
        'ongoing_tasks', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', ft.id,
                    'title', ft.title,
                    'business_name', ft.business_name,
                    'status', ft.status,
                    'priority', ft.priority
                )
            ), '[]'::json)
            FROM facility_tasks ft
            WHERE ft.assignee = user_info.name
            AND ft.is_active = true AND ft.is_deleted = false
            AND ft.status NOT IN ('balance_payment', 'document_complete', 'subsidy_payment')
        ),
        'collaboration_stats', (
            SELECT json_build_object(
                'sent', COUNT(*) FILTER (WHERE tc.requester_id = p_user_id),
                'received', COUNT(*) FILTER (WHERE tc.requested_to_id = p_user_id),
                'completed', COUNT(*) FILTER (WHERE tc.status = 'completed')
            )
            FROM task_collaborations tc
            WHERE (tc.requester_id = p_user_id OR tc.requested_to_id = p_user_id)
            AND tc.created_at BETWEEN p_week_start_date AND p_week_start_date + INTERVAL '6 days'
        )
    );

    -- 주간 보고서 템플릿 생성
    INSERT INTO weekly_reports (
        user_id, department_id, week_start_date, week_end_date,
        title, summary,
        completed_tasks, ongoing_tasks, planned_tasks,
        collaboration_requests_sent, collaboration_requests_received,
        metadata
    ) VALUES (
        p_user_id,
        user_info.dept_id,
        p_week_start_date,
        p_week_start_date + INTERVAL '6 days',
        user_info.name || '님의 ' || TO_CHAR(p_week_start_date, 'YYYY-MM-DD') || ' 주간 보고서',
        '이번 주 주요 업무 내용을 요약해주세요.',
        auto_data->'completed_tasks',
        auto_data->'ongoing_tasks',
        '[]'::jsonb,
        (auto_data->'collaboration_stats'->>'sent')::integer,
        (auto_data->'collaboration_stats'->>'received')::integer,
        json_build_object(
            'template_id', COALESCE(template_info.id, null),
            'auto_generated', true,
            'generation_version', '2.0'
        )
    )
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        updated_at = NOW()
    RETURNING id INTO report_id;

    RETURN report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 보고서 성과 지표 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_weekly_metrics(
    p_user_id UUID,
    p_week_start_date DATE
)
RETURNS UUID AS $$
DECLARE
    metrics_id UUID;
    user_dept_id UUID;
    completed_count INTEGER;
    ongoing_count INTEGER;
    collaboration_score DECIMAL;
    efficiency_score DECIMAL;
BEGIN
    -- 사용자 부서 조회
    SELECT department_id INTO user_dept_id FROM employees WHERE id = p_user_id;

    -- 완료 업무 수
    SELECT COUNT(*) INTO completed_count
    FROM facility_tasks ft
    WHERE ft.assignee = (SELECT name FROM employees WHERE id = p_user_id)
    AND ft.completed_at BETWEEN p_week_start_date AND p_week_start_date + INTERVAL '6 days';

    -- 진행 중 업무 수
    SELECT COUNT(*) INTO ongoing_count
    FROM facility_tasks ft
    WHERE ft.assignee = (SELECT name FROM employees WHERE id = p_user_id)
    AND ft.is_active = true AND ft.is_deleted = false
    AND ft.status NOT IN ('balance_payment', 'document_complete', 'subsidy_payment');

    -- 협업 점수 계산 (완료된 협조 요청 비율)
    SELECT COALESCE(
        (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        0
    ) INTO collaboration_score
    FROM task_collaborations tc
    WHERE (tc.requester_id = p_user_id OR tc.requested_to_id = p_user_id)
    AND tc.created_at BETWEEN p_week_start_date AND p_week_start_date + INTERVAL '6 days';

    -- 효율성 점수 계산 (간단한 공식)
    efficiency_score := LEAST(100, (completed_count * 20) + (collaboration_score * 0.3));

    -- 메트릭 삽입 또는 업데이트
    INSERT INTO weekly_report_metrics (
        user_id, department_id, week_start_date,
        tasks_completed, tasks_ongoing,
        collaboration_score, efficiency_score,
        task_completion_rate,
        auto_calculated_at
    ) VALUES (
        p_user_id, user_dept_id, p_week_start_date,
        completed_count, ongoing_count,
        collaboration_score, efficiency_score,
        CASE WHEN (completed_count + ongoing_count) > 0 THEN
            (completed_count::DECIMAL / (completed_count + ongoing_count)) * 100
        ELSE 0 END,
        NOW()
    )
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        tasks_completed = EXCLUDED.tasks_completed,
        tasks_ongoing = EXCLUDED.tasks_ongoing,
        collaboration_score = EXCLUDED.collaboration_score,
        efficiency_score = EXCLUDED.efficiency_score,
        task_completion_rate = EXCLUDED.task_completion_rate,
        auto_calculated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO metrics_id;

    RETURN metrics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 일괄 주간 보고서 생성 함수 (모든 활성 사용자)
CREATE OR REPLACE FUNCTION generate_weekly_reports_for_all_users(
    p_week_start_date DATE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    target_date DATE;
    generated_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- 날짜가 지정되지 않으면 이번 주 월요일
    IF p_week_start_date IS NULL THEN
        target_date := DATE_TRUNC('week', CURRENT_DATE);
    ELSE
        target_date := p_week_start_date;
    END IF;

    -- 모든 활성 사용자에 대해 보고서 생성
    FOR user_record IN
        SELECT id, name FROM employees
        WHERE is_active = true AND permission_level <= 2
    LOOP
        BEGIN
            PERFORM generate_weekly_report_template(user_record.id, target_date);
            PERFORM calculate_weekly_metrics(user_record.id, target_date);
            generated_count := generated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '사용자 % (%)의 주간 보고서 생성 실패: %',
                user_record.name, user_record.id, SQLERRM;
        END;
    END LOOP;

    RETURN generated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✓ 유틸리티 함수 생성 완료';

-- 10. 대시보드 뷰 생성
-- 주간 보고서 요약 뷰 (개선된 버전)
CREATE OR REPLACE VIEW weekly_reports_summary AS
SELECT
    wr.*,
    e.name as user_name,
    e.email as user_email,
    e.department as user_department,
    d.name as department_name,
    reviewer.name as reviewer_name,

    -- 업무 통계
    JSONB_ARRAY_LENGTH(wr.completed_tasks) as completed_count,
    JSONB_ARRAY_LENGTH(wr.ongoing_tasks) as ongoing_count,
    JSONB_ARRAY_LENGTH(wr.planned_tasks) as planned_count,

    -- 일정 계산
    CASE
        WHEN wr.due_date IS NOT NULL THEN
            EXTRACT(EPOCH FROM (wr.due_date::timestamp - NOW())) / 86400
    END as days_until_due,

    -- 승인 상태
    (
        SELECT COUNT(*)
        FROM weekly_report_approvals wra
        WHERE wra.report_id = wr.id AND wra.status = 'pending'
    ) as pending_approvals,

    -- 성과 지표
    wrm.efficiency_score,
    wrm.collaboration_score,
    wrm.task_completion_rate

FROM weekly_reports wr
LEFT JOIN employees e ON wr.user_id = e.id
LEFT JOIN departments d ON wr.department_id = d.id
LEFT JOIN employees reviewer ON wr.reviewed_by = reviewer.id
LEFT JOIN weekly_report_metrics wrm ON wr.user_id = wrm.user_id AND wr.week_start_date = wrm.week_start_date;

-- 부서별 보고서 통계 뷰
CREATE OR REPLACE VIEW department_report_statistics AS
SELECT
    d.id as department_id,
    d.name as department_name,
    wr.week_start_date,
    wr.year,
    wr.week_number,

    -- 제출 통계
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE wr.status = 'submitted') as submitted_reports,
    COUNT(*) FILTER (WHERE wr.status = 'approved') as approved_reports,
    COUNT(*) FILTER (WHERE wr.status = 'draft') as draft_reports,

    -- 성과 통계
    AVG(wrm.efficiency_score) as avg_efficiency_score,
    AVG(wrm.collaboration_score) as avg_collaboration_score,
    AVG(wrm.task_completion_rate) as avg_completion_rate,

    -- 업무 통계
    SUM(wrm.tasks_completed) as total_completed_tasks,
    SUM(wrm.tasks_ongoing) as total_ongoing_tasks,

    -- 시간 통계
    MAX(wr.updated_at) as last_updated_at

FROM departments d
LEFT JOIN weekly_reports wr ON d.id = wr.department_id
LEFT JOIN weekly_report_metrics wrm ON wr.user_id = wrm.user_id AND wr.week_start_date = wrm.week_start_date
GROUP BY d.id, d.name, wr.week_start_date, wr.year, wr.week_number;

RAISE NOTICE '✓ 대시보드 뷰 생성 완료';

-- 11. 기본 템플릿 데이터 생성
-- 기본 주간 보고서 템플릿 생성
INSERT INTO weekly_report_templates (
    name, description, template_structure, is_default, is_active, created_by
) VALUES
(
    '표준 주간 보고서',
    '모든 부서에서 사용할 수 있는 기본 주간 보고서 템플릿',
    '{
        "sections": [
            {
                "id": "completed",
                "title": "완료된 업무",
                "description": "이번 주에 완료한 주요 업무들을 나열해주세요",
                "required": true,
                "type": "list"
            },
            {
                "id": "ongoing",
                "title": "진행 중인 업무",
                "description": "현재 진행 중인 업무의 상태를 작성해주세요",
                "required": true,
                "type": "list"
            },
            {
                "id": "planned",
                "title": "다음 주 계획",
                "description": "다음 주에 진행할 업무 계획을 작성해주세요",
                "required": true,
                "type": "list"
            },
            {
                "id": "achievements",
                "title": "주요 성과",
                "description": "이번 주의 특별한 성과나 개선사항이 있다면 작성해주세요",
                "required": false,
                "type": "text"
            },
            {
                "id": "challenges",
                "title": "어려움 및 이슈",
                "description": "업무 진행 중 겪은 어려움이나 해결이 필요한 이슈가 있다면 작성해주세요",
                "required": false,
                "type": "text"
            },
            {
                "id": "support",
                "title": "필요한 지원",
                "description": "업무 진행을 위해 필요한 지원이나 협조사항이 있다면 작성해주세요",
                "required": false,
                "type": "text"
            }
        ],
        "auto_data": {
            "include_completed_tasks": true,
            "include_ongoing_tasks": true,
            "include_collaboration_stats": true
        }
    }'::jsonb,
    true,
    true,
    (SELECT id FROM employees WHERE permission_level = 3 ORDER BY created_at LIMIT 1)
),
(
    '기술팀 전용 보고서',
    '기술팀에서 사용하는 전문 보고서 템플릿',
    '{
        "sections": [
            {
                "id": "installations",
                "title": "시설 설치 현황",
                "description": "이번 주 시설 설치 및 점검 현황",
                "required": true,
                "type": "list"
            },
            {
                "id": "technical_issues",
                "title": "기술적 이슈",
                "description": "발생한 기술적 문제 및 해결 방안",
                "required": false,
                "type": "text"
            },
            {
                "id": "quality_metrics",
                "title": "품질 지표",
                "description": "설치 품질 및 고객 만족도 관련 지표",
                "required": false,
                "type": "metrics"
            }
        ]
    }'::jsonb,
    false,
    true,
    (SELECT id FROM employees WHERE permission_level = 3 ORDER BY created_at LIMIT 1)
)
ON CONFLICT DO NOTHING;

RAISE NOTICE '✓ 기본 템플릿 데이터 생성 완료';

-- 12. 데이터 검증 및 완료 로그
DO $$
DECLARE
    total_reports INTEGER;
    total_templates INTEGER;
    total_metrics INTEGER;
    active_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_reports FROM weekly_reports;
    SELECT COUNT(*) INTO total_templates FROM weekly_report_templates;
    SELECT COUNT(*) INTO total_metrics FROM weekly_report_metrics;
    SELECT COUNT(*) INTO active_users FROM employees WHERE is_active = true;

    RAISE NOTICE '=== Phase 3 주간 보고서 시스템 마이그레이션 완료 ===';
    RAISE NOTICE '주간 보고서: %건', total_reports;
    RAISE NOTICE '보고서 템플릿: %건', total_templates;
    RAISE NOTICE '성과 지표: %건', total_metrics;
    RAISE NOTICE '활성 사용자: %명', active_users;
    RAISE NOTICE '완료 시간: %', NOW();
END $$;

-- 13. 테이블 코멘트 추가
COMMENT ON TABLE weekly_reports IS 'Phase 3: 주간 보고서 관리 테이블';
COMMENT ON TABLE weekly_report_templates IS 'Phase 3: 주간 보고서 템플릿 관리';
COMMENT ON TABLE weekly_report_approvals IS 'Phase 3: 주간 보고서 승인 워크플로우';
COMMENT ON TABLE weekly_report_metrics IS 'Phase 3: 주간 성과 지표 및 KPI';

COMMENT ON COLUMN weekly_reports.status IS 'Phase 3: 보고서 상태 (draft, submitted, reviewed, approved, rejected)';
COMMENT ON COLUMN weekly_reports.productivity_score IS 'Phase 3: 생산성 점수 (0-100)';
COMMENT ON COLUMN weekly_reports.week_number IS 'Phase 3: 연도 내 주차 번호 (1-53)';

-- 14. 스케줄링을 위한 함수 (pg_cron 확장이 있는 경우 사용)
-- 매주 월요일 오전 9시에 모든 사용자의 주간 보고서 자동 생성
/*
SELECT cron.schedule(
    'weekly-report-generation',
    '0 9 * * 1',  -- 매주 월요일 9시
    'SELECT generate_weekly_reports_for_all_users();'
);
*/

RAISE NOTICE '🎉 Phase 3 주간 보고서 시스템 마이그레이션이 성공적으로 완료되었습니다!';
RAISE NOTICE '전체 통합 스키마 마이그레이션이 완료되었습니다.';
RAISE NOTICE '다음 단계: API 및 UI 구현을 진행하세요.';