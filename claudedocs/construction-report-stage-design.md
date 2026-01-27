# 착공신고서 제출 단계 추가 설계

## 📋 요구사항

보조금 업무 타입의 단계 중 **'제품 발주' 단계 전에 '착공신고서 제출' 단계**를 추가합니다.

---

## 🎯 현재 보조금 단계 구조 분석

### AS-IS (현재)

```typescript
// Lines 143-163 in app/admin/tasks/page.tsx
const subsidySteps = [
  // ... 공통 단계
  { status: 'approval_pending', label: '보조금 승인대기', color: 'sky' },
  { status: 'approved', label: '보조금 승인', color: 'lime' },
  { status: 'rejected', label: '보조금 탈락', color: 'red' },
  { status: 'document_supplement', label: '서류 보완', color: 'pink' },
  { status: 'pre_construction_inspection', label: '착공 전 실사', color: 'indigo' },

  // 착공 보완 세분화
  { status: 'pre_construction_supplement_1st', label: '착공 보완 1차', color: 'rose' },
  { status: 'pre_construction_supplement_2nd', label: '착공 보완 2차', color: 'fuchsia' },

  // ⚠️ 여기에 '착공신고서 제출' 단계 추가 필요
  { status: 'product_order', label: '제품 발주', color: 'cyan' },
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },
  // ... 이하 설치, 준공 단계
]
```

### 논리적 흐름 분석

1. **착공 전 실사** (pre_construction_inspection)
2. **착공 보완 1차** (pre_construction_supplement_1st) - 선택적
3. **착공 보완 2차** (pre_construction_supplement_2nd) - 선택적
4. **🆕 착공신고서 제출** ← 추가될 단계
5. **제품 발주** (product_order)
6. **제품 출고** (product_shipment)
7. **설치 협의** (installation_schedule)
8. **제품 설치** (installation)

---

## ✅ TO-BE (수정 후)

### 1. TaskStatus 타입 추가

```typescript
// Lines 49-68 in app/admin/tasks/page.tsx
type TaskStatus =
  // ... 기존 공통/자비 단계

  // 보조금 단계
  | 'approval_pending' | 'approved' | 'rejected'
  | 'application_submit' | 'document_supplement' | 'document_preparation' | 'pre_construction_inspection'
  // 착공 보완 세분화
  | 'pre_construction_supplement_1st' | 'pre_construction_supplement_2nd'
  | 'construction_report_submit' // 🆕 NEW: 착공신고서 제출
  | 'product_order' // 제품 발주
  | 'product_shipment'
  | 'installation_schedule'
  | 'installation'
  | 'pre_completion_document_submit' | 'completion_inspection'
  // ... 이하 준공 단계
```

### 2. subsidySteps 배열에 단계 추가

```typescript
// Lines 143-163 수정
const subsidySteps: Array<{status: TaskStatus, label: string, color: string}> = [
  { status: 'customer_contact', label: '고객 상담', color: 'blue' },
  { status: 'site_survey', label: '현장 조사', color: 'sky' },
  { status: 'site_inspection', label: '현장 실사', color: 'yellow' },
  { status: 'quotation', label: '견적서 작성', color: 'orange' },
  { status: 'application_submit', label: '신청서 제출', color: 'purple' },

  // 보조금 승인 단계
  { status: 'approval_pending', label: '보조금 승인대기', color: 'sky' },
  { status: 'approved', label: '보조금 승인', color: 'lime' },
  { status: 'rejected', label: '보조금 탈락', color: 'red' },
  { status: 'document_supplement', label: '서류 보완', color: 'pink' },
  { status: 'pre_construction_inspection', label: '착공 전 실사', color: 'indigo' },

  // 착공 보완 세분화
  { status: 'pre_construction_supplement_1st', label: '착공 보완 1차', color: 'rose' },
  { status: 'pre_construction_supplement_2nd', label: '착공 보완 2차', color: 'fuchsia' },

  // 🆕 NEW: 착공신고서 제출 단계
  { status: 'construction_report_submit', label: '착공신고서 제출', color: 'blue' },

  // 제품 발주 및 이후 단계
  { status: 'product_order', label: '제품 발주', color: 'cyan' },
  { status: 'product_shipment', label: '제품 출고', color: 'emerald' },
  { status: 'installation_schedule', label: '설치 협의', color: 'teal' },
  { status: 'installation', label: '제품 설치', color: 'green' },
  { status: 'pre_completion_document_submit', label: '준공실사 전 서류 제출', color: 'amber' },
  { status: 'completion_inspection', label: '준공 실사', color: 'violet' },

  // 준공 보완 세분화
  { status: 'completion_supplement_1st', label: '준공 보완 1차', color: 'slate' },
  { status: 'completion_supplement_2nd', label: '준공 보완 2차', color: 'zinc' },
  { status: 'completion_supplement_3rd', label: '준공 보완 3차', color: 'stone' },
  { status: 'final_document_submit', label: '보조금지급신청서 제출', color: 'gray' },
  { status: 'subsidy_payment', label: '보조금 입금', color: 'green' }
]
```

---

## 🎨 UI/UX 고려사항

### 1. 칸반보드 레이아웃

**보조금 타입 칸반보드**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ 착공 전 실사 │  착공 보완   │ 착공신고서   │  제품 발주   │  제품 출고   │
│             │   1차/2차    │    제출     │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

**컬럼 순서 (보조금)**:
1. 고객 상담
2. 현장 조사
3. 현장 실사
4. 견적서 작성
5. 신청서 제출
6. 보조금 승인대기
7. 보조금 승인
8. 서류 보완
9. 착공 전 실사
10. 착공 보완 1차
11. 착공 보완 2차
12. **🆕 착공신고서 제출** ← 새로운 컬럼 (12번째)
13. 제품 발주
14. 제품 출고
15. ... (이하 설치/준공 단계)

### 2. 진행률 계산

**calculateProgressPercentage() 함수는 자동 대응**:
- 보조금 전체 단계: 기존 23개 → **24개**로 증가
- 착공신고서 제출 단계: 24개 중 12번째
- 진행률: `(12 / 24) * 100 = 50%`

**자동 계산 예시**:
```typescript
// Lines 182-196
const calculateProgressPercentage = (type: TaskType, status: TaskStatus): number => {
  const steps = type === 'subsidy' ? subsidySteps : ...
  const currentStepIndex = steps.findIndex(step => step.status === status)
  const progress = ((currentStepIndex + 1) / steps.length) * 100
  return Math.round(progress)
}
```

→ 새로운 단계가 추가되면 자동으로 전체 단계 수가 증가하므로 진행률이 자동 조정됩니다.

### 3. 색상 선택

**제안: `'blue'` (파란색)**
- 이유: 공식 서류 제출을 나타내는 색상으로 적합
- 기존 사용 사례: '고객 상담' (customer_contact)도 blue 사용
- 대안: `'indigo'` (남색) - 더 공식적인 느낌

---

## 🔧 구현 범위

### 파일 수정

#### 1. `/app/admin/tasks/page.tsx` (핵심)

**수정 위치 및 내용**:

**A. TaskStatus 타입 정의 (Line 49-68)**
```typescript
// Line 62 근처에 추가
| 'construction_report_submit' // 🆕 착공신고서 제출
```

**B. subsidySteps 배열 (Line 143-163)**
```typescript
// Line 152 이후에 추가 (pre_construction_supplement_2nd 다음)
{ status: 'construction_report_submit', label: '착공신고서 제출', color: 'blue' },
```

#### 2. 데이터베이스 스키마 검증

**`/sql/tasks_table.sql` 확인 필요**:
```sql
-- status 컬럼의 CHECK 제약조건 확인
status VARCHAR(100) NOT NULL CHECK (status IN (
  'pending', 'customer_contact', ...,
  'pre_construction_supplement_2nd',
  'construction_report_submit', -- 🆕 추가 필요
  'product_order', ...
))
```

**⚠️ 중요**: 데이터베이스 스키마도 함께 업데이트해야 합니다!

#### 3. API 엔드포인트 검증

**`/app/api/facility-tasks/route.ts`**:
- TaskStatus 타입 정의 확인
- validation 로직에 새로운 status 추가

---

## 📊 데이터 마이그레이션 계획

### 기존 데이터 영향

**시나리오**: 이미 '제품 발주' 단계에 있는 기존 업무들

**옵션 1: 기존 데이터 유지 (권장)**
- 기존 '제품 발주' 상태의 업무는 그대로 유지
- 새로운 업무만 '착공신고서 제출' 단계를 거침
- **장점**: 안전, 데이터 손실 없음
- **단점**: 일부 업무가 단계를 건너뛴 것처럼 보임

**옵션 2: 데이터 마이그레이션 (선택적)**
- '제품 발주' 이후 단계의 업무는 그대로
- '제품 발주' 단계의 업무를 '착공신고서 제출'로 롤백
- **장점**: 모든 업무가 동일한 흐름을 따름
- **단점**: 기존 업무 진행 상황이 후퇴

**권장 방안**: **옵션 1** (기존 데이터 유지)

---

## 🧪 테스트 계획

### 1. 칸반보드 UI 테스트

- [ ] 보조금 타입 선택 시 '착공신고서 제출' 컬럼이 올바른 위치에 표시되는지 확인
- [ ] 드래그 앤 드롭으로 업무를 '착공신고서 제출' 단계로 이동 가능한지 확인
- [ ] 컬럼 색상이 올바르게 표시되는지 확인 (blue)

### 2. 진행률 계산 테스트

- [ ] '착공신고서 제출' 단계의 업무 진행률이 50% (12/24)로 계산되는지 확인
- [ ] 이전/이후 단계들의 진행률이 올바르게 조정되는지 확인

### 3. 데이터 CRUD 테스트

- [ ] 새로운 보조금 업무 생성 시 '착공신고서 제출' 상태 선택 가능한지 확인
- [ ] 기존 업무를 '착공신고서 제출' 상태로 수정 가능한지 확인
- [ ] API 응답에서 새로운 status가 올바르게 반환되는지 확인

### 4. 모바일 반응형 테스트

- [ ] 모바일 뷰에서 '착공신고서 제출' 단계가 올바르게 표시되는지 확인
- [ ] 스크롤 및 터치 동작이 정상 작동하는지 확인

---

## 📝 구현 체크리스트

### Frontend (app/admin/tasks/page.tsx)

- [ ] Line 49-68: TaskStatus 타입에 `'construction_report_submit'` 추가
- [ ] Line 143-163: subsidySteps 배열에 새로운 단계 추가
- [ ] 빌드 테스트: TypeScript 컴파일 오류 없는지 확인

### Database Schema (sql/tasks_table.sql)

- [ ] status 컬럼의 CHECK 제약조건에 `'construction_report_submit'` 추가
- [ ] 마이그레이션 스크립트 작성 (필요시)

### Backend API (app/api/facility-tasks/route.ts)

- [ ] TaskStatus 타입 정의 확인 및 추가
- [ ] validation 로직에 새로운 status 추가
- [ ] API 응답 테스트

### Testing

- [ ] 로컬 개발 환경 테스트
- [ ] 칸반보드 UI/UX 테스트
- [ ] 진행률 계산 검증
- [ ] 모바일 반응형 테스트

### Documentation

- [ ] 이 설계 문서 작성 완료
- [ ] 변경사항 README 또는 CHANGELOG 업데이트 (선택)

---

## 🎯 예상 효과

### 업무 흐름 개선

**Before**:
```
착공 전 실사 → 착공 보완 → [공백] → 제품 발주
```

**After**:
```
착공 전 실사 → 착공 보완 → 착공신고서 제출 → 제품 발주
```

### 장점

1. **실제 업무 프로세스 반영**: 착공신고서 제출은 제품 발주 전 필수 단계
2. **진행 상황 가시성 향상**: 착공신고서 제출 여부를 명확히 추적 가능
3. **업무 누락 방지**: 착공신고서 미제출 상태로 제품 발주하는 실수 방지
4. **진행률 정확성**: 보다 세분화된 단계로 정확한 진행률 표시

### 주의사항

1. **단계 증가**: 보조금 전체 단계가 23개 → 24개로 증가
2. **진행률 변경**: 동일 단계의 진행률이 약간 감소 (단계 수 증가로 인해)
3. **사용자 교육**: 새로운 단계에 대한 사용자 안내 필요

---

## 📅 구현 일정 (예상)

- **설계**: 완료 (본 문서)
- **구현**: 30분 (코드 수정 및 테스트)
- **배포**: 즉시 가능 (데이터베이스 스키마 변경 없는 경우)

---

**작성일**: 2026-01-27
**작성자**: Claude Sonnet 4.5
**상태**: 설계 완료, 구현 준비
