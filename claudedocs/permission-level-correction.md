# Permission Level Correction - 2026-01-27

## Critical Finding

**Actual Database Column**: `permission_level` (int4), NOT `role`

## Database Schema (Confirmed from Supabase UI)

```sql
-- users table structure
id              uuid
name            varchar
email           varchar
permission_level int4    -- THIS IS THE CORRECT COLUMN!
department_id   uuid
is_active       boolean
```

### Permission Levels
- `1` = Regular user
- `2` = Manager
- `3` = Admin
- `4` = Super Admin (required for manual subsidy upload)

## Files Corrected

### 1. TypeScript Types ([types/index.ts](../types/index.ts))

**Before (WRONG)**:
```typescript
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: number;  // WRONG - this doesn't exist in DB
  department_id: string;
  is_active: boolean;
}
```

**After (CORRECT)**:
```typescript
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string;
  permission_level: number;  // CORRECT - matches DB
  is_active: boolean;
}
```

### 2. SQL Migration ([sql/migrations/add_manual_subsidy_fields.sql](../sql/migrations/add_manual_subsidy_fields.sql))

**Corrected RLS Policy**:
```sql
-- RLS Policy: Allow admins (permission_level >= 4) to insert manual announcements
DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;
CREATE POLICY "Allow manual insert for admin users"
ON subsidy_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text
    AND permission_level >= 4  -- CORRECTED from 'role'
  )
);
```

### 3. API Endpoint ([app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts))

**Corrected Permission Check**:
```typescript
// Check permission_level (must be >= 4 for super admin)
console.log('[Manual Upload API] Checking user permission level...');

const { data: userData, error: userError } = await supabase
  .from('users')
  .select('permission_level, name, email')  // CORRECTED from 'role'
  .eq('id', user.id)
  .single();

console.log('[Manual Upload API] User permission_level:', userData.permission_level, 'Name:', userData.name);

if (userData.permission_level < 4) {  // CORRECTED from 'role'
  console.error('[Manual Upload API] Insufficient permissions. Level:', userData.permission_level, 'Required: 4+');
  return NextResponse.json(
    { success: false, error: 'Insufficient permissions. Super admin access required (permission_level 4+).' },
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
  permission_level: user?.permission_level,  // CORRECTED from 'role'
  authLoading,
  canSeeUrlManager: user && user.permission_level >= 4  // CORRECTED
});

// Manual upload button visibility
{!authLoading && user && user.permission_level >= 4 && (  // CORRECTED from 'role'
  <>
    <UrlDataManager ... />
    {/* Manual upload button */}
  </>
)}

// Debug display
<strong>🔍 권한 디버그:</strong>
{' '}사용자 레벨: {user.permission_level} |  {/* CORRECTED from 'role' */}
URL 관리 접근: {user.permission_level >= 4 ? '✅ 가능' : '❌ 불가능'}  {/* CORRECTED */}
```

## Root Cause Analysis

The confusion stemmed from:
1. Old SQL schema files referencing `role` field
2. Assuming the schema matched what was in old migration files
3. Not verifying actual database structure in Supabase UI first

## Verification Steps

To verify this fix is correct:

1. **Check Supabase Table Editor**:
   - Navigate to Table Editor → `users` table
   - Confirm `permission_level` column exists (int4)
   - Confirm values are 1, 2, 3, or 4

2. **Test Permission Check**:
   - Log in with user having `permission_level = 4`
   - Should see manual upload button
   - Should be able to create manual announcements

3. **Test RLS Policy**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM public.users WHERE id::text = auth.uid()::text AND permission_level >= 4;
   -- Should return row if current user is level 4
   ```

## Next Steps

1. **Apply Migration**: Execute corrected SQL migration in Supabase
2. **Test Manual Upload**: Verify session error is resolved
3. **Verify Permissions**: Test with level 4 user (최문호)
4. **Monitor Logs**: Check both browser console and server terminal

## Files Modified Summary

- ✅ [types/index.ts](../types/index.ts) - Fixed Employee interface
- ✅ [sql/migrations/add_manual_subsidy_fields.sql](../sql/migrations/add_manual_subsidy_fields.sql) - Fixed RLS policies
- ✅ [app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts) - Fixed permission check
- ✅ [app/admin/subsidy/page.tsx](../app/admin/subsidy/page.tsx) - Fixed UI permission checks

## Lesson Learned

**Always verify actual database schema in production/staging environment before making assumptions from code or old migration files.**
