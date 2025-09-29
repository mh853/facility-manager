-- Create test user with revenue access permissions
-- 매출 관리 시스템 테스트용 사용자 생성

-- Check if employees table exists, if not create it
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    position VARCHAR(100),
    permission_level INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert test user with permission level 3 (can access both revenue and pricing)
INSERT INTO employees (
    name,
    email,
    phone,
    department,
    position,
    permission_level,
    is_active
) VALUES (
    '매출관리자',
    'revenue@test.com',
    '010-1234-5678',
    '관리부',
    '매출관리자',
    3,
    true
) ON CONFLICT (email) DO UPDATE SET
    permission_level = 3,
    is_active = true,
    updated_at = NOW();

-- Insert test user with permission level 2 (can access revenue only)
INSERT INTO employees (
    name,
    email,
    phone,
    department,
    position,
    permission_level,
    is_active
) VALUES (
    '매출조회자',
    'revenue.viewer@test.com',
    '010-1234-5679',
    '영업부',
    '영업대리',
    2,
    true
) ON CONFLICT (email) DO UPDATE SET
    permission_level = 2,
    is_active = true,
    updated_at = NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_permission ON employees(permission_level);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active, is_deleted);

-- Display created users
SELECT
    name,
    email,
    permission_level,
    department,
    position,
    'Revenue Access: ' || CASE WHEN permission_level >= 2 THEN 'YES' ELSE 'NO' END as revenue_access,
    'Pricing Access: ' || CASE WHEN permission_level >= 3 THEN 'YES' ELSE 'NO' END as pricing_access
FROM employees
WHERE email IN ('revenue@test.com', 'revenue.viewer@test.com')
ORDER BY permission_level DESC;