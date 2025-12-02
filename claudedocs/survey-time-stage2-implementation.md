# 실사 시간 필드 2단계 구현 (완전한 양방향 동기화)

## 📋 구현 요약

**날짜**: 2025-12-02
**상태**: ✅ 완료 (2단계 - 완전한 양방향 동기화)
**목적**: 사업장관리와 일정관리 모두에서 실사 시간 정보 관리 가능

---

## 🎯 1단계 vs 2단계 비교

### 1단계 (이전 구현)
- ✅ `survey_events` 테이블에만 시간 필드 추가
- ✅ 일정관리에서 시간 설정 가능
- ⚠️ 사업장관리에서 날짜 변경 시 시간 정보 NULL로 초기화
- ⚠️ 사업장관리 UI는 날짜만 표시

### 2단계 (현재 구현) - **완전한 양방향 동기화**
- ✅ `business_info` 테이블에도 시간 필드 추가
- ✅ 사업장관리 수정모달에 시간 입력 UI 추가
- ✅ 트리거 함수에서 시간 필드 양방향 동기화
- ✅ 사업장관리 ↔ 일정관리 간 완전한 데이터 일관성

---

## 🔧 구현 내용

### 1. 데이터베이스 스키마 변경

#### business_info 테이블에 시간 필드 추가

**파일**: [`sql/add_time_to_business_info_surveys.sql`](../sql/add_time_to_business_info_surveys.sql)

```sql
-- 견적실사 시간 필드
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS estimate_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS estimate_survey_end_time TIME;

-- 착공전실사 시간 필드
ADD COLUMN IF NOT EXISTS pre_construction_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_end_time TIME;

-- 준공실사 시간 필드
ADD COLUMN IF NOT EXISTS completion_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_end_time TIME;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_business_info_estimate_survey_start_time
  ON business_info(estimate_survey_start_time) WHERE estimate_survey_start_time IS NOT NULL;
-- ... (6개 시간 필드에 대한 인덱스)
```

**스키마 구조** (변경 후):
```sql
CREATE TABLE business_info (
  -- 기본 필드들...

  -- 견적실사
  estimate_survey_date DATE,
  estimate_survey_start_time TIME,      -- ✅ 신규
  estimate_survey_end_time TIME,        -- ✅ 신규
  estimate_survey_manager TEXT,

  -- 착공전실사
  pre_construction_survey_date DATE,
  pre_construction_survey_start_time TIME,    -- ✅ 신규
  pre_construction_survey_end_time TIME,      -- ✅ 신규
  pre_construction_survey_manager TEXT,

  -- 준공실사
  completion_survey_date DATE,
  completion_survey_start_time TIME,    -- ✅ 신규
  completion_survey_end_time TIME,      -- ✅ 신규
  completion_survey_manager TEXT
);
```

---

### 2. 트리거 함수 업데이트 (양방향 시간 동기화)

**파일**: [`sql/update_survey_sync_triggers_with_time.sql`](../sql/update_survey_sync_triggers_with_time.sql)

#### business_info → survey_events 동기화

**변경 내용**:
```sql
-- 견적실사 예시
INSERT INTO survey_events (
  id, title, event_date,
  start_time,                        -- ✅ 추가
  end_time,                          -- ✅ 추가
  labels, business_id, business_name,
  author_name, survey_type, updated_at
)
VALUES (
  CONCAT('estimate-survey-', NEW.id::text),
  CONCAT(NEW.business_name, ' - 견적실사'),
  NEW.estimate_survey_date,
  NEW.estimate_survey_start_time,    -- ✅ 추가
  NEW.estimate_survey_end_time,      -- ✅ 추가
  ARRAY['견적실사']::TEXT[],
  NEW.id,
  NEW.business_name,
  COALESCE(NEW.estimate_survey_manager, '미지정'),
  'estimate_survey',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  event_date = EXCLUDED.event_date,
  start_time = EXCLUDED.start_time,    -- ✅ 추가
  end_time = EXCLUDED.end_time,        -- ✅ 추가
  business_name = EXCLUDED.business_name,
  author_name = EXCLUDED.author_name,
  updated_at = NOW();
```

#### survey_events → business_info 역방향 동기화

**변경 내용**:
```sql
-- 견적실사 예시
IF survey_type_value = 'estimate_survey' THEN
  UPDATE business_info
  SET
    estimate_survey_date = NEW.event_date,
    estimate_survey_start_time = NEW.start_time,    -- ✅ 추가
    estimate_survey_end_time = NEW.end_time,        -- ✅ 추가
    estimate_survey_manager = NEW.author_name,
    updated_at = NOW()
  WHERE id = NEW.business_id;
END IF;
```

#### 트리거 재생성 (시간 필드 감지 추가)

```sql
DROP TRIGGER IF EXISTS trigger_sync_business_to_survey ON business_info;
CREATE TRIGGER trigger_sync_business_to_survey
  AFTER INSERT OR UPDATE OF
    estimate_survey_date,
    estimate_survey_start_time,      -- ✅ 추가
    estimate_survey_end_time,        -- ✅ 추가
    estimate_survey_manager,
    pre_construction_survey_date,
    pre_construction_survey_start_time,    -- ✅ 추가
    pre_construction_survey_end_time,      -- ✅ 추가
    pre_construction_survey_manager,
    completion_survey_date,
    completion_survey_start_time,    -- ✅ 추가
    completion_survey_end_time,      -- ✅ 추가
    completion_survey_manager
  ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_survey_events();
```

---

### 3. 프론트엔드 UI 수정

#### 사업장관리 수정모달

**파일**: [`app/admin/business/page.tsx`](../app/admin/business/page.tsx)

**변경 내용**:

1. **TypeScript 인터페이스 업데이트** (lines 145-157):
```typescript
// 실사 관리 필드
estimate_survey_manager?: string | null;
estimate_survey_date?: string | null;
estimate_survey_start_time?: string | null;  // ✅ 시간 필드 추가
estimate_survey_end_time?: string | null;    // ✅ 시간 필드 추가
pre_construction_survey_manager?: string | null;
pre_construction_survey_date?: string | null;
pre_construction_survey_start_time?: string | null;  // ✅ 시간 필드 추가
pre_construction_survey_end_time?: string | null;    // ✅ 시간 필드 추가
completion_survey_manager?: string | null;
completion_survey_date?: string | null;
completion_survey_start_time?: string | null;  // ✅ 시간 필드 추가
completion_survey_end_time?: string | null;    // ✅ 시간 필드 추가
```

2. **견적실사 UI** (lines 4558-4602):
```tsx
<div className="bg-gray-50 rounded-lg p-3 sm:p-4">
  <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">견적실사</h4>
  <div className="space-y-2 sm:space-y-3">
    <div>
      <label>담당자</label>
      <input type="text" value={formData.estimate_survey_manager || ''} ... />
    </div>
    <div>
      <label>실사일</label>
      <input type="date" value={formData.estimate_survey_date || ''} ... />
    </div>
    {/* ✅ 시간 입력 필드 추가 */}
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label>시작 시간</label>
        <input
          type="time"
          value={formData.estimate_survey_start_time || ''}
          onChange={(e) => setFormData({
            ...formData,
            estimate_survey_start_time: e.target.value
          })}
        />
      </div>
      <div>
        <label>종료 시간</label>
        <input
          type="time"
          value={formData.estimate_survey_end_time || ''}
          onChange={(e) => setFormData({
            ...formData,
            estimate_survey_end_time: e.target.value
          })}
        />
      </div>
    </div>
  </div>
</div>
```

3. **착공전실사, 준공실사 UI도 동일하게 시간 입력 필드 추가**

---

## 📊 데이터 흐름

### 사업장관리에서 실사 정보 입력

```
사업장관리 수정모달
  ↓
사용자 입력:
  - 견적실사일: 2025-12-15
  - 시작 시간: 10:00
  - 종료 시간: 12:00
  ↓
PUT /api/business-info
  ↓
business_info 테이블 UPDATE
  - estimate_survey_date: 2025-12-15
  - estimate_survey_start_time: 10:00:00
  - estimate_survey_end_time: 12:00:00
  ↓
트리거 실행: sync_business_to_survey_events()
  ↓
survey_events 테이블 UPSERT
  - event_date: 2025-12-15
  - start_time: 10:00:00
  - end_time: 12:00:00
  ↓
일정관리에서 시간 포함하여 표시
```

### 일정관리에서 실사 이벤트 수정

```
일정관리 캘린더 모달
  ↓
사용자 시간 변경:
  - 시작 시간: 10:00 → 14:00
  - 종료 시간: 12:00 → 16:00
  ↓
PUT /api/survey-events
  ↓
survey_events 테이블 UPDATE
  - start_time: 14:00:00
  - end_time: 16:00:00
  ↓
트리거 실행: sync_survey_to_business_info()
  ↓
business_info 테이블 UPDATE
  - estimate_survey_start_time: 14:00:00
  - estimate_survey_end_time: 16:00:00
  ↓
사업장관리에서 변경된 시간 표시
```

---

## 🚀 배포 절차

### 1. 데이터베이스 스키마 업데이트

**순서**: 다음 SQL 스크립트를 순서대로 실행

```bash
# 1단계: survey_events에 시간 필드 추가 (이미 완료)
# sql/add_time_to_survey_events.sql

# 2단계: business_info에 시간 필드 추가
sql/add_time_to_business_info_surveys.sql

# 3단계: 트리거 함수 업데이트
sql/update_survey_sync_triggers_with_time.sql
```

**Supabase SQL Editor 실행**:
```sql
-- 1. business_info 시간 필드 추가
-- (add_time_to_business_info_surveys.sql 전체 실행)

-- 2. 트리거 함수 업데이트
-- (update_survey_sync_triggers_with_time.sql 전체 실행)
```

**검증**:
```sql
-- business_info 스키마 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_info'
  AND column_name LIKE '%survey%time%'
ORDER BY column_name;

-- 트리거 확인
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%survey%';
```

### 2. 애플리케이션 배포

```bash
# 타입 체크
npm run type-check

# 빌드
npm run build

# 배포
vercel --prod
```

### 3. 기능 테스트

#### 테스트 1: 사업장관리에서 시간 입력
1. 사업장관리 → 사업장 선택 → 수정
2. 실사 관리 섹션에서 시간 입력
   - 견적실사일: 2025-12-20
   - 시작 시간: 09:00
   - 종료 시간: 11:00
3. 저장 후 일정관리에서 해당 이벤트 확인
4. 시간이 09:00-11:00로 표시되는지 확인

#### 테스트 2: 일정관리에서 시간 수정
1. 일정관리 → 실사 이벤트 선택 → 수정
2. 시간 변경:
   - 시작 시간: 09:00 → 14:00
   - 종료 시간: 11:00 → 16:00
3. 저장 후 사업장관리에서 해당 사업장 확인
4. 시간이 14:00-16:00로 자동 동기화되었는지 확인

#### 테스트 3: 양방향 동기화 검증
```sql
-- 사업장관리에서 시간 변경 후
SELECT
  business_name,
  estimate_survey_date,
  estimate_survey_start_time,
  estimate_survey_end_time
FROM business_info
WHERE business_name = '테스트 사업장';

-- survey_events 동기화 확인
SELECT
  title,
  event_date,
  start_time,
  end_time
FROM survey_events
WHERE business_name = '테스트 사업장'
  AND survey_type = 'estimate_survey';
```

---

## ⚠️ 주의사항

### 1. 시간 필드는 선택사항
- 모든 시간 필드는 NULL 허용
- 날짜만 입력하고 시간은 생략 가능
- 기존 데이터는 시간 필드가 NULL로 유지됨

### 2. 데이터 일관성
- 사업장관리와 일정관리 모두에서 시간 정보 관리 가능
- 한쪽에서 시간 변경 시 자동으로 양방향 동기화됨
- 무한 루프 방지 로직 유지됨

### 3. 트리거 동작
- **business_info → survey_events**: 날짜 + 시간 모두 동기화
- **survey_events → business_info**: 날짜 + 시간 모두 동기화
- 시간 필드 변경 시에도 트리거 자동 실행됨

### 4. UI 호환성
- 모바일 환경에서도 시간 입력 가능 (`<input type="time">`)
- 기존 날짜 입력 UI와 일관된 디자인
- 그리드 레이아웃으로 시작/종료 시간 나란히 배치

---

## 📈 1단계 구현과의 차이점

### 1단계 (부분 동기화)
```
사업장관리 (날짜만) ─────┐
                        ├─→ survey_events (날짜 + 시간)
일정관리 (날짜 + 시간) ──┘

⚠️ 문제: 사업장관리에서 날짜 변경 시 시간 정보 NULL로 초기화
```

### 2단계 (완전한 양방향 동기화)
```
사업장관리 (날짜 + 시간) ←→ survey_events (날짜 + 시간)
         ↕                        ↕
일정관리 (날짜 + 시간) ←→ 트리거 (양방향 동기화)

✅ 해결: 모든 곳에서 시간 정보 유지 및 자동 동기화
```

---

## 🔍 관련 파일

### SQL 스크립트
- **Stage 1**: [`sql/add_time_to_survey_events.sql`](../sql/add_time_to_survey_events.sql)
- **Stage 2 - 스키마**: [`sql/add_time_to_business_info_surveys.sql`](../sql/add_time_to_business_info_surveys.sql)
- **Stage 2 - 트리거**: [`sql/update_survey_sync_triggers_with_time.sql`](../sql/update_survey_sync_triggers_with_time.sql)

### 프론트엔드
- **사업장관리 UI**: [`app/admin/business/page.tsx`](../app/admin/business/page.tsx)
- **일정관리 컴포넌트**: [`components/boards/CalendarBoard.tsx`](../components/boards/CalendarBoard.tsx)

### API
- **실사 이벤트 API**: [`app/api/survey-events/route.ts`](../app/api/survey-events/route.ts)
- **사업장 정보 API**: [`app/api/business-info/route.ts`](../app/api/business-info/route.ts)

### 문서
- **Stage 1 문서**: [`claudedocs/survey-time-implementation.md`](./survey-time-implementation.md)
- **분석 문서**: [`claudedocs/survey-time-sync-analysis.md`](./survey-time-sync-analysis.md)
- **Stage 2 문서**: [`claudedocs/survey-time-stage2-implementation.md`](./survey-time-stage2-implementation.md) (현재 문서)

---

**작성**: Claude Code (Sonnet 4.5)
**구현 완료**: 2025-12-02
**구현 단계**: Stage 2 (완전한 양방향 시간 동기화)
