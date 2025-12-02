# 실사-일정 동기화 오류 수정 완료

## 📋 수정 요약

**날짜**: 2025-12-02
**상태**: ✅ 완료
**수정된 오류**: 트리거 무한 루프 (Stack Depth Limit Exceeded)

---

## 🐛 발생했던 오류

### 오류 메시지
```
ERROR: 54001: stack depth limit exceeded
HINT: Increase the configuration parameter "max_stack_depth" (currently 2048kB)
CONTEXT: [반복되는 패턴:]
SQL statement "INSERT INTO survey_events (...)"
PL/pgSQL function sync_business_to_survey_events() line 5
SQL statement "UPDATE business_info SET estimate_survey_date = ..."
PL/pgSQL function sync_survey_to_business_info() line 9
```

### 원인 분석
양방향 동기화 트리거가 서로를 무한히 호출하는 문제:

```
1. business_info 테이블 UPDATE
   ↓
2. sync_business_to_survey_events() 트리거 실행
   ↓
3. survey_events 테이블 INSERT/UPDATE
   ↓
4. sync_survey_to_business_info() 트리거 실행
   ↓
5. business_info 테이블 UPDATE (다시 1번으로!)
   ↓
∞ 무한 루프...
```

---

## ✅ 적용된 수정사항

### 1. 트리거 함수에 무한 루프 방지 로직 추가

**수정 전**:
```sql
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 바로 동기화 로직 시작 (무한 루프 가능)
  IF NEW.estimate_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (...)
  ...
```

**수정 후**:
```sql
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 🔒 무한 루프 방지: 이미 동기화 중이면 트리거 실행 안 함
  IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 🔓 동기화 플래그 설정
  PERFORM set_config('app.syncing_survey', 'true', TRUE);

  -- 이제 안전하게 동기화 로직 실행
  IF NEW.estimate_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (...)
  ...
```

### 2. 양쪽 트리거 함수 모두 수정

✅ **sync_business_to_survey_events()** - 무한 루프 방지 추가
✅ **sync_survey_to_business_info()** - 무한 루프 방지 추가

---

## 🔧 작동 원리

### PostgreSQL 세션 변수를 이용한 재진입 방지

1. **첫 번째 트리거 실행**:
   ```sql
   -- 플래그 확인: 'false' 또는 설정 안됨
   IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
     RETURN NEW;  -- 실행 안됨
   END IF;

   -- 플래그 설정
   PERFORM set_config('app.syncing_survey', 'true', TRUE);
   -- TRUE = 트랜잭션 범위 (자동 리셋)
   ```

2. **두 번째 트리거 실행 (동일 트랜잭션)**:
   ```sql
   -- 플래그 확인: 'true' (첫 번째 트리거가 설정함)
   IF current_setting('app.syncing_survey', TRUE) = 'true' THEN
     RETURN NEW;  -- ✅ 즉시 리턴 (재진입 차단)
   END IF;
   ```

3. **트랜잭션 완료**:
   - 플래그 자동 리셋 (트랜잭션 범위 설정이므로)
   - 다음 독립적인 업데이트는 정상 동작

---

## 📁 수정된 파일

### 1. `sql/create_survey_calendar_sync.sql`
**변경 내용**:
- `sync_business_to_survey_events()` 함수에 무한 루프 방지 로직 추가 (lines 104-110)
- `sync_survey_to_business_info()` 함수에 무한 루프 방지 로직 추가 (lines 207-213)

### 2. `claudedocs/survey-calendar-sync-implementation.md`
**변경 내용**:
- 트러블슈팅 섹션에 "문제 2: 트리거 무한 루프 오류" 추가
- 원인, 해결책, 작동 원리 상세 설명 추가

---

## 🚀 다음 단계

### SQL 스크립트 실행

이제 수정된 SQL 파일을 실행할 수 있습니다:

```bash
# Supabase SQL Editor에서 실행
/sql/create_survey_calendar_sync.sql
```

### 실행 순서

1. **기존 트리거 및 함수 삭제** (스크립트에 포함)
   - DROP TRIGGER IF EXISTS
   - CREATE OR REPLACE FUNCTION

2. **테이블 생성** (이미 존재하면 스킵)
   - survey_events 테이블

3. **트리거 함수 생성**
   - sync_business_to_survey_events() ✅ 무한 루프 방지 포함
   - sync_survey_to_business_info() ✅ 무한 루프 방지 포함

4. **트리거 생성**
   - trigger_sync_business_to_survey
   - trigger_sync_survey_to_business

5. **기존 데이터 마이그레이션**
   - business_info → survey_events 초기 동기화

### 검증 쿼리

실행 후 다음 쿼리로 동기화 상태 확인:

```sql
-- 동기화된 실사 이벤트 수
SELECT
  '동기화된 실사 이벤트 수' AS 항목,
  COUNT(*) AS 개수
FROM survey_events
WHERE event_type = 'survey';

-- 실사 타입별 개수
SELECT
  survey_type,
  COUNT(*) AS 개수
FROM survey_events
GROUP BY survey_type
ORDER BY survey_type;
```

### 동기화 테스트

1. **사업장관리에서 실사일 변경**:
   - 견적실사 날짜 추가/수정
   - 일정관리에서 자동 반영 확인

2. **일정관리에서 실사 이벤트 수정**:
   - 실사 이벤트 날짜 변경
   - 사업장관리에서 자동 반영 확인

---

## 📊 기대 효과

✅ **무한 루프 방지**: 트리거가 서로를 무한 호출하지 않음
✅ **정상 동기화**: 양방향 동기화가 안전하게 작동
✅ **데이터 무결성**: 실사 정보가 두 시스템 간 일관성 유지
✅ **트랜잭션 안전성**: 각 트랜잭션이 독립적으로 동작

---

## 🔍 참고 자료

- **전체 구현 문서**: [survey-calendar-sync-implementation.md](./survey-calendar-sync-implementation.md)
- **SQL 스크립트**: [/sql/create_survey_calendar_sync.sql](../sql/create_survey_calendar_sync.sql)
- **API 라우트**: [/app/api/survey-events/route.ts](../app/api/survey-events/route.ts)

---

**작성**: Claude Code (Sonnet 4.5)
**수정 완료**: 2025-12-02
