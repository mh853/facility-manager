# 보조금 승인 단계 추가 구현 완료 보고서

## 개요
보조금 업무 워크플로우에 **승인 단계** (승인대기, 승인, 탈락)를 추가하고 모든 단계에 색상을 지정하여 칸반보드에서 구분할 수 있도록 개선했습니다.

## 변경 사항

### 1. TypeScript 타입 업데이트 ✅
**파일**: `app/admin/tasks/page.tsx`

#### TaskStatus 타입에 새 단계 추가 (Line 47-66):
```typescript
type TaskStatus =
  // 공통 단계
  | 'pending' | 'site_survey' | 'customer_contact' | 'site_inspection' | 'quotation' | 'contract'
  // 자비 단계
  | 'deposit_confirm' | 'product_order' | 'product_shipment' | 'installation_schedule'
  | 'installation' | 'balance_payment' | 'document_complete'
  // 보조금 단계
  | 'approval_pending' | 'approved' | 'rejected'  // ← 새로 추가
  | 'application_submit' | 'document_supplement' | 'document_preparation' | 'pre_construction_inspection'
  // 착공 보완 세분화
  | 'pre_construction_supplement_1st' | 'pre_construction_supplement_2nd'
  | 'completion_inspection'
  // 준공 보완 세분화
  | 'completion_supplement_1st' | 'completion_supplement_2nd' | 'completion_supplement_3rd'
  | 'final_document_submit' | 'subsidy_payment'
```

#### subsidySteps 배열 업데이트 (Line 136-162):
새 단계 추가 및 모든 단계에 고유 색상 지정:
- `approval_pending` (승인대기) - sky 색상
- `approved` (승인) - lime 색상
- `rejected` (탈락) - red 색상

각 보완 단계도 고유 색상으로 변경:
- 착공 보완 1차: rose
- 착공 보완 2차: fuchsia
- 준공 보완 1차: slate
- 준공 보완 2차: zinc
- 준공 보완 3차: stone

### 2. 데이터베이스 스키마 업데이트 ⚠️ (실행 필요)
**파일**: `sql/update_tasks_add_approval_steps.sql`

Supabase SQL Editor에서 실행해야 할 SQL:
```sql
-- 1. 기존 제약조건 제거
ALTER TABLE facility_tasks DROP CONSTRAINT IF EXISTS facility_tasks_status_check;

-- 2. 새 제약조건 추가 (승인 단계 포함)
ALTER TABLE facility_tasks ADD CONSTRAINT facility_tasks_status_check
CHECK (status IN (
  -- 공통 단계
  'customer_contact', 'site_inspection', 'quotation', 'contract',
  -- 자비 설치 단계
  'deposit_confirm', 'product_order', 'product_shipment', 'installation_schedule',
  'installation', 'balance_payment', 'document_complete',
  -- 보조금 전용 단계 (승인 단계 포함)
  'approval_pending', 'approved', 'rejected',
  'application_submit', 'document_supplement', 'document_preparation', 'pre_construction_inspection',
  -- 착공 보완 세분화
  'pre_construction_supplement_1st', 'pre_construction_supplement_2nd',
  'completion_inspection',
  -- 준공 보완 세분화
  'completion_supplement_1st', 'completion_supplement_2nd', 'completion_supplement_3rd',
  'final_document_submit', 'subsidy_payment'
));
```

### 3. PostgreSQL 함수 업데이트 ⚠️ (실행 필요)
**파일**: `sql/update_advance_function_with_approval.sql`

`advance_task_to_next_step` 함수를 승인 워크플로우를 포함하도록 업데이트:

**새로운 보조금 워크플로우**:
```
견적서 작성 → 승인대기 → 승인 → 신청서 제출 → ...
                  ↓
                탈락 (종료)
```

주요 변경사항:
- `quotation` → `approval_pending`
- `approval_pending` → `approved`
- `approved` → `application_submit`
- `rejected` → NULL (종료 상태, 다음 단계 없음)

## 워크플로우 다이어그램

### 보조금 업무 전체 흐름
```
1. 고객 상담 (customer_contact)
2. 현장 실사 (site_inspection)
3. 견적서 작성 (quotation)
4. 신청서 제출 (application_submit)
5. 보조금 승인대기 (approval_pending) ⭐ 새로 추가
6. 보조금 승인 (approved) ⭐ 새로 추가
   또는
   보조금 탈락 (rejected) ⭐ 새로 추가 (종료)
7. 서류 보완 (document_supplement)
8. 서류 준비 (document_preparation)
9. 착공 전 실사 (pre_construction_inspection)
10. 착공 보완 1차 (pre_construction_supplement_1st)
11. 착공 보완 2차 (pre_construction_supplement_2nd)
12. 제품 발주 (product_order)
13. 제품 출고 (product_shipment)
14. 설치 협의 (installation_schedule)
15. 제품 설치 (installation)
16. 준공 실사 (completion_inspection)
17. 준공 보완 1차 (completion_supplement_1st)
18. 준공 보완 2차 (completion_supplement_2nd)
19. 준공 보완 3차 (completion_supplement_3rd)
20. 서류 제출 (final_document_submit)
21. 보조금 입금 (subsidy_payment)
```

## 색상 매핑표

| 단계 | 영문명 | 색상 | Tailwind Class |
|------|--------|------|----------------|
| 고객 상담 | customer_contact | Blue | bg-blue-500 |
| 현장 실사 | site_inspection | Yellow | bg-yellow-500 |
| 견적서 작성 | quotation | Orange | bg-orange-500 |
| 신청서 제출 | application_submit | Purple | bg-purple-500 |
| **보조금 승인대기** | **approval_pending** | **Sky** | **bg-sky-500** |
| **보조금 승인** | **approved** | **Lime** | **bg-lime-500** |
| **보조금 탈락** | **rejected** | **Red** | **bg-red-500** |
| 서류 보완 | document_supplement | Pink | bg-pink-500 |
| 서류 준비 | document_preparation | Amber | bg-amber-500 |
| 착공 전 실사 | pre_construction_inspection | Indigo | bg-indigo-500 |
| 착공 보완 1차 | pre_construction_supplement_1st | Rose | bg-rose-500 |
| 착공 보완 2차 | pre_construction_supplement_2nd | Fuchsia | bg-fuchsia-500 |
| 제품 발주 | product_order | Cyan | bg-cyan-500 |
| 제품 출고 | product_shipment | Emerald | bg-emerald-500 |
| 설치 협의 | installation_schedule | Teal | bg-teal-500 |
| 제품 설치 | installation | Green | bg-green-500 |
| 준공 실사 | completion_inspection | Violet | bg-violet-500 |
| 준공 보완 1차 | completion_supplement_1st | Slate | bg-slate-500 |
| 준공 보완 2차 | completion_supplement_2nd | Zinc | bg-zinc-500 |
| 준공 보완 3차 | completion_supplement_3rd | Stone | bg-stone-500 |
| 서류 제출 | final_document_submit | Gray | bg-gray-500 |
| 보조금 입금 | subsidy_payment | Green | bg-green-500 |

## 데이터베이스 마이그레이션 절차

### 필수 실행 순서:

#### 1단계: CHECK 제약조건 업데이트
```bash
# Supabase Dashboard → SQL Editor
# sql/update_tasks_add_approval_steps.sql 파일 내용 실행
```

#### 2단계: PostgreSQL 함수 업데이트
```bash
# Supabase Dashboard → SQL Editor
# sql/update_advance_function_with_approval.sql 파일 내용 실행
```

### 실행 확인:
```sql
-- 제약조건 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'facility_tasks'::regclass
  AND conname = 'facility_tasks_status_check';

-- 함수 확인
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'advance_task_to_next_step';
```

## 테스트 체크리스트

### 프론트엔드 테스트 ✅
- [x] TypeScript 컴파일 성공
- [x] 개발 서버 정상 실행 (http://localhost:3001)
- [x] 업무 관리 페이지 로드 성공 (/admin/tasks)
- [ ] 칸반보드에서 새 단계 컬럼 표시 확인
- [ ] 각 단계별 색상 구분 확인

### 백엔드 테스트 ⚠️ (DB 마이그레이션 후)
- [ ] 새 승인 단계로 업무 생성 가능
- [ ] 완료 버튼으로 다음 단계 이동 확인:
  - [ ] 견적서 작성 → 승인대기
  - [ ] 승인대기 → 승인
  - [ ] 승인 → 신청서 제출
- [ ] 탈락 상태에서 완료 버튼 비활성화 확인
- [ ] 모든 보완 단계 이동 정상 작동 확인

## 사용자 가이드

### 승인 단계 사용법:

1. **보조금 승인대기**: 신청서를 제출한 후 정부/지자체의 승인을 기다리는 상태
   - 신청서 제출 완료 후 "완료" 버튼 클릭 → 자동으로 보조금 승인대기로 이동

2. **보조금 승인**: 정부/지자체가 보조금을 승인한 상태
   - 승인대기 단계에서 "완료" 버튼 클릭 → 보조금 승인으로 이동
   - 승인 후 "완료" 버튼 클릭 → 서류 보완 단계로 진행

3. **보조금 탈락**: 보조금 신청이 거절된 상태
   - 수동으로 탈락 상태로 변경 가능
   - 탈락 상태에서는 더 이상 진행 불가 (종료 상태)

## 참고 사항

- **기존 데이터 영향**: 현재 진행 중인 업무는 영향받지 않습니다. 새로운 단계는 앞으로 생성되는 업무에만 적용됩니다.
- **색상 변경**: 준공 보완 단계의 색상이 더 구분하기 쉽게 변경되었습니다 (purple/blue/indigo → slate/zinc/stone)
- **워크플로우 분기**: 승인대기 → 승인 또는 탈락으로 분기 가능
- **종료 상태**: 탈락 상태는 종료 상태로, 다음 단계로 진행할 수 없습니다

## 다음 단계

1. ⚠️ **Supabase에서 SQL 마이그레이션 실행** (필수)
   - `sql/update_tasks_add_approval_steps.sql`
   - `sql/update_advance_function_with_approval.sql`

2. 테스트 및 검증
   - 새 승인 단계로 업무 생성
   - 완료 버튼으로 워크플로우 전환 확인
   - 색상 구분 확인

3. 사용자 교육
   - 새 승인 단계 사용법 안내
   - 탈락 상태 처리 방법 교육

## 파일 변경 이력

### 수정된 파일:
- `app/admin/tasks/page.tsx` - TaskStatus 타입 및 subsidySteps 배열 업데이트

### 생성된 파일:
- `sql/update_tasks_add_approval_steps.sql` - DB 제약조건 업데이트
- `sql/update_advance_function_with_approval.sql` - PostgreSQL 함수 업데이트
- `claudedocs/subsidy-approval-workflow-implementation.md` - 이 문서

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: 1.0
