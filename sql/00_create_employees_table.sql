-- 직원 테이블 생성 (employees)
-- Facility Management System - Core Employees Schema
-- 이 테이블은 모든 직원 정보를 관리하며, 다른 많은 테이블에서 참조됩니다.

-- employees 테이블 생성
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    position VARCHAR(100),
    permission_level INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 권한 레벨:
    -- 1: 일반 사용자 (기본)
    -- 2: 매출 조회 가능
    -- 3: 매출 및 단가 조회/수정 가능
    CONSTRAINT valid_permission_level CHECK (permission_level BETWEEN 1 AND 3)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_permission ON public.employees(permission_level);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 직원 목록 조회 가능
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
CREATE POLICY "employees_select_policy" ON public.employees
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 직원은 자신의 정보 업데이트 가능
DROP POLICY IF EXISTS "employees_update_own" ON public.employees;
CREATE POLICY "employees_update_own" ON public.employees
    FOR UPDATE
    USING (auth.uid()::text = id::text);

-- 관리자 (permission_level >= 3)는 모든 직원 정보 업데이트 가능
DROP POLICY IF EXISTS "employees_update_admin" ON public.employees;
CREATE POLICY "employees_update_admin" ON public.employees
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id::text = auth.uid()::text
            AND permission_level >= 3
            AND is_active = TRUE
        )
    );

-- 관리자만 신규 직원 생성 가능
DROP POLICY IF EXISTS "employees_insert_admin" ON public.employees;
CREATE POLICY "employees_insert_admin" ON public.employees
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id::text = auth.uid()::text
            AND permission_level >= 3
            AND is_active = TRUE
        )
    );

-- 직원 삭제는 soft delete (is_deleted = TRUE)로만 처리
DROP POLICY IF EXISTS "employees_delete_admin" ON public.employees;
CREATE POLICY "employees_delete_admin" ON public.employees
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id::text = auth.uid()::text
            AND permission_level >= 3
            AND is_active = TRUE
        )
    );

-- 테이블 및 컬럼 코멘트
COMMENT ON TABLE public.employees IS '직원 정보 관리 테이블 - 시스템의 모든 사용자 정보';
COMMENT ON COLUMN public.employees.id IS '직원 고유 ID (UUID)';
COMMENT ON COLUMN public.employees.name IS '직원 이름';
COMMENT ON COLUMN public.employees.email IS '이메일 주소 (고유)';
COMMENT ON COLUMN public.employees.phone IS '전화번호';
COMMENT ON COLUMN public.employees.department IS '부서명';
COMMENT ON COLUMN public.employees.position IS '직급/직책';
COMMENT ON COLUMN public.employees.permission_level IS '권한 레벨 (1: 일반, 2: 매출조회, 3: 관리자)';
COMMENT ON COLUMN public.employees.is_active IS '활성화 여부';
COMMENT ON COLUMN public.employees.is_deleted IS '삭제 여부 (soft delete)';
