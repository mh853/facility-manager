# Database Schema Analysis & Extensible Design Report

**Date**: 2025-09-01  
**System**: Facility Management System (시설 관리 시스템)  
**Issue**: Schema mismatch causing "column business_name does not exist" error

## 🔍 Current State Analysis

### Identified Schema Conflict

The system currently has **two different database schemas** that are incompatible:

1. **Normalized Schema** (`lib/database-service.ts`)
   - Uses proper foreign key relationships
   - Structure: `business_info` → `air_permit_info` → `discharge_outlets` → facilities
   - More scalable and maintainable

2. **Flat Schema** (`sql/create_facilities_tables.sql`)
   - Uses direct `business_name` references in facility tables
   - Structure: `discharge_facilities` and `prevention_facilities` with `business_name` column
   - Simpler but less scalable

3. **API Expectation** (`facilities-supabase/[businessName]/route.ts`)
   - Currently expects the flat schema with `business_name` column
   - Queries: `FROM 'discharge_facilities' WHERE business_name = ?`

### Root Cause

The API routes are trying to query `discharge_facilities.business_name` but the current database tables were created using the normalized schema (without `business_name` column), causing the error.

## 📊 Existing Database Structure

### Current Tables (from `lib/supabase.ts`)
```sql
businesses (legacy)
├── id, name, status, google_folder_id, facility_info
├── created_at, updated_at, synced_at

facilities (basic table)  
├── id, business_id, name, type, details, created_at

uploaded_files (file management)
├── id, business_id, facility_id, filename, file_path
├── google_file_id, upload_status, thumbnail_path

sync_queue (Google Drive integration)
├── id, operation_type, payload, status, retry_count
```

### New Extended Tables (from `database-service.ts`)
```sql
business_info (comprehensive)
├── id, business_name, contact info, equipment counts
├── manufacturer, vpn, sensor quantities

air_permit_info (permit management)  
├── id, business_id, business_type, emission_amount
├── permit dates, additional_info

discharge_outlets (outlet hierarchy)
├── id, air_permit_id, outlet_number, outlet_name

discharge_facilities (normalized)
├── id, outlet_id, facility_name, capacity, quantity
├── ❌ Missing: business_name, outlet_number, facility_number

prevention_facilities (normalized)
├── id, outlet_id, facility_name, capacity, quantity  
├── ❌ Missing: business_name, outlet_number, facility_number
```

## 🏗️ Recommended Extensible Architecture

### Design Principles

1. **Backward Compatibility**: Support existing APIs without breaking changes
2. **Forward Scalability**: Enable complex hierarchies and relationships
3. **Dual Access Pattern**: Support both flat and normalized queries
4. **Extensibility**: JSON fields for future requirements
5. **Data Integrity**: Foreign keys with cascade relationships
6. **Performance**: Optimized indexes for both access patterns

### Schema Features

#### 🔄 Dual Structure Support
- **Normalized Fields**: `outlet_id` → proper foreign key relationships
- **Legacy Fields**: `business_name`, `outlet_number`, `facility_number` for compatibility
- **Auto-Population**: Triggers automatically populate legacy fields from normalized data

#### 📈 Scalability Enhancements
- **Equipment Quantities**: Integer counts instead of boolean flags
- **Extensible JSON**: `additional_info`, `operating_conditions`, `measurement_points`
- **Device Associations**: UUID arrays for linking measurement devices
- **Flexible Categorization**: Support for multiple business types and facility categories

#### 🛡️ Data Quality & Audit
- **Change Tracking**: Complete audit trail with user/session information
- **Data Validation**: Quality scores and validation status
- **Migration Safety**: Backup tables and rollback capabilities

### Key Architectural Decisions

#### 1. **Hybrid Column Strategy**
```sql
discharge_facilities:
├── outlet_id UUID (normalized - preferred)
├── business_name TEXT (legacy - compatibility)  
├── outlet_number INTEGER (legacy - compatibility)
└── facility_number INTEGER (legacy - compatibility)
```

#### 2. **Automatic Population via Triggers**
```sql
-- When inserting with outlet_id, automatically populate legacy fields
CREATE TRIGGER sync_legacy_facility_fields
    BEFORE INSERT OR UPDATE ON discharge_facilities
    FOR EACH ROW EXECUTE FUNCTION sync_legacy_facility_fields();
```

#### 3. **Equipment as Quantities**
```sql
-- Scalable: ph_sensor INTEGER (supports 0, 1, 2, 3...)
-- Not: ph_meter BOOLEAN (limited to true/false)
```

#### 4. **JSON Extensibility**
```sql
-- Operating conditions, measurement points, device associations
operating_conditions JSONB DEFAULT '{}' -- {"temperature": 150, "pressure": 1.2}
measurement_points JSONB DEFAULT '[]'   -- [{"point": "inlet", "parameters": ["temp"]}]
```

## 🔧 Migration Strategy

### Phase 1: Emergency Fix (Immediate)
**File**: `database/emergency-fix.sql`

```sql
-- Add missing columns to fix immediate error
ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS outlet_number INTEGER;
ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS facility_number INTEGER;

-- Same for prevention_facilities
-- Populate with default values for existing records
```

**Impact**: ✅ Fixes current API error immediately

### Phase 2: Full Migration (Recommended)
**File**: `database/migration-strategy.sql`

1. **Backup**: Create backup tables for existing data
2. **Normalize**: Create proper business_info, air_permit_info, discharge_outlets
3. **Populate**: Migrate existing flat data to normalized structure
4. **Enhance**: Add legacy compatibility columns and triggers
5. **Validate**: Check data integrity and API compatibility

**Impact**: 🏗️ Creates scalable foundation for future development

### Phase 3: Extended Features (Future)
**File**: `database/unified-extensible-schema.sql`

1. **Measurement Devices**: Complete IoT device management
2. **Project Phases**: Workflow and approval management  
3. **Advanced Analytics**: Time-series data and reporting
4. **Integration Management**: API status and quota tracking

**Impact**: 🚀 Enables advanced facility management features

## 📋 Implementation Recommendations

### Option A: Quick Fix (Low Risk)
1. Run `database/emergency-fix.sql` in Supabase SQL Editor
2. Test existing APIs to ensure they work
3. Plan normalized migration for next development cycle

**Timeline**: 15 minutes  
**Risk**: Low  
**Benefits**: Immediate error resolution

### Option B: Complete Migration (Recommended)
1. Run emergency fix first to restore functionality
2. Execute full migration during maintenance window
3. Update APIs to use normalized structure gradually
4. Implement extended features as needed

**Timeline**: 2-4 hours  
**Risk**: Medium (requires testing)  
**Benefits**: Future-proof scalable architecture

### Option C: Gradual Migration (Conservative)
1. Emergency fix for immediate error
2. Implement dual-access APIs (support both schemas)
3. Migrate data in phases over multiple releases
4. Deprecate legacy access patterns gradually

**Timeline**: 1-2 weeks  
**Risk**: Low  
**Benefits**: Zero downtime, thorough testing possible

## 🚀 Future Extensibility Features

### 1. Multi-Tenant Support
```sql
-- Add tenant isolation
ALTER TABLE business_info ADD COLUMN tenant_id UUID;
CREATE INDEX idx_business_info_tenant ON business_info(tenant_id);
```

### 2. Workflow Automation
```sql
-- Project phase transitions with approval workflow
project_phases: phase_type → status → approval_status
```

### 3. IoT Device Integration
```sql
-- Real-time measurement data with time-series optimization
measurement_history: device_id → measured_value + timestamp
```

### 4. Advanced Analytics
```sql
-- Computed metrics and KPIs
facility_analytics: efficiency_trends, compliance_scores, predictive_maintenance
```

### 5. Document Management
```sql
-- Enhanced file categorization and processing
uploaded_files: document_category, quality_score, processing_status
```

## 📝 Next Steps

### Immediate (Today)
1. ✅ **Run Emergency Fix**: Execute `emergency-fix.sql` to resolve current error
2. ✅ **Test APIs**: Verify `/api/facilities-supabase/[businessName]` works
3. ✅ **Validate Data**: Check existing business data is accessible

### Short Term (This Week)  
1. **Plan Migration Window**: Schedule downtime for full migration
2. **Backup Strategy**: Export current data for safety
3. **API Testing**: Create comprehensive test suite for all endpoints

### Medium Term (Next Sprint)
1. **Execute Full Migration**: Run `migration-strategy.sql`
2. **Update TypeScript**: Use new `types/database.ts` interfaces
3. **Enhance APIs**: Add normalized endpoint alternatives

### Long Term (Next Quarter)
1. **Extended Features**: Implement IoT device management
2. **Analytics Dashboard**: Add facility performance metrics
3. **Workflow Automation**: Project phase management with approvals

## 🔐 Risk Mitigation

### Data Safety
- ✅ **Backup Tables**: Migration creates backup copies automatically
- ✅ **Rollback Capability**: All changes can be reversed
- ✅ **Validation Functions**: Automatic integrity checking

### API Compatibility  
- ✅ **Legacy Views**: Maintain existing API response formats
- ✅ **Gradual Migration**: No breaking changes to existing endpoints
- ✅ **Dual Support**: Both flat and normalized access patterns

### Performance
- ✅ **Optimized Indexes**: Support both legacy and normalized queries
- ✅ **Materialized Views**: Pre-computed aggregates for dashboards
- ✅ **Time-Series Optimization**: Partitioned tables for measurement data

---

**Conclusion**: The extensible schema design provides a robust foundation that solves the immediate error while enabling future scalability. The migration strategy ensures data safety and API compatibility throughout the transition.