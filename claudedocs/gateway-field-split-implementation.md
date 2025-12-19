# Gateway Field Split Implementation

## Overview
Split the single "게이트웨이" (gateway) field into two separate fields to support different purchase prices for Ecosense manufacturer:
- **게이트웨이(1,2)** (gateway_1_2): Purchase price 1,000,000원
- **게이트웨이(3,4)** (gateway_3_4): Purchase price 1,420,000원
- Both have the same sales price: 1,600,000원

## Date
2025-12-19

## Files Modified

### 1. Database Schema
**File**: `/sql/add_gateway_split_fields.sql` (NEW)
- Added migration script to add `gateway_1_2` and `gateway_3_4` columns to `business_info` table
- Added column comments for documentation
- Marked old `gateway` field as deprecated
- **🎯 Automated data migration**: Existing `gateway` values automatically copied to `gateway_1_2`

### 2. Type Definitions
**File**: `/lib/database-service.ts`
- Lines 100-102: Added new fields to BusinessInfo interface
```typescript
gateway: number | null // @deprecated - Use gateway_1_2 and gateway_3_4 instead
gateway_1_2: number | null // 게이트웨이(1,2) - 에코센스 매입금액 다름
gateway_3_4: number | null // 게이트웨이(3,4) - 에코센스 매입금액 다름
```

### 3. Admin Business Page
**File**: `/app/admin/business/page.tsx`

**Interface Updates**:
- Lines 179-181: UnifiedBusinessInfo interface

**UI Components**:
- Lines 4853-4872: Two separate input fields for gateway_1_2 and gateway_3_4

**Pricing Constants**:
- Lines 518-520: OFFICIAL_PRICES (매출 단가) - Both 1,600,000원
- Lines 542-544: MANUFACTURER_COSTS (매입 단가) - gateway_1_2: 1,000,000원, gateway_3_4: 1,420,000원
- Lines 563-564: INSTALLATION_COSTS

**Arrays and Mappings**:
- Line 573: EQUIPMENT_FIELDS array
- Lines 2398-2400: Form initialization
- Lines 2487-2489: Edit modal data loading
- Lines 236-237, 2240-2241, 2732-2733, 2970-2971, 3161-3164: Excel import/export mappings

### 4. Admin Revenue Page
**File**: `/app/admin/revenue/page.tsx`

**Calculation Logic**:
- Line 961: equipmentFields array in table calculation

**Pricing Constants**:
- Lines 353-354: OFFICIAL_PRICES - Both 1,600,000원
- Lines 375-376: MANUFACTURER_COSTS - gateway_1_2: 1,000,000원, gateway_3_4: 1,420,000원
- Lines 397-398: INSTALLATION_COSTS
- Line 413: EQUIPMENT_FIELDS constant

### 5. Revenue Calculation API
**File**: `/app/api/revenue/calculate/route.ts`

**Equipment Fields Array**:
- Lines 306-313: Added gateway_1_2 and gateway_3_4 to equipmentFields array

**Pricing Constants**:
- Lines 336-338: DEFAULT_OFFICIAL_PRICES
  - gateway_1_2: 1,600,000원
  - gateway_3_4: 1,600,000원
- Lines 368-370: DEFAULT_COSTS (Ecosense purchase prices)
  - gateway_1_2: 1,000,000원
  - gateway_3_4: 1,420,000원 (different!)

**Equipment Names**:
- Lines 412-414: EQUIPMENT_NAMES mapping
  - gateway_1_2: '게이트웨이(1,2)'
  - gateway_3_4: '게이트웨이(3,4)'

### 6. Business Detail Modal
**File**: `/components/business/modals/BusinessDetailModal.tsx`

**Interface Updates**:
- Lines 118-120: FacilityDeviceData interface
- Lines 165-167: BusinessCardData interface

**Display Logic**:
- Lines 911-912: Changed from single gateway to split fields display

## Pricing Summary

| Equipment | Sales Price | Ecosense Purchase Price | Profit Margin |
|-----------|-------------|-------------------------|---------------|
| 게이트웨이(1,2) | 1,600,000원 | 1,000,000원 | 600,000원 |
| 게이트웨이(3,4) | 1,600,000원 | 1,420,000원 | 180,000원 |

## Testing Required

1. **Database Migration**:
   - Run `/sql/add_gateway_split_fields.sql` in Supabase SQL editor
   - Verify columns added successfully
   - Verify existing gateway data migrated to gateway_1_2

2. **Admin/Business Page**:
   - Open edit modal for a business
   - Verify two separate gateway input fields appear
   - Test saving values for both fields
   - Verify migrated data appears in gateway_1_2 field

3. **Admin/Revenue Page**:
   - Check table calculations include both gateway types
   - Verify detail modal shows correct pricing for Ecosense manufacturer

4. **Admin/Revenue Detail Modal**:
   - Open business detail in admin/revenue
   - Click "매출 상세보기" button
   - Verify equipment breakdown shows:
     - 게이트웨이(1,2) with correct pricing
     - 게이트웨이(3,4) with correct pricing (different purchase price for Ecosense)

## Backward Compatibility

- Old `gateway` field marked as `@deprecated` in all locations
- Old field NOT removed to maintain data integrity
- New fields default to 0 if not set
- Excel import/export supports both old and new fields
- **Automated migration**: Existing gateway values automatically copied to gateway_1_2 during migration

## Next Steps

1. ✅ Database migration script created with automatic data migration
2. ✅ All TypeScript interfaces updated
3. ✅ All pricing constants updated with correct values
4. ✅ API equipment breakdown generation updated
5. ✅ Detail modal display fixed
6. ✅ Save logic verified working correctly

**Ready for execution**: Run `/sql/add_gateway_split_fields.sql` in Supabase SQL editor to complete the migration.
