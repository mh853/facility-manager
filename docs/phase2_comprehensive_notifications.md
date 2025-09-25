# Phase 2: 포괄적 업무 알림 시스템

## 알림 유형 정의

### 1. 업무 할당 관련 (Phase 1에서 구현됨)
- `assignment`: 새 업무 할당
- `reassignment`: 담당자 변경

### 2. 상태 변경 관련
- `status_change`: 업무 진행 단계 변경
- `status_complete`: 업무 완료
- `status_pending`: 업무 대기 상태

### 3. 지연 및 경고 관련
- `delay_warning`: 지연 위험 경고 (마감일 3일 전)
- `delay_critical`: 지연 발생 (마감일 당일)
- `delay_overdue`: 연체 발생 (마감일 초과)

### 4. 우선순위 변경 관련
- `priority_increase`: 우선순위 상승
- `priority_decrease`: 우선순위 하락

### 5. 시스템 관련
- `comment_added`: 업무 댓글/노트 추가
- `file_attached`: 파일 첨부
- `schedule_change`: 일정 변경

## 알림 생성 트리거

### 1. 상태 변경 모니터링
```sql
-- 업무 상태 변경 시 담당자들에게 알림
CREATE OR REPLACE FUNCTION notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM create_status_change_notifications(
            NEW.id,
            NEW.assignees,
            OLD.status,
            NEW.status,
            NEW.business_name,
            NEW.title
        );
    END IF;
    RETURN NEW;
END;
$$;
```

### 2. 지연 모니터링 (스케줄러)
```sql
-- 매일 실행되는 지연 검사 함수
CREATE OR REPLACE FUNCTION check_task_delays()
RETURNS INTEGER AS $$
BEGIN
    -- 마감일 3일 전 경고
    -- 마감일 당일 위험
    -- 연체 발생 알림
END;
$$;
```

### 3. 우선순위 변경 모니터링
```sql
-- 우선순위 변경 시 알림
CREATE OR REPLACE FUNCTION notify_priority_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        PERFORM create_priority_change_notifications(
            NEW.id,
            NEW.assignees,
            OLD.priority,
            NEW.priority,
            NEW.business_name,
            NEW.title
        );
    END IF;
    RETURN NEW;
END;
$$;
```

## 알림 템플릿 시스템

### 메시지 템플릿
```typescript
const NOTIFICATION_TEMPLATES = {
  assignment: (task: string, business: string) =>
    `"${task}" 업무가 담당자로 배정되었습니다. (${business})`,

  status_change: (task: string, oldStatus: string, newStatus: string) =>
    `"${task}" 업무 상태가 "${oldStatus}"에서 "${newStatus}"로 변경되었습니다.`,

  delay_warning: (task: string, days: number) =>
    `"${task}" 업무 마감까지 ${days}일 남았습니다. 진행 상황을 확인해주세요.`,

  delay_critical: (task: string) =>
    `🚨 "${task}" 업무 마감일입니다. 즉시 처리가 필요합니다.`,

  delay_overdue: (task: string, overdueDays: number) =>
    `⚠️ "${task}" 업무가 ${overdueDays}일 연체되었습니다. 긴급 처리 필요!`,

  priority_increase: (task: string, newPriority: string) =>
    `"${task}" 업무 우선순위가 "${newPriority}"로 상승했습니다.`,
};
```

## 실시간 알림 시스템

### WebSocket/Server-Sent Events 연동
```typescript
// 실시간 알림 전송
async function broadcastNotificationToAssignees(
  assignees: TaskAssignee[],
  notification: TaskNotification
) {
  for (const assignee of assignees) {
    // WebSocket으로 실시간 전송
    await sendRealTimeNotification(assignee.id, notification);

    // 이메일 알림 (옵션)
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      await sendEmailNotification(assignee.email, notification);
    }
  }
}
```

## 알림 설정 관리

### 사용자별 알림 설정
```sql
CREATE TABLE user_notification_settings (
  user_id UUID PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{
    "assignment": true,
    "status_change": true,
    "delay_warning": true,
    "delay_critical": true,
    "delay_overdue": true,
    "priority_change": false
  }'::jsonb,
  quiet_hours JSONB DEFAULT '{
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  }'::jsonb
);
```

## 성능 최적화

### 1. 배치 처리
- 대량 알림은 큐 시스템으로 배치 처리
- 실시간 알림과 이메일 알림 분리

### 2. 인덱스 최적화
```sql
-- 효율적인 알림 조회를 위한 인덱스
CREATE INDEX CONCURRENTLY idx_task_notifications_user_unread_created
ON task_notifications(user_id, is_read, created_at DESC)
WHERE is_read = false AND expires_at > NOW();

-- 지연 검사를 위한 인덱스
CREATE INDEX CONCURRENTLY idx_facility_tasks_due_date_active
ON facility_tasks(due_date, is_active)
WHERE is_active = true AND due_date IS NOT NULL;
```

### 3. 정리 작업
```sql
-- 만료된 알림 정리 (매일 실행)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 읽은 알림은 30일 후 삭제
  DELETE FROM task_notifications
  WHERE is_read = true AND read_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 만료된 알림 삭제
  DELETE FROM task_notifications
  WHERE expires_at < NOW() - INTERVAL '7 days';

  RETURN deleted_count;
END;
$$;
```

## 구현 순서

### Phase 2.1: 상태 변경 알림
1. 상태 변경 트리거 구현
2. 상태 변경 알림 템플릿 추가
3. API 연동 및 테스트

### Phase 2.2: 지연 모니터링
1. 지연 검사 함수 구현
2. 스케줄러 설정 (cron job)
3. 지연 알림 템플릿 추가

### Phase 2.3: 실시간 알림
1. WebSocket 서버 구축
2. 클라이언트 실시간 수신 구현
3. 푸시 알림 연동

### Phase 2.4: 알림 설정
1. 사용자별 알림 설정 UI
2. 이메일 알림 시스템
3. 조용한 시간 기능

## 모니터링 및 분석

### 알림 효과성 측정
- 알림 읽음률
- 업무 완료율 개선
- 지연 감소율
- 사용자 만족도

### 대시보드 지표
- 일일 생성된 알림 수
- 알림 유형별 분포
- 사용자별 알림 반응률
- 시스템 성능 지표