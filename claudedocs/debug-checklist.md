# 디버깅 체크리스트

## 🚨 현재 상황

**문제**: 대시보드 매입금액이 ₩163,489,000으로 고정되어 있음 (예상: ₩354,679,000)

**증상**:
- 브라우저 콘솔에 `[DEBUG]` 로그가 전혀 출력되지 않음
- API가 호출되지 않거나, 서버 측 로그가 출력되지 않음

---

## ✅ 확인해야 할 사항

### 1. 서버 콘솔 확인 ⚠️ 가장 중요!

**확인 방법**:
```bash
# 터미널에서 npm run dev 실행 중인 콘솔 확인
# 대시보드 새로고침 시 다음과 같은 로그가 출력되어야 함:
[DEBUG] 정진 P&G: 매입금액 = 1,580,000원 (제조사: 에코센스)
[DEBUG] 2025-07 누적: 50개 사업장, 총 매입 ...원
[DEBUG] 2025-07 최종 집계: 사업장 224개, 총매출 ...원, 총매입 ...원
```

**만약 로그가 안 나온다면**:
→ API가 호출되지 않았거나, 코드가 반영되지 않은 것

---

### 2. 개발 서버 완전 재시작

**현재 방법 (잘못될 수 있음)**:
- Ctrl+C로 종료 후 `npm run dev` 재시작

**권장 방법 (확실한 재시작)**:
```bash
# 1. 서버 프로세스 완전 종료
killall node  # 또는 터미널 창 닫기

# 2. Next.js 캐시 삭제
rm -rf .next

# 3. 깨끗한 상태로 재시작
npm run dev
```

---

### 3. 브라우저 캐시 완전 삭제

**시크릿 모드 + 강제 새로고침**만으로는 부족할 수 있음

**권장 방법**:
1. Chrome 개발자 도구 열기 (F12)
2. Network 탭 클릭
3. **"Disable cache"** 체크박스 선택
4. **"Clear site data"** 또는 **Application → Clear storage**
5. 페이지 새로고침 (Ctrl+Shift+R)

---

### 4. API 직접 호출 테스트

**브라우저 주소창에서 직접 호출**:
```
http://localhost:3000/api/dashboard/revenue?months=2025-07
```

**또는 터미널에서**:
```bash
curl "http://localhost:3000/api/dashboard/revenue?months=2025-07" | jq '.data[] | select(.period == "2025-07")'
```

**예상 결과**:
```json
{
  "period": "2025-07",
  "total_revenue": 919520000,
  "total_cost": 354679000,  // ← 이 값이 163489000이면 문제
  ...
}
```

---

### 5. 코드 변경 확인

**수정된 파일**:
- `/app/api/dashboard/revenue/route.ts` (Line 256: gateway 제거, Line 370-396: DEBUG 로그 추가)

**확인 방법**:
```bash
# 파일이 실제로 수정되었는지 확인
grep -n "DEBUG" /Users/mh.c/claude/facility-manager/app/api/dashboard/revenue/route.ts
```

**예상 출력**:
```
370:      // 🐛 디버깅: 첫 5개 사업장의 매입금액 로그 출력
371:        console.log(`[DEBUG] ${business.business_name}: ...
```

---

## 🔍 근본 원인 분석

### 가능성 1: SSR 캐싱 (Server-Side Rendering)
- Next.js App Router는 기본적으로 서버 컴포넌트를 캐싱함
- `app/admin/page.tsx`가 서버 컴포넌트라면 빌드 시점의 데이터가 캐싱될 수 있음

**해결 방법**:
```typescript
// app/admin/page.tsx 최상단에 추가
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

### 가능성 2: React Query 또는 SWR 캐싱
- 클라이언트 측 데이터 페칭 라이브러리가 응답을 캐싱하고 있을 수 있음

**확인 방법**:
```bash
# package.json에서 확인
grep -E "(react-query|swr|@tanstack)" /Users/mh.c/claude/facility-manager/package.json
```

### 가능성 3: 서비스 워커 캐싱
- PWA 서비스 워커가 API 응답을 캐싱하고 있을 수 있음

**해결 방법**:
1. Chrome DevTools → Application → Service Workers
2. **"Unregister"** 클릭
3. 페이지 새로고침

---

## 📋 체크리스트 순서

**다음 순서대로 확인해주세요**:

1. ✅ **서버 콘솔 확인** → [DEBUG] 로그 출력되는지 확인
   - 출력됨 → 6번으로
   - 출력 안 됨 → 2번으로

2. ✅ **서버 완전 재시작** → killall node + rm -rf .next + npm run dev
   - 다시 1번 확인

3. ✅ **브라우저 캐시 완전 삭제** → Network 탭에서 Disable cache + Clear site data
   - 다시 1번 확인

4. ✅ **API 직접 호출** → 주소창에서 /api/dashboard/revenue?months=2025-07 호출
   - total_cost 값 확인

5. ✅ **서비스 워커 제거** → Application → Service Workers → Unregister
   - 다시 1번 확인

6. ✅ **서버 콘솔에서 total_cost 값 확인**
   - [DEBUG] 로그의 "총매입" 값과 화면의 "매입" 값 비교

---

## 🎯 예상 결과

**정상 작동 시**:
- 서버 콘솔: `[DEBUG] 2025-07 최종 집계: ... 총매입 354,679,000원`
- 브라우저 화면: `매입: ₩354,679,000`

**현재 상태**:
- 서버 콘솔: 로그 없음 또는 `총매입 163,489,000원`
- 브라우저 화면: `매입: ₩163,489,000`

---

**작성자**: Claude Code
**작성일**: 2026-01-15
**상태**: 🔴 디버깅 진행 중
