# 대리점 칸반보드 이슈 해결 가이드

## 📋 이슈 요약

**문제**: 업무 관리 페이지에서 필터를 "대리점"으로 선택했을 때, 칸반보드에 대리점 전용 4단계 대신 자가시설 단계(설치협의, 제품설치 등)가 표시됨

**원인**: 데이터베이스에 저장된 대리점 업무의 `status` 필드 값이 자가시설 단계 코드(`installation_schedule`, `installation` 등)로 저장되어 있음

**영향**: 대리점 업무가 올바른 칸반보드 컬럼에 표시되지 않음

## 🔍 근본 원인 분석

### 코드 분석 결과

#### 1. 칸반보드 로직 (정상)

[app/admin/tasks/page.tsx:824-828](app/admin/tasks/page.tsx#L824-L828)
```typescript
const steps = selectedType === 'all' ? [...selfSteps, ...subsidySteps, ...dealerSteps, ...etcSteps, ...asSteps] :
              selectedType === 'self' ? selfSteps :
              selectedType === 'subsidy' ? subsidySteps :
              selectedType === 'dealer' ? dealerSteps :  // ✅ 올바르게 dealerSteps 선택
              selectedType === 'etc' ? etcSteps : asSteps
```

- 필터를 "대리점"으로 선택하면 `dealerSteps` (4개 단계)를 올바르게 로드
- 코드 로직에는 문제 없음

#### 2. 데이터베이스 상태 (문제)

실제 DB에 저장된 대리점 업무들의 `status` 필드:
```
task_type = 'dealer'
status = 'installation_schedule'  ❌ (자가시설 단계 코드)
status = 'installation'            ❌ (자가시설 단계 코드)
status = 'product_order'           ❌ (자가시설 단계 코드)
```

**기대값**:
```
status = 'dealer_order_received'      ✅ (발주 수신)
status = 'dealer_invoice_issued'      ✅ (계산서 발행)
status = 'dealer_payment_confirmed'   ✅ (입금 확인)
status = 'dealer_product_ordered'     ✅ (제품 발주)
```

#### 3. 왜 이런 일이 발생했나?

대리점 업무 타입이 최근에 추가되었지만:
1. 기존에 생성된 대리점 업무들은 자가시설 단계 코드를 사용
2. 또는 업무 생성 시 잘못된 단계 코드가 할당됨
3. 데이터 마이그레이션이 실행되지 않음

## 🛠️ 해결 방법

### 1단계: 현재 상태 확인

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- 대리점 업무의 현재 status 분포 확인
SELECT
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY status
ORDER BY count DESC;
```

**예상 결과**: 자가시설 단계 코드들이 섞여 있을 것

### 2단계: 데이터 마이그레이션 실행

Supabase Dashboard → SQL Editor에서 다음 파일 실행:

**파일**: `/database/migrate-dealer-status.sql`

**마이그레이션 규칙**:

| 기존 Status (자가시설) | 새 Status (대리점) | 설명 |
|---|---|---|
| customer_contact, site_inspection, quotation, contract | `dealer_order_received` | 초기 단계 → 발주 수신 |
| deposit_confirm, product_order, product_shipment | `dealer_invoice_issued` | 중간 단계 → 계산서 발행 |
| installation_schedule, installation, balance_payment | `dealer_payment_confirmed` | 설치 단계 → 입금 확인 |
| document_complete | `dealer_product_ordered` | 완료 단계 → 제품 발주 완료 |

**SQL 코드**:
```sql
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
    THEN status  -- 이미 올바른 값인 경우 유지
  ELSE 'dealer_order_received'  -- 기타 예외 → 발주 수신으로 기본값
END
WHERE task_type = 'dealer';
```

### 3단계: 마이그레이션 검증

```sql
-- 마이그레이션 후 상태 확인
SELECT
  status,
  COUNT(*) as count
FROM facility_tasks
WHERE task_type = 'dealer'
GROUP BY status
ORDER BY
  CASE status
    WHEN 'dealer_order_received' THEN 1
    WHEN 'dealer_invoice_issued' THEN 2
    WHEN 'dealer_payment_confirmed' THEN 3
    WHEN 'dealer_product_ordered' THEN 4
    ELSE 5
  END;
```

**기대 결과**:
```
status                       | count
-----------------------------+-------
dealer_order_received        | X
dealer_invoice_issued        | X
dealer_payment_confirmed     | X
dealer_product_ordered       | X
```

### 4단계: UI 검증

1. 업무 관리 페이지 접속: `http://localhost:3000/admin/tasks`
2. 필터를 "대리점"으로 선택
3. 칸반보드에 다음 4개 컬럼만 표시되는지 확인:
   - 발주 수신 (파랑)
   - 계산서 발행 (노랑)
   - 입금 확인 (초록)
   - 제품 발주 (에메랄드)
4. 대리점 업무가 올바른 컬럼에 표시되는지 확인

## 📊 마이그레이션 전후 비교

### Before (문제 상황)
```
칸반보드 컬럼: [발주 수신] [계산서 발행] [입금 확인] [제품 발주]
대리점 업무:   (표시 안됨 또는 잘못된 위치)

DB 상태:
- task_type: 'dealer'
- status: 'installation_schedule' ❌ (자가시설 코드)
```

### After (해결 후)
```
칸반보드 컬럼: [발주 수신] [계산서 발행] [입금 확인] [제품 발주]
대리점 업무:   (올바른 컬럼에 표시)

DB 상태:
- task_type: 'dealer'
- status: 'dealer_payment_confirmed' ✅ (대리점 전용 코드)
```

## 🚨 주의사항

### 롤백 절차

만약 마이그레이션 후 문제가 발생하면:

```sql
-- 롤백 (실행하기 전에 백업 권장)
-- 마이그레이션 전 상태로 복원하려면 별도 백업 필요
```

**권장**: 마이그레이션 실행 전 Supabase에서 데이터베이스 백업 생성

### 향후 예방책

1. **업무 생성 시 검증**: 대리점 업무 생성 시 반드시 대리점 전용 status만 사용
2. **API 레벨 검증**: 백엔드 API에서 task_type과 status 조합 유효성 검사
3. **프론트엔드 제약**: UI에서 잘못된 조합 선택 방지

## ✅ 체크리스트

### 마이그레이션 실행
- [ ] 현재 대리점 업무 status 분포 확인 (1단계)
- [ ] Supabase 데이터베이스 백업 생성
- [ ] `/database/migrate-dealer-status.sql` 실행 (2단계)
- [ ] 마이그레이션 결과 검증 (3단계)
- [ ] UI에서 칸반보드 동작 확인 (4단계)

### 추가 검증
- [ ] 대리점 업무 생성 테스트
- [ ] 대리점 업무 단계 변경 테스트
- [ ] 진행률 계산 확인 (25% → 50% → 75% → 100%)
- [ ] 메모 동기화 동작 확인

## 📁 관련 파일

### 마이그레이션 스크립트
- `/database/migrate-dealer-status.sql` - 상태 코드 마이그레이션 (신규)

### 코드 파일
- `/app/admin/tasks/page.tsx` - 칸반보드 로직 (정상)
- `/app/admin/tasks/types.ts` - dealerSteps 정의 (정상)
- `/lib/task-status-utils.ts` - 한글 매핑 (정상)

### 문서
- `/claudedocs/dealer-task-simplified-design.md` - 4단계 설계 문서
- `/claudedocs/dealer-kanban-issue-fix.md` - 이 문서

---

**작성일**: 2026-01-30
**작성자**: Claude Code
**이슈**: 대리점 칸반보드 단계 오표시
**상태**: 마이그레이션 대기
