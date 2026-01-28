-- 게스트 권한(0) 설정 확인 SQL

-- 1. 게스트 권한을 가진 사용자 확인
SELECT
  id,
  name,
  email,
  permission_level,
  is_active,
  updated_at
FROM employees
WHERE permission_level = 0
ORDER BY updated_at DESC;

-- 2. 특정 이메일로 권한 확인 (게스트 계정 이메일로 교체 필요)
SELECT
  id,
  name,
  email,
  permission_level,
  is_active,
  last_login_at,
  updated_at
FROM employees
WHERE email = 'guest@facility-manager.com';  -- 실제 게스트 계정 이메일로 교체

-- 3. 권한 레벨별 사용자 수 통계
SELECT
  permission_level,
  CASE
    WHEN permission_level = 0 THEN '게스트 (읽기 전용)'
    WHEN permission_level = 1 THEN '일반 (기본 업무)'
    WHEN permission_level = 2 THEN '매니저 (매출관리)'
    WHEN permission_level = 3 THEN '관리자 (사용자 관리)'
    WHEN permission_level = 4 THEN '시스템 (최고 권한)'
    ELSE '알 수 없음'
  END as permission_label,
  COUNT(*) as user_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM employees
WHERE is_deleted = false
GROUP BY permission_level
ORDER BY permission_level;

-- 4. 최근 권한 변경 이력 확인 (updated_at 기준)
SELECT
  id,
  name,
  email,
  permission_level,
  CASE
    WHEN permission_level = 0 THEN '게스트'
    WHEN permission_level = 1 THEN '일반'
    WHEN permission_level = 2 THEN '매니저'
    WHEN permission_level = 3 THEN '관리자'
    WHEN permission_level = 4 THEN '시스템'
    ELSE '알 수 없음'
  END as permission_label,
  is_active,
  updated_at
FROM employees
WHERE is_deleted = false
ORDER BY updated_at DESC
LIMIT 20;
