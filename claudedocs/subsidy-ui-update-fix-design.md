# Subsidy Announcement UI Update Fix - Design Document

## Problem Analysis

### Issue 1: Create Not Reflecting Immediately
**Symptom**: After creating a new announcement via ManualUploadModal, the UI doesn't show the new item until page refresh.

**Root Cause**:
- `ManualUploadModal.tsx:166` calls `onSuccess()` which triggers `loadData()` in parent
- `loadData()` calls both `loadAllAnnouncements()` and `loadStats()` in parallel
- However, the modal calls `onClose()` immediately after `onSuccess()` without waiting
- This creates a race condition where the modal closes before data finishes loading

**Current Flow**:
```
ManualUploadModal.handleSubmit()
  → API POST /api/subsidy-announcements/manual ✅
  → onSuccess() [triggers loadData() - starts async]
  → onClose() [closes modal immediately]
  → [loadData finishes in background - may complete after modal closed]
```

### Issue 2: Delete Not Reflecting (Even After Refresh)
**Symptom**: After deleting an announcement, it remains visible even after refresh. Need to click delete again (triggering error) to remove from UI.

**Root Cause in AnnouncementDetailModal.tsx**:
```typescript
// Lines 75-82
onClose();                    // 1. Modal closes
alert('공고가 삭제되었습니다.');  // 2. Shows alert
onUpdate();                   // 3. Calls loadData() without await
```

**Problem**: The `onUpdate()` call is fire-and-forget, but more critically, there's a **STATE MANAGEMENT ISSUE** in the parent component.

**Parent State Management Analysis** (`page.tsx:59-77`):
```typescript
const loadAllAnnouncements = useCallback(async () => {
  try {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '1000',
      sortBy: 'published_at',
      sortOrder: 'desc',
    });

    const response = await fetch(`/api/subsidy-announcements?${params}`);
    const data = await response.json();

    if (data.success) {
      setAllAnnouncements(data.data.announcements);  // ⚠️ REPLACES entire array
    }
  } catch (error) {
    console.error('공고 로드 실패:', error);
  }
}, []);
```

**The Real Problem**:
- `loadAllAnnouncements()` completely replaces the state with fresh API data
- If the API endpoint has **CACHING** or returns **STALE DATA**, the deleted item reappears
- The database DELETE succeeds, but the API GET returns cached/stale data

### Issue 3: Why Second Delete Attempt "Works"
When user clicks delete again:
1. API returns 404 "Announcement not found" (it was already deleted)
2. Error handler in modal doesn't close the modal (`setIsDeleting(false)`)
3. User sees error, manually closes modal
4. On manual close, parent might trigger refresh again
5. By this time, cache has expired, API returns fresh data without deleted item

## Design Solution

### Strategy: Optimistic UI Updates with Rollback

We'll implement the same pattern used in `useBusinessData.ts` - **optimistic updates with automatic rollback on failure**.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSIDY PAGE (Parent)                     │
│  State: allAnnouncements[]                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ passes callbacks
                           ▼
        ┌──────────────────────────────────────────┐
        │      Child Components (Modals)           │
        │  • ManualUploadModal                     │
        │  • AnnouncementDetailModal               │
        └──────────────────────────────────────────┘
                           │
                           │ triggers operations
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              OPTIMISTIC STATE MANAGEMENT                     │
│                                                              │
│  CREATE:                                                     │
│  1. Optimistic: Add temp item to allAnnouncements[]         │
│  2. API Call: POST /api/subsidy-announcements/manual        │
│  3. Success: Replace temp with real data from API           │
│  4. Failure: Remove temp item (rollback)                    │
│                                                              │
│  UPDATE:                                                     │
│  1. Optimistic: Update item in allAnnouncements[]           │
│  2. API Call: PATCH /api/subsidy-announcements/manual       │
│  3. Success: Keep updated data                              │
│  4. Failure: Revert to backup data (rollback)               │
│                                                              │
│  DELETE:                                                     │
│  1. Backup: Save original allAnnouncements[]                │
│  2. Optimistic: Remove item from allAnnouncements[]         │
│  3. API Call: DELETE /api/subsidy-announcements/manual      │
│  4. Success: Keep removed state                             │
│  5. Failure: Restore backup (rollback)                      │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: Add Optimistic Create Function
**Location**: `app/admin/subsidy/page.tsx`

```typescript
/**
 * 공고 생성 - 낙관적 업데이트
 * @param newAnnouncement - 생성할 공고 데이터
 * @returns { success: boolean, data?: any, error?: string }
 */
const createAnnouncement = async (newAnnouncement: any) => {
  // 1. 임시 ID 생성 (실제 ID는 API 응답에서)
  const tempId = `temp-${Date.now()}`;
  const tempAnnouncement = {
    ...newAnnouncement,
    id: tempId,
    created_at: new Date().toISOString(),
    is_manual: true,
    is_read: false,
    status: 'new' as const,
  };

  // 2. 낙관적 업데이트 (UI에 즉시 추가)
  setAllAnnouncements(prev => [tempAnnouncement, ...prev]);

  try {
    // 3. API 호출
    const token = TokenManager.getToken();
    if (!token) {
      throw new Error('인증 토큰이 없습니다.');
    }

    const response = await fetch('/api/subsidy-announcements/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newAnnouncement)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || '공고 등록에 실패했습니다.');
    }

    // 4. 성공: 임시 항목을 실제 데이터로 교체
    setAllAnnouncements(prev =>
      prev.map(a => a.id === tempId ? result.data : a)
    );

    // 5. 통계 새로고침
    loadStats();

    return { success: true, data: result.data };

  } catch (error) {
    // 6. 실패: 임시 항목 제거 (롤백)
    setAllAnnouncements(prev => prev.filter(a => a.id !== tempId));

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
};
```

#### Phase 2: Add Optimistic Update Function
**Location**: `app/admin/subsidy/page.tsx`

```typescript
/**
 * 공고 수정 - 낙관적 업데이트
 * @param id - 공고 ID
 * @param updates - 수정할 데이터
 * @returns { success: boolean, error?: string }
 */
const updateAnnouncement = async (id: string, updates: any) => {
  // 1. 원본 데이터 백업 (롤백용)
  const originalAnnouncements = [...allAnnouncements];

  try {
    // 2. 낙관적 업데이트 (UI에 즉시 반영)
    setAllAnnouncements(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
    );

    // 3. API 호출
    const token = TokenManager.getToken();
    if (!token) {
      throw new Error('인증 토큰이 없습니다.');
    }

    const response = await fetch('/api/subsidy-announcements/manual', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, ...updates })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || '공고 수정에 실패했습니다.');
    }

    return { success: true };

  } catch (error) {
    // 4. 실패: 원본 데이터로 롤백
    setAllAnnouncements(originalAnnouncements);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
};
```

#### Phase 3: Add Optimistic Delete Function (Following useBusinessData Pattern)
**Location**: `app/admin/subsidy/page.tsx`

```typescript
/**
 * 공고 삭제 - 낙관적 업데이트
 * @param id - 삭제할 공고 ID
 * @returns { success: boolean, message?: string, error?: string }
 */
const deleteAnnouncement = async (id: string) => {
  console.log('🗑️ [deleteAnnouncement] 삭제 시작:', id);

  // 1. 원본 데이터 백업 (롤백용)
  const originalAnnouncements = [...allAnnouncements];

  try {
    // 2. 낙관적 업데이트 (UI에서 즉시 제거)
    setAllAnnouncements(prev => prev.filter(a => a.id !== id));

    // 3. API 호출
    const token = TokenManager.getToken();
    if (!token) {
      throw new Error('인증 토큰이 없습니다.');
    }

    const response = await fetch(`/api/subsidy-announcements/manual?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || '삭제에 실패했습니다.');
    }

    // 4. 성공: 통계 새로고침
    console.log('✅ [deleteAnnouncement] 삭제 성공:', id);
    loadStats();

    return { success: true, message: '삭제 완료' };

  } catch (error) {
    // 5. 실패: 원본 데이터로 자동 롤백
    console.error('❌ [deleteAnnouncement] 삭제 실패 - 자동 롤백:', id, error);
    setAllAnnouncements(originalAnnouncements);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
};
```

#### Phase 4: Update Child Components to Use New Functions

**ManualUploadModal Changes**:
```typescript
// Instead of calling onSuccess() which triggers full reload:
// OLD:
onSuccess();
onClose();

// NEW: Pass announcement data back to parent for optimistic update
interface ManualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (announcementData: ManualAnnouncementRequest) => Promise<{ success: boolean, error?: string }>;
  editMode?: boolean;
  existingData?: any;
}

// In handleSubmit:
const result = await onSuccess(requestBody as ManualAnnouncementRequest);

if (result.success) {
  // Reset form
  setFormData({ /* ... */ });
  setValidationErrors({});
  onClose();
} else {
  // Show error (rollback already handled by parent)
  setError(result.error || '저장 실패');
}
```

**AnnouncementDetailModal Changes**:
```typescript
// Instead of calling onUpdate() which triggers full reload:
// OLD:
interface AnnouncementDetailModalProps {
  announcement: SubsidyAnnouncement;
  currentUserId?: string;
  userPermissionLevel?: number;
  onClose: () => void;
  onUpdate: () => void;  // ❌ Full reload
  onEdit: (announcement: SubsidyAnnouncement) => void;
}

// NEW:
interface AnnouncementDetailModalProps {
  announcement: SubsidyAnnouncement;
  currentUserId?: string;
  userPermissionLevel?: number;
  onClose: () => void;
  onDelete: (id: string) => Promise<{ success: boolean, message?: string, error?: string }>;
  onEdit: (announcement: SubsidyAnnouncement) => void;
}

// In handleDelete:
const result = await onDelete(announcement.id);

if (result.success) {
  onClose();
  alert(result.message || '공고가 삭제되었습니다.');
} else {
  alert(result.error || '삭제 중 오류가 발생했습니다.');
  setIsDeleting(false);
}
```

## Implementation Sequence

1. ✅ **Add optimistic functions to parent** (`page.tsx`)
   - `createAnnouncement()`
   - `updateAnnouncement()`
   - `deleteAnnouncement()`

2. ✅ **Update ManualUploadModal**
   - Change `onSuccess` prop signature
   - Update `handleSubmit` to use new create function
   - Handle success/error responses

3. ✅ **Update AnnouncementDetailModal**
   - Change `onUpdate` to `onDelete` prop
   - Update `handleDelete` to use new delete function
   - Handle success/error responses

4. ✅ **Update parent component modal bindings**
   - Pass new functions to modals
   - Remove old `loadData` callbacks

5. ✅ **Testing**
   - Test create: Should appear immediately
   - Test edit: Should update immediately
   - Test delete: Should remove immediately
   - Test error cases: Should rollback properly

## Benefits

1. **Instant UI Feedback**: Users see changes immediately
2. **Automatic Rollback**: Failed operations revert automatically
3. **No Refresh Needed**: Eliminates page refresh requirements
4. **Better UX**: Smooth, responsive experience
5. **Error Resilience**: Graceful handling of API failures
6. **Cache Independence**: UI state independent of API caching

## Testing Checklist

- [ ] Create announcement → appears immediately in list
- [ ] Create with network error → temp item removed (rollback)
- [ ] Edit announcement → updates immediately in list
- [ ] Edit with network error → reverts to original (rollback)
- [ ] Delete announcement → removes immediately from list
- [ ] Delete with network error → reappears in list (rollback)
- [ ] Page refresh after operations → data consistent with server
- [ ] Multiple rapid operations → all handled correctly
- [ ] Filtered/paginated views → updates visible correctly

## Migration Notes

**Breaking Changes**:
- `ManualUploadModal.onSuccess` signature changed: `() => void` → `(data: ManualAnnouncementRequest) => Promise<{ success: boolean, error?: string }>`
- `AnnouncementDetailModal.onUpdate` removed, replaced with `onDelete: (id: string) => Promise<{ success: boolean, message?: string, error?: string }>`

**Backward Compatibility**: None - this is a design improvement requiring coordinated updates across parent and child components.
