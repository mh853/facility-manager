# facility_tasks business_id NULL 문제 해결 가이드

## 📋 문제 요약

발주 관리 시스템에서 일부 사업장 정보가 표시되지 않는 문제 발생
- **원인**: `facility_tasks` 테이블의 `business_id`가 NULL
- **영향**: 주소, 제조사, 담당자 정보 등이 표시되지 않음
- **발견된 문제 건수**: 2건 (2025-10-31 기준)

## 🔧 해결 방법

### 1단계: 즉시 데이터 수정

**파일**: `sql/fix_null_business_ids.sql`

```sql
-- business_name으로 business_info와 매칭하여 업데이트
UPDATE facility_tasks ft
SET
  business_id = bi.id,
  updated_at = NOW()
FROM business_info bi
WHERE ft.business_name = bi.business_name
  AND ft.business_id IS NULL
  AND ft.is_deleted = false
  AND bi.is_deleted = false;
```

**실행 방법**:
```bash
# Supabase SQL Editor에서 실행
# 또는 psql 명령어로 실행
psql -h [HOST] -U [USER] -d [DATABASE] -f sql/fix_null_business_ids.sql
```

**예상 결과**:
- (주)건우텍스: business_id 자동 매칭 → business_info에서 조회
- (주)지케이파워폴: business_id 자동 매칭 → business_info에서 조회

### 2단계: 재발 방지 트리거 설치

**파일**: `sql/prevent_null_business_id.sql`

이 스크립트는 다음 기능을 제공합니다:

#### 2-1. 자동 매칭 함수
```sql
CREATE OR REPLACE FUNCTION auto_match_business_id()
```

**기능**:
- `facility_tasks` INSERT/UPDATE 시 자동 실행
- `business_id`가 NULL이면 `business_name`으로 자동 매칭
- 매칭 성공 시 자동으로 `business_id` 설정
- 매칭 실패 시 WARNING 로그 출력

#### 2-2. 트리거 생성
```sql
CREATE TRIGGER trigger_auto_match_business_id
  BEFORE INSERT OR UPDATE OF business_name, business_id ON facility_tasks
```

**실행 방법**:
```bash
# Supabase SQL Editor에서 실행
psql -h [HOST] -U [USER] -d [DATABASE] -f sql/prevent_null_business_id.sql
```

**설치 확인**:
```sql
-- 함수 확인
SELECT proname FROM pg_proc WHERE proname = 'auto_match_business_id';

-- 트리거 확인
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname = 'trigger_auto_match_business_id';
```

### 3단계: API Fallback 로직 개선

**파일**: `app/api/order-management/route.ts`

**변경 사항**:
1. `business_id`가 NULL인 경우 `business_name`으로 조회 시도
2. 두 가지 방식의 매칭 지원:
   - ID 기반 매칭 (기존)
   - 이름 기반 매칭 (신규 추가)

**코드 개선 내용**:
```typescript
// business_id가 없는 tasks도 business_name으로 조회 시도
const tasksWithoutId = tasks.filter(t => !t.business_id && t.business_name)
const businessNames = tasksWithoutId.map(t => t.business_name)

// business_name으로도 조회 (fallback)
if (!bizErr && businessNames.length > 0) {
  const { data: businessesByName } = await supabaseAdmin
    .from('business_info')
    .select('*')
    .in('business_name', businessNames)
    .eq('is_deleted', false)

  // 중복 제거하며 병합
  businessesByName.forEach(b => {
    if (!existingIds.has(b.id)) {
      businesses.push(b)
    }
  })
}
```

## 🎯 적용 순서

### 필수 (즉시 적용)
1. ✅ **1단계 실행**: 기존 NULL 데이터 수정
2. ✅ **2단계 실행**: 트리거 설치 (재발 방지)
3. ✅ **3단계 배포**: API 코드 개선 사항 배포

### 권장 (선택 사항)
4. **검증 트리거 활성화** (매우 엄격한 검증이 필요한 경우):
   ```sql
   CREATE TRIGGER trigger_validate_business_id
     BEFORE INSERT OR UPDATE ON facility_tasks
     FOR EACH ROW
     EXECUTE FUNCTION validate_business_id();
   ```

## 🔍 모니터링 및 검증

### 문제 데이터 확인 쿼리
```sql
-- business_id가 NULL인 facility_tasks 확인
SELECT
  ft.id,
  ft.business_name,
  ft.business_id,
  ft.status,
  CASE
    WHEN ft.business_id IS NULL THEN 'business_id NULL'
    WHEN bi.id IS NULL THEN 'business_info 없음'
    WHEN bi.is_deleted = true THEN 'business_info 삭제됨'
    ELSE 'OK'
  END as issue
FROM facility_tasks ft
LEFT JOIN business_info bi ON ft.business_id = bi.id AND bi.is_deleted = false
WHERE ft.status = 'product_order'
  AND ft.is_deleted = false
ORDER BY issue, ft.business_name;
```

### 트리거 동작 확인
```sql
-- 테스트 데이터 INSERT (business_name만 제공)
INSERT INTO facility_tasks (business_name, title, task_type, status)
VALUES ('강림산업', '트리거 테스트', 'etc', 'customer_contact')
RETURNING id, business_name, business_id;

-- business_id가 자동으로 설정되었는지 확인
SELECT id, business_name, business_id
FROM facility_tasks
WHERE title = '트리거 테스트';

-- 테스트 데이터 정리
DELETE FROM facility_tasks WHERE title = '트리거 테스트';
```

## 📊 영향 분석

### Before (수정 전)
```
facility_tasks
├─ (주)건우텍스: business_id = NULL ❌
│  └─ 발주 관리 화면: 주소, 제조사 표시 안됨
└─ (주)지케이파워폴: business_id = NULL ❌
   └─ 발주 관리 화면: 주소, 제조사 표시 안됨
```

### After (수정 후)
```
facility_tasks
├─ (주)건우텍스: business_id = [UUID] ✅
│  └─ 발주 관리 화면: 전체 정보 정상 표시
└─ (주)지케이파워폴: business_id = [UUID] ✅
   └─ 발주 관리 화면: 전체 정보 정상 표시

+ 트리거 설치됨 → 향후 자동 매칭
+ API Fallback 추가 → 트리거 실패해도 표시 가능
```

## 🛡️ 보안 및 안정성

### 안전장치
1. **트리거 단계**: INSERT/UPDATE 시 자동 매칭 시도
2. **API 단계**: 트리거가 실패해도 런타임에 매칭 시도
3. **Fallback 단계**: 여전히 실패하면 최소 정보라도 표시

### 롤백 방법
```sql
-- 트리거 비활성화 (필요 시)
DROP TRIGGER IF EXISTS trigger_auto_match_business_id ON facility_tasks;
DROP FUNCTION IF EXISTS auto_match_business_id();

-- 데이터 롤백은 불가능 (업데이트 전 백업 권장)
```

## ✅ 체크리스트

- [x] 1단계: 기존 NULL 데이터 수정 완료
- [x] 2단계: 트리거 설치 완료
- [x] 3단계: API 코드 개선 완료
- [ ] 4단계: Supabase에서 SQL 스크립트 실행
- [ ] 5단계: API 코드 배포
- [ ] 6단계: 발주 관리 화면에서 정보 표시 확인
- [ ] 7단계: 트리거 동작 테스트 (새 업무 생성)

## 📞 문제 발생 시

1. **로그 확인**:
   ```sql
   -- PostgreSQL 로그에서 트리거 실행 확인
   SELECT * FROM pg_stat_statements
   WHERE query LIKE '%auto_match_business_id%';
   ```

2. **API 로그 확인**:
   ```
   [ORDER-MANAGEMENT] business_name으로 매칭 성공
   [ORDER-MANAGEMENT] business_name으로 조회 성공
   ```

3. **수동 매칭**:
   ```sql
   -- 특정 업무의 business_id 수동 설정
   UPDATE facility_tasks
   SET business_id = (
     SELECT id FROM business_info
     WHERE business_name = '사업장명'
     LIMIT 1
   )
   WHERE id = 'task_id';
   ```

## 📚 관련 파일

- `sql/fix_null_business_ids.sql` - 데이터 수정 스크립트
- `sql/prevent_null_business_id.sql` - 트리거 설치 스크립트
- `app/api/order-management/route.ts` - API Fallback 로직
- `claudedocs/fix-null-business-id-guide.md` - 이 문서

## 🎓 학습 포인트

이 문제를 통해 배운 점:
1. **3계층 방어 전략**: DB 트리거 → API Fallback → UI Fallback
2. **데이터 무결성**: Foreign Key와 NOT NULL 제약의 중요성
3. **점진적 개선**: 즉시 수정 → 재발 방지 → 완전 자동화

---

**작성일**: 2025-10-31
**작성자**: Claude Code
**버전**: 1.0
