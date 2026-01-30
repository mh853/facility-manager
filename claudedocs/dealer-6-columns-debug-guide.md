# 대리점 칸반보드 6개 컬럼 이슈 디버깅 가이드

## 📋 문제 상황

**증상**: 업무 관리 페이지에서 필터를 "대리점"으로 선택했을 때, 칸반보드에 6개 컬럼이 표시됨

**기대값**: 4개 컬럼만 표시되어야 함
- 발주 수신
- 계산서 발행
- 입금 확인
- 제품 발주

**실제값**: 6개 컬럼 표시
- 설치협의 ❌ (자가시설 단계)
- 제품설치 ❌ (자가시설 단계)
- 발주 수신 ✅
- 계산서 발행 ✅
- 입금 확인 ✅
- 제품 발주 ✅

## 🔍 디버깅 절차

### 1단계: 브라우저 콘솔 확인

1. 업무 관리 페이지 접속: `http://localhost:3000/admin/tasks`
2. 필터를 "대리점"으로 선택
3. 브라우저 개발자 도구 열기 (F12 또는 Cmd+Option+I)
4. Console 탭에서 다음 로그 찾기:

```
🐛 [KANBAN DEBUG] ==================
🎯 Selected Type: dealer
📋 Dealer Steps Definition: [Array(4)]
📊 uniqueSteps (should equal dealerSteps): [Array(???)]
🔢 uniqueSteps.length: ???
🔢 Expected: 4, Actual: ???
```

**중요 체크포인트**:
- `uniqueSteps.length`가 4가 아니면 코드 로직 문제
- `uniqueSteps.length`가 4이면 데이터베이스 문제

### 2단계: 데이터베이스 상태 확인

Supabase Dashboard → SQL Editor에서 다음 쿼리 실행:

**파일**: `/database/check-dealer-tasks-simple.sql`

```sql
-- 1. 대리점 업무의 status 분포 확인
SELECT
  '=== 대리점 Status 분포 ===' as info,
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY status
ORDER BY count DESC;
```

**기대 결과**: 다음 4개 status만 있어야 함
```
dealer_order_received
dealer_invoice_issued
dealer_payment_confirmed
dealer_product_ordered
```

**문제 상황**: 다음과 같은 status가 있으면 안 됨
```
installation_schedule    ❌ (자가시설 코드)
installation            ❌ (자가시설 코드)
customer_contact        ❌ (자가시설 코드)
product_order           ❌ (자가시설 코드)
등등...
```

### 3단계: 잘못된 Status 확인

```sql
-- 2. 잘못된 status 업무 목록
SELECT
  '=== 잘못된 Status ===' as info,
  id,
  business_name,
  status,
  title
FROM facility_tasks
WHERE task_type = 'dealer'
  AND status NOT LIKE 'dealer_%'
ORDER BY created_at DESC
LIMIT 20;
```

## 🛠️ 해결 방법

### 시나리오 A: 코드 로직 문제 (uniqueSteps.length ≠ 4)

**원인**: `tasksByStatus` useMemo에서 `uniqueSteps` 생성 로직 오류

**해결**:
1. [page.tsx:836-840](app/admin/tasks/page.tsx#L836-L840) 확인
2. `selectedType === 'dealer'` 조건이 올바르게 `dealerSteps`를 반환하는지 확인
3. `uniqueSteps` 생성 로직 (line 843-851) 확인

### 시나리오 B: 데이터베이스 문제 (dealer 업무에 자가시설 status 코드)

**원인**: 마이그레이션이 제대로 실행되지 않았거나, 마이그레이션 후 새로 생성된 업무가 잘못된 status를 가짐

**해결 1**: 마이그레이션 재실행

```sql
-- /database/migrate-dealer-status.sql 재실행
UPDATE facility_tasks
SET status = CASE
  WHEN status IN ('customer_contact', 'site_inspection', 'quotation', 'contract')
    THEN 'dealer_order_received'
  WHEN status IN ('deposit_confirm', 'product_order', 'product_shipment')
    THEN 'dealer_invoice_issued'
  WHEN status IN ('installation_schedule', 'installation', 'balance_payment')
    THEN 'dealer_payment_confirmed'
  WHEN status IN ('document_complete')
    THEN 'dealer_product_ordered'
  WHEN status IN ('dealer_order_received', 'dealer_invoice_issued',
                  'dealer_payment_confirmed', 'dealer_product_ordered')
    THEN status
  ELSE 'dealer_order_received'
END
WHERE task_type = 'dealer';
```

**해결 2**: 특정 업무만 수동 수정

```sql
-- 특정 업무의 status 수정 (ID로 찾기)
UPDATE facility_tasks
SET status = 'dealer_order_received'  -- 올바른 대리점 status로 변경
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  -- 문제가 있는 업무 ID
  AND task_type = 'dealer';
```

### 시나리오 C: 혼합 문제 (코드 + 데이터)

**가능성**:
- 일부 대리점 업무는 올바른 status 가짐
- 일부는 여전히 자가시설 status 가짐
- 칸반보드가 둘 다 표시하려고 함

**해결**:
1. 먼저 데이터베이스 마이그레이션 재실행
2. 브라우저 하드 리프레시 (Cmd+Shift+R 또는 Ctrl+Shift+R)
3. 여전히 문제 있으면 코드 로직 재확인

## 📊 검증 단계

### 1. 데이터베이스 검증

```sql
-- 모든 대리점 업무가 올바른 status를 가지는지 확인
SELECT
  COUNT(*) as total_dealer_tasks,
  COUNT(CASE WHEN status LIKE 'dealer_%' THEN 1 END) as correct_status,
  COUNT(CASE WHEN status NOT LIKE 'dealer_%' THEN 1 END) as incorrect_status
FROM facility_tasks
WHERE task_type = 'dealer';
```

**기대 결과**:
```
total_dealer_tasks | correct_status | incorrect_status
-------------------+----------------+-----------------
 X                 | X              | 0               ← incorrect_status는 0이어야 함
```

### 2. UI 검증

1. 업무 관리 페이지 접속
2. 필터: "대리점" 선택
3. 칸반보드 확인:
   - ✅ 정확히 4개 컬럼만 표시
   - ✅ 컬럼 순서: 발주 수신 → 계산서 발행 → 입금 확인 → 제품 발주
   - ✅ "설치협의", "제품설치" 컬럼 없음

### 3. 업무 생성 테스트

1. "업무 추가" 버튼 클릭
2. 업무 타입: "대리점" 선택
3. 현재 단계 드롭다운 확인:
   - ✅ 4개 옵션만 표시 (발주 수신, 계산서 발행, 입금 확인, 제품 발주)
   - ❌ "설치 협의", "제품 설치" 등 자가시설 단계 없음

4. 대리점 업무 생성 후 상태 확인:
```sql
SELECT * FROM facility_tasks
WHERE task_type = 'dealer'
ORDER BY created_at DESC
LIMIT 1;
```

**기대값**: `status` 필드가 `dealer_` 접두사를 가져야 함

## 🔧 추가 디버깅 도구

### Debug Component 사용 (선택사항)

`/app/admin/tasks/debug-kanban.tsx` 컴포넌트를 page.tsx에 임시로 추가하여 UI에 직접 디버그 정보 표시:

```tsx
import { KanbanDebug } from './debug-kanban'

// 칸반보드 위에 추가
<KanbanDebug
  selectedType={selectedType}
  dealerSteps={dealerSteps}
  tasksByStatus={tasksByStatus}
  filteredTasks={filteredTasks}
/>
```

이렇게 하면 브라우저 화면에 노란색 디버그 패널이 표시되어:
- 실제 컬럼 개수
- 각 status별 업무 개수
- 잘못된 status 하이라이트

## 📝 체크리스트

### 디버깅 완료 확인
- [ ] 브라우저 콘솔에서 `uniqueSteps.length: 4` 확인
- [ ] 데이터베이스에서 모든 dealer 업무가 `dealer_` 접두사 status 가짐
- [ ] 칸반보드에 정확히 4개 컬럼만 표시
- [ ] "설치협의", "제품설치" 컬럼 없음
- [ ] 대리점 업무 생성 시 올바른 status로 저장됨

### 클린업
- [ ] 디버깅 로그 제거 또는 조건부로 변경 (`if (process.env.NODE_ENV === 'development')`)
- [ ] debug-kanban.tsx 컴포넌트 import 제거
- [ ] 변경사항 커밋

## 🚨 알려진 이슈

### 이슈 1: 마이그레이션 후에도 문제 지속
**원인**: 브라우저 캐시 또는 서버 재시작 필요
**해결**:
1. 브라우저 하드 리프레시 (Cmd+Shift+R)
2. Next.js 개발 서버 재시작 (`npm run dev` 중지 후 재시작)

### 이슈 2: 일부 업무만 올바른 status
**원인**: 마이그레이션 이후 수동으로 생성된 업무가 잘못된 status
**해결**: 업무 생성 로직 확인, 드롭다운이 대리점 타입 선택 시 dealerSteps만 표시하는지 확인

### 이슈 3: API 응답에서 이미 잘못된 status
**원인**: 데이터베이스 레벨에서 잘못된 데이터
**해결**: 마이그레이션 재실행 필수

## 📞 다음 단계

문제가 계속되면:
1. 브라우저 콘솔 로그 전체 캡처
2. SQL 쿼리 결과 캡처
3. 문제 재현 단계 상세 기록
4. 스크린샷 첨부

---

**작성일**: 2026-01-30
**버전**: 1.0
**관련 커밋**: 7951804
