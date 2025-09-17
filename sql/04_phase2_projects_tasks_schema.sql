-- Phase 2: 프로젝트 및 작업 관리 스키마
-- 작성일: 2025-09-17
-- 설명: 다중 프로젝트 워크플로우 및 작업 관리를 위한 데이터베이스 스키마

-- ============================================
-- 프로젝트 관리 테이블
-- ============================================

-- 프로젝트 유형 ENUM
CREATE TYPE project_type AS ENUM ('자체자금', '보조금');
CREATE TYPE project_status AS ENUM ('계획', '진행중', '완료', '보류', '취소');
CREATE TYPE task_status AS ENUM ('할당대기', '진행중', '완료', '보류', '취소');
CREATE TYPE task_priority AS ENUM ('낮음', '보통', '높음', '긴급');

-- 프로젝트 테이블
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 기본 정보
    name VARCHAR(200) NOT NULL,
    description TEXT,
    project_type project_type NOT NULL DEFAULT '자체자금',

    -- 사업장 정보 (기존 business_list와 연결)
    business_name VARCHAR(200) NOT NULL,
    business_registration_number VARCHAR(20),
    business_address TEXT,
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),

    -- 프로젝트 관리
    status project_status NOT NULL DEFAULT '계획',
    department_id UUID REFERENCES departments(id),
    manager_id UUID REFERENCES employees(id),

    -- 일정 관리
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,

    -- 예산 정보 (보조금 프로젝트용)
    total_budget DECIMAL(15,2),
    subsidy_amount DECIMAL(15,2),
    self_funding_amount DECIMAL(15,2),

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),

    -- 인덱스를 위한 제약조건
    CONSTRAINT valid_budget CHECK (
        (project_type = '자체자금' AND subsidy_amount IS NULL) OR
        (project_type = '보조금' AND subsidy_amount IS NOT NULL)
    )
);

-- 작업 테이블
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 기본 정보
    title VARCHAR(200) NOT NULL,
    description TEXT,

    -- 프로젝트 연관
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- 작업 관리
    status task_status NOT NULL DEFAULT '할당대기',
    priority task_priority NOT NULL DEFAULT '보통',

    -- 담당자 정보
    assigned_to UUID REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),

    -- 일정 관리
    start_date DATE,
    due_date DATE,
    completed_date DATE,
    estimated_hours INTEGER,
    actual_hours INTEGER,

    -- 종속성 관리
    parent_task_id UUID REFERENCES tasks(id),
    order_in_project INTEGER DEFAULT 0,

    -- 첨부파일 및 노트
    attachments JSONB DEFAULT '[]',
    notes TEXT,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- 작업 댓글/로그 테이블
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- 댓글 내용
    content TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'comment', -- 'comment', 'status_change', 'assignment_change'

    -- 작성자
    author_id UUID NOT NULL REFERENCES employees(id),

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW()
);

-- 프로젝트 템플릿 테이블 (향후 확장용)
CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    project_type project_type NOT NULL,

    -- 템플릿 작업 목록 (JSON 형태)
    template_tasks JSONB DEFAULT '[]',

    -- 설정
    is_active BOOLEAN DEFAULT TRUE,
    department_id UUID REFERENCES departments(id),

    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- ============================================
-- 인덱스 생성
-- ============================================

-- 프로젝트 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_business ON projects(business_name);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, expected_end_date);

-- 작업 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- 댓글 인덱스
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_comments(author_id);

-- ============================================
-- 트리거 함수 생성
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 프로젝트 업데이트 트리거
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 작업 업데이트 트리거
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 기본 데이터 삽입
-- ============================================

-- 프로젝트 템플릿 생성 (기본 시설 점검 워크플로우)
INSERT INTO project_templates (name, description, project_type, template_tasks) VALUES
(
    '표준 시설 점검 프로젝트',
    '일반적인 사업장 시설 점검을 위한 표준 템플릿',
    '자체자금',
    '[
        {
            "title": "현장 방문 및 사전 조사",
            "description": "사업장 현황 파악 및 점검 계획 수립",
            "priority": "높음",
            "estimated_hours": 4,
            "order": 1
        },
        {
            "title": "시설 현황 조사",
            "description": "기본시설, 배출시설, 방지시설 조사",
            "priority": "높음",
            "estimated_hours": 8,
            "order": 2
        },
        {
            "title": "사진 촬영 및 자료 수집",
            "description": "각 시설별 사진 촬영 및 관련 서류 수집",
            "priority": "보통",
            "estimated_hours": 4,
            "order": 3
        },
        {
            "title": "점검 보고서 작성",
            "description": "현장 조사 결과를 바탕으로 상세 보고서 작성",
            "priority": "높음",
            "estimated_hours": 6,
            "order": 4
        },
        {
            "title": "고객 설명 및 완료 확인",
            "description": "점검 결과 고객 설명 및 프로젝트 완료 처리",
            "priority": "보통",
            "estimated_hours": 2,
            "order": 5
        }
    ]'::jsonb
),
(
    '보조금 지원 시설 개선 프로젝트',
    '정부 보조금을 활용한 시설 개선 프로젝트 템플릿',
    '보조금',
    '[
        {
            "title": "보조금 신청 서류 준비",
            "description": "보조금 신청에 필요한 서류 작성 및 준비",
            "priority": "긴급",
            "estimated_hours": 8,
            "order": 1
        },
        {
            "title": "현장 실태 조사",
            "description": "보조금 지원 대상 시설 실태 조사",
            "priority": "높음",
            "estimated_hours": 6,
            "order": 2
        },
        {
            "title": "개선 계획 수립",
            "description": "시설 개선 계획 및 예산 수립",
            "priority": "높음",
            "estimated_hours": 10,
            "order": 3
        },
        {
            "title": "보조금 신청 제출",
            "description": "관련 기관에 보조금 신청서 제출",
            "priority": "긴급",
            "estimated_hours": 4,
            "order": 4
        },
        {
            "title": "승인 결과 확인 및 후속 조치",
            "description": "보조금 승인 결과 확인 및 프로젝트 진행",
            "priority": "높음",
            "estimated_hours": 6,
            "order": 5
        }
    ]'::jsonb
);

-- ============================================
-- 권한 설정
-- ============================================

-- 테이블 권한 설정 (기존 employees 사용자에게 권한 부여)
-- 실제 환경에서는 적절한 ROLE 기반 권한 설정 필요

-- ============================================
-- 뷰 생성 (편의용)
-- ============================================

-- 프로젝트 대시보드 뷰
CREATE OR REPLACE VIEW project_dashboard AS
SELECT
    p.*,
    d.name as department_name,
    m.name as manager_name,
    m.email as manager_email,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = '완료' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = '진행중' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = '보류' THEN 1 END) as on_hold_tasks,
    ROUND(
        (COUNT(CASE WHEN t.status = '완료' THEN 1 END)::DECIMAL /
         NULLIF(COUNT(t.id), 0)) * 100, 2
    ) as completion_percentage
FROM projects p
LEFT JOIN departments d ON p.department_id = d.id
LEFT JOIN employees m ON p.manager_id = m.id
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, d.name, m.name, m.email;

-- 작업 대시보드 뷰
CREATE OR REPLACE VIEW task_dashboard AS
SELECT
    t.*,
    p.name as project_name,
    p.business_name,
    p.project_type,
    assigned.name as assigned_to_name,
    assigned.email as assigned_to_email,
    d.name as department_name,
    creator.name as created_by_name
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN employees assigned ON t.assigned_to = assigned.id
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN employees creator ON t.created_by = creator.id;