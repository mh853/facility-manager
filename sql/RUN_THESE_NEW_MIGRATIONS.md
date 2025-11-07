# 새로운 SQL Migrations 실행 가이드

## 중요: Supabase 대시보드에서 다음 SQL 스크립트를 순서대로 실행하세요

### 1. 고객 담당자 컬럼 추가
**파일:** `sql/add_customer_manager_to_estimates.sql`

견적서 테이블에 담당자 및 담당자 연락처 컬럼을 추가합니다.

```sql
-- 이 스크립트를 Supabase SQL 에디터에 복사하여 실행
```

### 2. 견적서 문서명 형식 업데이트
**파일:** `sql/update_estimate_document_name.sql`

실행이력 탭의 문서명을 `YYYYMMDD_사업장명_IoT설치견적서` 형식으로 변경하고,
견적서 미리보기에 필요한 모든 데이터를 metadata에 포함합니다.

```sql
-- 이 스크립트를 Supabase SQL 에디터에 복사하여 실행
```

### 3. 대기필증 컬럼 추가 (🆕 필수)
**파일:** `sql/add_air_permit_to_estimates.sql`

견적서 테이블에 대기배출시설 허가증 데이터를 저장할 air_permit 컬럼을 추가합니다.
이 컬럼이 없으면 견적서 미리보기와 PDF에 허가증이 표시되지 않습니다.

```sql
-- 이 스크립트를 Supabase SQL 에디터에 복사하여 실행
```

---

## 검증 쿼리

### 1. 모든 새 컬럼 확인
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'estimate_history'
  AND column_name IN ('customer_manager', 'customer_manager_contact', 'air_permit')
ORDER BY column_name;
```

**예상 결과:**
```
air_permit                 | jsonb | YES
customer_manager           | text  | YES
customer_manager_contact   | text  | YES
```

### 2. 문서명 형식 확인
```sql
SELECT
  document_name,
  document_type,
  created_at
FROM document_history_detail
WHERE document_type = 'estimate'
ORDER BY created_at DESC
LIMIT 5;
```

**예상 결과:**
```
20251107_사업장명_IoT설치견적서 | estimate | 2025-11-07 ...
```

### 3. Metadata 및 대기필증 확인
```sql
SELECT
  document_name,
  metadata->>'business_name' as business_name,
  metadata->>'customer_manager' as manager,
  metadata->'air_permit' as air_permit_data,
  (metadata->'air_permit'->>'business_type') as permit_business_type
FROM document_history_detail
WHERE document_type = 'estimate'
ORDER BY created_at DESC
LIMIT 1;
```

**예상 결과:** metadata에 모든 견적서 정보와 air_permit 데이터가 포함되어 있어야 합니다.

---

## 예상 결과

모든 마이그레이션 실행 후:

1. ✅ 견적서 생성 시 담당자 정보가 저장됨
2. ✅ 실행이력 탭의 문서명이 `YYYYMMDD_사업장명_IoT설치견적서` 형식으로 표시
3. ✅ 실행이력 탭에서 견적서 "보기" 버튼 작동
4. ✅ 견적서 미리보기에 모든 정보 표시 (담당자, 참고사항 포함)
5. ✅ 공급자 섹션과 공급받는자 섹션 크기 동일
6. ✅ 견적서 미리보기 모달에 대기배출시설 허가증 표시
7. ✅ 견적서 PDF에 대기배출시설 허가증 포함 (별도 페이지)

---

## 문제 해결

### 견적서 생성 시 오류 발생
**증상:** `Could not find the 'customer_manager' column`

**해결:** `add_customer_manager_to_estimates.sql`을 실행하세요.

### 실행이력에서 문서명이 이상하게 표시
**증상:** `견적서_EST-202511-...` 형식으로 표시

**해결:** `update_estimate_document_name.sql`을 실행하세요.

### 견적서 미리보기가 비어있음
**증상:** "보기" 버튼을 눌러도 내용이 표시되지 않음

**해결:** `update_estimate_document_name.sql`을 실행하여 metadata가 포함되도록 하세요.

### 견적서에 허가증이 표시되지 않음
**증상:** 견적서 미리보기와 PDF에 대기배출시설 허가증이 표시되지 않음

**해결:** `add_air_permit_to_estimates.sql`을 실행하여 air_permit 컬럼을 추가하세요.
