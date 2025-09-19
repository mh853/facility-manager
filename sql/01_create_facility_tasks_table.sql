-- ===============================================
-- 1단계: facility_tasks 기본 테이블 생성
-- ===============================================

-- facility_tasks 기본 테이블 생성 (기존 employees 테이블과 연동)
CREATE TABLE IF NOT EXISTS facility_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 업무 기본 정보
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- 사업장 연결
    business_name VARCHAR(255) NOT NULL,
    business_id UUID REFERENCES business_info(id) ON DELETE SET NULL,

    -- 업무 분류
    task_type VARCHAR(20) NOT NULL DEFAULT 'etc'
        CHECK (task_type IN ('self', 'subsidy', 'etc', 'as')),

    -- 업무 상태 (각 타입별로 다른 상태값 사용)
    status VARCHAR(50) NOT NULL DEFAULT 'customer_contact',

    -- 우선순위
    priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),

    -- 담당자 (현재는 단일 담당자, 2단계에서 다중 담당자로 확장)
    assignee VARCHAR(100),

    -- 일정 관리
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 추가 정보
    notes TEXT,

    -- 상태 관리
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_name ON facility_tasks(business_name);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_business_id ON facility_tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_task_type ON facility_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_status ON facility_tasks(status);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_assignee ON facility_tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_due_date ON facility_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_created_at ON facility_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_facility_tasks_active ON facility_tasks(is_active, is_deleted);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_facility_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_facility_tasks_updated_at
    BEFORE UPDATE ON facility_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_facility_tasks_updated_at();

-- 업무 상태별 상수 정의 (주석으로 참고용)
/*
자비 설치 (self):
- customer_contact: 고객연락
- site_survey: 현장조사
- quotation: 견적서작성
- contract: 계약
- installation: 설치작업
- test_run: 시운전
- completion: 완료

보조금 (subsidy):
- document_preparation: 서류작성
- application_submission: 신청서제출
- document_review: 서류검토
- site_inspection: 현지조사
- approval_notification: 승인통보
- installation: 설치작업
- completion_report: 완료보고
- subsidy_payment: 보조금지급

기타 (etc):
- etc_status: 기타상태

AS (as):
- failure_report: 고장신고
- diagnosis: 진단
- repair: 수리
- completion: 완료
*/

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO facility_tasks (
    title,
    description,
    business_name,
    task_type,
    status,
    priority,
    assignee,
    due_date
) VALUES
(
    '대기오염방지시설 설치 업무',
    '○○사업장 대기오염방지시설 자비 설치 프로젝트',
    '테스트 사업장',
    'self',
    'customer_contact',
    'high',
    '김담당',
    CURRENT_DATE + INTERVAL '30 days'
),
(
    '보조금 신청 업무',
    '정부 보조금을 통한 환경설비 설치',
    '테스트 사업장 2',
    'subsidy',
    'document_preparation',
    'medium',
    '박담당',
    CURRENT_DATE + INTERVAL '45 days'
);

-- 권한 설정
ALTER TABLE facility_tasks ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 인증된 사용자만 접근 가능
CREATE POLICY "facility_tasks_authenticated_access" ON facility_tasks
    FOR ALL USING (auth.role() = 'authenticated');

-- 서비스 역할 정책: 모든 접근 허용 (API에서 사용)
CREATE POLICY "facility_tasks_service_role_access" ON facility_tasks
    FOR ALL USING (auth.role() = 'service_role');

-- 테이블 설명 추가
COMMENT ON TABLE facility_tasks IS '시설 업무 관리 테이블 - 자비설치, 보조금, AS, 기타 업무 관리';
COMMENT ON COLUMN facility_tasks.task_type IS '업무 타입: self(자비), subsidy(보조금), etc(기타), as(AS)';
COMMENT ON COLUMN facility_tasks.status IS '업무 상태 - 각 task_type별로 다른 상태값 사용';
COMMENT ON COLUMN facility_tasks.assignee IS '담당자 이름 (2단계에서 다중 담당자로 확장 예정)';

-- 생성 완료 메시지
SELECT 'facility_tasks 테이블이 성공적으로 생성되었습니다!' as message;