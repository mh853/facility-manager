# 연락처 정보 필드 추가 - 데이터베이스 마이그레이션 가이드

## 📋 마이그레이션 개요

**목적**: employees 테이블에 연락처 정보 필드 추가
**영향 범위**: employees 테이블
**예상 소요 시간**: 1분 미만
**다운타임**: 없음 (IF NOT EXISTS 사용)

---

## 🚀 실행 방법

### 방법 1: Supabase Dashboard (권장)

#### 1단계: Supabase Dashboard 접속
1. Supabase 프로젝트 대시보드 열기
2. 좌측 메뉴에서 **SQL Editor** 클릭

#### 2단계: SQL 실행
1. "New query" 버튼 클릭
2. 아래 SQL 전체 복사하여 붙여넣기:

```sql
-- 연락처 정보 관리 기능을 위한 employees 테이블 확장
-- 작성일: 2025-11-03
-- 목적: 계정 설정 페이지에서 연락처 정보 입력 및 관리

-- 1. 연락처 정보 컬럼 추가
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);

-- 2. 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile);

-- 3. 컬럼 설명 추가
COMMENT ON COLUMN employees.phone IS '일반 전화번호 (사무실)';
COMMENT ON COLUMN employees.mobile IS '휴대전화번호';
```

3. **RUN** 버튼 클릭 (또는 Ctrl+Enter)

#### 3단계: 성공 확인
다음과 같은 메시지가 표시되면 성공:
```
Success. No rows returned
```

---

### 방법 2: psql 커맨드 라인 (고급 사용자)

```bash
# 환경변수 설정 (DATABASE_URL이 설정되어 있다면 생략)
export DATABASE_URL="postgresql://user:password@host:port/database"

# SQL 파일 실행
psql $DATABASE_URL -f sql/add_contact_info_to_employees.sql
```

---

## ✅ 검증 방법

### 1. 컬럼 추가 확인

Supabase SQL Editor에서 실행:

```sql
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('phone', 'mobile')
ORDER BY column_name;
```

**예상 결과**:
```
 column_name |     data_type     | character_maximum_length | is_nullable
-------------+-------------------+--------------------------+-------------
 mobile      | character varying |                       20 | YES
 phone       | character varying |                       20 | YES
```

### 2. 인덱스 생성 확인

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'employees'
AND indexname IN ('idx_employees_phone', 'idx_employees_mobile')
ORDER BY indexname;
```

**예상 결과**:
```
      indexname       | tablename
----------------------+-----------
 idx_employees_mobile | employees
 idx_employees_phone  | employees
```

### 3. 컬럼 설명 확인

```sql
SELECT
    col.column_name,
    pgd.description
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns col ON (
    pgd.objsubid = col.ordinal_position AND
    col.table_schema = st.schemaname AND
    col.table_name = st.relname
)
WHERE st.relname = 'employees'
AND col.column_name IN ('phone', 'mobile')
ORDER BY col.column_name;
```

**예상 결과**:
```
 column_name |        description
-------------+---------------------------
 mobile      | 휴대전화번호
 phone       | 일반 전화번호 (사무실)
```

---

## 🧪 테스트 방법

### 1. 데이터 입력 테스트

```sql
-- 테스트 데이터 업데이트 (실제 사용자 ID로 변경)
UPDATE employees
SET phone = '02-1234-5678', mobile = '010-1234-5678'
WHERE email = 'your-email@example.com';
```

### 2. 데이터 조회 테스트

```sql
-- 연락처 정보 조회
SELECT
    name,
    email,
    phone,
    mobile,
    department,
    position
FROM employees
WHERE email = 'your-email@example.com';
```

### 3. 애플리케이션 테스트

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 `/profile` 접속

3. 연락처 정보 입력:
   - 사무실 전화번호: `02-1234-5678`
   - 휴대전화: `010-1234-5678`

4. "프로필 저장" 클릭

5. 프로필 개요에서 연락처 정보 표시 확인

---

## ⚠️ 주의사항

### 안전한 마이그레이션
- `IF NOT EXISTS` 사용으로 이미 컬럼이 있어도 오류 없음
- 기존 데이터에 영향 없음
- 다운타임 없음

### 롤백 불필요 상황
- 컬럼이 이미 존재하는 경우: 무시됨
- 인덱스가 이미 존재하는 경우: 무시됨

### 프로덕션 환경
- 백업 후 실행 권장
- 피크 시간대 피하기 (선택사항, 빠른 작업이므로)

---

## 🔄 롤백 방법

문제 발생 시 다음 SQL로 롤백:

```sql
-- 1. 인덱스 제거
DROP INDEX IF EXISTS idx_employees_phone;
DROP INDEX IF EXISTS idx_employees_mobile;

-- 2. 컬럼 제거
ALTER TABLE employees DROP COLUMN IF EXISTS phone;
ALTER TABLE employees DROP COLUMN IF EXISTS mobile;
```

**⚠️ 주의**: 롤백 시 입력된 연락처 데이터가 모두 삭제됩니다.

---

## 📊 마이그레이션 체크리스트

### 실행 전
- [ ] Supabase Dashboard 접속 확인
- [ ] SQL Editor 접근 권한 확인
- [ ] (선택) 프로덕션 환경인 경우 백업 완료

### 실행 중
- [ ] SQL 전체 복사
- [ ] SQL Editor에 붙여넣기
- [ ] RUN 버튼 클릭
- [ ] 성공 메시지 확인

### 실행 후
- [ ] 컬럼 추가 확인 (검증 쿼리 1)
- [ ] 인덱스 생성 확인 (검증 쿼리 2)
- [ ] 애플리케이션 테스트
- [ ] 프로필 페이지에서 연락처 입력/저장/조회 확인

---

## 🎯 완료 기준

다음이 모두 확인되면 마이그레이션 완료:

1. ✅ SQL 실행 성공 메시지
2. ✅ `phone`, `mobile` 컬럼 존재 확인
3. ✅ 인덱스 2개 생성 확인
4. ✅ 애플리케이션에서 연락처 입력/저장 가능
5. ✅ 프로필 페이지에서 연락처 정보 표시

---

## 💡 자주 묻는 질문

### Q: 이미 컬럼이 존재하면?
A: `IF NOT EXISTS`로 안전하게 처리됩니다. 오류 없이 무시됩니다.

### Q: 기존 사용자 데이터는?
A: 영향 없습니다. 새 컬럼은 NULL로 초기화됩니다.

### Q: 다운타임이 필요한가요?
A: 아니요. 컬럼 추가는 즉시 완료되며 서비스 중단 없습니다.

### Q: 롤백 시 데이터는?
A: 컬럼을 제거하면 입력된 연락처 데이터가 모두 삭제됩니다.

---

## 📞 문의

마이그레이션 관련 문제 발생 시 개발팀에 문의해주세요.

**작성일**: 2025-11-03
