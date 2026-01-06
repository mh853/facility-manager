# Phase 2 Migration Summary: User & Business Context

**File Created**: `sql/migration/01_USER_BUSINESS_CONTEXT.sql`
**Date**: 2026-01-05
**Status**: ✅ Ready for Execution

## Overview

Phase 2 creates the core user management and business information tables that depend on Phase 1 (Core Foundation). This migration includes 17 tables organized into 6 logical sections.

## Prerequisites

**Required**: Phase 1 (`00_CORE_FOUNDATION.sql`) must be completed first.
**Validates**: Checks for `departments` table from Phase 1.

## Tables Created (17 Total)

### Section 1: Core User Tables (5 tables)

1. **employees** - Core user management with social login support
   - Permission levels: 1 (일반), 2 (매출조회), 3 (관리자)
   - Supports both manual and social signup methods
   - 6 indexes for optimized queries

2. **users** - Extended user management for business context
   - Role-based access: 1 (일반사용자), 2 (매니저), 3 (관리자)
   - Self-referential foreign keys for creator tracking
   - 4 indexes

3. **user_activity_logs** - User activity tracking
   - Captures all user actions with JSONB details
   - IP and user agent tracking
   - 3 indexes

4. **user_sessions** - Session management
   - Supports both users and employees
   - Token-based authentication
   - 7 indexes for session queries

5. **security_events** - Security event logging
   - Event types: login, logout, suspicious_activity, token_refresh
   - Severity levels: info, warning, critical
   - Resolution tracking
   - 4 indexes

### Section 2: Social Authentication (2 tables)

6. **social_accounts** - Multiple social account support
   - Providers: kakao, naver, google
   - Token management (access + refresh)
   - 2 indexes

7. **social_auth_approvals** - Social login approval workflow
   - Approval statuses: pending, approved, rejected, expired
   - 7-day expiration with auto-cleanup
   - 4 indexes

### Section 3: Team & Organization (3 tables)

8. **teams** - Team/department group management
   - Hierarchical structure (parent_team_id)
   - Multiple leader references
   - 5 indexes

9. **employee_team_memberships** - Employee-team relationships
   - Primary team designation
   - Role in team tracking
   - 3 indexes

10. **organization_changes_detailed** - Organization change history
    - Change types: hire, team_join, team_leave, promotion, role_change, transfer, assignment_change
    - Before/after data in JSONB
    - Task change tracking
    - 3 indexes

### Section 4: Business Core Tables (3 tables)

11. **businesses** - Basic business entity information
    - Business number (사업자등록번호)
    - CEO and contact details
    - 3 indexes

12. **business_info** - Detailed business information
    - 47 columns including equipment counts
    - Manufacturer types: ecosense, cleanearth, gaia_cns, evs
    - Installation phases: presurvey, installation, completed
    - JSONB for extensible data
    - 5 indexes

13. **business_contacts** - Business contact information
    - References businesses table
    - Unique business_name constraint
    - 2 indexes

### Section 5: Business Details (3 tables)

14. **air_permit_info** - Air emission permit information
    - Permit number and expiry tracking
    - Pollutants as JSONB array
    - References business_info
    - 3 indexes

15. **business_memos** - Business-related memos
    - Priority levels 1-5
    - Important/resolved flags
    - References business_info and users
    - 3 indexes

16. **business_progress_notes** - Business progress tracking
    - Auto and manual note types
    - Task-related notes
    - JSONB metadata
    - 4 indexes

### Section 6: Notification System (1 table)

17. **user_notifications** - User notification system
    - Types: task_assigned, task_completed, task_updated, system_notice
    - 30-day expiration
    - Read/unread tracking
    - 3 indexes

## Key Features

### Dependency Management
- **Correct Order**: employees → users → teams → businesses → business_info
- **Foreign Keys**: All references properly validated
- **Cascading Deletes**: Configured where appropriate

### Trigger Functions
- **updated_at auto-update**: 7 tables with automatic timestamp updates
- **Reusable function**: Single `update_updated_at_column()` function

### Row Level Security (RLS)
- **All tables protected**: 17 tables with RLS enabled
- **Policy types**:
  - Self-access policies (users can view/edit own data)
  - Admin-only policies (permission_level >= 3)
  - Manager policies (role >= 2)
  - System insert policies (for automated processes)

### Indexing Strategy
- **Total indexes**: 61 across all tables
- **Query optimization**: email, foreign keys, timestamps, status fields
- **Composite indexes**: Multi-column for complex queries

## Validation

The migration includes comprehensive validation:

```sql
-- Checks for 17 expected tables
-- Reports column counts and foreign key counts
-- Fails with clear error if any table is missing
```

**Expected Output**:
```
✅ Phase 2 Migration Completed Successfully!
Tables Created: 17

Next Step: Run Phase 3 (Business Operations)
  File: 02_BUSINESS_OPERATIONS.sql
```

## Execution Instructions

### Option 1: Direct Execution
```bash
# Using psql
psql -h your-supabase-host -U postgres -d postgres < sql/migration/01_USER_BUSINESS_CONTEXT.sql

# Or via Supabase SQL Editor
# Copy and paste the entire file contents
```

### Option 2: Sequential Execution (Recommended)
```bash
# After Phase 1 completion
./migrate.sh phase-2
# Or
psql < sql/migration/01_USER_BUSINESS_CONTEXT.sql
```

## Rollback Strategy

If issues occur, drop tables in reverse order:

```sql
-- Reverse dependency order
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS business_progress_notes CASCADE;
DROP TABLE IF EXISTS business_memos CASCADE;
DROP TABLE IF EXISTS air_permit_info CASCADE;
DROP TABLE IF EXISTS business_contacts CASCADE;
DROP TABLE IF EXISTS business_info CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS organization_changes_detailed CASCADE;
DROP TABLE IF EXISTS employee_team_memberships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS social_auth_approvals CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_activity_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
```

## Known Issues & Notes

### 1. Self-Referential Foreign Keys
- **users.created_by** and **users.updated_by** reference users(id)
- First user must be created with NULL creator

### 2. Social Auth Integration
- social_accounts references employees (not users)
- Ensure employees table has social login columns

### 3. Business Info vs Businesses
- **businesses**: Simple entity table
- **business_info**: Detailed operational data
- business_contacts references businesses (not business_info)

### 4. Task References
- business_progress_notes.task_id is VARCHAR (not UUID)
- Designed for facility_tasks integration in Phase 3

## Testing Checklist

After migration:

- [ ] All 17 tables created successfully
- [ ] Foreign key constraints functional
- [ ] RLS policies active
- [ ] Triggers working (test update on any table)
- [ ] Indexes created (check pg_indexes)
- [ ] Can insert test employee
- [ ] Can insert test user
- [ ] Can create team with employees
- [ ] Can create business with business_info

## Next Steps

1. **Validate Phase 2**: Run validation queries
2. **Test Data**: Insert sample data for testing
3. **Phase 3 Preparation**: Review `02_BUSINESS_OPERATIONS.sql`
4. **Dependencies**: Ensure Phase 3 tables reference Phase 2 correctly

## Related Files

- **Source Files**:
  - `sql/00_create_employees_table.sql`
  - `sql/01_users_schema.sql`
  - `sql/missing/create_teams_table.sql`
  - `sql/missing/create_businesses_table.sql`
  - `sql/create_business_info_only.sql`
  - `sql/phase1_social_auth_extension.sql`
  - `sql/social_auth_approvals_table.sql`
  - `sql/create_business_contacts.sql`
  - `sql/02_business_schema.sql`
  - `sql/05_create_business_progress_system.sql`

- **Documentation**:
  - `claudedocs/NEW-MIGRATION-DESIGN.md`
  - `claudedocs/phase-1-migration-summary.md` (if exists)

## Statistics

- **Total Tables**: 17
- **Total Indexes**: 61
- **Total RLS Policies**: ~25
- **Total Triggers**: 7
- **Foreign Key Constraints**: ~30
- **Check Constraints**: ~15
- **Unique Constraints**: ~8

## Migration Size

- **Estimated Lines**: ~1,050 lines
- **Estimated Execution Time**: 2-5 seconds
- **Storage Impact**: Minimal (schema only, no data)
