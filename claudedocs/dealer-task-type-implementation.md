# 대리점 업무 타입 구현 완료

## ✅ 구현 완료 항목

### 1. 코드 수정

#### `/lib/task-status-utils.ts` ✅
- [x] TASK_STATUS_KR에 대리점 단계 7개 추가
- [x] TASK_TYPE_KR에 'dealer': '대리점' 추가
- [x] getStatusColor에 대리점 단계 색상 7개 추가

#### `/app/admin/tasks/types.ts` ✅
- [x] TaskType에 'dealer' 추가
- [x] TaskStatus에 대리점 단계 7개 추가
- [x] dealerSteps 상수 배열 추가 (12단계)
- [x] calculateProgressPercentage 함수 업데이트
- [x] getStepsByType 함수 업데이트

#### `/app/admin/tasks/page.tsx` ✅
- [x] TaskType 인라인 타입 정의에 'dealer' 추가
- [x] TaskStatus 인라인 타입에 대리점 단계 7개 추가
- [x] 필터 드롭다운에 "대리점" 옵션 추가
- [x] 생성 모달 드롭다운에 "대리점" 옵션 추가
- [x] 편집 모달 드롭다운에 "대리점" 옵션 추가
- [x] getTaskTypeBadge에 dealer 배지 추가 (오렌지색)
- [x] 지연 임계값 thresholds에 dealer 추가 (21일)

#### `/app/api/admin/tasks/bulk-upload/route.ts` ✅
- [x] REVERSE_TASK_TYPE_MAP에 '대리점': 'dealer' 추가

#### 데이터베이스 마이그레이션 ✅
- [x] `/database/add-dealer-task-type.sql` 생성
  - CHECK 제약조건 업데이트 (dealer 포함)
  - 검증 쿼리 포함

### 2. 설계 문서

#### `/claudedocs/dealer-task-type-design.md` ✅
- 대리점 워크플로우 정의 (12단계)
- 파일별 수정 사항 상세 설명
- 테스트 시나리오 4가지
- 진행률 계산 예시
- UI 색상 체계
- 체크리스트
- 롤백 가이드

## 🚀 배포 절차

### 1단계: 데이터베이스 마이그레이션

Supabase Dashboard에서 실행:

1. Supabase 프로젝트 접속: https://app.supabase.com
2. SQL Editor 선택
3. New Query 클릭
4. 다음 파일 내용 복사 붙여넣기:
   ```
   database/add-dealer-task-type.sql
   ```
5. Run 버튼 클릭

**예상 결과**:
```
✅ 대리점 업무 타입이 성공적으로 추가되었습니다!
```

**검증 쿼리**:
```sql
-- CHECK 제약조건 확인
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'facility_tasks'::regclass
  AND contype = 'c'
  AND conname = 'facility_tasks_task_type_check';
```

**예상 출력**:
```
conname                            | definition
-----------------------------------+---------------------------------------------------
facility_tasks_task_type_check     | CHECK (task_type IN ('self', 'subsidy', 'etc', 'as', 'dealer'))
```

---

### 2단계: 코드 배포

```bash
# 현재 변경사항 확인
git status

# 변경된 파일 스테이징
git add .

# 커밋
git commit -m "feat: 대리점 업무 타입 추가

- 대리점(dealer) 업무 타입 추가 (12단계 워크플로우)
- CHECK 제약조건 업데이트 (dealer 포함)
- UI에 대리점 선택 옵션 추가
- 엑셀 일괄 등록에 대리점 타입 지원
- 대리점 전용 단계: 접수, 현장실사, 견적확정, 계약체결, 계약금확인, 잔금입금, 대리점정산
- 공통 단계: 제품발주, 제품출고, 설치협의, 제품설치, 서류발송완료

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 푸시
git push origin main
```

---

### 3단계: 기능 테스트

#### 테스트 1: 대리점 업무 생성

1. `/admin/tasks` 페이지 접속
2. "제품 발주" 버튼 클릭
3. 업무 타입: **"대리점"** 선택
4. 사업장: 아무 사업장 선택
5. 현재 단계: **"대리점 접수"** 선택
6. 메모: "테스트 대리점 업무" 입력
7. 저장 버튼 클릭

**기대 결과**:
- ✅ 칸반보드에 대리점 업무 카드 생성됨
- ✅ 타입 배지: "대리점" (오렌지색)
- ✅ 현재 단계: "대리점 접수"
- ✅ 진행률: 8% (1/12)

---

#### 테스트 2: 워크플로우 진행

1. 생성한 대리점 업무 카드 클릭
2. 현재 단계를 순차적으로 변경:
   - 대리점 접수 (8%) → 현장 실사 (17%) → 견적 확정 (25%) → 계약 체결 (33%)
   - → 계약금 확인 (42%) → 제품 발주 (50%) → 제품 출고 (58%) → 설치 협의 (67%)
   - → 제품 설치 (75%) → 잔금 입금 (83%) → 대리점 정산 (92%) → 서류 발송 완료 (100%)
3. 각 단계마다 메모 입력

**기대 결과**:
- ✅ 모든 12단계가 순서대로 표시됨
- ✅ 진행률이 자동 계산됨
- ✅ 각 단계별 색상이 올바르게 표시됨
- ✅ 메모가 사업장 상세 모달에 동기화됨

---

#### 테스트 3: 엑셀 일괄 등록

**엑셀 파일 작성**:

| 사업장명 | 업무타입 | 현재단계 | 담당자 | 메모 |
|----------|----------|----------|--------|------|
| (주)테스트대리점 | 대리점 | 견적 확정 | 홍길동 | 대리점 견적 확인 완료 |

**절차**:
1. `/admin/tasks` 페이지에서 "업무 일괄 등록" 클릭
2. 엑셀 파일 업로드
3. 업로드 결과 확인

**기대 결과**:
- ✅ "대리점" 타입 인식
- ✅ "견적 확정" 단계 매핑 성공
- ✅ 업무 생성 성공
- ✅ 메모 동기화 성공

---

#### 테스트 4: 필터링 기능

1. `/admin/tasks` 페이지에서 업무 타입 필터 클릭
2. **"대리점"** 선택

**기대 결과**:
- ✅ 대리점 업무만 표시됨
- ✅ 다른 타입(자비, 보조금, AS) 업무는 숨겨짐

---

#### 테스트 5: 기존 업무 타입 호환성

1. 기존 자가시설, 보조금, A/S 업무 조회
2. 각 업무 편집 및 저장
3. 기존 워크플로우 동작 확인

**기대 결과**:
- ✅ 기존 업무 타입 정상 동작
- ✅ 기존 워크플로우 변경 없음
- ✅ 메모 동기화 정상 작동
- ✅ 하위 호환성 보장

---

## 📊 대리점 워크플로우 요약

### 12단계 워크플로우

| 순서 | 단계 코드 | 한글 명칭 | 진행률 | 특징 |
|------|-----------|-----------|--------|------|
| 1 | dealer_contact | 대리점 접수 | 8% | 대리점으로부터 업무 접수 |
| 2 | dealer_site_inspection | 현장 실사 | 17% | 현장 실사 진행 |
| 3 | dealer_quotation | 견적 확정 | 25% | 대리점과 견적 확정 |
| 4 | dealer_contract | 계약 체결 | 33% | 대리점 계약 체결 |
| 5 | dealer_deposit_confirm | 계약금 확인 | 42% | 계약금 입금 확인 |
| 6 | product_order | 제품 발주 | 50% | **자가시설과 동일** |
| 7 | product_shipment | 제품 출고 | 58% | **자가시설과 동일** |
| 8 | installation_schedule | 설치 협의 | 67% | **자가시설과 동일** |
| 9 | installation | 제품 설치 | 75% | **자가시설과 동일** |
| 10 | dealer_balance_payment | 잔금 입금 | 83% | 잔금 입금 확인 |
| 11 | dealer_settlement | 대리점 정산 | 92% | **대리점 전용 단계** |
| 12 | document_complete | 서류 발송 완료 | 100% | **자가시설과 동일** |

### 특징

- **총 12단계**: 자가시설(11단계)보다 1단계 많음
- **공통 단계**: 제품 발주 ~ 제품 설치 구간은 자가시설과 완전 동일
- **대리점 특화**: 접수, 견적, 정산 단계에서 대리점 비즈니스 로직 반영
- **지연 기준**: 자가시설과 동일 (21일)

---

## 🎨 UI 색상 체계

### 업무 타입 배지
- **대리점**: `bg-orange-100 text-orange-800 border-orange-200` (오렌지색)
- **자비**: `bg-blue-100 text-blue-800 border-blue-200` (파란색)
- **보조금**: `bg-green-100 text-green-800 border-green-200` (초록색)
- **AS**: `bg-purple-100 text-purple-800 border-purple-200` (보라색)
- **기타**: `bg-gray-100 text-gray-800 border-gray-200` (회색)

### 단계별 색상
- **대리점 접수**: `bg-blue-100 text-blue-800`
- **현장 실사**: `bg-yellow-100 text-yellow-800`
- **견적 확정**: `bg-orange-100 text-orange-800`
- **계약 체결**: `bg-purple-100 text-purple-800`
- **계약금 확인**: `bg-indigo-100 text-indigo-800`
- **잔금 입금**: `bg-lime-100 text-lime-800`
- **대리점 정산**: `bg-emerald-100 text-emerald-800`

---

## 🔄 롤백 절차

문제 발생 시 롤백:

### 1. 데이터베이스 롤백

```sql
-- CHECK 제약조건 삭제
ALTER TABLE facility_tasks
DROP CONSTRAINT IF EXISTS facility_tasks_task_type_check;

-- 원래 제약조건 복원 (dealer 제외)
ALTER TABLE facility_tasks
ADD CONSTRAINT facility_tasks_task_type_check
CHECK (task_type IN ('self', 'subsidy', 'etc', 'as'));
```

### 2. 기존 대리점 업무 처리

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

### 3. 코드 롤백

```bash
git revert <commit-hash>
git push origin main
```

---

## 📁 수정된 파일 목록

1. `/lib/task-status-utils.ts` - 상태 및 타입 매핑
2. `/app/admin/tasks/types.ts` - 타입 정의 및 워크플로우
3. `/app/admin/tasks/page.tsx` - UI 컴포넌트
4. `/app/api/admin/tasks/bulk-upload/route.ts` - 엑셀 업로드 매핑
5. `/database/add-dealer-task-type.sql` - DB 마이그레이션 (신규)
6. `/claudedocs/dealer-task-type-design.md` - 설계 문서 (신규)
7. `/claudedocs/dealer-task-type-implementation.md` - 구현 완료 문서 (신규)

---

## ✅ 최종 체크리스트

### 배포 전
- [x] 모든 코드 수정 완료
- [x] 데이터베이스 마이그레이션 스크립트 작성
- [x] 설계 문서 작성
- [x] 구현 완료 문서 작성
- [ ] **데이터베이스 마이그레이션 실행** (Supabase에서 수동 실행 필요)
- [ ] **로컬 테스트 완료**
- [ ] TypeScript 컴파일 확인 (`npm run build`)
- [ ] Lint 검사 통과 (`npm run lint`)
- [ ] Git 커밋 및 푸시

### 배포 후
- [ ] 대리점 업무 생성 테스트
- [ ] 워크플로우 12단계 진행 테스트
- [ ] 엑셀 일괄 등록 테스트
- [ ] 필터링 기능 테스트
- [ ] 기존 업무 타입 호환성 테스트
- [ ] 메모 동기화 확인
- [ ] 프로덕션 모니터링

---

**작성일**: 2026-01-30
**작성자**: Claude Code
**상태**: 구현 완료 (데이터베이스 마이그레이션 대기)
