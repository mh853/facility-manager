# 업무 메모 동기화 기능 설정 가이드

## 🔴 중요: 데이터베이스 마이그레이션 필수

업무 메모 동기화 기능이 작동하려면 반드시 데이터베이스 스키마를 업데이트해야 합니다.

## 1단계: 데이터베이스 마이그레이션 실행

### Supabase Dashboard 사용 (권장)

1. Supabase Dashboard 접속: https://app.supabase.com
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭
4. **New Query** 클릭
5. 아래 파일의 내용을 복사하여 붙여넣기:
   ```
   database/add-task-memo-sync-fields.sql
   ```
6. **Run** 버튼 클릭하여 실행

### 로컬 PostgreSQL 사용

```bash
psql -U your_username -d your_database -f database/add-task-memo-sync-fields.sql
```

## 2단계: 마이그레이션 성공 확인

SQL Editor에서 다음 쿼리 실행:

```sql
-- business_memos 테이블에 새 컬럼이 추가되었는지 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'business_memos'
  AND column_name IN ('source_type', 'source_id', 'task_status', 'task_type');
```

**예상 결과**:
```
column_name  | data_type
-------------+-----------
source_type  | character varying
source_id    | uuid
task_status  | character varying
task_type    | character varying
```

## 3단계: 기능 테스트

### 테스트 시나리오 1: 업무 생성 시 메모 동기화

1. `/admin/tasks` 페이지에서 **제품 발주** 클릭
2. 업무 정보 입력:
   - 사업장: (주)케어제이에스우진
   - 업무 타입: 보조금
   - 현재 단계: 제품 출고
   - 메모: **"테스트 메모 - 동기화 확인"**
3. **저장** 클릭
4. `/admin/business` 페이지로 이동
5. **(주)케어제이에스우진** 사업장 클릭하여 상세 모달 열기
6. **메모 및 업무** 섹션에서 확인:
   - ✅ [업무] 배지가 표시되어야 함
   - ✅ "테스트 메모 - 동기화 확인" 내용이 보여야 함

### 테스트 시나리오 2: 업무 수정 시 메모 동기화

1. `/admin/tasks` 페이지에서 기존 업무 클릭 (예: (주)케어제이에스우진 - 제품 출고)
2. 메모 필드 수정: **"수정된 메모 - 이력 테스트"**
3. **저장** 클릭
4. `/admin/business` 페이지로 이동
5. 사업장 상세 모달 확인:
   - ✅ 기존 메모 + 새 메모 **모두** 표시되어야 함 (이력 누적)
   - ✅ 각 메모에 [업무] 배지 표시

### 테스트 시나리오 3: 엑셀 일괄 등록

1. `/admin/tasks` 페이지에서 **업무 일괄 등록** 클릭
2. 엑셀 파일 업로드 (메모 컬럼 포함)
3. 업로드 성공 후 `/admin/business` 페이지 확인
4. 각 사업장 상세에서 메모가 동기화되었는지 확인

## 4단계: 문제 해결

### 문제: 메모가 동기화되지 않음

#### 확인 1: 데이터베이스 스키마
```sql
\d business_memos
```
`source_type`, `source_id`, `task_status`, `task_type` 컬럼이 있어야 함

#### 확인 2: 브라우저 콘솔 로그 확인
1. F12 → Console 탭
2. 업무 저장 시 다음 로그 확인:
   - `✅ [FACILITY-TASKS] 업무 메모 → 사업장 메모 동기화 완료`
   - 또는 `⚠️ [FACILITY-TASKS] 메모 동기화 실패`

#### 확인 3: 서버 로그 확인
터미널에서 개발 서버 로그 확인:
```
✅ [FACILITY-TASKS] 업무 메모 → 사업장 메모 동기화 완료: [memo-id]
```

### 문제: [업무] 배지가 안 보임

#### 해결: 브라우저 캐시 삭제
1. Ctrl+Shift+R (Windows/Linux) 또는 Cmd+Shift+R (Mac)
2. 페이지 새로고침

#### 확인: business_memos 데이터 직접 조회
```sql
SELECT
  id,
  title,
  content,
  source_type,
  source_id,
  task_status,
  task_type,
  created_at
FROM business_memos
WHERE source_type = 'task_sync'
ORDER BY created_at DESC
LIMIT 10;
```

## 5단계: 롤백 (필요 시)

마이그레이션을 되돌리려면:

```sql
-- 제약조건 제거
ALTER TABLE business_memos DROP CONSTRAINT IF EXISTS fk_business_memos_source_task;

-- 인덱스 제거
DROP INDEX IF EXISTS idx_business_memos_source_type;
DROP INDEX IF EXISTS idx_business_memos_source_id;
DROP INDEX IF EXISTS idx_business_memos_task_status;
DROP INDEX IF EXISTS idx_business_memos_source_lookup;

-- 컬럼 제거
ALTER TABLE business_memos
DROP COLUMN IF EXISTS source_type,
DROP COLUMN IF EXISTS source_id,
DROP COLUMN IF EXISTS task_status,
DROP COLUMN IF EXISTS task_type;
```

## 기술 지원

문제가 계속되면:
1. 브라우저 콘솔 로그 캡처
2. 서버 터미널 로그 캡처
3. SQL 쿼리 결과 캡처
4. 위 정보와 함께 문의
