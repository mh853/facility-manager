# 실사 이벤트 시간 필드 구현

## 📋 구현 요약

**날짜**: 2025-12-02
**상태**: ✅ 완료 (1단계)
**목적**: 일정관리에서 실사 이벤트의 시간 정보 관리 가능하도록 개선

---

## 🎯 구현 목표

### 문제점
- **사업장관리**: 실사일은 DATE 타입 (날짜만 저장)
- **일정관리**: event_date + start_time, end_time (날짜 + 시간 관리)
- **survey_events**: 시간 필드 없어서 동기화 시 시간 정보 누락

### 해결책
1단계로 `survey_events` 테이블에만 시간 필드 추가하여:
- ✅ 일정관리에서 실사 이벤트 시간 설정 가능
- ✅ 사업장관리는 날짜만 표시 (기존 동작 유지)
- ✅ 최소한의 변경으로 시간 정보 관리 시작

---

## 🔧 구현 내용

### 1. 데이터베이스 스키마 변경

#### survey_events 테이블에 시간 필드 추가

**파일**: [`sql/add_time_to_survey_events.sql`](../sql/add_time_to_survey_events.sql)

```sql
-- 시간 필드 추가
ALTER TABLE survey_events
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_survey_events_start_time
  ON survey_events(start_time) WHERE start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_events_end_time
  ON survey_events(end_time) WHERE end_time IS NOT NULL;
```

**스키마 구조** (변경 후):
```sql
CREATE TABLE survey_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME,          -- ✅ 신규
  end_time TIME,            -- ✅ 신규
  labels TEXT[],
  business_id UUID,
  business_name TEXT,
  author_name TEXT,
  event_type TEXT DEFAULT 'survey',
  survey_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

---

### 2. API 엔드포인트 수정

#### POST /api/survey-events (생성)

**파일**: [`app/api/survey-events/route.ts`](../app/api/survey-events/route.ts:70-128)

**변경 내용**:
```typescript
// 요청 Body에 시간 필드 추가
const {
  business_id,
  business_name,
  survey_type,
  event_date,
  start_time,  // ✅ 추가
  end_time,    // ✅ 추가
  author_name,
  description
} = body;

// DB INSERT에 시간 필드 포함
const { data, error } = await supabase
  .from('survey_events')
  .insert([{
    id: eventId,
    title,
    event_date,
    start_time: start_time || null,  // ✅ 추가
    end_time: end_time || null,      // ✅ 추가
    labels: [label],
    business_id,
    business_name,
    author_name: author_name || '미지정',
    event_type: 'survey',
    survey_type,
    description: description || null
  }])
  .select();
```

#### PUT /api/survey-events (수정)

**파일**: [`app/api/survey-events/route.ts`](../app/api/survey-events/route.ts:157-188)

**변경 내용**:
```typescript
// 요청 Body에 시간 필드 추가
const {
  id,
  event_date,
  start_time,  // ✅ 추가
  end_time,    // ✅ 추가
  author_name,
  description
} = body;

// DB UPDATE에 시간 필드 포함
const { data, error } = await supabase
  .from('survey_events')
  .update({
    event_date: event_date || undefined,
    start_time: start_time !== undefined ? start_time : undefined,  // ✅ 추가
    end_time: end_time !== undefined ? end_time : undefined,        // ✅ 추가
    author_name: author_name || undefined,
    description: description || undefined,
    updated_at: new Date().toISOString()
  })
  .eq('id', id)
  .select();
```

---

### 3. 프론트엔드 컴포넌트 수정

#### CalendarBoard.tsx

**파일**: [`components/boards/CalendarBoard.tsx`](../components/boards/CalendarBoard.tsx:127-144)

**변경 내용**:
```typescript
// 실사 이벤트를 CalendarEvent 형식으로 변환 시 시간 필드 포함
const surveyEvents: CalendarEvent[] = (surveyResult.data || []).map((survey: any) => ({
  id: survey.id,
  title: survey.title,
  description: survey.description || null,
  event_date: survey.event_date,
  start_time: survey.start_time || null,  // ✅ 추가
  end_time: survey.end_time || null,      // ✅ 추가
  event_type: 'schedule' as const,
  is_completed: false,
  author_id: survey.business_id || '',
  author_name: survey.author_name || '미지정',
  labels: survey.labels || [],
  business_id: survey.business_id,
  business_name: survey.business_name,
  created_at: survey.created_at,
  updated_at: survey.updated_at
}));
```

---

## 📊 데이터 흐름

### 일정관리에서 실사 이벤트 생성/수정

```
일정관리 UI
  ↓
캘린더 모달에서 날짜 + 시간 입력
  ↓
POST /api/survey-events
  - event_date: "2025-12-15"
  - start_time: "10:00"
  - end_time: "12:00"
  ↓
survey_events 테이블 INSERT
  - event_date: 2025-12-15
  - start_time: 10:00:00
  - end_time: 12:00:00
  ↓
트리거 실행: sync_survey_to_business_info()
  ↓
business_info 테이블 UPDATE
  - estimate_survey_date: 2025-12-15
  - 시간 정보는 저장 안됨 (DATE 타입)
```

### 사업장관리에서 실사일 변경

```
사업장관리 UI
  ↓
수정모달에서 날짜만 입력
  ↓
PUT /api/business-info
  - estimate_survey_date: "2025-12-20"
  ↓
business_info 테이블 UPDATE
  - estimate_survey_date: 2025-12-20
  ↓
트리거 실행: sync_business_to_survey_events()
  ↓
survey_events 테이블 UPSERT
  - event_date: 2025-12-20
  - start_time: NULL (사업장관리에 시간 정보 없음)
  - end_time: NULL
```

---

## ⚠️ 주의사항

### 1. 시간 필드는 선택사항
- `start_time`, `end_time`은 NULL 허용
- 일정관리에서만 시간 설정 가능
- 사업장관리에서 날짜 변경 시 시간 정보는 NULL로 초기화

### 2. 트리거 동작
- **business_info → survey_events**: 날짜만 동기화 (시간 NULL)
- **survey_events → business_info**: 날짜만 동기화 (시간 무시)
- 무한 루프 방지 로직 유지

### 3. 데이터 일관성
- 사업장관리에서 실사일 변경 → 기존 시간 정보 삭제됨
- 일정관리에서 시간을 설정한 후 사업장관리에서 날짜 변경 시 주의

---

## 🚀 배포 절차

### 1. SQL 스크립트 실행

Supabase SQL Editor에서 실행:
```sql
-- sql/add_time_to_survey_events.sql 전체 실행
```

**검증**:
```sql
-- 스키마 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'survey_events'
  AND column_name IN ('start_time', 'end_time');

-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'survey_events'
  AND indexname LIKE '%time%';
```

### 2. 애플리케이션 배포

```bash
# 빌드 및 배포
npm run build
vercel --prod
```

### 3. 기능 테스트

#### 테스트 1: 일정관리에서 실사 시간 설정
1. 일정관리 → 새 이벤트 생성
2. 실사 타입 이벤트 생성 (라벨: 견적실사/착공전실사/준공실사)
3. 시작 시간, 종료 시간 입력
4. 저장 후 일정관리에서 시간 표시 확인

#### 테스트 2: 사업장관리에서 실사일 변경
1. 사업장관리 → 사업장 선택 → 수정
2. 견적실사 날짜 변경
3. 일정관리에서 해당 이벤트 날짜 자동 변경 확인
4. 시간 정보는 NULL로 초기화 확인

---

## 📈 향후 확장 (2단계)

### business_info에 시간 필드 추가

완전한 양방향 시간 동기화를 위해서는:

1. **DB 스키마 확장**:
```sql
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS estimate_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS estimate_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_end_time TIME;
```

2. **트리거 함수 수정**:
- `sync_business_to_survey_events()`: 시간 필드 동기화 추가
- `sync_survey_to_business_info()`: 시간 필드 동기화 추가

3. **사업장관리 UI 수정**:
- 수정모달에 시간 입력 필드 추가
- `<input type="time">` 또는 시간 선택 컴포넌트

---

## 🔍 관련 파일

- **SQL**: [`sql/add_time_to_survey_events.sql`](../sql/add_time_to_survey_events.sql)
- **API**: [`app/api/survey-events/route.ts`](../app/api/survey-events/route.ts)
- **UI**: [`components/boards/CalendarBoard.tsx`](../components/boards/CalendarBoard.tsx)
- **분석 문서**: [`claudedocs/survey-time-sync-analysis.md`](./survey-time-sync-analysis.md)

---

**작성**: Claude Code (Sonnet 4.5)
**구현 완료**: 2025-12-02
