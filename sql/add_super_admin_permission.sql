-- 슈퍼 관리자 권한 시스템 확장
-- Level 4: 슈퍼 관리자 추가

-- 1. 권한 제약 조건 확장 (1,2,3,4 허용)
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE public.users
ADD CONSTRAINT valid_role CHECK (role IN (1, 2, 3, 4));

-- 2. munong2@gmail.com 계정을 슈퍼 관리자(권한 4)로 업그레이드
UPDATE public.users
SET role = 4, updated_at = NOW()
WHERE email = 'munong2@gmail.com';

-- 3. 슈퍼 관리자 전용 RLS 정책 추가

-- 슈퍼 관리자는 모든 사용자 정보를 읽을 수 있음 (기존 관리자 정책에 추가)
CREATE POLICY "Super admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 4
        )
    );

-- 슈퍼 관리자는 모든 사용자 정보를 업데이트할 수 있음
CREATE POLICY "Super admins can update all users" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 4
        )
    );

-- 슈퍼 관리자는 사용자를 생성할 수 있음
CREATE POLICY "Super admins can insert users" ON public.users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 4
        )
    );

-- 슈퍼 관리자는 모든 활동 로그를 볼 수 있음
CREATE POLICY "Super admins can view all activity" ON public.user_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 4
        )
    );

-- 4. is_super_admin 함수 생성
CREATE OR REPLACE FUNCTION is_super_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role INTEGER;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = user_id_param AND is_active = true;

    RETURN COALESCE(user_role, 1) = 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 사용자 통계 뷰 업데이트 (슈퍼 관리자 포함)
DROP VIEW IF EXISTS user_stats;
CREATE OR REPLACE VIEW user_stats AS
SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE role = 4) as super_admin_users,
    COUNT(*) FILTER (WHERE role = 3) as admin_users,
    COUNT(*) FILTER (WHERE role = 2) as manager_users,
    COUNT(*) FILTER (WHERE role = 1) as regular_users,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d
FROM public.users;

-- 6. 자동 메모 삭제 로그 테이블 생성 (최소 리소스)
CREATE TABLE IF NOT EXISTS public.auto_memo_deletion_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memo_id UUID NOT NULL,
    memo_title TEXT NOT NULL,
    business_name TEXT NOT NULL,
    deleted_by UUID NOT NULL REFERENCES public.users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auto_memo_deletion_logs_deleted_by ON public.auto_memo_deletion_logs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_auto_memo_deletion_logs_deleted_at ON public.auto_memo_deletion_logs(deleted_at);

-- RLS 설정 (슈퍼 관리자만 접근 가능)
ALTER TABLE public.auto_memo_deletion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view deletion logs" ON public.auto_memo_deletion_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id::text = auth.uid()::text AND role = 4
        )
    );

CREATE POLICY "System can insert deletion logs" ON public.auto_memo_deletion_logs
    FOR INSERT WITH CHECK (true);

-- 7. 확인 쿼리
SELECT
    email,
    name,
    role,
    CASE
        WHEN role = 1 THEN '일반사용자'
        WHEN role = 2 THEN '매니저'
        WHEN role = 3 THEN '관리자'
        WHEN role = 4 THEN '슈퍼관리자'
        ELSE '알수없음'
    END as role_name,
    is_active,
    created_at
FROM public.users
WHERE email = 'munong2@gmail.com' OR role >= 3
ORDER BY role DESC, created_at;