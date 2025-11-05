# PDF Layout Optimization - Single Page Design

## Overview
Optimized purchase order PDF layout to fit all content on a single A4 page by reducing margins and spacing while maintaining readability. Added comprehensive fields including equipment settings, payment terms, and contact information in a balanced layout.

## Added Content (Latest Update)

### New Sections
1. **담당자 정보 (Contact Information)** - Combined section
   - 블루온 담당자 (BlueOn Manager): name, contact, email
   - 세금계산서 담당자 (Tax Invoice Manager): factory manager info

2. **장비 설정 (Equipment Settings)** - 2-column layout
   - VPN 설정 (VPN Setting): wired/wireless
   - 온도센서 타입 (Temperature Sensor Type): flange/nipple
   - 온도센서 길이 (Temperature Sensor Length): 10/20/40cm
   - PH 인디게이터 부착위치 (PH Indicator Location): panel/independent box/none

3. **결제조건 (Payment Terms)** - Added to payment section
   - 선금5|잔금5 (Prepay 5|Balance 5)
   - 납품 후 완납 (Full after delivery)
   - 기타사항(선입금) (Other-Prepaid) [Default]
   - Note: "세금계산서 발행 후 7일 이내" (Within 7 days after tax invoice)

### Layout Reorganization
- Consolidated contact info into single 2-column table
- Grouped equipment settings (VPN, temp sensor, PH) in 2-column layout
- Simplified business info section (removed duplicate contact fields)
- Integrated payment terms into payment amount section

## Design Changes

### Document Margins
| Element | Before | After | Reduction |
|---------|--------|-------|-----------|
| PDF margins | 15mm | 8mm | 47% |
| Container padding | 30-40px | 15px | 50-63% |

### Typography (Latest)
| Element | Before | After | Final | Total Reduction |
|---------|--------|-------|-------|-----------------|
| Body font size | 12px | 11px | 11px | 8% |
| Line height | 1.6 | 1.3 | 1.3 | 19% |
| Title (h1) | 28px | 22px | 20px | 29% |
| Section headers (h2) | 18px | 15px | 14px | 22% |
| Business name | 14px | 13px | 12px | 14% |
| Footer text | 11px | 10px | 9px | 18% |
| Contact info | - | - | (inline) | Condensed |

### Spacing (Latest)
| Element | Before | Intermediate | Final | Total Reduction |
|---------|--------|--------------|-------|-----------------|
| Title bottom margin | 30px | 15px | 10px | 67% |
| Title padding-bottom | 15px | - | 8px | 47% |
| Section bottom margin | 25px | 12px | 8-10px | 60-68% |
| Header margin-bottom | 15px | 10px | 8px | 47% |
| Table cell padding | 8-10px | 6px | 5px | 38-50% |
| Footer margin-top | 40px | 20px | 15px | 63% |
| Footer padding-top | 20px | 12px | 10px | 50% |
| Footer text margin | 5px | 3px | 2px | 60% |

### Visual Elements
| Element | Before | After | Final |
|---------|--------|-------|-------|
| Title border bottom | 3px | 2px | 2px |
| Section border left | 4px | 3px | 3px |
| Title padding-bottom | 15px | 10px | 8px |
| Section padding-left | 10px | 8px | 6px |
| Title h1 margin-bottom | 10px | 6px | 5px |

### Content Structure
**Section Order (Optimized):**
1. 제목 (Title) - Centered with business name
2. 담당자 정보 (Contact Info) - 2-column: BlueOn + Tax Invoice managers
3. 품목 정보 (Items) - Dynamic horizontal table
4. 설치(납품) 정보 (Installation Info) - Delivery date
5. 사업장 정보 (Business Info) - Name, addresses (business + delivery)
6. 장비 설정 (Equipment Settings) - 2x2 grid: VPN, temp sensor type/length, PH indicator
7. 전류계 타입 (CT Type) - CT sizes table (16L/24L/36L)
8. 발주 금액 및 결제조건 (Payment + Terms) - Amount breakdown + payment terms + note
9. 하단 정보 (Footer) - Timestamp + document number

## Expected Results

### Space Reduction
- Overall content height: ~40-45% reduction from original
- All 9 sections fit on single A4 page
- Improved information density without compromising readability
- 2-column layout for equipment settings saves ~30% vertical space

### Maintained Quality
- Professional appearance with tighter spacing
- Clear visual hierarchy preserved
- Korean font rendering unaffected
- Table borders and structure intact

## Implementation Details

**File Modified:**
- `lib/document-generators/pdf-generator-ecosense.ts`

**Key Changes:**

1. **PDF Configuration** (line 73):
   - Margin: 15mm → 8mm (47% reduction)

2. **Container Styling** (lines 18-32, 54-63):
   - Padding: 40px → 15px (63% reduction)
   - Font-size: 12px → 11px (8% reduction)
   - Line-height: 1.6 → 1.3 (19% reduction)

3. **Title Section** (lines 151-154):
   - Font: 28px → 20px (29% reduction)
   - Margin-bottom: 30px → 10px (67% reduction)
   - Business name: 14px → 12px

4. **Contact Section** (lines 156-169) - NEW:
   - 2-column table layout
   - Header row with blue background
   - BlueOn manager + Tax invoice manager side-by-side
   - Inline format: "Name | Phone | Email"

5. **Equipment Settings** (lines 220-237) - NEW:
   - 2x2 grid layout (4 settings in 2 rows)
   - VPN + Temp Sensor Type (row 1)
   - Temp Sensor Length + PH Indicator (row 2)
   - Checkbox format for all options

6. **Payment Section** (lines 268-293) - ENHANCED:
   - Added payment terms row
   - 3 checkbox options for payment methods
   - Note: "세금계산서 발행 후 7일 이내" (10px gray text)

7. **All Sections**:
   - Margin-bottom: 25px → 8-10px (60-68% reduction)
   - Header font: 18px → 14px (22% reduction)
   - Header margin: 15px → 8px (47% reduction)
   - Table padding: 8-10px → 5px (38-50% reduction)

8. **Business Info Section** (lines 201-218) - SIMPLIFIED:
   - Removed duplicate manager/contact rows
   - 3 rows only: business name, address, delivery address
   - Contact info moved to top section

## Testing Recommendations

1. **Content Variations**:
   - Test with minimum items (2-3 equipment types)
   - Test with maximum items (7-8 equipment types)
   - Test with long addresses (multi-line text wrapping)
   - Test with long business names
   - Test with all equipment settings enabled
   - Test with missing optional fields (graceful defaults)

2. **Visual Quality**:
   - Verify text readability at 11px body, 9px footer
   - Check 2-column layout alignment
   - Ensure checkbox symbols (☑/☐) render correctly
   - Validate inline contact format readability
   - Check table cell spacing adequacy (5px padding)
   - Ensure section headers remain prominent at 14px

3. **Data Display**:
   - Verify all 3 payment term options display correctly
   - Check temperature sensor type defaults to flange
   - Check PH indicator defaults to independent_box
   - Verify payment terms note displays in gray
   - Test with missing email fields (should handle gracefully)

4. **Print Quality**:
   - Physical A4 print test
   - PDF viewer rendering across browsers
   - Mobile device PDF viewing
   - Korean font rendering quality (especially checkboxes)

## Rollback Plan

If layout is too compressed or content overflows:

1. **First adjustment**: Increase section margins from 8px to 10px
2. **Second adjustment**: Increase table padding from 5px to 6px
3. **Third adjustment**: Increase PDF margins from 8mm to 10mm
4. **Fourth adjustment**: Split equipment settings into separate sections (vertical instead of 2-column)
5. **Last resort**: Accept 2-page output, add page break after "전류계 타입" section

### Quick Fixes for Specific Issues

**Text too small:**
- Body: 11px → 11.5px
- Headers: 14px → 15px
- Footer: 9px → 10px

**Tables too tight:**
- Padding: 5px → 6px
- Add 1-2px to section margins

**2-column layout issues:**
- Change equipment settings back to vertical stacked layout
- Increase column widths if text wraps awkwardly

## Related Files
- `lib/document-generators/pdf-generator-ecosense.ts` - Main PDF generator
- `components/EcosensePurchaseOrderForm.tsx` - Preview component (not affected)
- `app/admin/document-automation/components/PurchaseOrderModal.tsx` - Modal with preview

## Technical Notes

### Architecture
- HTML-to-Canvas approach requires client-side execution (browser APIs)
- Changes affect PDF output only, not Excel generation
- Preview modal still uses original component styling (not affected)
- Non-ecosense manufacturers use this generator for PDF output

### Data Mapping
- BlueOn manager: `data.manager_name`, `manager_contact`, `manager_email`
- Tax invoice manager: `data.factory_manager`, `factory_contact`, `factory_email`
- Temperature sensor type: `data.temperature_sensor_type` (flange/nipple, default: flange)
- Temperature sensor length: `data.temperature_sensor_length` (10cm/20cm/40cm, default: 10cm)
- PH indicator: `data.ph_indicator_location` (panel/independent_box/none, default: independent_box)
- Payment terms: `data.payment_terms` (prepay_5_balance_5/full_after_delivery/other_prepaid, default: other_prepaid)

### Default Values
All new fields have graceful defaults if not provided:
- Temperature sensor type: flange (프렌지타입)
- Temperature sensor length: 10cm
- PH indicator location: independent_box (독립형하이박스)
- Payment terms: other_prepaid (기타사항-선입금)

### Layout Strategy
- **2-column tables** used for space efficiency (담당자 정보, 장비 설정)
- **Inline format** for contact info (Name | Phone | Email) saves vertical space
- **Checkbox format** (☑/☐) for all selection fields provides visual clarity
- **Combined sections** reduce header overhead (발주 금액 + 결제조건)

### Browser Compatibility
- Korean font stack: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif
- Checkbox symbols (☑/☐) are Unicode characters, supported in all modern browsers
- HTML-to-Canvas rendering tested with html2canvas library (scale: 2, JPEG quality: 0.95)
