# Sales Office Commission Rate RLS Fix

## Problem
The `sales_office_cost_settings` table query returns empty array (`Array(0)`) even though data exists in Supabase. This prevents commission rates from loading in the business detail modal.

## Root Cause
The `sales_office_cost_settings` table has RLS (Row Level Security) enabled, but **no SELECT policy was defined** in the original schema (`sql/revenue_management_schema_fixed.sql`).

### Evidence
- Line 239: `ALTER TABLE sales_office_cost_settings ENABLE ROW LEVEL SECURITY;`
- No corresponding `CREATE POLICY` statement for SELECT operations on this table
- Other tables have policies defined (lines 246-279)

## Solution
Apply the SQL migration in `sql/fix_sales_office_rls_policy.sql` to add the missing RLS policies.

### To Apply Fix in Supabase

**Option 1: Via Supabase Dashboard (Recommended)**
1. Open Supabase Dashboard: https://app.supabase.com
2. Navigate to your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `sql/fix_sales_office_rls_policy.sql`
5. Click **Run** to execute

**Option 2: Via psql Command Line**
```bash
psql -h your-db-host -U postgres -d postgres -f sql/fix_sales_office_rls_policy.sql
```

**Option 3: Via Supabase CLI**
```bash
supabase db push sql/fix_sales_office_rls_policy.sql
```

## What the Fix Does

### 1. SELECT Policy (Permission Level 2+)
Allows users with permission level 2 or higher to read commission rates:
```sql
CREATE POLICY "sales_office_cost_settings_select_policy"
    FOR SELECT USING (permission_level >= 2)
```

### 2. INSERT/UPDATE Policies (Permission Level 3+)
Allows users with permission level 3 or higher to modify commission settings:
```sql
CREATE POLICY "sales_office_cost_settings_insert_policy"
    FOR INSERT WITH CHECK (permission_level >= 3)

CREATE POLICY "sales_office_cost_settings_update_policy"
    FOR UPDATE USING (permission_level >= 3)
```

## Verification

After applying the fix, verify it works:

1. **Check Policies Created:**
   ```sql
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'sales_office_cost_settings';
   ```

2. **Test Query in Browser Console:**
   - Reload the business admin page
   - Check browser console for: `🔄 영업점 수수료 로드 시작...`
   - Should see: `✅ 영업점 수수료 로드 완료: 40개` (or actual count)
   - Should NOT see: `Array(0)`

3. **Test in Business Detail Modal:**
   - Open any business with sales office "원에너지"
   - Check "순이익 계산 과정"
   - Should show: `영업비용 (15% - 원에너지) = [calculated amount]원`
   - Should NOT show: `영업비용 (10% - 원에너지)` (10% was the default fallback)

## Related Files
- `sql/revenue_management_schema_fixed.sql` - Original schema (missing policies)
- `sql/fix_sales_office_rls_policy.sql` - Migration to add policies
- `app/admin/business/page.tsx:346-389` - useEffect loading commission rates
- `app/admin/business/page.tsx:559-642` - calculateBusinessRevenue function

## Impact
- **Before Fix**: All client-side queries to `sales_office_cost_settings` return empty array, commission rates default to 10%
- **After Fix**: Commission rates load properly, calculations show correct percentages (e.g., 15% for 원에너지)
