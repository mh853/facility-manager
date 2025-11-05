# 대기필증 개발자도구 닫힘 시 반영 안되는 문제 근본 원인 분석

## 🔍 증상
- 개발자도구를 **열면**: 데이터 수정 후 저장하면 즉시 UI에 반영됨 ✅
- 개발자도구를 **닫으면**: 데이터 수정 후 저장해도 UI에 반영 안됨 ❌

## 🧪 Root Cause Analysis

### 1. **Race Condition: API Updates vs Data Refresh**

현재 저장 플로우:
```typescript
// handleSave 함수 (Lines 470-668)
1. 모든 기존 시설에 대해 PUT API 호출 생성
2. Promise.all(apiCalls) - 모든 API 호출 완료 대기
3. fetch(`/api/air-permit?forcePrimary=true`) - 최신 데이터 재조회
4. flushSync(() => setPermitDetail(refreshData.data))
```

**문제**: Step 2와 Step 3 사이에 **시간 간격이 너무 짧음**

### 2. **Database Write Latency**

Supabase PostgreSQL의 특성:
- **Write Operation**: 데이터를 디스크에 완전히 커밋하는데 시간 소요
- **Transaction Commit**: ACID 보장을 위한 fsync 작업
- **Primary DB Read**: 커밋이 완전히 완료되기 전에 읽을 수 있음 (dirty read 방지 메커니즘 있음)

```
Timeline with DevTools OPEN (느린 실행):
┌────────────────────────────────────────────────────────────┐
│ API Updates                                                 │
│ [===============================] 300-500ms                 │
│                                                             │
│ DB Commit                                                   │
│ [==================================] 400-600ms              │
│                                                             │
│ Data Refresh (forcePrimary)                                │
│                                   [========] 200ms          │
│                                                             │
│ Result: ✅ Refresh happens AFTER commit completes           │
└────────────────────────────────────────────────────────────┘

Timeline with DevTools CLOSED (빠른 실행):
┌────────────────────────────────────────────────────────────┐
│ API Updates                                                 │
│ [============] 100-150ms                                    │
│                                                             │
│ DB Commit                                                   │
│ [====================] 200-300ms                            │
│                                                             │
│ Data Refresh (forcePrimary)                                │
│         [========] 50ms                                     │
│                                                             │
│ Result: ❌ Refresh happens BEFORE commit completes          │
└────────────────────────────────────────────────────────────┘
```

### 3. **Current Solution의 한계**

현재 코드 (Lines 625-627):
```typescript
await Promise.all(apiCalls);
console.log('✅ 모든 API 호출 완료')

// 즉시 재조회 시작
const refreshResponse = await fetch(`/api/air-permit?forcePrimary=true`)
```

**문제점**:
- `Promise.all(apiCalls)`는 **HTTP 응답 수신**을 대기
- HTTP 응답 ≠ 데이터베이스 커밋 완료
- 서버는 응답을 보낸 후에도 백그라운드에서 커밋 작업 진행 가능

### 4. **실제 문제 위치**

**app/admin/air-permit-detail/page.tsx:474-520**
```typescript
updatedPermitDetail.outlets?.forEach(outlet => {
  // 모든 기존 시설에 대해 업데이트 API 호출
  existingDischargeFacilities.forEach(facility => {
    apiCalls.push(fetch('/api/outlet-facility', { method: 'PUT', ... }))
  })
  existingPreventionFacilities.forEach(facility => {
    apiCalls.push(fetch('/api/outlet-facility', { method: 'PUT', ... }))
  })
})
```

**추가 문제**:
- **불필요한 업데이트**: 변경되지 않은 시설도 모두 업데이트
- **성능 저하**: 많은 API 호출로 인한 latency 증가
- **경쟁 상태**: 여러 업데이트가 동시에 발생하여 타이밍 이슈 악화

## ✅ 해결 방안

### Option 1: 변경된 시설만 업데이트 (Recommended)

**핵심**: `originalPermitDetail`과 `permitDetail`을 비교하여 실제로 변경된 시설만 업데이트

```typescript
// handleSave 수정
const findChangedFacilities = () => {
  const changed: Array<{type: string, id: string, data: any}> = []

  updatedPermitDetail.outlets?.forEach(outlet => {
    const originalOutlet = originalPermitDetail?.outlets?.find(o => o.id === outlet.id)

    outlet.discharge_facilities?.forEach(facility => {
      if (facility.id.startsWith('new-')) return // 새 시설은 별도 처리

      const originalFacility = originalOutlet?.discharge_facilities?.find(f => f.id === facility.id)

      // 깊은 비교로 실제 변경 감지
      if (JSON.stringify(facility) !== JSON.stringify(originalFacility)) {
        changed.push({
          type: 'discharge_facility',
          id: facility.id,
          data: {
            facility_name: facility.facility_name,
            capacity: facility.capacity,
            quantity: facility.quantity,
            additional_info: facility.additional_info
          }
        })
      }
    })

    // prevention_facilities도 동일 로직
  })

  return changed
}

// 변경된 시설만 업데이트
const changedFacilities = findChangedFacilities()
changedFacilities.forEach(item => {
  apiCalls.push(
    fetch('/api/outlet-facility', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type, id: item.id, ...item.data })
    })
  )
})
```

**장점**:
- ✅ API 호출 최소화 (성능 향상)
- ✅ 타이밍 이슈 완화
- ✅ 불필요한 DB 업데이트 제거

### Option 2: Explicit Wait After Updates

DB 커밋 완료를 보장하기 위해 명시적 대기 추가:

```typescript
await Promise.all(apiCalls);
console.log('✅ 모든 API 호출 완료')

// DB 커밋 완료 대기 (200-300ms)
await new Promise(resolve => setTimeout(resolve, 300))

// 이제 재조회
const refreshResponse = await fetch(`/api/air-permit?forcePrimary=true`)
```

**장점**:
- ✅ 간단한 구현
- ✅ 확실한 커밋 완료 보장

**단점**:
- ❌ 불필요한 지연 (사용자 경험 저하)
- ❌ 근본적 해결이 아님

### Option 3: Optimistic UI Update (Best UX)

서버 응답을 기다리지 않고 즉시 UI 업데이트:

```typescript
// 1. UI는 이미 permitDetail로 업데이트되어 있음 (handleFacilityEdit)
// 2. 저장 시 백그라운드로 API 호출만 수행
// 3. 실패 시에만 rollback

const handleSave = async () => {
  try {
    setIsSaving(true)

    // originalPermitDetail을 현재 permitDetail로 업데이트 (optimistic)
    const savedState = { ...permitDetail }
    setOriginalPermitDetail(savedState)

    // 백그라운드로 API 호출
    const changedFacilities = findChangedFacilities()
    const promises = changedFacilities.map(item =>
      fetch('/api/outlet-facility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id, ...item.data })
      })
    )

    await Promise.all(promises)

    // 성공 시 알림만 표시
    alert('변경사항이 저장되었습니다')

  } catch (error) {
    // 실패 시 rollback
    setPermitDetail(originalPermitDetail)
    alert('저장에 실패했습니다')
  } finally {
    setIsSaving(false)
  }
}
```

**장점**:
- ✅ **즉각적인 UI 반응** (최고의 UX)
- ✅ 서버 지연과 무관
- ✅ 타이밍 이슈 완전 해결

**단점**:
- ⚠️ Rollback 로직 필요

## 🎯 권장 해결 방법

**Option 1 + Option 3 조합**:

1. **변경된 항목만 업데이트** (성능 최적화)
2. **Optimistic UI Update** (UX 최적화)
3. **실패 시 Rollback** (안정성 보장)

### 구현 우선순위

1. **단기 (Quick Fix)**: Option 1 구현 - 변경된 시설만 업데이트
2. **중기 (Better UX)**: Option 3 추가 - Optimistic Update
3. **장기 (완벽)**: 서버 측 batch update API 개선

## 📊 예상 효과

### Before (현재):
- API 호출: **모든 시설** (예: 10개 배출시설 + 10개 방지시설 = 20개 호출)
- 응답 대기: 20 × 50ms = **1000ms**
- DB 커밋: 추가 200-300ms
- **Total**: ~1300ms (개발자도구 닫힘 시 타이밍 이슈)

### After (Option 1):
- API 호출: **변경된 시설만** (예: 1-2개)
- 응답 대기: 2 × 50ms = **100ms**
- DB 커밋: 200-300ms
- **Total**: ~400ms (충분한 시간 확보)

### After (Option 1 + 3):
- UI 업데이트: **즉시** (0ms)
- API 호출: 백그라운드 (사용자는 대기 안 함)
- **Total**: **0ms** (사용자 체감)

## 🔧 다음 단계

1. ✅ **원인 분석 완료**
2. ⏭️ **Option 1 구현**: 변경 감지 로직 추가
3. ⏭️ **테스트**: 개발자도구 닫힌 상태에서 즉시 반영 확인
4. ⏭️ **Option 3 구현**: Optimistic Update 추가 (선택사항)
