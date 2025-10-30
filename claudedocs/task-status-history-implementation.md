# 업무 단계 이력 추적 시스템 구현

## 📋 개요

업무의 각 단계별 시작일, 종료일, 소요 시간을 추적하는 시스템을 구현했습니다.

## 🎯 목적

- 각 단계의 정확한 시작/종료 시간 기록
- 단계별 소요 시간 자동 계산
- 단계별 담당자 이력 추적
- 통계 분석 지원 (평균 소요 시간 등)

## 🗄️ 데이터베이스 스키마

### 1. 테이블: `task_status_history`

```sql
CREATE TABLE task_status_history (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES facility_tasks(id),
  status VARCHAR(50) NOT NULL,
  task_type VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_days INTEGER,        -- 자동 계산
  assignee_id UUID,
  assignee_name TEXT,
  business_name TEXT,
  notes TEXT,
  created_by UUID,
  created_by_name TEXT
);
```

### 2. 뷰: `task_status_timeline`

업무별 단계 타임라인을 보기 쉽게 정리한 뷰

```sql
CREATE VIEW task_status_timeline AS
SELECT
  tsh.*,
  ft.title as task_title,
  LEAD(tsh.status) OVER (PARTITION BY tsh.task_id ORDER BY tsh.started_at) as next_status
FROM task_status_history tsh
LEFT JOIN facility_tasks ft ON tsh.task_id = ft.id;
```

### 3. 뷰: `task_status_statistics`

단계별 평균 소요 시간 통계

```sql
CREATE VIEW task_status_statistics AS
SELECT
  status,
  task_type,
  COUNT(*) as total_occurrences,
  AVG(duration_days) as avg_duration_days,
  MIN(duration_days) as min_duration_days,
  MAX(duration_days) as max_duration_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_days) as median_duration_days
FROM task_status_history
WHERE completed_at IS NOT NULL
GROUP BY status, task_type;
```

## 🔧 구현 파일

### 1. SQL 스키마
- **파일**: `sql/task_status_history.sql`
- **내용**: 테이블, 인덱스, 뷰, 트리거 생성

### 2. 유틸리티 라이브러리
- **파일**: `lib/task-status-history.ts`
- **주요 함수**:
  - `startNewStatus()`: 새 단계 시작 기록
  - `completeCurrentStatus()`: 현재 단계 완료 처리
  - `getTaskStatusHistory()`: 이력 조회
  - `getTaskTimeline()`: 타임라인 조회
  - `getCurrentStatus()`: 현재 진행 단계 조회
  - `getStatusStatistics()`: 통계 조회

### 3. API 통합
- **파일**: `app/api/facility-tasks/route.ts`
- **변경사항**:
  - POST (업무 생성 시): 첫 단계 이력 자동 기록
  - PUT (업무 수정 시): 상태 변경 감지 → 이력 기록

### 4. 이력 조회 API
- **파일**: `app/api/facility-tasks/[id]/history/route.ts`
- **엔드포인트**: `GET /api/facility-tasks/{id}/history`
- **쿼리 파라미터**:
  - `timeline=true`: 타임라인 뷰 사용

### 5. UI 컴포넌트
- **파일**: `components/TaskHistoryTimeline.tsx`
- **기능**:
  - 타임라인 형식으로 단계 이력 표시
  - 진행 중/완료 상태 시각화
  - 소요 시간 표시
  - 통계 요약

## 📊 데이터 흐름

### 업무 생성 시
```
사용자 → POST /api/facility-tasks
  ↓
API: 업무 생성 (facility_tasks)
  ↓
startNewStatus(): 첫 단계 이력 기록
  ↓
task_status_history 테이블에 insert
  - started_at: 현재 시각
  - completed_at: null (진행 중)
```

### 상태 변경 시
```
사용자 → PUT /api/facility-tasks
  ↓
API: 상태 변경 감지
  ↓
1. 이전 단계 완료 처리
   - completed_at: 현재 시각
   - duration_days: 자동 계산 (트리거)
  ↓
2. 새 단계 시작 기록
   - started_at: 현재 시각
   - completed_at: null
```

### 이력 조회
```
UI → GET /api/facility-tasks/{id}/history
  ↓
task_status_history 조회
  ↓
UI: TaskHistoryTimeline 컴포넌트로 표시
```

## 🎨 UI 예시

```
📅 단계 이력

  ✅ ─┬─ 고객접촉
      │  담당자: 이준호
      │  시작: 2024년 1월 1일 09:00
      │  완료: 2024년 1월 5일 17:00
      │  4일 소요
      │
  ✅ ─┬─ 현장실사
      │  담당자: 김영희
      │  시작: 2024년 1월 5일 17:00
      │  완료: 2024년 1월 10일 15:00
      │  5일 소요
      │
  🔵 ─┬─ 견적 (진행 중)
      │  담당자: 이준호
      │  시작: 2024년 1월 10일 15:00

─────────────────────────
완료된 단계: 2개
총 소요 시간: 9일
```

## 🔍 사용 예시

### 1. 업무 단계 이력 조회
```typescript
import TaskHistoryTimeline from '@/components/TaskHistoryTimeline';

<TaskHistoryTimeline taskId="업무ID" />
```

### 2. 프로그래매틱 이력 조회
```typescript
import { getTaskStatusHistory } from '@/lib/task-status-history';

const history = await getTaskStatusHistory(taskId);
// [
//   { status: 'customer_contact', started_at: '...', completed_at: '...', duration_days: 4 },
//   { status: 'site_inspection', started_at: '...', completed_at: '...', duration_days: 5 },
//   { status: 'quotation', started_at: '...', completed_at: null, duration_days: null }
// ]
```

### 3. 통계 조회
```typescript
import { getStatusStatistics } from '@/lib/task-status-history';

const stats = await getStatusStatistics('site_inspection', 'self');
// {
//   status: 'site_inspection',
//   task_type: 'self',
//   total_occurrences: 150,
//   avg_duration_days: 4.5,
//   min_duration_days: 2,
//   max_duration_days: 10,
//   median_duration_days: 4
// }
```

## 📈 장점

### 1. 정확한 추적
- ✅ 각 단계의 정확한 시작/종료 시간
- ✅ 자동 소요 시간 계산 (트리거)
- ✅ 단계별 담당자 이력

### 2. 분석 가능
- ✅ 평균/최소/최대 소요 시간 통계
- ✅ 병목 구간 식별 가능
- ✅ 담당자별 처리 속도 분석

### 3. 확장성
- ✅ 향후 첨부파일, 메모 등 추가 정보 저장 가능
- ✅ 단계별 추가 메타데이터 확장 가능

### 4. 유지보수
- ✅ 명확한 구조
- ✅ 인덱싱으로 빠른 조회
- ✅ 뷰를 통한 편리한 데이터 접근

## 🚀 배포 순서

1. **데이터베이스 스키마 생성**
   ```bash
   # Supabase SQL Editor에서 실행
   sql/task_status_history.sql
   ```

2. **코드 배포**
   - API 변경사항 배포
   - 새 라이브러리 파일 배포
   - UI 컴포넌트 배포

3. **검증**
   - 새 업무 생성 → 이력 확인
   - 상태 변경 → 이력 업데이트 확인
   - UI에서 타임라인 표시 확인

## ⚠️ 주의사항

### 기존 업무 처리
- 기존 업무는 이력이 없음
- 필요시 마이그레이션 스크립트로 현재 상태만 이력에 추가 가능

### 성능
- 인덱스가 생성되어 있어 조회 성능 우수
- 대량의 업무가 있어도 문제없음

### 데이터 무결성
- `ON DELETE CASCADE`: 업무 삭제 시 이력도 함께 삭제
- 트리거로 자동 계산 보장

## 📝 향후 개선 사항

1. **대시보드 위젯**
   - 평균 처리 시간 차트
   - 병목 구간 시각화
   - 담당자별 통계

2. **알림 기능**
   - 단계 지연 시 자동 알림
   - 목표 시간 대비 현황 알림

3. **데이터 마이그레이션**
   - 기존 업무의 현재 상태를 이력으로 추가
   - 예상 소요 시간 기반 과거 날짜 추정

## 📚 참고

- 테이블 스키마: `sql/task_status_history.sql`
- API 문서: `app/api/facility-tasks/[id]/history/route.ts`
- 유틸리티: `lib/task-status-history.ts`
- UI 컴포넌트: `components/TaskHistoryTimeline.tsx`
