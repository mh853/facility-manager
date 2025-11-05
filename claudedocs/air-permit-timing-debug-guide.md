# 대기필증 UI 업데이트 타이밍 디버깅 가이드

## 🔍 문제 진단 절차

### Step 1: 브라우저 콘솔 로그 확인

저장 버튼을 클릭한 후 다음 로그들을 확인하고, **각 로그 사이의 시간 간격**을 측정해주세요:

```
[시작] 💾 handleSave 함수 시작
   ↓ ? 초
🔧 변경된 시설 정보 업데이트 시작
   ↓ ? 초
✅ 모든 API 호출 완료
   ↓ ? 초
🔄 최신 데이터 재조회 시작 (Primary DB 사용)
   ↓ ? 초
🔄 최신 데이터 재조회 완료
   ↓ ? 초
🔍 [DEBUG] 배출구 1 데이터:
   ↓ ? 초
✅ UI 업데이트 완료 - permitDetail이 최신 데이터로 업데이트됨
   ↓ ? 초
[종료] alert 팝업 표시
```

### Step 2: 시간 간격 분석

**정상 범위**:
- handleSave 시작 → API 호출 완료: **150ms 이내**
- API 호출 완료 → 재조회 완료: **150ms 이내**
- 재조회 완료 → UI 업데이트 완료: **10ms 이내**
- **Total: ~300ms**

**비정상 (의심 구간)**:
- 🚨 **10초 이상 소요** → 해당 구간에 문제 있음

---

## 🎯 의심 구간별 원인 및 해결

### Case 1: API 호출 완료가 느림 (10초+)
```
✅ 모든 API 호출 완료  ← 여기까지 10초+
```

**원인**:
- `/api/outlet-facility` API가 느림
- 데이터베이스 쿼리 성능 문제
- 네트워크 지연

**확인 방법**:
- 브라우저 개발자도구 → Network 탭
- `/api/outlet-facility` 요청 찾기
- 응답 시간 확인 (Timing)

**해결**:
- 서버 로그 확인
- 데이터베이스 인덱스 확인
- API 최적화 필요

### Case 2: 재조회가 느림 (10초+)
```
🔄 최신 데이터 재조회 시작
   ↓ 10초+
🔄 최신 데이터 재조회 완료  ← 여기까지 10초+
```

**원인**:
- `/api/air-permit?forcePrimary=true` API가 느림
- Primary DB 조회 성능 문제
- `getAirPermitWithDetails` 함수가 느림

**확인 방법**:
- Network 탭에서 `/api/air-permit` 요청 확인
- 서버 로그에서 시간 측정
- DB 쿼리 성능 분석

**해결**:
- 조인 쿼리 최적화
- 인덱스 추가
- 데이터 캐싱 고려

### Case 3: UI 업데이트가 느림 (10초+)
```
✅ UI 업데이트 완료 - permitDetail이 최신 데이터로 업데이트됨
   ↓ 10초+
[종료] alert 팝업 표시  ← 여기까지 10초+
```

**원인**:
- **setTimeout이 여전히 문제**
- 또는 리렌더링 성능 문제

**확인 방법**:
```typescript
// 이 코드가 실제로 적용되었는지 확인
setTimeout(() => alert('변경사항이 저장되었습니다'), 0)
```

**해결**:
- 코드가 제대로 적용되었는지 확인 (F5 새로고침)
- 개발 서버 재시작

---

## 🧪 정밀 진단 방법

### 추가 로그 삽입

다음 코드를 추가하면 정확한 시간 측정 가능:

```typescript
const handleSave = async () => {
  const startTime = performance.now()
  console.log(`[TIME] handleSave 시작: ${startTime}ms`)

  try {
    // ... 기존 코드 ...

    await Promise.all(apiCalls)
    console.log(`[TIME] API 호출 완료: ${performance.now() - startTime}ms`)

    const refreshResponse = await fetch(...)
    console.log(`[TIME] 재조회 시작: ${performance.now() - startTime}ms`)

    const refreshData = await refreshResponse.json()
    console.log(`[TIME] 재조회 완료: ${performance.now() - startTime}ms`)

    flushSync(() => {
      setPermitDetail(refreshData.data)
      setOriginalPermitDetail(refreshData.data)
    })
    console.log(`[TIME] flushSync 완료: ${performance.now() - startTime}ms`)

    setGatewayAssignments(newAssignments)
    console.log(`[TIME] 게이트웨이 할당 완료: ${performance.now() - startTime}ms`)

    setTimeout(() => {
      console.log(`[TIME] alert 표시: ${performance.now() - startTime}ms`)
      alert('변경사항이 저장되었습니다')
    }, 0)

  } catch (error) {
    console.error('Error:', error)
  }
}
```

---

## 📊 예상 타이밍 (정상)

```
[TIME] handleSave 시작: 0ms
[TIME] API 호출 완료: 152ms
[TIME] 재조회 시작: 153ms
[TIME] 재조회 완료: 294ms
[TIME] flushSync 완료: 295ms
[TIME] 게이트웨이 할당 완료: 296ms
[TIME] alert 표시: 300ms
```

---

## 🚨 비정상 케이스

### Case A: API 호출이 느림
```
[TIME] handleSave 시작: 0ms
[TIME] API 호출 완료: 10000ms  ← 🚨 10초!
```
→ `/api/outlet-facility` 최적화 필요

### Case B: 재조회가 느림
```
[TIME] handleSave 시작: 0ms
[TIME] API 호출 완료: 152ms
[TIME] 재조회 시작: 153ms
[TIME] 재조회 완료: 10153ms  ← 🚨 10초!
```
→ `/api/air-permit` 최적화 필요

### Case C: alert가 여전히 차단
```
[TIME] handleSave 시작: 0ms
[TIME] API 호출 완료: 152ms
[TIME] 재조회 완료: 294ms
[TIME] flushSync 완료: 295ms
[TIME] 게이트웨이 할당 완료: 296ms
(30초 후)
[TIME] alert 표시: 30296ms  ← 🚨 30초!
```
→ setTimeout 코드가 적용 안 됨

---

## ✅ 다음 단계

1. **브라우저 새로고침** (F5) - 코드 변경 적용 확인
2. **콘솔 로그 확인** - 위 타이밍 측정
3. **Network 탭 확인** - API 응답 시간 측정
4. **결과 공유** - 어느 구간이 느린지 알려주세요

---

## 🔧 즉시 확인할 사항

### 1. setTimeout 코드 적용 확인
```javascript
// 브라우저 콘솔에서 직접 확인:
// F12 → Sources 탭 → page.tsx 파일 열기
// Line 762 근처 확인:
setTimeout(() => alert('변경사항이 저장되었습니다'), 0)
```

이 코드가 없으면 → 아직 변경사항이 적용 안 된 것!

### 2. 개발 서버 재시작
```bash
# 개발 서버 종료 (Ctrl+C)
# 다시 시작
npm run dev
```

### 3. 브라우저 캐시 완전 삭제
```
Ctrl+Shift+Delete
→ "캐시된 이미지 및 파일" 선택
→ 삭제
```
