-- 실제 사용되는 employees 테이블에 슈퍼 관리자 권한 적용
-- munong2@gmail.com을 권한 레벨 4(슈퍼 관리자)로 업그레이드

-- 1. 권한 제약 조건 확인 및 업데이트
-- employees 테이블의 permission_level 컬럼에 4까지 허용하도록 설정

-- 2. munong2@gmail.com을 슈퍼 관리자로 업그레이드
UPDATE public.employees
SET permission_level = 4
WHERE email = 'munong2@gmail.com';

-- 3. 업데이트 결과 확인
SELECT
  id,
  name,
  email,
  permission_level,
  CASE
    WHEN permission_level = 1 THEN '일반사용자'
    WHEN permission_level = 2 THEN '매니저'
    WHEN permission_level = 3 THEN '관리자'
    WHEN permission_level = 4 THEN '슈퍼관리자'
    ELSE '알수없음'
  END as permission_name,
  is_active,
  created_at
FROM public.employees
WHERE email = 'munong2@gmail.com' OR permission_level >= 3
ORDER BY permission_level DESC, created_at;

-- 4. 모든 직원의 권한 분포 확인
SELECT
  permission_level,
  COUNT(*) as count,
  CASE
    WHEN permission_level = 1 THEN '일반사용자'
    WHEN permission_level = 2 THEN '매니저'
    WHEN permission_level = 3 THEN '관리자'
    WHEN permission_level = 4 THEN '슈퍼관리자'
    ELSE '알수없음'
  END as permission_name
FROM public.employees
WHERE is_active = true AND is_deleted = false
GROUP BY permission_level
ORDER BY permission_level DESC;