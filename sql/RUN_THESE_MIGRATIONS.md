# SQL Migrations to Run

## Important: Run these SQL scripts in your Supabase dashboard in this order

### 1. Update Supplier Information
**File:** `sql/update_supplier_info.sql`

Updates the estimate template with correct supplier information.

### 2. Add Reference Notes Column
**File:** `sql/add_reference_notes_to_estimates.sql`

Adds `reference_notes` column to `estimate_history` table for custom notes per estimate.

### 3. Recreate Document History View
**File:** `sql/integrate_estimate_to_document_history.sql`

**IMPORTANT:** This fixes the issue where 문서명, 생성자, 작업 columns are not showing data.

Recreates the `document_history_detail` view to properly join:
- `business_info` for address
- `users` for creator name and email
- Includes `document_name` and `document_data` from document_history
- Generates document_name for estimates as "견적서_{estimate_number}"

---

## Verification Queries

After running the migrations, verify with these queries:

### Check supplier info updated:
```sql
SELECT supplier_company_name, supplier_registration_number, supplier_address
FROM estimate_templates
WHERE is_active = TRUE;
```

### Check reference_notes column exists:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'estimate_history'
  AND column_name = 'reference_notes';
```

### Check document_history_detail view:
```sql
SELECT business_name, document_name, created_by_name, document_type
FROM document_history_detail
ORDER BY created_at DESC
LIMIT 5;
```

---

## Expected Results

After running all migrations:

1. ✅ Supplier info shows: 주식회사 블루온, 679-86-02827, 경상북도 고령군 대가야읍 낫질로 285
2. ✅ Estimates can have custom reference notes
3. ✅ Document history shows:
   - 문서명 (Document Name)
   - 생성자 (Creator Name + Email)
   - 작업 (View/Download buttons)
   - Both purchase orders AND estimates with all fields populated
