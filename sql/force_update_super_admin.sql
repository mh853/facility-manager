-- Force update munong2@gmail.com to permission level 4
-- First ensure constraint allows level 4
ALTER TABLE public.employees 
DROP CONSTRAINT IF EXISTS employees_permission_level_check;

ALTER TABLE public.employees 
ADD CONSTRAINT employees_permission_level_check 
CHECK (permission_level IN (1, 2, 3, 4));

-- Force update to level 4
UPDATE public.employees
SET permission_level = 4
WHERE email = 'munong2@gmail.com';

-- Verify the update
SELECT 
  id, name, email, permission_level,
  CASE 
    WHEN permission_level = 4 THEN '슈퍼관리자'
    WHEN permission_level = 3 THEN '관리자'
    WHEN permission_level = 2 THEN '매니저'
    WHEN permission_level = 1 THEN '일반사용자'
    ELSE '알수없음'
  END as permission_name
FROM public.employees 
WHERE email = 'munong2@gmail.com';
