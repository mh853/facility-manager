# 단계 이력 확인 방법 가이드

## 📍 어디서 확인하나요?

### 1. **업무 관리 페이지** (`/admin/tasks`)

#### 방법 1: 업무 카드 클릭
1. 업무 관리 페이지로 이동
2. 칸반 보드에서 업무 카드 클릭
3. 업무 상세 모달이 열림
4. 하단의 **"단계 이력"** 섹션 클릭
5. "펼치기" 버튼 클릭하면 타임라인 표시

```
┌─────────────────────────────────┐
│ 업무 상세 모달                   │
├─────────────────────────────────┤
│ 📌 기본 정보                     │
│ 🏢 사업장 정보                   │
│ 📝 설명                          │
│ 📋 메모                          │
│                                 │
│ 📅 단계 이력  [펼치기]  ← 클릭! │
│   ↓ 펼치면                       │
│   ✅ 고객접촉 (4일 소요)         │
│   ✅ 현장실사 (5일 소요)         │
│   🔵 견적 (진행 중)              │
└─────────────────────────────────┘
```

#### 표시되는 정보:
- ✅ **단계명**: 고객접촉, 현장실사, 견적 등
- 📅 **시작일**: 2024년 1월 1일 09:00
- ✅ **완료일**: 2024년 1월 5일 17:00 (완료된 단계만)
- ⏱️ **소요 시간**: 4일 (자동 계산)
- 👤 **담당자**: 이준호
- 📝 **메모**: 단계별 추가 정보
- 📊 **통계**: 완료된 단계 수, 총 소요 시간

---

### 2. **API로 직접 조회**

개발자나 외부 시스템 연동 시:

```bash
# 특정 업무의 이력 조회
GET /api/facility-tasks/{업무ID}/history

# 타임라인 형식으로 조회
GET /api/facility-tasks/{업무ID}/history?timeline=true
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc-123",
      "status": "customer_contact",
      "started_at": "2024-01-01T09:00:00Z",
      "completed_at": "2024-01-05T17:00:00Z",
      "duration_days": 4,
      "assignee_name": "이준호"
    },
    {
      "status": "site_inspection",
      "started_at": "2024-01-05T17:00:00Z",
      "completed_at": "2024-01-10T15:00:00Z",
      "duration_days": 5,
      "assignee_name": "김영희"
    },
    {
      "status": "quotation",
      "started_at": "2024-01-10T15:00:00Z",
      "completed_at": null,
      "duration_days": null,
      "assignee_name": "이준호"
    }
  ]
}
```

---

### 3. **Supabase 데이터베이스에서 직접 조회**

관리자가 SQL로 직접 확인:

```sql
-- 특정 업무의 단계 이력 조회
SELECT
  status,
  started_at,
  completed_at,
  duration_days,
  assignee_name,
  notes
FROM task_status_history
WHERE task_id = '업무ID'
ORDER BY started_at ASC;

-- 타임라인 뷰 사용 (다음 단계 정보 포함)
SELECT * FROM task_status_timeline
WHERE task_id = '업무ID';

-- 사업장별 모든 이력 조회
SELECT
  tsh.*,
  ft.title as task_title
FROM task_status_history tsh
JOIN facility_tasks ft ON tsh.task_id = ft.id
WHERE tsh.business_name = '농업회사법인 주식회사 건양'
ORDER BY tsh.started_at DESC;
```

---

## 🎯 UI 동작 흐름

### 업무 생성 시
```
1. 새 업무 생성
   └─> "고객접촉" 단계로 시작
   └─> task_status_history에 자동 기록
       ✅ started_at: 현재 시각
       ⏳ completed_at: null (진행 중)
```

### 단계 변경 시
```
2. "고객접촉" → "현장실사"로 변경
   └─> 이전 단계 자동 완료 처리
       ✅ completed_at: 현재 시각
       📊 duration_days: 4 (자동 계산)
   └─> 새 단계 시작 기록
       ✅ started_at: 현재 시각
       ⏳ completed_at: null
```

### 이력 조회 시
```
3. 업무 카드 클릭 → 모달 열림
   └─> "단계 이력" 섹션 클릭
   └─> API 호출: GET /api/facility-tasks/{id}/history
   └─> 타임라인 형식으로 표시
       ✅ 고객접촉 (완료, 4일 소요)
       ✅ 현장실사 (완료, 5일 소요)
       🔵 견적 (진행 중)
```

---

## 📊 타임라인 UI 예시

```
📅 단계 이력
─────────────────────────────────

  ✅ ─┬─ 고객접촉
      │  담당자: 이준호
      │  시작: 2024년 1월 1일 09:00
      │  완료: 2024년 1월 5일 17:00
      │  소요: 4일
      │  메모: 업무 생성 - 대기배출시설 설치 검토
      │
  ✅ ─┬─ 현장실사
      │  담당자: 김영희
      │  시작: 2024년 1월 5일 17:00
      │  완료: 2024년 1월 10일 15:00
      │  소요: 5일
      │  메모: 단계 변경: 고객접촉 → 현장실사
      │
  🔵 ─┬─ 견적 (진행 중)
      │  담당자: 이준호
      │  시작: 2024년 1월 10일 15:00
      │  메모: 단계 변경: 현장실사 → 견적

─────────────────────────────────
완료된 단계: 2개
총 소요 시간: 9일
```

---

## ⚠️ 주의사항

### 기존 업무
- **이미 진행 중인 업무**는 과거 이력이 없습니다
- 앞으로 상태를 변경할 때부터 이력이 쌓입니다
- 필요시 관리자가 SQL로 수동 추가 가능

### 이력 데이터
- 업무 삭제 시 이력도 함께 삭제됩니다
- 이력은 수정할 수 없고 조회만 가능합니다
- 소요 시간은 자동으로 계산됩니다

---

## 🚀 배포 체크리스트

### 1. 데이터베이스 설정
- [ ] Supabase SQL Editor에서 `sql/task_status_history.sql` 실행
- [ ] `task_status_history` 테이블 생성 확인
- [ ] 뷰 생성 확인 (`task_status_timeline`, `task_status_statistics`)

### 2. 기능 테스트
- [ ] 새 업무 생성 → 이력 자동 기록 확인
- [ ] 상태 변경 → 이력 업데이트 확인
- [ ] 업무 모달에서 "단계 이력" 섹션 표시 확인
- [ ] 타임라인 UI 정상 작동 확인

### 3. 사용자 안내
- [ ] 사용자에게 새 기능 안내
- [ ] "단계 이력" 섹션 위치 설명
- [ ] 기존 업무는 이력이 없다는 점 안내

---

## 💡 활용 팁

### 1. 통계 분석
```sql
-- 단계별 평균 소요 시간 조회
SELECT * FROM task_status_statistics
WHERE status = 'site_inspection';

-- 가장 오래 걸린 단계 확인
SELECT
  business_name,
  status,
  duration_days
FROM task_status_history
WHERE completed_at IS NOT NULL
ORDER BY duration_days DESC
LIMIT 10;
```

### 2. 병목 구간 식별
```sql
-- 평균 이상으로 오래 걸리는 단계
WITH avg_durations AS (
  SELECT status, AVG(duration_days) as avg_days
  FROM task_status_history
  WHERE completed_at IS NOT NULL
  GROUP BY status
)
SELECT
  tsh.business_name,
  tsh.status,
  tsh.duration_days,
  ad.avg_days,
  (tsh.duration_days - ad.avg_days) as delay_days
FROM task_status_history tsh
JOIN avg_durations ad ON tsh.status = ad.status
WHERE tsh.duration_days > ad.avg_days
ORDER BY delay_days DESC;
```

### 3. 담당자별 처리 속도
```sql
-- 담당자별 평균 처리 시간
SELECT
  assignee_name,
  status,
  COUNT(*) as task_count,
  AVG(duration_days) as avg_duration
FROM task_status_history
WHERE completed_at IS NOT NULL
  AND assignee_name IS NOT NULL
GROUP BY assignee_name, status
ORDER BY assignee_name, status;
```

---

## 📚 관련 문서
- 구현 상세: `claudedocs/task-status-history-implementation.md`
- API 문서: `app/api/facility-tasks/[id]/history/route.ts`
- UI 컴포넌트: `components/TaskHistoryTimeline.tsx`
