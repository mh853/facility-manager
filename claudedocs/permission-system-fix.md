# Permission System Fix - 2026-01-27

## Issue Summary

The manual subsidy upload feature had incorrect permission checks that prevented all users from accessing it. The system was checking for a non-existent `permission_level` field instead of the actual `role` field.

## Root Causes

1. **AuthContext Field Mismatch**: `AuthContext.tsx` was checking `user.permission_level` but the database column is `role`
2. **Overly Restrictive Permissions**: Both URL management and manual upload required role >= 4, when only URL management should require this level
3. **UI Debug Output**: Showed `user.role` as undefined because of the field name mismatch

## Changes Made

### 1. AuthContext Fix ([contexts/AuthContext.tsx](../contexts/AuthContext.tsx))

**Changed field reference from `permission_level` to `role`**:

```typescript
// Before (WRONG):
if (requiredLevel && user.permission_level < requiredLevel) {
  // ...
  <p>현재 권한: 레벨 {user.permission_level}</p>
}

// After (CORRECT):
if (requiredLevel && user.role < requiredLevel) {
  // ...
  <p>현재 권한: 레벨 {user.role}</p>
}
```

### 2. Admin Page Permission Split ([app/admin/subsidy/page.tsx](../app/admin/subsidy/page.tsx))

**Separated permission checks for different features**:

```tsx
// Before (WRONG): Both features required role >= 4
{!authLoading && user && user.role >= 4 && (
  <>
    <UrlDataManager ... />
    {/* Manual upload button */}
  </>
)}

// After (CORRECT): Different permission levels
{/* URL 관리 - 권한 4(슈퍼 관리자)만 접근 가능 */}
{!authLoading && user && user.role >= 4 && (
  <UrlDataManager ... />
)}

{/* 수동 공고 등록 - 모든 인증된 사용자(권한 1~4) 접근 가능 */}
{!authLoading && user && user.role >= 1 && (
  <div>
    {/* Manual upload button */}
  </div>
)}
```

### 3. API Permission Update ([app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts))

**Lowered permission requirement from role 4 to role 1**:

```typescript
// Before (WRONG):
if (userData.role < 4) {
  return NextResponse.json(
    { success: false, error: 'Super admin access required (role 4+).' },
    { status: 403 }
  );
}

// After (CORRECT):
if (userData.role < 1) {
  return NextResponse.json(
    { success: false, error: 'Authenticated user access required (role 1+).' },
    { status: 403 }
  );
}
```

### 4. RLS Policy Update ([sql/migrations/add_manual_subsidy_fields.sql](../sql/migrations/add_manual_subsidy_fields.sql))

**Updated database policy to allow all authenticated users**:

```sql
-- Before (WRONG):
CREATE POLICY "Allow manual insert for admin users"
ON subsidy_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text
    AND role >= 4
  )
);

-- After (CORRECT):
CREATE POLICY "Allow manual insert for authenticated users"
ON subsidy_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text
    AND role >= 1
  )
);
```

## Permission Levels Clarified

| Feature | Required Role | Users Who Can Access |
|---------|--------------|---------------------|
| **URL 관리** (UrlDataManager) | role >= 4 | 슈퍼 관리자만 |
| **수동 공고 등록** | role >= 1 | 모든 인증된 사용자 |

## Role Definitions

From [sql/01_users_schema.sql](../sql/01_users_schema.sql:9) and [sql/add_super_admin_permission.sql](../sql/add_super_admin_permission.sql):

- `1` = Regular user (일반사용자)
- `2` = Manager (매니저)
- `3` = Admin (관리자)
- `4` = Super Admin (슈퍼관리자)

## Verification Steps

1. **Re-run SQL Migration** (if already executed with wrong permissions):
   ```bash
   # In Supabase SQL Editor
   DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;
   # Then run the corrected migration
   ```

2. **Test with Different Role Levels**:
   - Login as role 1 user → Should see manual upload button, NOT see URL manager
   - Login as role 4 user → Should see both manual upload button AND URL manager

3. **Verify Debug Output**:
   ```
   🔍 권한 디버그: 사용자 Role: [1-4] | URL 관리 접근: [✅ or ❌]
   ```
   Role should now display a number instead of being blank.

## Related Documentation

- [role-column-correction.md](./role-column-correction.md) - Previous fix for role vs permission_level confusion
- [permission-level-correction.md](./permission-level-correction.md) - Initial (incorrect) attempt using permission_level

## Key Lesson

**Field Consistency**: Always ensure frontend code (TypeScript interfaces, React contexts) uses the same field names as the actual database schema. The Supabase UI may show display names that differ from actual column names.
