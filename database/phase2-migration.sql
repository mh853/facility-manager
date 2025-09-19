-- ===============================================
-- Phase 2: 협업 시스템 구축 마이그레이션
-- facility_tasks 확장 및 task_collaborations 추가
-- ===============================================

-- 1. 마이그레이션 시작 로그
DO $$
BEGIN
    RAISE NOTICE '시작: Phase 2 협업 시스템 마이그레이션 - %', NOW();
END $$;

-- 2. 기존 facility_tasks 테이블 백업 (선택사항)
-- CREATE TABLE facility_tasks_backup_phase2 AS SELECT * FROM facility_tasks;

-- 3. facility_tasks 테이블에 협업 관련 컬럼 추가
DO $$
BEGIN
    -- created_by 컬럼 추가
    BEGIN
        ALTER TABLE facility_tasks ADD COLUMN created_by UUID REFERENCES employees(id);
        RAISE NOTICE '✓ created_by 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ created_by 컬럼이 이미 존재합니다';
    END;

    -- updated_by 컬럼 추가
    BEGIN
        ALTER TABLE facility_tasks ADD COLUMN updated_by UUID REFERENCES employees(id);
        RAISE NOTICE '✓ updated_by 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ updated_by 컬럼이 이미 존재합니다';
    END;

    -- collaboration_status 컬럼 추가
    BEGIN
        ALTER TABLE facility_tasks ADD COLUMN collaboration_status VARCHAR(20) DEFAULT 'none'
            CHECK (collaboration_status IN ('none', 'requested', 'accepted', 'rejected'));
        RAISE NOTICE '✓ collaboration_status 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ collaboration_status 컬럼이 이미 존재합니다';
    END;

    -- tags 컬럼 추가 (업무 분류를 위한 태그)
    BEGIN
        ALTER TABLE facility_tasks ADD COLUMN tags JSONB DEFAULT '[]';
        RAISE NOTICE '✓ tags 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ tags 컬럼이 이미 존재합니다';
    END;

    -- attachments 컬럼 추가 (첨부파일 관리)
    BEGIN
        ALTER TABLE facility_tasks ADD COLUMN attachments JSONB DEFAULT '[]';
        RAISE NOTICE '✓ attachments 컬럼 추가 완료';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠ attachments 컬럼이 이미 존재합니다';
    END;
END $$;

-- 4. 기존 facility_tasks 데이터 보정
-- 기존 업무에 기본 생성자 설정 (관리자 계정으로)
UPDATE facility_tasks
SET
    created_by = (
        SELECT id FROM employees
        WHERE permission_level = 3 AND is_active = true
        ORDER BY created_at
        LIMIT 1
    ),
    updated_by = (
        SELECT id FROM employees
        WHERE permission_level = 3 AND is_active = true
        ORDER BY created_at
        LIMIT 1
    ),
    collaboration_status = 'none'
WHERE created_by IS NULL;

RAISE NOTICE '✓ 기존 facility_tasks 데이터 보정 완료: % 건',
    (SELECT COUNT(*) FROM facility_tasks WHERE collaboration_status = 'none');

-- 5. 업무 협조 요청 관리 테이블 생성
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
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('support', 'review', 'approval', 'information', 'resource', 'consultation')),
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
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 협조 만족도 평가

    -- 첨부파일 및 메타데이터
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 제약조건: facility_task_id 또는 project_task_id 중 하나는 반드시 있어야 함
    CONSTRAINT task_reference_check CHECK (
        (facility_task_id IS NOT NULL AND project_task_id IS NULL) OR
        (facility_task_id IS NULL AND project_task_id IS NOT NULL)
    ),

    -- 자기 자신에게 협조 요청 불가
    CONSTRAINT no_self_collaboration CHECK (requester_id != requested_to_id)
);

RAISE NOTICE '✓ task_collaborations 테이블 생성 완료';

-- 6. 업무 댓글/로그 시스템 확장
CREATE TABLE IF NOT EXISTS facility_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 업무 연결
    facility_task_id UUID NOT NULL REFERENCES facility_tasks(id) ON DELETE CASCADE,
    collaboration_id UUID REFERENCES task_collaborations(id) ON DELETE CASCADE,

    -- 댓글 내용
    content TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'comment' CHECK (comment_type IN (
        'comment', 'status_change', 'assignment_change', 'collaboration_request',
        'collaboration_response', 'file_upload', 'system_note'
    )),

    -- 작성자
    author_id UUID NOT NULL REFERENCES employees(id),

    -- 첨부파일 및 메타데이터
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

RAISE NOTICE '✓ facility_task_comments 테이블 생성 완료';

-- 7. 부서별 업무 분담 설정 테이블
CREATE TABLE IF NOT EXISTS department_task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 부서 정보
    department_id UUID NOT NULL REFERENCES departments(id),

    -- 업무 유형별 담당자 설정
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('self', 'subsidy')),
    default_assignee_id UUID REFERENCES employees(id),

    -- 업무 단계별 담당부서 (JSON 형태)
    workflow_assignments JSONB DEFAULT '{}',

    -- 협조 요청 정책
    auto_collaboration_rules JSONB DEFAULT '{}',

    -- 상태 관리
    is_active BOOLEAN DEFAULT true,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),

    -- 제약조건
    UNIQUE(department_id, task_type)
);

RAISE NOTICE '✓ department_task_assignments 테이블 생성 완료';

-- 8. 인덱스 생성
-- facility_tasks 확장 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_tasks_created_by
    ON facility_tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_facility_tasks_collaboration_status
    ON facility_tasks(collaboration_status)
    WHERE collaboration_status != 'none';

CREATE INDEX IF NOT EXISTS idx_facility_tasks_tags
    ON facility_tasks USING GIN(tags);

-- task_collaborations 인덱스
CREATE INDEX IF NOT EXISTS idx_task_collaborations_facility_task
    ON task_collaborations(facility_task_id);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_project_task
    ON task_collaborations(project_task_id);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_requester
    ON task_collaborations(requester_id);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_requested_to
    ON task_collaborations(requested_to_id);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_status
    ON task_collaborations(status);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_type_priority
    ON task_collaborations(request_type, priority);

CREATE INDEX IF NOT EXISTS idx_task_collaborations_due_date
    ON task_collaborations(due_date)
    WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_collaborations_department
    ON task_collaborations(department_id);

-- facility_task_comments 인덱스
CREATE INDEX IF NOT EXISTS idx_facility_task_comments_task
    ON facility_task_comments(facility_task_id);

CREATE INDEX IF NOT EXISTS idx_facility_task_comments_collaboration
    ON facility_task_comments(collaboration_id);

CREATE INDEX IF NOT EXISTS idx_facility_task_comments_author
    ON facility_task_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_facility_task_comments_type
    ON facility_task_comments(comment_type);

-- department_task_assignments 인덱스
CREATE INDEX IF NOT EXISTS idx_department_task_assignments_dept
    ON department_task_assignments(department_id);

CREATE INDEX IF NOT EXISTS idx_department_task_assignments_assignee
    ON department_task_assignments(default_assignee_id);

RAISE NOTICE '✓ 인덱스 생성 완료';

-- 9. 트리거 생성
-- task_collaborations 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_task_collaborations_updated_at ON task_collaborations;
CREATE TRIGGER update_task_collaborations_updated_at
    BEFORE UPDATE ON task_collaborations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- facility_task_comments 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_facility_task_comments_updated_at ON facility_task_comments;
CREATE TRIGGER update_facility_task_comments_updated_at
    BEFORE UPDATE ON facility_task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- department_task_assignments 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_department_task_assignments_updated_at ON department_task_assignments;
CREATE TRIGGER update_department_task_assignments_updated_at
    BEFORE UPDATE ON department_task_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- facility_tasks 협조 상태 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_facility_task_collaboration_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 새로운 협조 요청 생성시
    IF TG_OP = 'INSERT' THEN
        UPDATE facility_tasks
        SET
            collaboration_status = 'requested',
            updated_at = NOW()
        WHERE id = NEW.facility_task_id;
        RETURN NEW;
    END IF;

    -- 협조 요청 상태 변경시
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        UPDATE facility_tasks
        SET
            collaboration_status = CASE
                WHEN NEW.status = 'accepted' THEN 'accepted'
                WHEN NEW.status = 'rejected' THEN 'rejected'
                WHEN NEW.status = 'completed' THEN 'none'
                WHEN NEW.status = 'cancelled' THEN 'none'
                ELSE 'requested'
            END,
            updated_at = NOW()
        WHERE id = NEW.facility_task_id;
        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facility_task_collaboration_status_trigger ON task_collaborations;
CREATE TRIGGER facility_task_collaboration_status_trigger
    AFTER INSERT OR UPDATE ON task_collaborations
    FOR EACH ROW EXECUTE FUNCTION update_facility_task_collaboration_status();

RAISE NOTICE '✓ 트리거 생성 완료';

-- 10. RLS 정책 설정
-- task_collaborations RLS
ALTER TABLE task_collaborations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view related collaborations" ON task_collaborations;
DROP POLICY IF EXISTS "Users can create collaboration requests" ON task_collaborations;
DROP POLICY IF EXISTS "Users can update own requests or received requests" ON task_collaborations;

-- 관련 협조 요청 조회 (요청자, 피요청자, 관리자)
CREATE POLICY "Users can view related collaborations" ON task_collaborations
    FOR SELECT USING (
        requester_id::text = auth.uid()::text OR
        requested_to_id::text = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level >= 2
        )
    );

-- 협조 요청 생성 (본인만 가능)
CREATE POLICY "Users can create collaboration requests" ON task_collaborations
    FOR INSERT WITH CHECK (requester_id::text = auth.uid()::text);

-- 협조 요청 업데이트 (요청자 또는 피요청자)
CREATE POLICY "Users can update own requests or received requests" ON task_collaborations
    FOR UPDATE USING (
        requester_id::text = auth.uid()::text OR
        requested_to_id::text = auth.uid()::text
    );

-- facility_task_comments RLS
ALTER TABLE facility_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view task comments" ON facility_task_comments;
DROP POLICY IF EXISTS "Users can create task comments" ON facility_task_comments;

-- 업무 관련자는 댓글 조회 가능
CREATE POLICY "Users can view task comments" ON facility_task_comments
    FOR SELECT USING (
        author_id::text = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM facility_tasks ft
            WHERE ft.id = facility_task_comments.facility_task_id
            AND (ft.assignee = (SELECT name FROM employees WHERE id::text = auth.uid()::text) OR
                 ft.created_by::text = auth.uid()::text)
        ) OR
        EXISTS (
            SELECT 1 FROM employees
            WHERE id::text = auth.uid()::text AND permission_level >= 2
        )
    );

-- 업무 관련자는 댓글 작성 가능
CREATE POLICY "Users can create task comments" ON facility_task_comments
    FOR INSERT WITH CHECK (author_id::text = auth.uid()::text);

-- department_task_assignments RLS
ALTER TABLE department_task_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Department managers can manage assignments" ON department_task_assignments;

-- 부서 관리자는 부서 업무 분담 관리 가능
CREATE POLICY "Department managers can manage assignments" ON department_task_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id::text = auth.uid()::text
            AND (e.department_id = department_task_assignments.department_id OR e.permission_level = 3)
            AND e.permission_level >= 2
        )
    );

RAISE NOTICE '✓ RLS 정책 설정 완료';

-- 11. 협업 관련 유틸리티 함수
-- 협조 요청 생성 함수 (개선된 버전)
CREATE OR REPLACE FUNCTION create_collaboration_request(
    p_facility_task_id UUID DEFAULT NULL,
    p_project_task_id UUID DEFAULT NULL,
    p_requester_id UUID,
    p_requested_to_id UUID,
    p_request_type VARCHAR(50),
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'medium',
    p_due_date DATE DEFAULT NULL,
    p_department_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    collaboration_id UUID;
    target_department_id UUID;
BEGIN
    -- 부서 ID가 없으면 피요청자의 부서로 설정
    IF p_department_id IS NULL THEN
        SELECT department_id INTO target_department_id
        FROM employees WHERE id = p_requested_to_id;
    ELSE
        target_department_id := p_department_id;
    END IF;

    -- 협조 요청 생성
    INSERT INTO task_collaborations (
        facility_task_id, project_task_id, requester_id, requested_to_id,
        department_id, request_type, title, description, priority, due_date
    ) VALUES (
        p_facility_task_id, p_project_task_id, p_requester_id, p_requested_to_id,
        target_department_id, p_request_type, p_title, p_description, p_priority, p_due_date
    )
    RETURNING id INTO collaboration_id;

    -- 시스템 댓글 자동 생성
    INSERT INTO facility_task_comments (
        facility_task_id, collaboration_id, content, comment_type, author_id
    ) VALUES (
        p_facility_task_id,
        collaboration_id,
        format('협조 요청이 생성되었습니다: %s', p_title),
        'collaboration_request',
        p_requester_id
    );

    RETURN collaboration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 협조 요청 응답 함수
CREATE OR REPLACE FUNCTION respond_collaboration_request(
    p_collaboration_id UUID,
    p_response_status VARCHAR(20),
    p_response_message TEXT DEFAULT NULL,
    p_responder_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    collaboration_record RECORD;
BEGIN
    -- 협조 요청 정보 조회
    SELECT * INTO collaboration_record
    FROM task_collaborations
    WHERE id = p_collaboration_id AND requested_to_id = p_responder_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '협조 요청을 찾을 수 없거나 응답 권한이 없습니다.';
    END IF;

    -- 상태 업데이트
    UPDATE task_collaborations
    SET
        status = p_response_status,
        response_message = p_response_message,
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_collaboration_id;

    -- 응답 댓글 자동 생성
    INSERT INTO facility_task_comments (
        facility_task_id, collaboration_id, content, comment_type, author_id
    ) VALUES (
        collaboration_record.facility_task_id,
        p_collaboration_id,
        format('협조 요청에 응답하였습니다: %s', p_response_status),
        'collaboration_response',
        p_responder_id
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 업무 태그 관리 함수
CREATE OR REPLACE FUNCTION add_facility_task_tag(
    p_task_id UUID,
    p_tag VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE facility_tasks
    SET
        tags = CASE
            WHEN tags ? p_tag THEN tags
            ELSE tags || jsonb_build_array(p_tag)
        END,
        updated_at = NOW()
    WHERE id = p_task_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✓ 유틸리티 함수 생성 완료';

-- 12. 협업 대시보드 뷰 생성
-- 협조 요청 대시보드 뷰 (개선된 버전)
CREATE OR REPLACE VIEW collaboration_dashboard AS
SELECT
    tc.*,
    requester.name as requester_name,
    requester.email as requester_email,
    requester.department as requester_department,
    requested_to.name as requested_to_name,
    requested_to.email as requested_to_email,
    requested_to.department as requested_to_department,
    d.name as department_name,

    -- 관련 업무 정보
    CASE
        WHEN tc.facility_task_id IS NOT NULL THEN ft.title
        WHEN tc.project_task_id IS NOT NULL THEN pt.title
    END as task_title,

    CASE
        WHEN tc.facility_task_id IS NOT NULL THEN ft.business_name
        WHEN tc.project_task_id IS NOT NULL THEN pr.business_name
    END as business_name,

    CASE
        WHEN tc.facility_task_id IS NOT NULL THEN ft.status
        WHEN tc.project_task_id IS NOT NULL THEN pt.status::text
    END as task_status,

    -- 일정 계산
    CASE
        WHEN tc.due_date IS NOT NULL THEN
            EXTRACT(EPOCH FROM (tc.due_date::timestamp - NOW())) / 86400
    END as days_until_due,

    -- 댓글 수
    (
        SELECT COUNT(*)
        FROM facility_task_comments ftc
        WHERE ftc.collaboration_id = tc.id
    ) as comment_count

FROM task_collaborations tc
LEFT JOIN employees requester ON tc.requester_id = requester.id
LEFT JOIN employees requested_to ON tc.requested_to_id = requested_to.id
LEFT JOIN departments d ON tc.department_id = d.id
LEFT JOIN facility_tasks ft ON tc.facility_task_id = ft.id
LEFT JOIN tasks pt ON tc.project_task_id = pt.id
LEFT JOIN projects pr ON pt.project_id = pr.id;

-- 확장된 facility_tasks 뷰
CREATE OR REPLACE VIEW facility_tasks_extended AS
SELECT
    ft.*,
    creator.name as created_by_name,
    creator.email as created_by_email,
    updater.name as updated_by_name,

    -- 협조 요청 통계
    (
        SELECT COUNT(*)
        FROM task_collaborations tc
        WHERE tc.facility_task_id = ft.id AND tc.status = 'pending'
    ) as pending_collaborations,

    (
        SELECT COUNT(*)
        FROM task_collaborations tc
        WHERE tc.facility_task_id = ft.id AND tc.status = 'completed'
    ) as completed_collaborations,

    -- 댓글 수
    (
        SELECT COUNT(*)
        FROM facility_task_comments ftc
        WHERE ftc.facility_task_id = ft.id
    ) as comment_count,

    -- 최근 활동
    (
        SELECT MAX(ftc.created_at)
        FROM facility_task_comments ftc
        WHERE ftc.facility_task_id = ft.id
    ) as last_activity_at

FROM facility_tasks ft
LEFT JOIN employees creator ON ft.created_by = creator.id
LEFT JOIN employees updater ON ft.updated_by = updater.id;

RAISE NOTICE '✓ 대시보드 뷰 생성 완료';

-- 13. 초기 부서별 업무 분담 설정 데이터
-- 기본 부서 업무 분담 설정 생성 (departments 테이블에 데이터가 있는 경우)
INSERT INTO department_task_assignments (
    department_id, task_type, workflow_assignments, auto_collaboration_rules, created_by
)
SELECT
    d.id,
    task_type.type,
    CASE task_type.type
        WHEN 'self' THEN '{
            "customer_contact": "영업팀",
            "site_inspection": "기술팀",
            "quotation": "영업팀",
            "installation": "기술팀",
            "document_complete": "관리팀"
        }'::jsonb
        WHEN 'subsidy' THEN '{
            "application_submit": "관리팀",
            "document_supplement": "관리팀",
            "pre_construction_inspection": "기술팀",
            "completion_inspection": "기술팀",
            "subsidy_payment": "관리팀"
        }'::jsonb
    END,
    '{
        "auto_request_threshold": 7,
        "default_priority": "medium",
        "required_approvals": ["manager"]
    }'::jsonb,
    (SELECT id FROM employees WHERE permission_level = 3 ORDER BY created_at LIMIT 1)
FROM departments d
CROSS JOIN (VALUES ('self'), ('subsidy')) AS task_type(type)
WHERE EXISTS (SELECT 1 FROM departments)
ON CONFLICT (department_id, task_type) DO NOTHING;

-- 14. 데이터 검증 및 마이그레이션 완료 로그
DO $$
DECLARE
    total_facility_tasks INTEGER;
    tasks_with_creator INTEGER;
    total_collaborations INTEGER;
    total_comments INTEGER;
    total_assignments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_facility_tasks FROM facility_tasks;
    SELECT COUNT(*) INTO tasks_with_creator FROM facility_tasks WHERE created_by IS NOT NULL;
    SELECT COUNT(*) INTO total_collaborations FROM task_collaborations;
    SELECT COUNT(*) INTO total_comments FROM facility_task_comments;
    SELECT COUNT(*) INTO total_assignments FROM department_task_assignments;

    RAISE NOTICE '=== Phase 2 협업 시스템 마이그레이션 완료 ===';
    RAISE NOTICE '전체 시설업무: %건', total_facility_tasks;
    RAISE NOTICE '생성자 정보 있는 업무: %건', tasks_with_creator;
    RAISE NOTICE '협조 요청: %건', total_collaborations;
    RAISE NOTICE '업무 댓글: %건', total_comments;
    RAISE NOTICE '부서별 업무 분담: %건', total_assignments;
    RAISE NOTICE '완료 시간: %', NOW();
END $$;

-- 15. 테이블 코멘트 추가
COMMENT ON TABLE task_collaborations IS 'Phase 2: 업무 협조 요청 관리 테이블 - facility_tasks와 tasks 모두 지원';
COMMENT ON TABLE facility_task_comments IS 'Phase 2: 시설 업무 댓글 및 로그 관리 테이블';
COMMENT ON TABLE department_task_assignments IS 'Phase 2: 부서별 업무 분담 설정 테이블';

COMMENT ON COLUMN facility_tasks.collaboration_status IS 'Phase 2: 협조 요청 상태 (none, requested, accepted, rejected)';
COMMENT ON COLUMN facility_tasks.tags IS 'Phase 2: 업무 분류 태그 (JSON 배열)';
COMMENT ON COLUMN facility_tasks.attachments IS 'Phase 2: 첨부파일 정보 (JSON 배열)';

COMMENT ON COLUMN task_collaborations.request_type IS 'Phase 2: 협조 요청 유형 (support, review, approval, information, resource, consultation)';
COMMENT ON COLUMN task_collaborations.rating IS 'Phase 2: 협조 만족도 평가 (1-5점)';

RAISE NOTICE '🎉 Phase 2 협업 시스템 마이그레이션이 성공적으로 완료되었습니다!';
RAISE NOTICE '다음 단계: Phase 3 주간 보고서 시스템 마이그레이션을 진행하세요.';