# 실사-일정 시간 동기화 분석

## 📋 문제 정의

### 현재 상황
**사업장관리 (Business Management)**:
- 실사일 필드: `estimate_survey_date`, `pre_construction_survey_date`, `completion_survey_date`
- 데이터 타입: `DATE` (날짜만 저장, 시간 정보 없음)
- UI 입력 방식: `<input type="date">` (날짜만 선택 가능)

**일정관리 (Calendar Management)**:
- 이벤트 필드: `event_date`, `start_time`, `end_time`
- 데이터 타입:
  - `event_date`: DATE
  - `start_time`: TIME (HH:MM 형식)
  - `end_time`: TIME (HH:MM 형식)
- UI 입력 방식: 날짜 + 시간 별도 입력

### 문제점
1. **데이터 불일치**: 사업장관리는 날짜만, 일정관리는 날짜+시간 관리
2. **동기화 누락**: `survey_events` 테이블에 시간 필드 없음
3. **정보 손실**: 일정관리에서 시간을 설정해도 사업장관리에 반영 불가
4. **사용자 혼란**: 두 시스템 간 데이터 불일치로 혼란 발생

---

## 🏗️ 현재 스키마 분석

### 1. business_info 테이블
```sql
-- 실사 날짜만 저장 (시간 정보 없음)
estimate_survey_date DATE
estimate_survey_manager TEXT

pre_construction_survey_date DATE
pre_construction_survey_manager TEXT

completion_survey_date DATE
completion_survey_manager TEXT
```

### 2. survey_events 테이블 (현재)
```sql
CREATE TABLE survey_events (
  id TEXT PRIMARY KEY,
  event_date DATE NOT NULL,  -- ⚠️ 날짜만 저장
  -- start_time, end_time 필드 없음!
  ...
);
```

### 3. calendar_events 테이블 (참고)
```sql
CREATE TABLE calendar_events (
  event_date DATE NOT NULL,
  start_time TIME,  -- ✅ 시간 필드 있음
  end_time TIME,    -- ✅ 시간 필드 있음
  ...
);
```

---

## 🎯 해결 방안

### 방안 1: survey_events에 시간 필드 추가 (권장)

#### 장점
- 일정관리와 동일한 구조로 시간 정보 관리 가능
- 양방향 동기화 시 시간 정보 보존
- 향후 확장성 좋음 (시간대별 실사 일정 관리 가능)

#### 단점
- business_info 테이블은 여전히 날짜만 저장 (DATE 타입)
- 사업장관리 UI 수정 필요

#### 구현 방법
```sql
-- survey_events 테이블에 시간 필드 추가
ALTER TABLE survey_events
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_survey_events_start_time
  ON survey_events(start_time) WHERE start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_events_end_time
  ON survey_events(end_time) WHERE start_time IS NOT NULL;
```

**트리거 함수 수정**:
```sql
-- sync_business_to_survey_events() 수정
-- business_info에서 survey_events로 동기화 시
-- start_time, end_time은 NULL로 유지 (business_info에 시간 정보 없음)

-- sync_survey_to_business_info() 수정
-- survey_events에서 business_info로 동기화 시
-- 시간 정보는 무시 (business_info는 DATE 타입만 저장)
```

**CalendarBoard.tsx 수정**:
```typescript
const surveyEvents: CalendarEvent[] = (surveyResult.data || []).map((survey: any) => ({
  id: survey.id,
  title: survey.title,
  event_date: survey.event_date,
  start_time: survey.start_time || null,  // ✅ 시간 필드 추가
  end_time: survey.end_time || null,      // ✅ 시간 필드 추가
  ...
}));
```

---

### 방안 2: business_info에 시간 필드 추가 (완전한 해결)

#### 장점
- 사업장관리에서도 시간 정보 관리 가능
- 완전한 양방향 동기화 (날짜 + 시간 모두 동기화)
- 데이터 일관성 최대화

#### 단점
- business_info 테이블 스키마 변경 (총 6개 필드 추가 필요)
- 사업장관리 UI 대폭 수정 필요
- 기존 데이터 마이그레이션 복잡

#### 필요한 필드
```sql
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS estimate_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS estimate_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS pre_construction_survey_end_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_start_time TIME,
ADD COLUMN IF NOT EXISTS completion_survey_end_time TIME;
```

---

## 📊 비교표

| 항목 | 방안 1 (survey_events만) | 방안 2 (양쪽 모두) |
|-----|------------------------|------------------|
| **구현 난이도** | 🟢 쉬움 | 🔴 어려움 |
| **DB 스키마 변경** | survey_events만 | business_info + survey_events |
| **UI 수정 범위** | 없음 (선택사항) | 사업장관리 수정모달 필수 |
| **데이터 일관성** | 🟡 부분적 | 🟢 완전함 |
| **향후 확장성** | 🟢 좋음 | 🟢 매우 좋음 |
| **기존 데이터 영향** | 🟢 없음 | 🟡 마이그레이션 필요 |

---

## 🚀 권장 구현 단계

### 1단계: survey_events 시간 필드 추가 (즉시 적용 가능)

**작업 내용**:
1. `survey_events` 테이블에 `start_time`, `end_time` 추가
2. 트리거 함수는 그대로 유지 (시간 필드는 NULL)
3. API는 시간 필드 처리하도록 수정
4. CalendarBoard는 시간 필드 표시하도록 수정

**효과**:
- 일정관리에서 실사 이벤트에 시간 설정 가능
- 사업장관리는 날짜만 표시 (기존 동작 유지)
- 최소한의 변경으로 시간 정보 관리 시작

### 2단계: 사업장관리 UI 개선 (선택사항)

**작업 내용**:
1. business_info에 시간 필드 추가
2. 수정모달에 시간 입력 필드 추가
3. 트리거 함수에서 시간 동기화 로직 추가

**효과**:
- 완전한 양방향 시간 동기화
- 사업장관리에서도 실사 시간 관리 가능

---

## 💡 구현 권장사항

### 즉시 적용 (1단계)
**파일 수정**:
1. `sql/add_time_to_survey_events.sql` - 새로 생성
2. `app/api/survey-events/route.ts` - POST/PUT에 시간 필드 처리 추가
3. `components/boards/CalendarBoard.tsx` - surveyEvents 매핑에 시간 필드 추가

**장점**:
- 최소한의 변경으로 시간 정보 관리 시작
- 기존 기능 영향 없음
- 추후 2단계로 확장 가능

### 향후 적용 (2단계)
**파일 수정**:
1. `sql/add_time_to_business_info_surveys.sql` - 새로 생성
2. `sql/create_survey_calendar_sync.sql` - 트리거 함수에 시간 동기화 추가
3. `app/admin/business/page.tsx` - 수정모달에 시간 입력 추가

---

## 🔍 다음 작업

사용자가 선택할 수 있는 옵션:

1. **1단계만 구현** (권장):
   - survey_events에만 시간 필드 추가
   - 일정관리에서 시간 설정 가능
   - 사업장관리는 날짜만 표시

2. **1+2단계 모두 구현**:
   - 완전한 양방향 시간 동기화
   - 사업장관리 UI도 시간 입력 가능

어떤 방안으로 진행하시겠습니까?

---

**작성**: Claude Code (Sonnet 4.5)
**분석 완료**: 2025-12-02
