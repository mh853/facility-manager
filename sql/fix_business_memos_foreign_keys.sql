-- business_memos 테이블의 외래키 이름을 명시적으로 지정
-- 이 스크립트는 기존 외래키를 삭제하고 명시적인 이름으로 재생성합니다.

-- 1. 기존 외래키 확인 및 제거 (있는 경우)
DO $$
BEGIN
    -- created_by 외래키 제거
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'business_memos_created_by_fkey'
        AND table_name = 'business_memos'
    ) THEN
        ALTER TABLE public.business_memos DROP CONSTRAINT business_memos_created_by_fkey;
    END IF;

    -- updated_by 외래키 제거
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'business_memos_updated_by_fkey'
        AND table_name = 'business_memos'
    ) THEN
        ALTER TABLE public.business_memos DROP CONSTRAINT business_memos_updated_by_fkey;
    END IF;

    -- 다른 이름으로 존재할 수 있는 외래키 제거
    DECLARE
        constraint_rec RECORD;
    BEGIN
        FOR constraint_rec IN (
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'business_memos'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%created_by%'
        ) LOOP
            EXECUTE 'ALTER TABLE public.business_memos DROP CONSTRAINT ' || constraint_rec.constraint_name;
        END LOOP;

        FOR constraint_rec IN (
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'business_memos'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%updated_by%'
        ) LOOP
            EXECUTE 'ALTER TABLE public.business_memos DROP CONSTRAINT ' || constraint_rec.constraint_name;
        END LOOP;
    END;
END $$;

-- 2. 명시적인 이름으로 외래키 재생성
ALTER TABLE public.business_memos
ADD CONSTRAINT business_memos_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.business_memos
ADD CONSTRAINT business_memos_updated_by_fkey
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_business_memos_created_by ON public.business_memos(created_by);
CREATE INDEX IF NOT EXISTS idx_business_memos_updated_by ON public.business_memos(updated_by);

-- 4. 검증
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'business_memos'
    AND tc.table_schema = 'public'
ORDER BY kcu.column_name;
