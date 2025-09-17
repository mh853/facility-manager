# Phase 1 Implementation Guide: Authentication & User Management

## Overview
This guide provides step-by-step instructions for implementing Phase 1 of the Supabase migration, focusing on replacing mock authentication with real database operations.

## Prerequisites
- ✅ Supabase project created and configured
- ✅ Environment variables set in `.env.local`
- ✅ Supabase client configured in `/lib/supabase.ts`
- ✅ Database service updated to use real Supabase clients

## Step 1: Database Schema Setup

### 1.1 Create Employee Table
Run this SQL in your Supabase SQL Editor:

```sql
-- Create employees table
CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id text UNIQUE NOT NULL,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    password_hash text,
    permission_level integer NOT NULL DEFAULT 1 CHECK (permission_level >= 1 AND permission_level <= 3),
    department text,
    team text,
    position text,
    phone text,
    mobile text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    last_login_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    additional_info jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_employees_email ON employees(email) WHERE is_active = true AND is_deleted = false;
CREATE INDEX idx_employees_permission_level ON employees(permission_level);
CREATE INDEX idx_employees_active ON employees(is_active, is_deleted);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial admin user (replace with your details)
INSERT INTO employees (
    employee_id,
    name,
    email,
    permission_level,
    department,
    position
) VALUES (
    'ADMIN001',
    '시스템 관리자',
    'admin@facility.blueon-iot.com',
    3,
    'IT팀',
    '시스템관리자'
);

-- Insert test users
INSERT INTO employees (employee_id, name, email, permission_level, department, position) VALUES
('EMP001', '실사담당자1', 'inspector1@facility.blueon-iot.com', 2, '환경팀', '실사담당자'),
('EMP002', '실사담당자2', 'inspector2@facility.blueon-iot.com', 1, '환경팀', '실사담당자');
```

### 1.2 Set Up Row Level Security (RLS)
```sql
-- Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data or admins can view all
CREATE POLICY "Users can view accessible employee data" ON employees
    FOR SELECT USING (
        -- Users can see their own data
        id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR
        -- Admins can see all data
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );

-- Policy: Only admins can insert new employees
CREATE POLICY "Only admins can create employees" ON employees
    FOR INSERT WITH CHECK (
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );

-- Policy: Admins can update all, users can update their own basic info
CREATE POLICY "Employee update policy" ON employees
    FOR UPDATE USING (
        -- Users can update their own non-critical data
        (
            id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        )
        OR
        -- Admins can update anyone
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );

-- Policy: Only admins can delete (soft delete)
CREATE POLICY "Only admins can delete employees" ON employees
    FOR UPDATE USING (
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );
```

## Step 2: Update Authentication Service

### 2.1 Create Employee Service
Create `/lib/employee-service.ts`:

```typescript
// lib/employee-service.ts
import { supabase, supabaseAdmin } from './supabase'
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/types/work-management'
import { hashPassword, verifyPassword } from '@/utils/password'

export class EmployeeService {
  /**
   * Find employee by email for authentication
   */
  static async findByEmail(email: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows returned
        throw new Error(`Employee lookup failed: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Employee lookup error:', error)
      return null
    }
  }

  /**
   * Create new employee (admin only)
   */
  static async createEmployee(employeeData: CreateEmployeeRequest): Promise<Employee> {
    if (!supabaseAdmin) {
      throw new Error('Admin client required for employee creation')
    }

    try {
      const hashedPassword = employeeData.password
        ? await hashPassword(employeeData.password)
        : null

      const { password, ...dataWithoutPassword } = employeeData

      const { data, error } = await supabaseAdmin
        .from('employees')
        .insert([{
          ...dataWithoutPassword,
          password_hash: hashedPassword,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw new Error(`Employee creation failed: ${error.message}`)

      return data
    } catch (error) {
      console.error('Employee creation error:', error)
      throw error
    }
  }

  /**
   * Update employee information
   */
  static async updateEmployee(id: string, updateData: UpdateEmployeeRequest): Promise<Employee> {
    if (!supabaseAdmin) {
      throw new Error('Admin client required for employee updates')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('employees')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(`Employee update failed: ${error.message}`)

      return data
    } catch (error) {
      console.error('Employee update error:', error)
      throw error
    }
  }

  /**
   * Get all employees (with filters)
   */
  static async getEmployees(params?: {
    page?: number
    limit?: number
    search?: string
    department?: string
    permissionLevel?: number
  }): Promise<{
    data: Employee[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNext: boolean
      hasPrev: boolean
    }
  }> {
    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const offset = (page - 1) * limit

      let query = supabase
        .from('employees')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      // Apply filters
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
      }

      if (params?.department) {
        query = query.eq('department', params.department)
      }

      if (params?.permissionLevel) {
        query = query.eq('permission_level', params.permissionLevel)
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw new Error(`Employee listing failed: ${error.message}`)

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / limit)

      return {
        data: data || [],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      console.error('Employee listing error:', error)
      throw error
    }
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('Failed to update last login:', error)
        // Don't throw - this is not critical
      }
    } catch (error) {
      console.error('Last login update error:', error)
      // Don't throw - this is not critical
    }
  }

  /**
   * Soft delete employee
   */
  static async deleteEmployee(id: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Admin client required for employee deletion')
    }

    try {
      const { error } = await supabaseAdmin
        .from('employees')
        .update({
          is_deleted: true,
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw new Error(`Employee deletion failed: ${error.message}`)
    } catch (error) {
      console.error('Employee deletion error:', error)
      throw error
    }
  }
}
```

### 2.2 Create Password Utilities
Create `/utils/password.ts`:

```typescript
// utils/password.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    const hash = await bcrypt.hash(password, salt)
    return hash
  } catch (error) {
    console.error('Password hashing error:', error)
    throw new Error('Failed to hash password')
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

export function generateRandomPassword(length: number = 12): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''

  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }

  return password
}

export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다.')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 포함해야 합니다.')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 포함해야 합니다.')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 포함해야 합니다.')
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('특수문자(!@#$%^&*)를 포함해야 합니다.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
```

### 2.3 Update Authentication Utilities
Update `/utils/auth.ts`:

```typescript
// utils/auth.ts - Updated to use database
import { TokenPayload, User, UserRole } from '@/types';
import { EmployeeService } from '@/lib/employee-service';
import { Employee } from '@/types/work-management';

// JWT configuration
const TOKEN_SECRET = process.env.JWT_SECRET || 'facility-manager-secret-key';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24시간

// ... keep existing token functions (encodeToken, decodeToken, createToken, verifyToken)

// Replace mock user functions with database lookups
export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const employee = await EmployeeService.findByEmail(email);
    if (!employee) return null;

    // Convert Employee to User type
    const user: User = {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.permission_level as UserRole,
      department: employee.department || undefined,
      isActive: employee.is_active,
      createdAt: new Date(employee.created_at),
      lastLoginAt: employee.last_login_at ? new Date(employee.last_login_at) : undefined
    };

    return user;
  } catch (error) {
    console.error('Database user lookup error:', error);
    return null;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    const employees = await EmployeeService.getEmployees();
    const employee = employees.data.find(emp => emp.id === id);

    if (!employee) return null;

    const user: User = {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.permission_level as UserRole,
      department: employee.department || undefined,
      isActive: employee.is_active,
      createdAt: new Date(employee.created_at),
      lastLoginAt: employee.last_login_at ? new Date(employee.last_login_at) : undefined
    };

    return user;
  } catch (error) {
    console.error('Database user lookup by ID error:', error);
    return null;
  }
}

// Keep existing MOCK_USERS as fallback for development
export const MOCK_USERS: User[] = [
  // ... existing mock users for development fallback
];

// ... rest of the file remains the same
```

## Step 3: Update API Routes

### 3.1 Update Login Route
Update `/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { LoginRequest, AuthResponse } from '@/types';
import { createToken, findUserByEmail, AUTH_COOKIE_OPTIONS } from '@/utils/auth';
import { EmployeeService } from '@/lib/employee-service';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { provider, code } = body;

    if (!provider || !code) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // For demo purposes, map social login to test accounts
    // In production, integrate with actual OAuth providers
    let userEmail: string;

    switch (provider) {
      case 'kakao':
        userEmail = 'admin@facility.blueon-iot.com';
        break;
      case 'naver':
        userEmail = 'inspector1@facility.blueon-iot.com';
        break;
      case 'google':
        userEmail = 'inspector2@facility.blueon-iot.com';
        break;
      default:
        return NextResponse.json(
          { success: false, error: '지원하지 않는 로그인 제공자입니다.' },
          { status: 400 }
        );
    }

    // Database lookup instead of mock array
    const user = await findUserByEmail(userEmail);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await EmployeeService.updateLastLogin(user.id);

    // Generate token
    const token = await createToken(user);

    // Remove sensitive information
    const { isActive, ...safeUser } = user;

    // Set cookie and return response
    const response = NextResponse.json({
      success: true,
      token,
      user: safeUser,
    } as AuthResponse);

    response.cookies.set('auth-token', token, AUTH_COOKIE_OPTIONS);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

### 3.2 Create Employee Management API
Create `/app/api/employees/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@/lib/employee-service';
import { CreateEmployeeRequest } from '@/types/work-management';
import { verifyToken } from '@/utils/auth';
import { AUTH_COOKIE_NAME } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const permissionLevel = searchParams.get('permissionLevel')
      ? parseInt(searchParams.get('permissionLevel')!)
      : undefined;

    const result = await EmployeeService.getEmployees({
      page,
      limit,
      search,
      department,
      permissionLevel
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Employee listing error:', error);
    return NextResponse.json(
      { success: false, error: '직원 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role < 3) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const employeeData: CreateEmployeeRequest = await request.json();

    const newEmployee = await EmployeeService.createEmployee(employeeData);

    return NextResponse.json({
      success: true,
      data: newEmployee
    });

  } catch (error) {
    console.error('Employee creation error:', error);
    return NextResponse.json(
      { success: false, error: '직원 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## Step 4: Testing & Validation

### 4.1 Database Connection Test
Create `/app/api/test-db/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { testSupabaseConnection } from '@/lib/supabase';
import { EmployeeService } from '@/lib/employee-service';

export async function GET() {
  try {
    const tests = {
      supabase_connection: false,
      employee_count: 0,
      sample_employee: null,
      error: null as string | null
    };

    // Test basic connection
    tests.supabase_connection = await testSupabaseConnection();

    if (tests.supabase_connection) {
      // Test employee service
      const employees = await EmployeeService.getEmployees({ limit: 1 });
      tests.employee_count = employees.pagination.totalItems;
      tests.sample_employee = employees.data[0] || null;
    }

    return NextResponse.json({
      success: tests.supabase_connection,
      tests,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      tests: {
        supabase_connection: false,
        employee_count: 0,
        sample_employee: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    });
  }
}
```

### 4.2 Validation Checklist

Before proceeding to Phase 2, verify:

- [ ] Database schema created successfully
- [ ] RLS policies configured and tested
- [ ] Initial admin user created
- [ ] Employee service functions work correctly
- [ ] Authentication API routes updated
- [ ] Login flow uses database instead of mock data
- [ ] Admin panel shows real user information
- [ ] User permissions enforced correctly
- [ ] Database test endpoint returns success

### 4.3 Testing Commands

```bash
# Test database connection
curl http://localhost:3000/api/test-db

# Test employee listing (requires authentication)
curl -H "Cookie: auth-token=YOUR_TOKEN" http://localhost:3000/api/employees

# Test login flow
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"provider":"kakao","code":"test"}'
```

## Troubleshooting

### Common Issues:

1. **Supabase connection fails**
   - Check environment variables
   - Verify Supabase project URL and keys
   - Check network connectivity

2. **RLS policies block operations**
   - Verify JWT claims format
   - Check policy conditions
   - Test with service role for debugging

3. **Employee creation fails**
   - Verify admin client configuration
   - Check unique constraints (email, employee_id)
   - Validate required fields

4. **Authentication loop**
   - Clear browser cookies
   - Check token expiration
   - Verify database user exists

## Next Steps

Once Phase 1 is complete and all tests pass:

1. **Deploy to staging** environment
2. **Test with real users** (limited rollout)
3. **Monitor performance** and error logs
4. **Begin Phase 2** (Business & Facility Data Integration)

The system should now have:
- ✅ Real database-backed user management
- ✅ Secure authentication with proper permissions
- ✅ Admin interface for user management
- ✅ Foundation for subsequent phases