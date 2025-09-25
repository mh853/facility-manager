# 다중 담당자 알림 시스템 아키텍처

## 현재 문제점

1. **DB 스키마 불일치**
   - `facility_tasks.assignee` (TEXT) - 단일 담당자
   - UI `assignees` (SelectedAssignee[]) - 다중 담당자
   - `task_notifications.user_id` - 단일 수신자

2. **업무-알림 연결**
   - 업무 할당/변경 시 담당자들에게 자동 알림 생성 미흡
   - 다중 담당자 지원 부족

## 제안 아키텍처

### 1. DB 스키마 개선

#### A. facility_tasks 테이블 다중 담당자 지원
```sql
-- 기존 assignee (TEXT) 유지 (호환성)
-- 새로운 assignees 컬럼 추가
ALTER TABLE facility_tasks ADD COLUMN assignees JSONB;

-- 예시 데이터 구조:
-- assignees: [
--   {"id": "uuid1", "name": "김철수", "email": "kim@example.com"},
--   {"id": "uuid2", "name": "이영희", "email": "lee@example.com"}
-- ]
```

#### B. task_notifications 다중 생성 지원
```sql
-- 현재 구조 유지, 다중 알림은 여러 레코드로 생성
-- 한 업무당 담당자 수만큼 알림 레코드 생성
```

### 2. 알림 생성 로직

#### 업무 할당/변경 시 자동 알림 생성
```typescript
// 업무 생성/수정 시
async function createTaskNotifications(task: Task, assignees: SelectedAssignee[]) {
  const notifications = assignees.map(assignee => ({
    user_id: assignee.id,
    task_id: task.id,
    business_name: task.businessName,
    message: `"${task.title}" 업무가 담당자로 배정되었습니다. (${task.businessName})`,
    notification_type: 'assignment',
    priority: task.priority,
    metadata: {
      task_type: task.type,
      assigned_by: currentUser.name
    }
  }));

  // 각 담당자에게 개별 알림 생성
  return await createMultipleNotifications(notifications);
}
```

### 3. 알림 표시 로직

#### 로그인한 사용자의 담당 업무 알림만 표시
```typescript
// 알림 조회 시
async function getUserTaskNotifications(userId: string) {
  return await supabase
    .from('task_notifications')
    .select('*')
    .eq('user_id', userId)  // 현재 사용자가 담당자인 알림만
    .order('created_at', { ascending: false });
}
```

## 데이터 흐름

```
업무 생성/수정
    ↓
담당자 선택 (다중)
    ↓
각 담당자별 알림 생성
    ↓
담당자별 알림함에 표시
    ↓
담당자가 로그인 시 본인 알림만 확인
```

## 구현 단계

### 1단계: DB 스키마 업데이트
- `facility_tasks.assignees` JSONB 컬럼 추가
- 기존 데이터 호환성 유지

### 2단계: API 업데이트
- 업무 생성/수정 시 다중 알림 생성
- 담당자 변경 시 기존 알림 정리 + 새 알림 생성

### 3단계: 알림 조회 로직 개선
- 사용자별 담당 업무 알림 필터링
- 실시간 업데이트 지원

### 4단계: UI 연동
- 다중 담당자 선택 → 알림 생성 연동
- 알림 페이지에서 담당 업무 중심 표시

## 고려사항

### 장점
- ✅ 실제 업무 흐름에 맞는 알림
- ✅ 다중 담당자 지원
- ✅ 개별 알림 관리 (읽음/삭제)

### 주의사항
- 담당자 변경 시 기존 알림 처리 필요
- 대량 업무의 경우 알림 개수 증가
- 실시간 동기화 복잡도 증가

## 예시 시나리오

```
업무: "스타일웍스 대기배출시설 설치"
담당자: [김철수, 이영희]

→ 알림 생성:
  - 김철수에게: "스타일웍스 대기배출시설 설치" 업무 배정 알림
  - 이영희에게: "스타일웍스 대기배출시설 설치" 업무 배정 알림

→ 알림 표시:
  - 김철수 로그인 시: 본인이 담당자인 알림만 표시
  - 이영희 로그인 시: 본인이 담당자인 알림만 표시
```