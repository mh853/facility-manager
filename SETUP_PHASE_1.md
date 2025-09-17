# Quick Setup Guide for Phase 1: Database Authentication

## Prerequisites Check

Before starting, ensure you have:
- [x] Supabase project created at https://supabase.com
- [x] Environment variables configured in `.env.local`
- [x] Supabase client library available

## Installation Commands

```bash
# Install new dependencies
npm install @supabase/supabase-js@^2.39.0 bcryptjs@^2.4.3 jsonwebtoken@^9.0.2
npm install -D @types/bcryptjs@^2.4.6 @types/jsonwebtoken@^9.0.5

# Verify installation
npm list @supabase/supabase-js bcryptjs jsonwebtoken
```

## Database Setup (Execute in Supabase SQL Editor)

### Step 1: Create Tables and Functions
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

-- Create indexes
CREATE INDEX idx_employees_email ON employees(email) WHERE is_active = true AND is_deleted = false;
CREATE INDEX idx_employees_permission_level ON employees(permission_level);
CREATE INDEX idx_employees_active ON employees(is_active, is_deleted);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Insert Initial Users
```sql
-- Insert admin user
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

### Step 3: Configure Row Level Security
```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view accessible employee data" ON employees
    FOR SELECT USING (
        id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );

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

CREATE POLICY "Employee update policy" ON employees
    FOR UPDATE USING (
        id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR
        (
            SELECT permission_level
            FROM employees
            WHERE id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
            AND is_active = true
            AND is_deleted = false
        ) >= 3
    );
```

## File Creation Checklist

Create these new files in your project:

### 1. Password Utilities (`/utils/password.ts`)
```typescript
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
```

### 2. Employee Service (`/lib/employee-service.ts`)
```typescript
import { supabase, supabaseAdmin } from './supabase'
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/types/work-management'

export class EmployeeService {
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
        if (error.code === 'PGRST116') return null
        throw new Error(`Employee lookup failed: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Employee lookup error:', error)
      return null
    }
  }

  // Add other methods as needed
}
```

### 3. Database Test Endpoint (`/app/api/test-db/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import { testSupabaseConnection } from '@/lib/supabase';
import { EmployeeService } from '@/lib/employee-service';

export async function GET() {
  try {
    const connectionTest = await testSupabaseConnection();

    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        error: 'Supabase connection failed'
      });
    }

    const testEmployee = await EmployeeService.findByEmail('admin@facility.blueon-iot.com');

    return NextResponse.json({
      success: true,
      connection: connectionTest,
      admin_user_exists: !!testEmployee,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

## Testing Steps

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test Database Connection
```bash
# Visit in browser or use curl
curl http://localhost:3000/api/test-db
```

Expected response:
```json
{
  "success": true,
  "connection": true,
  "admin_user_exists": true,
  "timestamp": "2025-01-XX..."
}
```

### 3. Test Authentication Flow
```bash
# Test login API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"provider":"kakao","code":"test"}'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "id": "uuid-here",
    "email": "admin@facility.blueon-iot.com",
    "name": "시스템 관리자",
    "role": 3,
    "department": "IT팀"
  }
}
```

### 4. Test Admin Dashboard
1. Navigate to `http://localhost:3000`
2. Click login (should use social login flow)
3. Should redirect to admin dashboard
4. Verify user information displays correctly
5. Check that mock data warnings are gone

## Troubleshooting

### Database Connection Issues
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Authentication Issues
1. Clear browser cookies
2. Check Supabase logs in dashboard
3. Verify user exists in employees table
4. Check RLS policies are not blocking access

### Build Issues
```bash
# Check TypeScript compilation
npm run type-check

# Check for missing dependencies
npm install
```

## Success Criteria

Phase 1 is complete when:
- [x] Database schema created and populated
- [x] Authentication uses real database users
- [x] Admin dashboard shows real user info
- [x] Employee management API works
- [x] All tests pass without errors
- [x] No mock authentication code remains active

## Next Steps After Phase 1

Once Phase 1 is successfully implemented and tested:

1. **Deploy to staging environment**
2. **Monitor performance and error logs**
3. **Begin Phase 2: Business & Facility Data Integration**
4. **Update documentation with production setup**

## Support

If you encounter issues:
1. Check Supabase project dashboard for errors
2. Review console logs for detailed error messages
3. Verify environment variables are correctly set
4. Ensure all database tables and policies are created

The goal is to have a fully functional authentication system backed by Supabase before moving to the next phase of the migration.