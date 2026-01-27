# Role Column Correction - 2026-01-27

## Critical Finding

**Actual Database Column**: `role` (INTEGER), NOT `permission_level`

## Confusion Source

Supabase UI showed "permission_level" as column header, but this was **display name only**. The actual database column is `role`.

## Database Schema (Confirmed from [sql/01_users_schema.sql](../sql/01_users_schema.sql:9))

```sql
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role INTEGER NOT NULL DEFAULT 1,  -- THIS IS THE ACTUAL COLUMN!
    -- ...
    CONSTRAINT valid_role CHECK (role IN (1, 2, 3))  -- Extended to (1,2,3,4) by add_super_admin_permission.sql
);
```

### Role Values
- `1` = Regular user (일반사용자)
- `2` = Manager (매니저)
- `3` = Admin (관리자)
- `4` = Super Admin (슈퍼관리자) - added by [sql/add_super_admin_permission.sql](../sql/add_super_admin_permission.sql)

## Files Corrected (Final Version)

### 1. TypeScript Types ([types/index.ts](../types/index.ts:473-480))

**Corrected**:
```typescript
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: number;  // CORRECT - matches DB column (INTEGER)
  department_id: string;
  is_active: boolean;
}
```

### 2. SQL Migration ([sql/migrations/add_manual_subsidy_fields.sql](../sql/migrations/add_manual_subsidy_fields.sql:22-35))

**Corrected RLS Policy**:
```sql
-- RLS Policy: Allow admins (role >= 4) to insert manual announcements
DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;
CREATE POLICY "Allow manual insert for admin users"
ON subsidy_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text
    AND role >= 4  -- CORRECT column name
  )
);
```

### 3. API Endpoint ([app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts:49-82))

**Corrected Permission Check**:
```typescript
// Check role (must be >= 4 for super admin)
console.log('[Manual Upload API] Checking user role...');

const { data: userData, error: userError } = await supabase
  .from('users')
  .select('role, name, email')  // CORRECT column name
  .eq('id', user.id)
  .single();

console.log('[Manual Upload API] User role:', userData.role, 'Name:', userData.name);

if (userData.role < 4) {  // CORRECT field check
  console.error('[Manual Upload API] Insufficient permissions. Role:', userData.role, 'Required: 4+');
  return NextResponse.json(
    { success: false, error: 'Insufficient permissions. Super admin access required (role 4+).' },
    { status: 403 }
  );
}
```

### 4. Admin Page ([app/admin/subsidy/page.tsx](../app/admin/subsidy/page.tsx))

**Corrected Permission Checks**:
```tsx
// Debug logging
console.log('🔍 [Subsidy] User Info:', {
  user,
  role: user?.role,  // CORRECT field
  authLoading,
  canSeeUrlManager: user && user.role >= 4  // CORRECT check
});

// Manual upload button visibility
{!authLoading && user && user.role >= 4 && (  // CORRECT check
  <>
    <UrlDataManager ... />
    {/* Manual upload button */}
  </>
)}

// Debug display
<strong>🔍 권한 디버그:</strong>
{' '}사용자 Role: {user.role} |  {/* CORRECT field */}
URL 관리 접근: {user.role >= 4 ? '✅ 가능' : '❌ 불가능'}  {/* CORRECT check */}
```

## SQL Error Resolution

**Original Error**:
```
ERROR: 42703: column "permission_level" does not exist
```

**Root Cause**:
- Referenced non-existent `permission_level` column in RLS policies
- Actual column name is `role`

**Solution**:
- Changed all references from `permission_level` to `role`
- Updated SQL migration, API code, TypeScript types, and UI checks

## Verification Steps

1. **Execute Corrected SQL Migration**:
   ```bash
   # In Supabase SQL Editor, run:
   /Users/mh.c/claude/facility-manager/sql/migrations/add_manual_subsidy_fields.sql
   ```

2. **Verify RLS Policies Created**:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename = 'subsidy_announcements';
   ```

3. **Test Permission Check**:
   ```sql
   -- Should return row if current user has role 4
   SELECT id, name, email, role
   FROM public.users
   WHERE id::text = auth.uid()::text AND role >= 4;
   ```

4. **Test Manual Upload**:
   - Log in as user with role 4 (최문호: munong2@gmail.com)
   - Navigate to `/admin/subsidy`
   - Should see manual upload button
   - Should be able to create manual announcements

## All Corrections Timeline

1. **First Attempt**: Used `role` based on `01_users_schema.sql`
2. **User Correction**: Showed screenshot with `permission_level` column
3. **Second Attempt**: Changed everything to `permission_level`
4. **SQL Error**: `permission_level` doesn't exist in database
5. **Final Verification**: Confirmed `role` is actual column name from schema files
6. **Final Correction**: All files now use `role` correctly

## Files Modified Summary

- ✅ [types/index.ts](../types/index.ts:473-480) - Employee interface uses `role: number`
- ✅ [sql/migrations/add_manual_subsidy_fields.sql](../sql/migrations/add_manual_subsidy_fields.sql) - RLS policies use `role >= 4`
- ✅ [app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts) - API checks `userData.role >= 4`
- ✅ [app/admin/subsidy/page.tsx](../app/admin/subsidy/page.tsx) - UI checks `user.role >= 4`

## Key Lesson

**Always verify actual database schema using schema definition files (`.sql`) rather than UI display names which may differ from actual column names.**

The confusion arose because:
1. Supabase UI displayed "permission_level" as column header (possibly aliased or localized)
2. Actual database column is named `role` (INTEGER)
3. Schema files are the source of truth, not UI screenshots
