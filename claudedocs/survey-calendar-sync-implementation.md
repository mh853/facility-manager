# 실사 정보 - 일정관리 동기화 구현 문서

## 📋 개요

사업장관리의 실사 정보(견적실사, 착공전실사, 준공실사)와 일정관리를 양방향 동기화하는 시스템 구현

**구현일**: 2025-12-02
**구현 방식**: 통합 테이블 + 양방향 트리거

---

## 🎯 요구사항

### 1. 기능 요구사항
- **양방향 동기화**: 사업장관리 또는 일정관리 중 어디서 변경하든 자동 반영
- **3가지 실사 타입 지원**: 견적실사, 착공전실사, 준공실사
- **실시간 업데이트**: 한 쪽에서 변경하면 즉시 다른 쪽에 반영
- **일정관리 라벨**: 실사 타입별로 라벨 자동 할당

### 2. 기술 요구사항
- PostgreSQL 트리거를 활용한 자동 동기화
- 기존 `business_info` 및 `calendar_events` 데이터 유지
- 별도의 `survey_events` 테이블로 실사 전용 관리
- API 레벨에서의 병렬 데이터 조회

---

## 🏗️ 아키텍처

### 데이터베이스 구조

```
business_info (기존 테이블)
├─ id: UUID (PK)                 ⚠️ UUID 타입 (중요!)
├─ estimate_survey_date          (견적실사일)
├─ estimate_survey_manager        (견적실사 담당자)
├─ pre_construction_survey_date   (착공전실사일)
├─ pre_construction_survey_manager (착공전실사 담당자)
├─ completion_survey_date         (준공실사일)
└─ completion_survey_manager      (준공실사 담당자)
        ↕ 양방향 트리거 동기화
survey_events (신규 테이블 - 실사 전용)
├─ id: TEXT              (PK: 'estimate-survey-{uuid}' 형식, UUID를 TEXT로 변환)
├─ title                 ('{사업장명} - {실사타입}')
├─ event_date            (실사일)
├─ labels                (['견적실사'] | ['착공전실사'] | ['준공실사'])
├─ business_id: UUID     (FK → business_info.id) ⚠️ UUID 타입으로 외래 키 설정
├─ business_name         (사업장명)
├─ author_name           (담당자명)
├─ survey_type           ('estimate_survey' | 'pre_construction_survey' | 'completion_survey')
├─ description           (설명)
├─ created_at
└─ updated_at
```

### 라벨 매핑

| 사업장관리 필드 | survey_type | 일정관리 라벨 |
|--------------|-------------|-------------|
| `estimate_survey_date` | `estimate_survey` | `"견적실사"` |
| `pre_construction_survey_date` | `pre_construction_survey` | `"착공전실사"` |
| `completion_survey_date` | `completion_survey` | `"준공실사"` |

---

## 🔧 구현 상세

### 1. 데이터베이스 스키마

**파일**: [`/sql/create_survey_calendar_sync.sql`](../sql/create_survey_calendar_sync.sql)

#### 1-1. `survey_events` 테이블 생성
```sql
CREATE TABLE IF NOT EXISTS survey_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_id UUID, -- ⚠️ UUID 타입 (business_info.id와 일치)
  business_name TEXT,
  author_name TEXT,
  event_type TEXT DEFAULT 'survey',
  survey_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_business_info
    FOREIGN KEY (business_id)
    REFERENCES business_info(id)
    ON DELETE CASCADE
);
```

#### 1-2. 양방향 동기화 트리거

**A. business_info → survey_events 트리거**
```sql
CREATE OR REPLACE FUNCTION sync_business_to_survey_events()
RETURNS TRIGGER AS $$
BEGIN
  -- 견적실사 동기화
  IF NEW.estimate_survey_date IS NOT NULL THEN
    INSERT INTO survey_events (...)
    ON CONFLICT (id) DO UPDATE SET ...;
  ELSE
    DELETE FROM survey_events WHERE id = CONCAT('estimate-survey-', NEW.id);
  END IF;

  -- 착공전실사, 준공실사도 동일 패턴
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_business_to_survey
  AFTER INSERT OR UPDATE OF
    estimate_survey_date, estimate_survey_manager,
    pre_construction_survey_date, pre_construction_survey_manager,
    completion_survey_date, completion_survey_manager
  ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_survey_events();
```

**B. survey_events → business_info 역방향 트리거**
```sql
CREATE OR REPLACE FUNCTION sync_survey_to_business_info()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.survey_type = 'estimate_survey' THEN
    UPDATE business_info
    SET estimate_survey_date = NEW.event_date,
        estimate_survey_manager = NEW.author_name,
        updated_at = NOW()
    WHERE id = NEW.business_id;
  ELSIF NEW.survey_type = 'pre_construction_survey' THEN
    UPDATE business_info ...;
  ELSIF NEW.survey_type = 'completion_survey' THEN
    UPDATE business_info ...;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_survey_to_business
  AFTER INSERT OR UPDATE OF event_date, author_name
  ON survey_events
  FOR EACH ROW
  EXECUTE FUNCTION sync_survey_to_business_info();
```

---

### 2. API 엔드포인트

**파일**: [`/app/api/survey-events/route.ts`](../app/api/survey-events/route.ts)

#### GET `/api/survey-events`
- **목적**: 실사 이벤트 조회 (월별, 사업장별 필터링 가능)
- **파라미터**:
  - `month`: YYYY-MM 형식 (예: `2025-12`)
  - `businessId`: 특정 사업장 실사만 조회

#### POST `/api/survey-events`
- **목적**: 실사 이벤트 생성 (트리거로 business_info 자동 업데이트)
- **Body**:
  ```json
  {
    "business_id": "business-123",
    "business_name": "테스트 사업장",
    "survey_type": "estimate_survey",
    "event_date": "2025-12-15",
    "author_name": "홍길동",
    "description": "견적실사 예정"
  }
  ```

#### PUT `/api/survey-events`
- **목적**: 실사 이벤트 수정 (트리거로 business_info 자동 업데이트)
- **Body**:
  ```json
  {
    "id": "estimate-survey-business-123",
    "event_date": "2025-12-20",
    "author_name": "김철수"
  }
  ```

#### DELETE `/api/survey-events?id={id}`
- **목적**: 실사 이벤트 삭제 (business_info의 해당 날짜도 NULL로 업데이트)

---

### 3. UI 통합

#### 3-1. CalendarBoard 컴포넌트

**파일**: [`/components/boards/CalendarBoard.tsx`](../components/boards/CalendarBoard.tsx)

**변경 사항**:
- `fetchEvents()` 함수에서 일반 이벤트와 실사 이벤트를 병렬 조회
- 두 데이터를 통합하여 캘린더에 표시

```typescript
const fetchEvents = async (scrollToBottom = false) => {
  // 병렬로 일반 이벤트와 실사 이벤트 조회
  const [calendarResponse, surveyResponse] = await Promise.all([
    fetch(`/api/calendar?start_date=${startDate}&end_date=${endDate}`),
    fetch(`/api/survey-events?month=${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)
  ]);

  const calendarResult = await calendarResponse.json();
  const surveyResult = await surveyResponse.json();

  // 실사 이벤트를 CalendarEvent 형식으로 변환
  const surveyEvents: CalendarEvent[] = (surveyResult.data || []).map((survey: any) => ({
    id: survey.id,
    title: survey.title,
    event_date: survey.event_date,
    event_type: 'schedule',
    labels: survey.labels,
    business_id: survey.business_id,
    business_name: survey.business_name,
    author_name: survey.author_name,
    // ...
  }));

  // 일반 이벤트와 실사 이벤트 통합
  const mergedEvents = [...(calendarResult.data || []), ...surveyEvents];
  setEvents(mergedEvents);
};
```

#### 3-2. 사업장관리 페이지

**파일**: [`/app/admin/business/page.tsx`](../app/admin/business/page.tsx#L4543-L4630)

**기존 구조 유지**:
- 실사 관리 영역의 입력 필드는 그대로 유지
- `formData.estimate_survey_date` 등을 변경하면 자동으로 트리거가 동작
- 별도의 API 호출 없이 `business_info` 업데이트만으로 동기화 완료

---

## 🔄 동기화 흐름

### Case 1: 사업장관리에서 실사일 입력
```
사용자 입력 (사업장관리)
  ↓
formData.estimate_survey_date 변경
  ↓
PUT /api/businesses/{id} (business_info UPDATE)
  ↓
[트리거 자동 실행] sync_business_to_survey_events()
  ↓
survey_events 테이블에 INSERT/UPDATE/DELETE
  ↓
일정관리에서 자동 표시
```

### Case 2: 일정관리에서 실사 이벤트 생성
```
사용자 입력 (일정관리)
  ↓
POST /api/survey-events
  ↓
survey_events 테이블에 INSERT
  ↓
[트리거 자동 실행] sync_survey_to_business_info()
  ↓
business_info 테이블의 해당 필드 UPDATE
  ↓
사업장관리에서 자동 표시
```

---

## 🧪 테스트 시나리오

### 1. 사업장관리 → 일정관리 동기화 테스트
1. **사업장관리** 페이지에서 특정 사업장의 "견적실사일" 입력
2. **일정관리** 페이지로 이동
3. ✅ 해당 날짜에 "{사업장명} - 견적실사" 라벨 이벤트 표시 확인

### 2. 일정관리 → 사업장관리 동기화 테스트
1. **일정관리** 페이지에서 "착공전실사" 라벨로 새 이벤트 생성 (사업장 선택)
2. **사업장관리** 페이지에서 해당 사업장 상세 확인
3. ✅ "착공전실사일"과 "담당자" 필드에 자동 입력 확인

### 3. 수정 동기화 테스트
1. **사업장관리**에서 "준공실사일"을 다른 날짜로 변경
2. **일정관리** 확인
3. ✅ 기존 이벤트가 새 날짜로 이동 확인

### 4. 삭제 동기화 테스트
1. **일정관리**에서 실사 이벤트 삭제
2. **사업장관리** 확인
3. ✅ 해당 실사일 필드가 비워짐(NULL) 확인

---

## 📊 성능 최적화

### 1. 인덱스 설정
```sql
CREATE INDEX idx_survey_events_date ON survey_events(event_date);
CREATE INDEX idx_survey_events_business_id ON survey_events(business_id);
CREATE INDEX idx_survey_events_survey_type ON survey_events(survey_type);
CREATE INDEX idx_survey_events_labels ON survey_events USING GIN(labels);
```

### 2. 병렬 데이터 조회
```typescript
// CalendarBoard에서 Promise.all로 병렬 조회
const [calendarResponse, surveyResponse] = await Promise.all([...]);
```

---

## ⚠️ 주의사항

### 1. 트리거 동작 순서
- `business_info` 업데이트 시: 자동으로 `survey_events`가 UPSERT됨
- `survey_events` 업데이트 시: 자동으로 `business_info`가 UPDATE됨
- **무한 루프 방지**: 트리거는 각 방향에서 1회만 실행되도록 설계

### 2. 데이터 일관성
- `survey_events.id` 형식: `{survey_type}-{uuid}`
- 예: `estimate-survey-123e4567-e89b-12d3-a456-426614174000`
- `business_id`는 UUID 타입으로 저장 (외래 키 제약조건 적용)
- ID에서 UUID 추출 시: `id.replace('estimate-survey-', '')`

### 3. 삭제 동작
- `business_info`의 실사 날짜를 NULL로 설정 → 해당 `survey_events` 자동 삭제
- `survey_events` 삭제 → `business_info`의 실사 날짜 NULL로 업데이트

---

## 🚀 배포 절차

### 1. 데이터베이스 마이그레이션
```bash
# Supabase SQL Editor에서 실행
psql -f sql/create_survey_calendar_sync.sql
```

### 2. 초기 데이터 동기화
```sql
-- 기존 business_info의 실사 정보를 survey_events로 마이그레이션
-- (스크립트에 포함되어 있음)
```

### 3. 애플리케이션 배포
```bash
git add .
git commit -m "feat: 실사 정보-일정관리 양방향 동기화 구현"
git push origin main
```

### 4. 검증 쿼리
```sql
-- 동기화 상태 확인
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

---

## 📝 향후 개선 사항

### 1. 알림 기능
- 실사일 D-7, D-3, D-1 자동 알림
- 담당자에게 이메일/SMS 발송

### 2. 일정 충돌 감지
- 같은 날 여러 실사가 겹치는 경우 경고
- 담당자 일정 관리 지원

### 3. 실사 완료 체크
- 실사 완료 여부 표시
- 완료된 실사는 아카이빙

### 4. 통계 및 리포트
- 월별/분기별 실사 통계
- 담당자별 실사 건수
- 실사 타입별 소요 시간 분석

---

## 🐛 트러블슈팅

### 문제 1: Foreign Key 제약조건 오류
**오류 메시지**:
```
ERROR: 42804: foreign key constraint "fk_business_info" cannot be implemented
DETAIL: Key columns "business_id" and "id" are of incompatible types: text and uuid.
```

**원인**:
- `business_info.id`는 UUID 타입
- `survey_events.business_id`를 TEXT로 정의하면 외래 키 설정 불가

**해결책**:
```sql
-- ❌ 잘못된 정의
CREATE TABLE survey_events (
  business_id TEXT, -- 틀림!
  FOREIGN KEY (business_id) REFERENCES business_info(id)
);

-- ✅ 올바른 정의
CREATE TABLE survey_events (
  business_id UUID, -- UUID 타입으로 변경
  FOREIGN KEY (business_id) REFERENCES business_info(id)
);
```

**주의사항**:
- `survey_events.id`는 TEXT 타입 유지 (복합 키: `'estimate-survey-{uuid}'`)
- `survey_events.business_id`는 UUID 타입 (외래 키 참조용)
- UUID를 TEXT로 변환할 때: `uuid_column::text`
- TEXT를 UUID로 변환할 때: `text_column::uuid`

---

## 🔗 관련 파일

- **SQL 스키마**: [`/sql/create_survey_calendar_sync.sql`](../sql/create_survey_calendar_sync.sql)
- **API**: [`/app/api/survey-events/route.ts`](../app/api/survey-events/route.ts)
- **UI (일정관리)**: [`/components/boards/CalendarBoard.tsx`](../components/boards/CalendarBoard.tsx)
- **UI (사업장관리)**: [`/app/admin/business/page.tsx`](../app/admin/business/page.tsx)
- **타입 정의**: [`/types/index.ts`](../types/index.ts)

---

## 📅 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|-----|------|---------|--------|
| 2025-12-02 | 1.0 | 초기 구현 완료 | Claude |

---

**작성**: Claude Code (Sonnet 4.5)
**최종 수정**: 2025-12-02
