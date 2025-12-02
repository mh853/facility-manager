# 캘린더 라벨 필터 수정 - 실사 라벨 누락 문제 해결

## 문제 상황

일정관리(CalendarBoard)에서 라벨 필터 기능 중 실사 관련 라벨(견적실사, 착공전실사, 준공실사)이 표시되지 않는 문제 발생.

## 근본 원인 분석

### 데이터 흐름
1. **CalendarBoard 컴포넌트**는 두 개의 API에서 이벤트 데이터를 가져옴:
   - `/api/calendar` → `calendar_events` 테이블 조회
   - `/api/survey-events` → `survey_events` 테이블 조회

2. **라벨 필터 목록**은 `/api/calendar/labels`에서 가져옴

### 문제의 핵심
`/api/calendar/labels` 엔드포인트가 `calendar_events` 테이블만 조회하고 `survey_events` 테이블은 조회하지 않음.

```typescript
// ❌ 기존 코드 (문제)
const { data, error } = await supabase
  .from('calendar_events')  // calendar_events만 조회
  .select('labels')
  .eq('is_deleted', false)
  .not('labels', 'is', null);
```

**결과**: 실사 이벤트의 라벨(견적실사, 착공전실사, 준공실사)이 필터 옵션에 표시되지 않음.

## 해결 방법

### 수정된 파일
- `/app/api/calendar/labels/route.ts`

### 변경 내용
병렬로 두 테이블의 라벨을 모두 조회하도록 수정:

```typescript
// ✅ 수정된 코드
const [calendarResult, surveyResult] = await Promise.all([
  // 일반 캘린더 이벤트 라벨
  supabase
    .from('calendar_events')
    .select('labels')
    .eq('is_deleted', false)
    .not('labels', 'is', null),

  // 실사 이벤트 라벨
  supabase
    .from('survey_events')
    .select('labels')
    .eq('event_type', 'survey')
    .not('labels', 'is', null)
]);

// 두 소스의 라벨을 모두 통합
const allLabels = new Set<string>();

// 일반 이벤트 라벨 추가
calendarResult.data?.forEach((event) => {
  if (event.labels && Array.isArray(event.labels)) {
    event.labels.forEach((label: string) => {
      if (label && label.trim()) {
        allLabels.add(label.trim());
      }
    });
  }
});

// 실사 이벤트 라벨 추가
surveyResult.data?.forEach((event) => {
  if (event.labels && Array.isArray(event.labels)) {
    event.labels.forEach((label: string) => {
      if (label && label.trim()) {
        allLabels.add(label.trim());
      }
    });
  }
});
```

### 주요 개선 사항
1. **병렬 조회**: `Promise.all`로 두 테이블을 동시에 조회하여 성능 최적화
2. **통합 처리**: `Set`을 사용하여 중복 제거 및 두 소스의 라벨 통합
3. **로깅 추가**: 각 소스별 이벤트 수와 고유 라벨 수를 콘솔에 출력

```typescript
console.log(`✅ [라벨 조회 완료] 일반 이벤트: ${calendarResult.data?.length || 0}개, 실사 이벤트: ${surveyResult.data?.length || 0}개, 고유 라벨: ${uniqueLabels.length}개`);
```

## 검증 방법

### 1. API 응답 확인
```bash
# 라벨 목록 조회
curl http://localhost:3000/api/calendar/labels

# 예상 응답
{
  "success": true,
  "labels": [
    "견적실사",
    "착공전실사",
    "준공실사",
    "기타 일반 라벨..."
  ],
  "total": [라벨 개수]
}
```

### 2. 브라우저 콘솔 확인
일정관리 페이지 접속 시 다음 로그 확인:
```
✅ [라벨 조회 완료] 일반 이벤트: X개, 실사 이벤트: Y개, 고유 라벨: Z개
```

### 3. UI 확인
- 일정관리 페이지의 라벨 필터 드롭다운에 실사 라벨 표시 여부 확인
- 필터 선택 시 해당 라벨의 이벤트만 표시되는지 확인

## 관련 파일

### 수정된 파일
- `/app/api/calendar/labels/route.ts` - 라벨 목록 조회 API (메인 수정)

### 관련 파일 (수정 없음)
- `/components/boards/CalendarBoard.tsx` - 라벨 목록 사용하는 UI 컴포넌트
- `/app/api/survey-events/route.ts` - 실사 이벤트 CRUD API
- `/sql/simple_resync_survey_events.sql` - 실사 이벤트 데이터 동기화 스크립트

## 기술적 세부사항

### 데이터 구조
- `calendar_events.labels`: TEXT[] (PostgreSQL 배열 타입)
- `survey_events.labels`: TEXT[] (PostgreSQL 배열 타입)

### Supabase 쿼리
- `.not('labels', 'is', null)`: NULL이 아닌 라벨만 조회
- `.eq('event_type', 'survey')`: 실사 이벤트만 필터링

### JavaScript 처리
- `Set<string>`: 중복 제거를 위한 자료구조
- `.sort()`: 한글 가나다순 정렬
- `.trim()`: 공백 제거 및 정규화

## 빌드 검증

```bash
npm run build
# ✅ 빌드 성공 확인
```

## 배포 후 확인사항

1. 라벨 필터에 실사 관련 라벨 표시 확인
2. 각 라벨 선택 시 올바른 이벤트 필터링 확인
3. 성능 이슈 없는지 확인 (병렬 조회로 성능 개선 예상)

## 참고

이 수정은 이전 세션에서 완료한 survey_events 동기화 작업의 후속 조치입니다:
- `simple_resync_survey_events.sql` 실행으로 데이터 마이그레이션 완료
- 실사 이벤트가 calendar에 정상 표시되는 것 확인
- 라벨 필터만 누락된 상태였음
