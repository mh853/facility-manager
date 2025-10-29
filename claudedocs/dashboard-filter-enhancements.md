# Dashboard Filter Enhancements

**Date**: 2025-10-29
**Status**: ✅ Completed

## Summary

Implemented visual enhancements to the dashboard filtering system to improve user experience and readability.

## Changes Made

### 1. Quick Filter Visual Active State

**File**: `components/dashboard/FilterPanel.tsx`

**Requirement**: Show which quick filter (오늘/어제/이번주/이번달) is currently active with color highlighting.

**Implementation**:
- Added `activeQuickFilter` state to track which quick filter button is active
- Updated button styling to show active state with `bg-indigo-600 text-white` when selected
- Inactive buttons show `bg-white text-indigo-600` styling
- Reset active state when switching between period modes (최근기간/기간지정/연도별)
- Reset active state when clicking "초기화" button

**Visual Behavior**:
```
Active button:   bg-indigo-600 text-white border-indigo-600
Inactive button: bg-white text-indigo-600 border-indigo-300
```

**State Tracking**:
- `'today'` - 오늘 filter active
- `'yesterday'` - 어제 filter active
- `'thisWeek'` - 이번주 filter active
- `'thisMonth'` - 이번달 filter active
- `null` - No quick filter active (using other period modes)

### 2. Number Formatting with Thousand Separators

**Files Modified**:
- `components/dashboard/charts/RevenueChart.tsx` (lines 206-211)
- `components/dashboard/charts/ReceivableChart.tsx` (lines 178-182)

**Requirement**: Add thousand separators (commas) to "총 매출" and "총 순이익" values in summary cards.

**Implementation**:

**Before**:
```tsx
{formatCurrency(summary.totalRevenue)}  // "12억" or "5000만"
{formatCurrency(summary.totalProfit)}   // "3억" or "1500만"
```

**After**:
```tsx
{summary.totalRevenue.toLocaleString()}원  // "1,234,567,890원"
{summary.totalProfit.toLocaleString()}원   // "987,654,321원"
```

**Changed Cards**:
- **RevenueChart**:
  - 총 매출 (line 207): Shows full number with commas
  - 총 순이익 (line 211): Shows full number with commas
- **ReceivableChart**:
  - 총 미수금 (line 181): Shows full number with commas

**Unchanged Cards** (still using formatCurrency for brevity):
- 평균 순이익
- 평균 이익률

## Technical Details

### Component Structure

**FilterPanel.tsx**:
```tsx
const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

// In quick filter button onClick handlers:
setActiveQuickFilter('today');  // or 'yesterday', 'thisWeek', 'thisMonth'

// In period mode button handlers:
setActiveQuickFilter(null);  // Clear quick filter state

// In reset function:
setActiveQuickFilter(null);  // Clear on filter reset
```

### Number Formatting

Uses JavaScript's built-in `toLocaleString()` method:
- Automatically adds thousand separators based on locale
- More precise than abbreviated format (억/만)
- Better for exact financial reporting

## Testing Checklist

- [x] Quick filter buttons show active state when clicked
- [x] Only one quick filter can be active at a time
- [x] Active state clears when switching to 최근기간/기간지정/연도별
- [x] Active state clears when clicking 초기화
- [x] Number formatting shows commas in all summary cards
- [x] Development server compiles without errors
- [x] No TypeScript errors introduced

## User Experience Improvements

1. **Visual Feedback**: Users can immediately see which quick filter is active
2. **Consistency**: Matches the existing pattern used for period mode buttons (최근기간/기간지정/연도별)
3. **Readability**: Large numbers are easier to read with thousand separators
4. **Precision**: Exact financial values visible instead of abbreviated format

## Related Files

- `components/dashboard/FilterPanel.tsx` - Filter UI with quick filter buttons
- `components/dashboard/charts/RevenueChart.tsx` - Revenue chart with summary cards
- `components/dashboard/charts/ReceivableChart.tsx` - Receivables chart with summary card
- `types/dashboard.ts` - Dashboard type definitions

## Notes

- The existing period mode buttons (최근기간/기간지정/연도별) already had active state styling
- Quick filter buttons now match this existing pattern for consistency
- Number formatting change only affects summary cards displaying total values
- Chart tooltips and other displays remain unchanged
