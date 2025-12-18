# 안전한 연속 삭제 시스템 설계

## 문제 정의
연속적으로 여러 항목을 빠르게 삭제할 때 발생할 수 있는 문제:
- Race condition으로 인한 상태 불일치
- 첫 번째 삭제 실패 시 나머지 낙관적 업데이트 손실
- API 응답 순서와 삭제 순서 불일치

## 해결 방안 1: 삭제 큐 + 배치 상태 업데이트 ⭐ 권장

### 설계 원칙
1. **즉시 UI 반영**: 사용자 클릭 즉시 UI에서 제거 (낙관적 업데이트)
2. **독립적 삭제**: 각 삭제 요청은 독립적으로 서버에 전송
3. **안전한 롤백**: 실패 시 해당 항목만 복원

### 구현 상세

```typescript
// 1. 삭제 상태 관리
const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())

// 2. 안전한 삭제 함수
const handleDeleteSafe = async (business: UnifiedBusinessInfo) => {
  const businessId = business.id

  // 이미 삭제 진행 중이면 무시
  if (pendingDeletions.has(businessId)) {
    console.log('⚠️ 이미 삭제 진행 중:', businessId)
    return
  }

  // 확인 모달 표시
  if (!confirm(`'${business.business_name}' 사업장을 정말 삭제하시겠습니까?`)) {
    return
  }

  try {
    // 1️⃣ 삭제 진행 중 상태 추가
    setPendingDeletions(prev => new Set(prev).add(businessId))

    // 2️⃣ 낙관적 UI 업데이트 (즉시 제거)
    setAllBusinesses(prev => prev.filter(b => b.id !== businessId))

    // 3️⃣ 서버 삭제 요청
    const response = await fetch('/api/business-info', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: businessId }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || '삭제 실패')
    }

    // 4️⃣ 성공: 진행 중 상태만 제거 (UI는 이미 업데이트됨)
    console.log('✅ 삭제 성공:', businessId)
    toast.success('사업장 삭제 완료', `${business.business_name}이(가) 삭제되었습니다.`)

  } catch (error) {
    // 5️⃣ 실패: 해당 항목만 복원
    console.error('❌ 삭제 실패 - 항목 복원:', businessId, error)

    // 서버에서 최신 데이터 가져와서 복원
    try {
      const fetchResponse = await fetch(`/api/business-info?id=${businessId}`)
      const fetchResult = await fetchResponse.json()

      if (fetchResult.success && fetchResult.data) {
        setAllBusinesses(prev => [...prev, fetchResult.data])
        toast.error('삭제 실패', `${business.business_name} 삭제에 실패했습니다.`)
      } else {
        // 서버에서 가져오기 실패 시 전체 리로드
        await loadAllBusinesses()
        toast.error('삭제 실패', '데이터를 다시 불러왔습니다.')
      }
    } catch (restoreError) {
      // 복원 실패 시 전체 리로드
      console.error('❌ 복원 실패 - 전체 리로드:', restoreError)
      await loadAllBusinesses()
      toast.error('삭제 실패', '데이터를 다시 불러왔습니다.')
    }

  } finally {
    // 6️⃣ 진행 중 상태 제거
    setPendingDeletions(prev => {
      const next = new Set(prev)
      next.delete(businessId)
      return next
    })
  }
}
```

### 연속 삭제 시나리오 검증

```typescript
// 시나리오: A, B, C를 빠르게 연속 삭제

// t=0ms: A 삭제 클릭
pendingDeletions: {A}
allBusinesses: [B, C, D, E]  // A 즉시 제거
API: DELETE A 요청 시작...

// t=100ms: B 삭제 클릭
pendingDeletions: {A, B}
allBusinesses: [C, D, E]  // B 즉시 제거 (A는 이미 없음)
API: DELETE B 요청 시작...

// t=200ms: C 삭제 클릭
pendingDeletions: {A, B, C}
allBusinesses: [D, E]  // C 즉시 제거
API: DELETE C 요청 시작...

// t=500ms: B 삭제 성공 응답
pendingDeletions: {A, C}  // B만 제거
allBusinesses: [D, E]  // 변화 없음 (이미 제거됨)
✅ 토스트: "B 삭제 완료"

// t=600ms: A 삭제 실패 응답
pendingDeletions: {C}  // A 제거
// A만 복원 (서버에서 최신 데이터 가져오기)
allBusinesses: [A, D, E]  // A 복원, B는 그대로 삭제 상태
❌ 토스트: "A 삭제 실패"

// t=700ms: C 삭제 성공 응답
pendingDeletions: {}  // C 제거
allBusinesses: [A, D, E]  // 변화 없음 (C는 이미 제거됨)
✅ 토스트: "C 삭제 완료"

// 최종 결과: A는 복원, B와 C는 삭제됨 ✅
```

## 해결 방안 2: useBusinessData 훅 통합 (더 복잡)

현재 `useBusinessData` 훅을 사용하고 있으므로, 훅 내부에서 삭제 상태를 관리하는 방법도 고려할 수 있습니다.

```typescript
// hooks/useBusinessData.ts 내부
const deleteBusinessOptimistic = async (businessId: string) => {
  // 낙관적 업데이트
  setAllBusinesses(prev => prev.filter(b => b.id !== businessId))

  try {
    await apiDelete(businessId)
  } catch (error) {
    // 실패 시 refetch로 전체 복원
    await refetch()
    throw error
  }
}
```

**단점**: 훅 내부 로직 수정 필요, 커스텀 에러 처리 어려움

## 해결 방안 3: 삭제 요청 직렬화 (사용자 경험 저하)

```typescript
// 삭제 큐를 순차적으로 처리
const deleteQueue = useRef<string[]>([])
const isDeleting = useRef(false)

const processDeleteQueue = async () => {
  if (isDeleting.current || deleteQueue.current.length === 0) return

  isDeleting.current = true
  const businessId = deleteQueue.current.shift()!

  await handleDelete(businessId)

  isDeleting.current = false
  processDeleteQueue() // 다음 삭제 처리
}
```

**단점**: 느린 삭제 경험 (연속 3개 삭제 시 순차 대기)

## 권장 구현: 해결 방안 1

### 장점
✅ **즉시 반영**: 각 삭제가 즉시 UI에 반영
✅ **독립적 처리**: 각 삭제가 독립적으로 처리 (A 실패해도 B, C는 정상 삭제)
✅ **안전한 롤백**: 실패한 항목만 선택적으로 복원
✅ **중복 방지**: `pendingDeletions` Set으로 중복 클릭 방지
✅ **좋은 UX**: 토스트 메시지로 각 삭제 결과 개별 피드백

### 단점
⚠️ **약간의 복잡성**: 상태 관리가 조금 더 복잡
⚠️ **복원 API 필요**: 실패 시 항목 복원을 위한 fetch 로직 추가

## 추가 최적화 사항

### 1. 삭제 버튼 비활성화 표시
```typescript
// 삭제 진행 중인 항목은 시각적으로 표시
<button
  disabled={pendingDeletions.has(business.id)}
  className={pendingDeletions.has(business.id) ? 'opacity-50 cursor-not-allowed' : ''}
>
  {pendingDeletions.has(business.id) ? '삭제 중...' : '삭제'}
</button>
```

### 2. 배치 삭제 기능 (선택 사항)
여러 항목을 선택 후 한 번에 삭제하는 경우:

```typescript
const handleBatchDelete = async (businessIds: string[]) => {
  // 모든 항목 낙관적 업데이트
  setAllBusinesses(prev => prev.filter(b => !businessIds.includes(b.id)))

  // 병렬로 삭제 요청
  const results = await Promise.allSettled(
    businessIds.map(id => fetch('/api/business-info', {
      method: 'DELETE',
      body: JSON.stringify({ id })
    }))
  )

  // 실패한 항목만 복원
  const failedIds = results
    .map((r, i) => r.status === 'rejected' ? businessIds[i] : null)
    .filter(Boolean)

  if (failedIds.length > 0) {
    await loadAllBusinesses() // 실패 항목이 있으면 전체 리로드
  }
}
```

### 3. 낙관적 업데이트 시간 제한
```typescript
// 5초 이상 API 응답이 없으면 경고
const deleteTimeout = setTimeout(() => {
  if (pendingDeletions.has(businessId)) {
    toast.warning('삭제 처리 중', '삭제 요청이 처리되고 있습니다...')
  }
}, 5000)
```

## 결론

**권장 방안**: 해결 방안 1 (삭제 큐 + 독립적 롤백)

연속 삭제 시나리오에서도 안전하게 작동하며, 각 삭제의 성공/실패를 독립적으로 처리할 수 있습니다.

구현하시겠습니까?
