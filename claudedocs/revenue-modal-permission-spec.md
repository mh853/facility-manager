# 매출 상세보기 모달 권한 요구사항 명세서

## 📋 현재 상황 분석

### 발견된 사실

**1. 사업장 관리 페이지** (`app/admin/business/page.tsx`)
- **페이지 접근 권한**: 권한 1 이상 (`withAuth(BusinessManagementPage, undefined, 1)`)
- **매출 상세보기 섹션** (line 4313-4379):
  - ✅ **권한 체크 없음** - 모든 사용자가 버튼을 볼 수 있음
  - 버튼 클릭 시: `/api/revenue/calculate` API 호출 → 매출 계산 → 모달 표시

**2. BusinessRevenueModal 컴포넌트** (`components/business/BusinessRevenueModal.tsx`)
- **Props**: `userPermission` 전달받음
- **Line 25**: `const isReadOnly = userPermission < 2`
- **사용처**: Line 453-459 - "읽기 전용 안내" 메시지 표시
- ✅ **모달 자체는 권한 1도 볼 수 있음** (표시 제한 없음)
- ⚠️ **편집 기능만 권한 2 필요** (`isReadOnly` 체크)

**3. 매출관리 페이지** (`app/admin/revenue/page.tsx`)
- 별도 페이지로 존재
- 권한 체크 필요 확인 필요

---

## 🎯 요구사항 정리

### 사용자 요청사항
1. **사업장 관리 → 상세보기 모달 → "매출 상세보기" 버튼**:
   - ✅ 권한 1도 매출 상세 정보 모달 볼 수 있게 (읽기 전용)
   - ✅ 이미 구현되어 있음!

2. **매출관리 페이지** (`/admin/revenue`):
   - ⚠️ 기존대로 권한 2부터 접근 가능하게 유지

---

## ✅ 현재 동작 방식 (이미 요구사항 충족)

### Case 1: 권한 1 사용자
```
사업장 관리 페이지
→ 사업장 선택
→ "비용 및 매출 정보" 섹션 보임 ✅
→ "매출 상세보기" 버튼 클릭 ✅
→ API 호출 (/api/revenue/calculate) ✅
→ BusinessRevenueModal 표시 ✅
→ 모달 내부에서 "읽기 전용 모드" 안내 표시 ✅
```

### Case 2: 권한 2 이상 사용자
```
사업장 관리 페이지
→ 사업장 선택
→ "비용 및 매출 정보" 섹션 보임 ✅
→ "매출 상세보기" 버튼 클릭 ✅
→ API 호출 (/api/revenue/calculate) ✅
→ BusinessRevenueModal 표시 ✅
→ 편집 가능 모드 (읽기 전용 안내 없음) ✅
```

---

## 🔍 확인 필요 사항

### 매출관리 페이지 권한 체크

**파일**: `app/admin/revenue/page.tsx`

현재 권한 레벨 확인 필요:

```bash
# 파일 마지막 라인 확인
tail -5 app/admin/revenue/page.tsx
```

예상:
- `export default withAuth(RevenuePage, undefined, 2)` → 권한 2 필요 ✅
- 또는 `export default withAuth(RevenuePage, undefined, 1)` → 권한 1도 접근 가능 ⚠️

---

## 📊 요구사항 충족 여부

| 요구사항 | 현재 상태 | 조치 필요 |
|----------|----------|----------|
| 사업장 상세 → 매출 상세보기 버튼 (권한 1) | ✅ 이미 가능 | ❌ 없음 |
| BusinessRevenueModal 표시 (권한 1) | ✅ 이미 표시됨 | ❌ 없음 |
| 매출관리 페이지 접근 (권한 2만) | ⚠️ 확인 필요 | ⏳ 확인 후 결정 |

---

## 🚀 다음 단계

### Step 1: 매출관리 페이지 권한 확인

```bash
grep -n "withAuth" app/admin/revenue/page.tsx | tail -1
```

### Step 2-A: 만약 권한 1도 접근 가능하면 (수정 필요)

```typescript
// Before
export default withAuth(RevenuePage, undefined, 1)

// After
export default withAuth(RevenuePage, undefined, 2)
```

### Step 2-B: 만약 이미 권한 2만 접근 가능하면

✅ **추가 작업 없음** - 이미 요구사항 충족!

---

## 🎊 예상 결론

**사용자 요청사항은 이미 구현되어 있을 가능성 높음!**

이유:
1. `BusinessRevenueModal`은 `userPermission`을 받지만 **표시 자체를 막지 않음**
2. Line 25: `isReadOnly` 는 편집 기능만 제어
3. 사업장 관리 페이지는 권한 1부터 접근 가능
4. "매출 상세보기" 버튼에 별도 권한 체크 없음

**확인만 하면 됩니다!**

---

**작성일**: 2025-10-27
**상태**: 요구사항 분석 완료, 매출관리 페이지 권한 확인 대기
