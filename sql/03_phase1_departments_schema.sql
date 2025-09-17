-- Phase 1: 부서 관리 및 사용자 확장 스키마
-- 기존 employees 테이블과 호환되도록 설계

-- 1. 부서 테이블 생성
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. 기존 employees 테이블에 부서 및 소셜 로그인 컬럼 추가
-- 안전한 방식으로 기존 데이터 유지하며 확장
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'staff';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_provider VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_id VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_email VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_social ON employees(social_provider, social_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

-- 4. 기본 부서 데이터 삽입 (존재하지 않는 경우만)
INSERT INTO departments (name, description)
SELECT '영업부', '고객 상담 및 영업 업무'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = '영업부');

INSERT INTO departments (name, description)
SELECT '설치부', '현장 설치 및 기술 지원'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = '설치부');

INSERT INTO departments (name, description)
SELECT '관리부', '사무 및 전체 관리 업무'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = '관리부');

-- 5. 트리거 함수 (업데이트 시간 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- departments 테이블에 트리거 적용
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 기존 사용자들을 기본 부서에 할당 (department_id가 NULL인 경우)
UPDATE employees
SET department_id = (SELECT id FROM departments WHERE name = '관리부' LIMIT 1)
WHERE department_id IS NULL;

-- 7. 기존 permission_level을 role로 매핑
UPDATE employees
SET role = CASE
  WHEN permission_level = 1 THEN 'staff'
  WHEN permission_level = 2 THEN 'team_leader'
  WHEN permission_level = 3 THEN 'manager'
  ELSE 'staff'
END
WHERE role IS NULL OR role = 'staff';

-- 8. 부서별 권한 확인을 위한 뷰 생성 (옵셔널)
CREATE OR REPLACE VIEW v_employees_with_departments AS
SELECT
  e.*,
  d.name as department_name,
  d.description as department_description,
  d.parent_id as department_parent_id
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.is_active = TRUE AND e.is_deleted = FALSE;

-- 9. 부서 계층 구조 조회를 위한 재귀 함수
CREATE OR REPLACE FUNCTION get_department_hierarchy(dept_id UUID)
RETURNS TABLE(
  id UUID,
  name VARCHAR(100),
  level INTEGER,
  path TEXT
) AS $$
WITH RECURSIVE dept_tree AS (
  -- 시작점: 지정된 부서
  SELECT
    d.id,
    d.name,
    0 as level,
    d.name::TEXT as path
  FROM departments d
  WHERE d.id = dept_id

  UNION ALL

  -- 재귀: 하위 부서들
  SELECT
    d.id,
    d.name,
    dt.level + 1,
    dt.path || ' > ' || d.name
  FROM departments d
  INNER JOIN dept_tree dt ON d.parent_id = dt.id
  WHERE d.is_active = TRUE
)
SELECT * FROM dept_tree ORDER BY level, name;
$$ LANGUAGE sql;

-- 10. 안전성 검증 쿼리 (롤백용)
-- 이 쿼리들로 마이그레이션 결과를 확인할 수 있음
-- SELECT COUNT(*) as total_departments FROM departments;
-- SELECT COUNT(*) as employees_with_departments FROM employees WHERE department_id IS NOT NULL;
-- SELECT department_name, COUNT(*) as employee_count FROM v_employees_with_departments GROUP BY department_name;

COMMENT ON TABLE departments IS 'Phase 1: 부서 관리 테이블 - 계층적 조직 구조 지원';
COMMENT ON COLUMN employees.department_id IS 'Phase 1: 부서 참조 - departments 테이블과 연결';
COMMENT ON COLUMN employees.social_provider IS 'Phase 1: 소셜 로그인 제공자 (google, kakao, naver)';
COMMENT ON COLUMN employees.social_id IS 'Phase 1: 소셜 로그인 고유 ID';