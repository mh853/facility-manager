# 대리점 업무 타입 추가 설계

## 📋 개요

**목표**: 시설 업무 관리 시스템에 "대리점" (Dealer/Agency) 업무 타입 추가

**영문 코드**: `dealer`

**한글 명칭**: `대리점`

## 🎯 요구사항

### 기능 요구사항
1. 새로운 업무 타입 "대리점" 추가
2. 대리점 업무 전용 워크플로우 단계 정의
3. 칸반보드에 대리점 타입 표시
4. 업무 생성/수정 시 대리점 타입 선택 가능
5. 엑셀 일괄 등록에서 대리점 타입 지원

### 비기능 요구사항
- 기존 업무 타입(자가시설, 보조금, A/S)와 일관성 유지
- 하위 호환성 보장 (기존 데이터 영향 없음)
- UI/UX 일관성 유지

## 📊 대리점 워크플로우 정의

### 워크플로우 단계 (dealerSteps)

대리점 업무는 **자가시설 워크플로우와 유사**하지만 대리점 특성을 반영한 단계 구성:

```typescript
export const dealerSteps: StepInfo[] = [
  { status: 'dealer_contact', label: '대리점 접수', color: 'blue' },
  { status: 'dealer_site_inspection', label: '현장 실사', color: 'yellow' },
  { status: 'dealer_quotation', label: '견적 확정', color: 'orange' },
  { status: 'dealer_contract', label: '계약 체결', color: 'purple' },
  { status: 'dealer_deposit_confirm', label: '계약금 확인', color: 'indigo' },
  { status: 'product_order', label: '제품 발주', color: 'cyan' },        // 자가시설과 동일
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },   // 자가시설과 동일
  { status: 'installation_schedule', label: '설치 협의', color: 'teal' }, // 자가시설과 동일
  { status: 'installation', label: '제품 설치', color: 'green' },         // 자가시설과 동일
  { status: 'dealer_balance_payment', label: '잔금 입금', color: 'lime' },
  { status: 'dealer_settlement', label: '대리점 정산', color: 'emerald' },
  { status: 'document_complete', label: '서류 발송 완료', color: 'green' } // 자가시설과 동일
]
```

### 단계 설명

| 단계 코드 | 한글 명칭 | 설명 | 자가시설과 차이점 |
|-----------|-----------|------|-------------------|
| `dealer_contact` | 대리점 접수 | 대리점으로부터 업무 접수 | 고객 상담 → 대리점 접수 |
| `dealer_site_inspection` | 현장 실사 | 현장 실사 진행 | 동일 (네이밍만 구분) |
| `dealer_quotation` | 견적 확정 | 대리점과 견적 확정 | 견적서 작성 → 견적 확정 |
| `dealer_contract` | 계약 체결 | 대리점 계약 체결 | 동일 (네이밍만 구분) |
| `dealer_deposit_confirm` | 계약금 확인 | 계약금 입금 확인 | 동일 (네이밍만 구분) |
| `product_order` | 제품 발주 | 제품 발주 처리 | **완전 동일** |
| `product_shipment` | 제품 출고 | 제품 출고 처리 | **완전 동일** |
| `installation_schedule` | 설치 협의 | 설치 일정 협의 | **완전 동일** |
| `installation` | 제품 설치 | 제품 설치 완료 | **완전 동일** |
| `dealer_balance_payment` | 잔금 입금 | 잔금 입금 확인 | 동일 (네이밍만 구분) |
| `dealer_settlement` | 대리점 정산 | 대리점 수수료 정산 | **대리점 전용 단계** |
| `document_complete` | 서류 발송 완료 | 완료 서류 발송 | **완전 동일** |

### 워크플로우 특징

- **총 12단계**: 자가시설(11단계)보다 1단계 많음 (대리점 정산 단계 추가)
- **공통 단계**: 제품 발주 ~ 제품 설치 구간은 자가시설과 완전 동일
- **대리점 특화**: 접수, 견적, 정산 단계에서 대리점 비즈니스 로직 반영

## 🗂️ 파일별 수정 사항

### 1. `/lib/task-status-utils.ts`

**수정 내용**: 상태 매핑 및 업무 타입 추가

```typescript
// 업무 상태 한글 매핑 - 추가 항목
export const TASK_STATUS_KR: { [key: string]: string } = {
  // ... 기존 항목 유지 ...

  // 대리점 업무 단계 (NEW)
  'dealer_contact': '대리점 접수',
  'dealer_site_inspection': '현장 실사',
  'dealer_quotation': '견적 확정',
  'dealer_contract': '계약 체결',
  'dealer_deposit_confirm': '계약금 확인',
  'dealer_balance_payment': '잔금 입금',
  'dealer_settlement': '대리점 정산',

  // ... 기존 항목 유지 ...
};

// 업무 타입 한글 매핑 - 추가 항목
export const TASK_TYPE_KR: { [key: string]: string } = {
  'self': '자가시설',
  'subsidy': '보조금',
  'as': 'A/S',
  'dealer': '대리점'  // NEW
};
```

**getStatusColor 함수 업데이트**:

```typescript
export function getStatusColor(status: string): string {
  const colorMap: { [key: string]: string } = {
    // ... 기존 항목 유지 ...

    // 대리점 전용 단계 (NEW)
    'dealer_contact': 'bg-blue-100 text-blue-800',
    'dealer_site_inspection': 'bg-yellow-100 text-yellow-800',
    'dealer_quotation': 'bg-orange-100 text-orange-800',
    'dealer_contract': 'bg-purple-100 text-purple-800',
    'dealer_deposit_confirm': 'bg-indigo-100 text-indigo-800',
    'dealer_balance_payment': 'bg-lime-100 text-lime-800',
    'dealer_settlement': 'bg-emerald-100 text-emerald-800',
  };

  return colorMap[status] || 'bg-gray-100 text-gray-800';
}
```

---

### 2. `/app/admin/tasks/types.ts`

**수정 내용**: 타입 정의 및 단계 상수 추가

```typescript
// 타입 정의 업데이트
export type TaskType = 'self' | 'subsidy' | 'etc' | 'as' | 'dealer'  // dealer 추가

export type TaskStatus =
  // ... 기존 상태 유지 ...

  // 대리점 단계 (NEW)
  | 'dealer_contact' | 'dealer_site_inspection' | 'dealer_quotation' | 'dealer_contract'
  | 'dealer_deposit_confirm' | 'dealer_balance_payment' | 'dealer_settlement'

  // ... 기존 상태 유지 ...

// 상태별 단계 정의 (대리점) - NEW
export const dealerSteps: StepInfo[] = [
  { status: 'dealer_contact', label: '대리점 접수', color: 'blue' },
  { status: 'dealer_site_inspection', label: '현장 실사', color: 'yellow' },
  { status: 'dealer_quotation', label: '견적 확정', color: 'orange' },
  { status: 'dealer_contract', label: '계약 체결', color: 'purple' },
  { status: 'dealer_deposit_confirm', label: '계약금 확인', color: 'indigo' },
  { status: 'product_order', label: '제품 발주', color: 'cyan' },
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },
  { status: 'installation_schedule', label: '설치 협의', color: 'teal' },
  { status: 'installation', label: '제품 설치', color: 'green' },
  { status: 'dealer_balance_payment', label: '잔금 입금', color: 'lime' },
  { status: 'dealer_settlement', label: '대리점 정산', color: 'emerald' },
  { status: 'document_complete', label: '서류 발송 완료', color: 'green' }
]
```

**유틸리티 함수 업데이트**:

```typescript
export const calculateProgressPercentage = (type: TaskType, status: TaskStatus): number => {
  const steps = type === 'self' ? selfSteps :
                type === 'subsidy' ? subsidySteps :
                type === 'dealer' ? dealerSteps :  // NEW
                type === 'etc' ? etcSteps : asSteps
  // ... 나머지 로직 동일 ...
}

export const getStepsByType = (type: TaskType): StepInfo[] => {
  switch (type) {
    case 'self':
      return selfSteps
    case 'subsidy':
      return subsidySteps
    case 'dealer':        // NEW
      return dealerSteps  // NEW
    case 'as':
      return asSteps
    case 'etc':
    default:
      return etcSteps
  }
}
```

---

### 3. `/app/admin/tasks/page.tsx`

**수정 내용**: UI에 대리점 타입 선택 옵션 추가

**업무 타입 선택 섹션 업데이트** (라인 ~930):

```typescript
{/* 업무 타입 */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    업무 타입 <span className="text-red-500">*</span>
  </label>
  <div className="grid grid-cols-2 gap-2">
    {/* 자가시설 */}
    <button
      type="button"
      onClick={() => {
        setFormData({ ...formData, type: 'self', status: 'customer_contact' })
        setAvailableStatuses(selfSteps)
      }}
      className={`px-4 py-2 rounded-lg border-2 transition-all ${
        formData.type === 'self'
          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
          : 'border-gray-300 hover:border-blue-300'
      }`}
    >
      자가시설
    </button>

    {/* 보조금 */}
    <button
      type="button"
      onClick={() => {
        setFormData({ ...formData, type: 'subsidy', status: 'customer_contact' })
        setAvailableStatuses(subsidySteps)
      }}
      className={`px-4 py-2 rounded-lg border-2 transition-all ${
        formData.type === 'subsidy'
          ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
          : 'border-gray-300 hover:border-green-300'
      }`}
    >
      보조금
    </button>

    {/* A/S */}
    <button
      type="button"
      onClick={() => {
        setFormData({ ...formData, type: 'as', status: 'as_customer_contact' })
        setAvailableStatuses(asSteps)
      }}
      className={`px-4 py-2 rounded-lg border-2 transition-all ${
        formData.type === 'as'
          ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
          : 'border-gray-300 hover:border-purple-300'
      }`}
    >
      A/S
    </button>

    {/* 대리점 - NEW */}
    <button
      type="button"
      onClick={() => {
        setFormData({ ...formData, type: 'dealer', status: 'dealer_contact' })
        setAvailableStatuses(dealerSteps)
      }}
      className={`px-4 py-2 rounded-lg border-2 transition-all ${
        formData.type === 'dealer'
          ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
          : 'border-gray-300 hover:border-orange-300'
      }`}
    >
      대리점
    </button>
  </div>
</div>
```

**import 구문 업데이트** (상단):

```typescript
import { selfSteps, subsidySteps, asSteps, dealerSteps, etcSteps } from './types'
```

---

### 4. `/app/api/admin/tasks/bulk-upload/route.ts`

**수정 내용**: 엑셀 업로드 시 "대리점" 타입 인식

**한글→영문 코드 변환 매핑 업데이트** (라인 58-64):

```typescript
const REVERSE_TASK_TYPE_MAP: { [key: string]: string } = {
  '자가': 'self',
  '자가시설': 'self',
  '보조금': 'subsidy',
  'AS': 'as',
  'A/S': 'as',
  '대리점': 'dealer'  // NEW
};
```

---

### 5. `/components/tasks/BusinessInfoPanel.tsx`

**수정 내용**: 대리점 타입 메모 동기화 지원

**변경 불필요**: 이미 task_type 필드를 동적으로 처리하므로 자동 지원됨.

---

### 6. `/components/business/modals/BusinessDetailModal.tsx`

**수정 내용**: 대리점 메모 배지 표시

**변경 불필요**: source_type, task_type 기반 로직이므로 자동 지원됨.

---

### 7. 데이터베이스 스키마

**변경 불필요**:
- `facility_tasks.task_type` 컬럼은 VARCHAR 타입이므로 새 값 'dealer' 저장 가능
- CHECK 제약조건이 없다면 마이그레이션 불필요
- CHECK 제약조건이 있다면 ALTER TABLE 필요 (확인 필요)

**확인 쿼리**:

```sql
-- 제약조건 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'facility_tasks'::regclass
  AND contype = 'c';
```

**만약 CHECK 제약조건이 있다면**:

```sql
-- 기존 제약조건 삭제
ALTER TABLE facility_tasks
DROP CONSTRAINT IF EXISTS facility_tasks_task_type_check;

-- 새 제약조건 추가 (dealer 포함)
ALTER TABLE facility_tasks
ADD CONSTRAINT facility_tasks_task_type_check
CHECK (task_type IN ('self', 'subsidy', 'as', 'dealer', 'etc'));
```

---

## 🧪 테스트 시나리오

### 1. 업무 생성 테스트

**단계**:
1. `/admin/tasks` 페이지 접속
2. "제품 발주" 버튼 클릭
3. 업무 타입으로 **"대리점"** 선택
4. 사업장, 현재 단계(대리점 접수), 메모 입력
5. 저장 버튼 클릭

**기대 결과**:
- ✅ 칸반보드에 대리점 업무 카드 생성
- ✅ 카드에 "대리점" 타입 표시
- ✅ 현재 단계: "대리점 접수"
- ✅ `/admin/business` 메모에 동기화 (배지: [업무])

---

### 2. 워크플로우 진행 테스트

**단계**:
1. 생성한 대리점 업무 카드 클릭
2. 현재 단계를 순차적으로 변경:
   - 대리점 접수 → 현장 실사 → 견적 확정 → 계약 체결 → ... → 서류 발송 완료
3. 각 단계 변경 시 메모 입력

**기대 결과**:
- ✅ 모든 단계가 순서대로 표시됨
- ✅ 진행률이 자동 계산됨 (0% → 8% → 17% → ... → 100%)
- ✅ 단계별 색상이 정확히 표시됨
- ✅ 메모가 사업장 상세 모달에 동기화됨

---

### 3. 엑셀 일괄 등록 테스트

**단계**:
1. 엑셀 파일 작성:
   ```
   사업장명          | 업무타입 | 현재단계      | 담당자 | 메모
   (주)테스트대리점  | 대리점   | 견적 확정     | 홍길동 | 대리점 견적 확인 완료
   ```
2. `/admin/tasks` 페이지에서 "업무 일괄 등록" 클릭
3. 엑셀 파일 업로드

**기대 결과**:
- ✅ "대리점" 타입 인식
- ✅ "견적 확정" 단계 매핑 성공
- ✅ 업무 생성 성공
- ✅ 메모 동기화 성공

---

### 4. 기존 업무 타입 호환성 테스트

**단계**:
1. 기존 자가시설, 보조금, A/S 업무 조회
2. 각 업무 편집 및 저장
3. 기존 워크플로우 동작 확인

**기대 결과**:
- ✅ 기존 업무 타입 정상 동작
- ✅ 기존 워크플로우 변경 없음
- ✅ 메모 동기화 정상 작동
- ✅ 하위 호환성 보장

---

## 📊 진행률 계산 예시

대리점 업무는 총 **12단계**이므로:

| 단계 | 진행률 | 계산식 |
|------|--------|--------|
| 대리점 접수 | 8% | (1/12) × 100 = 8.33% ≈ 8% |
| 현장 실사 | 17% | (2/12) × 100 = 16.67% ≈ 17% |
| 견적 확정 | 25% | (3/12) × 100 = 25% |
| 계약 체결 | 33% | (4/12) × 100 = 33.33% ≈ 33% |
| 계약금 확인 | 42% | (5/12) × 100 = 41.67% ≈ 42% |
| 제품 발주 | 50% | (6/12) × 100 = 50% |
| 제품 출고 | 58% | (7/12) × 100 = 58.33% ≈ 58% |
| 설치 협의 | 67% | (8/12) × 100 = 66.67% ≈ 67% |
| 제품 설치 | 75% | (9/12) × 100 = 75% |
| 잔금 입금 | 83% | (10/12) × 100 = 83.33% ≈ 83% |
| 대리점 정산 | 92% | (11/12) × 100 = 91.67% ≈ 92% |
| 서류 발송 완료 | 100% | (12/12) × 100 = 100% |

---

## 🎨 UI 색상 체계

**대리점 타입 색상**: 오렌지 계열 (기존 타입과 구별)

- **타입 선택 버튼**: `border-orange-500 bg-orange-50 text-orange-700`
- **카드 테두리**: `border-l-orange-400`
- **단계별 배지 색상**: 워크플로우 진행에 따라 blue → yellow → orange → purple → ... → green

---

## ✅ 체크리스트

### 코드 수정
- [ ] `/lib/task-status-utils.ts` - TASK_STATUS_KR 업데이트
- [ ] `/lib/task-status-utils.ts` - TASK_TYPE_KR 업데이트
- [ ] `/lib/task-status-utils.ts` - getStatusColor 함수 업데이트
- [ ] `/app/admin/tasks/types.ts` - TaskType 타입 업데이트
- [ ] `/app/admin/tasks/types.ts` - TaskStatus 타입 업데이트
- [ ] `/app/admin/tasks/types.ts` - dealerSteps 상수 추가
- [ ] `/app/admin/tasks/types.ts` - calculateProgressPercentage 함수 업데이트
- [ ] `/app/admin/tasks/types.ts` - getStepsByType 함수 업데이트
- [ ] `/app/admin/tasks/page.tsx` - import 구문 업데이트
- [ ] `/app/admin/tasks/page.tsx` - 대리점 선택 버튼 추가
- [ ] `/app/api/admin/tasks/bulk-upload/route.ts` - REVERSE_TASK_TYPE_MAP 업데이트

### 데이터베이스
- [ ] CHECK 제약조건 확인 (필요시 마이그레이션)

### 테스트
- [ ] 대리점 업무 생성 테스트
- [ ] 워크플로우 12단계 진행 테스트
- [ ] 진행률 계산 검증
- [ ] 메모 동기화 확인
- [ ] 엑셀 일괄 등록 테스트 (대리점 타입)
- [ ] 기존 업무 타입 호환성 테스트

### 문서화
- [ ] 사용자 가이드 업데이트 (대리점 워크플로우 설명)
- [ ] API 문서 업데이트 (task_type 값에 'dealer' 추가)

---

## 🚀 배포 전 확인사항

1. **로컬 테스트**: 모든 테스트 시나리오 통과 확인
2. **TypeScript 컴파일**: `npm run build` 오류 없음
3. **Lint 검사**: `npm run lint` 통과
4. **데이터베이스**: 프로덕션 DB에 CHECK 제약조건 확인 및 마이그레이션
5. **백업**: 배포 전 데이터베이스 백업
6. **롤백 계획**: 문제 발생 시 롤백 절차 준비

---

## 🔄 롤백 가이드

만약 문제가 발생하면:

### 1. 코드 롤백

```bash
git revert <commit-hash>
git push origin main
```

### 2. 데이터베이스 롤백 (CHECK 제약조건 추가한 경우)

```sql
-- 새 제약조건 삭제
ALTER TABLE facility_tasks
DROP CONSTRAINT IF EXISTS facility_tasks_task_type_check;

-- 원래 제약조건 복원 (dealer 제외)
ALTER TABLE facility_tasks
ADD CONSTRAINT facility_tasks_task_type_check
CHECK (task_type IN ('self', 'subsidy', 'as', 'etc'));
```

### 3. 기존 대리점 업무 처리

**옵션 A**: 기타 타입으로 변경

```sql
UPDATE facility_tasks
SET task_type = 'etc', status = 'etc_status'
WHERE task_type = 'dealer';
```

**옵션 B**: 소프트 삭제

```sql
UPDATE facility_tasks
SET is_deleted = true
WHERE task_type = 'dealer';
```

---

## 📌 참고사항

### 기존 업무 타입과의 비교

| 항목 | 자가시설 | 보조금 | A/S | 대리점 (NEW) |
|------|----------|--------|-----|--------------|
| 단계 수 | 11 | 23 | 6 | 12 |
| 복잡도 | 중간 | 높음 | 낮음 | 중간 |
| 특징 | 일반 고객 대상 | 정부 보조금 절차 | 사후 관리 | 대리점 경유 판매 |
| 고유 단계 | 없음 | 보조금 승인 관련 | AS 전용 단계 | 대리점 정산 |

### 향후 개선 방향

1. **대리점별 수수료율 관리**: 대리점 정산 단계에서 수수료 자동 계산 기능 추가
2. **대리점 성과 리포트**: 대리점별 업무 실적 통계 대시보드
3. **대리점 전용 포털**: 대리점이 직접 업무 등록/조회할 수 있는 별도 인터페이스

---

## 📝 구현 순서

1. **Phase 1**: 타입 정의 및 상수 추가
   - `types.ts`, `task-status-utils.ts` 수정
2. **Phase 2**: UI 컴포넌트 업데이트
   - `page.tsx` 대리점 선택 버튼 추가
3. **Phase 3**: API 및 검증 로직
   - `bulk-upload/route.ts` 매핑 추가
4. **Phase 4**: 데이터베이스 확인 및 마이그레이션
5. **Phase 5**: 테스트 및 QA
6. **Phase 6**: 배포

---

**작성일**: 2026-01-30
**작성자**: Claude Code
**버전**: 1.0
