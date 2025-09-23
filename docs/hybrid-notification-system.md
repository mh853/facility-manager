# 하이브리드 알림 시스템 구현 가이드

시설 관리 시스템의 알림 시스템을 WebSocket 기반에서 단순한 폴링 기반으로 전환하여 서버리스 환경에 최적화한 하이브리드 아키텍처입니다.

## 🎯 구현 목표

1. **알림 누락 방지**: WebSocket 실패 시에도 폴링으로 알림 보장
2. **응답 속도 최적화**: 30초 캐싱으로 성능 향상
3. **서버리스 환경 안정성**: 30초 함수 실행 제한 대응
4. **간단한 유지보수**: 복잡한 WebSocket 의존성 제거

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   클라이언트    │───▶│   하이브리드     │───▶│   데이터베이스   │
│   (폴링 30초)   │    │   알림 API       │    │   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐             │
         │              │  캐시 시스템    │             │
         │              │  (30초 메모리)  │             │
         │              └─────────────────┘             │
         │                                              │
         └──────────────── ETag 조건부 요청 ──────────────┘
```

## 📁 구현된 파일들

### 1. 백엔드 API
- `/app/api/notifications/simple/route.ts` - 통합 알림 API
- `/app/api/facility-tasks/route.ts` - 업무 관리 API (알림 생성 로직 개선)
- `/sql/hybrid_notifications_schema.sql` - 데이터베이스 스키마

### 2. 프론트엔드
- `/lib/hooks/useSimpleNotifications.ts` - 단순 폴링 훅
- `/contexts/NotificationContext.tsx` - 하이브리드 컨텍스트 (업데이트됨)

## 🔧 주요 기능

### 1. 통합 알림 API (`/api/notifications/simple`)

**특징:**
- 일반 알림 + 업무 알림 통합 조회
- 30초 메모리 캐싱
- ETag 조건부 요청 지원
- Promise.allSettled로 장애 격리

**엔드포인트:**
```typescript
GET /api/notifications/simple
- 통합 알림 조회
- ETag 지원 (304 Not Modified)
- 30초 캐싱

POST /api/notifications/simple
- 읽음 처리 (markAsRead, markAllAsRead)
- 폴링 업데이트 확인 (action: 'poll')

DELETE /api/notifications/simple?id={id}
- 알림 삭제 (소프트 삭제)
```

### 2. 개선된 업무 알림 생성

**facility-tasks API에서 자동 알림 생성:**
- 업무 생성 시: 담당자에게 배정 알림
- 업무 수정 시: 상태 변경, 담당자 변경 알림
- 업무 삭제 시: 관련자에게 삭제 알림

**이중 보장 시스템:**
```typescript
// WebSocket + Database 이중 알림 생성
await sendTaskCreationNotifications(newTask, user);      // WebSocket
await createSimpleTaskNotifications(newTask, 'creation', user); // Database
```

### 3. 단순 폴링 훅

**useSimpleNotifications 특징:**
- 30초 간격 자동 폴링
- ETag 조건부 요청으로 대역폭 절약
- 페이지 가시성 기반 폴링 제어
- 최대 재시도 횟수 제한

**사용법:**
```typescript
const {
  notifications,
  unreadCount,
  loading,
  error,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = useSimpleNotifications({
  pollingInterval: 30000,
  enablePolling: true,
  maxRetries: 3
});
```

## 🗄️ 데이터베이스 스키마

### 1. 업무 알림 테이블 (task_notifications)
```sql
CREATE TABLE task_notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES employees(id),
    task_id UUID NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'normal',
    metadata JSONB DEFAULT '{}',

    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);
```

### 2. 성능 최적화 인덱스
```sql
-- 사용자별 읽지 않은 알림 조회 최적화
CREATE INDEX idx_task_notifications_user_unread
ON task_notifications(user_id, is_read, is_deleted, created_at DESC);

-- 만료된 알림 정리 최적화
CREATE INDEX idx_task_notifications_expires
ON task_notifications(expires_at) WHERE expires_at IS NOT NULL;
```

### 3. 자동 정리 함수
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
BEGIN
    UPDATE task_notifications
    SET is_deleted = true, deleted_at = NOW()
    WHERE expires_at < NOW() AND NOT is_deleted;

    RETURN ROW_COUNT;
END;
$$ LANGUAGE plpgsql;
```

## 🚀 설치 및 설정

### 1. 데이터베이스 설정
```bash
# 스키마 적용
psql -d your_database -f sql/hybrid_notifications_schema.sql
```

### 2. 환경 변수 확인
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
```

### 3. 기존 시스템과의 호환성
- 기존 `NotificationContext` 사용 코드는 그대로 작동
- 하이브리드 시스템이 자동으로 단순 API 우선 사용
- 실패 시 기존 시스템으로 자동 폴백

## 📊 성능 최적화

### 1. 캐싱 전략
- **메모리 캐시**: 30초 응답 캐싱
- **ETag**: 조건부 요청으로 대역폭 절약
- **데이터베이스**: 효율적인 인덱스 설계

### 2. 응답 시간 목표
- **캐시 히트**: <50ms
- **데이터베이스 조회**: <200ms
- **폴링 간격**: 30초

### 3. 메모리 관리
```typescript
// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION * 2) {
      responseCache.delete(key);
    }
  }
}, CACHE_DURATION);
```

## 🔍 모니터링

### 1. 성능 통계 뷰
```sql
SELECT * FROM notification_performance_stats;
```

### 2. 로그 모니터링
```typescript
// 성능 로그
console.log('✅ [NOTIFICATIONS-SIMPLE] 조회 성공:', {
  user: user.name,
  totalNotifications: allNotifications.length,
  unreadCount,
  generalCount: generalNotifications.length,
  taskCount: taskNotifications.length,
  cached: false
});
```

### 3. 에러 처리
- **Circuit Breaker**: 연속 실패 시 재시도 제한
- **Graceful Degradation**: 부분 실패 시에도 서비스 지속
- **Fallback Strategy**: 단순 API 실패 시 기존 시스템 사용

## 🔒 보안 고려사항

### 1. 인증 및 권한
- JWT 토큰 기반 인증
- Row Level Security (RLS) 적용
- 사용자별 데이터 격리

### 2. 데이터 검증
```typescript
// 사용자 권한 확인
const user = await getUserFromToken(request);
if (!user) {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
}
```

### 3. SQL 인젝션 방지
- Supabase 클라이언트 사용으로 자동 방지
- 파라미터화된 쿼리만 사용

## 🧪 테스트 가이드

### 1. API 테스트
```bash
# 알림 조회
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/notifications/simple

# 읽음 처리
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"notificationIds":["notification-id"],"markAllAsRead":false}' \
     http://localhost:3000/api/notifications/simple
```

### 2. 폴링 테스트
- 브라우저 개발자 도구에서 네트워크 탭 확인
- 30초 간격으로 요청 발생 확인
- ETag 헤더로 304 응답 확인

### 3. 성능 테스트
```sql
-- 알림 생성 부하 테스트
INSERT INTO task_notifications (user_id, task_id, business_name, message)
SELECT
    (SELECT id FROM employees ORDER BY random() LIMIT 1),
    gen_random_uuid(),
    'Test Business ' || generate_series,
    'Test message ' || generate_series
FROM generate_series(1, 1000);
```

## 🔄 마이그레이션 가이드

### 1. 단계별 전환
1. **Phase 1**: 하이브리드 시스템 배포 (기존 시스템과 병행)
2. **Phase 2**: 단순 API 우선 사용 (기존 시스템 폴백)
3. **Phase 3**: WebSocket 시스템 제거 (선택적)

### 2. 롤백 계획
- 환경 변수로 기존 시스템 강제 사용 가능
- 데이터베이스 스키마는 기존과 호환
- 점진적 마이그레이션으로 리스크 최소화

## 📈 향후 개선 사항

### 1. 단기 개선 (1-2개월)
- [ ] Push 알림 지원 (Service Worker)
- [ ] 알림 카테고리별 필터링
- [ ] 사용자 설정 기반 알림 제어

### 2. 중기 개선 (3-6개월)
- [ ] Redis 캐싱으로 성능 향상
- [ ] 알림 템플릿 시스템
- [ ] A/B 테스트 기반 최적화

### 3. 장기 개선 (6개월+)
- [ ] ML 기반 알림 우선순위 자동 조정
- [ ] 실시간 분석 대시보드
- [ ] 마이크로서비스 분리

## 🆘 문제 해결

### 1. 일반적인 문제들

**Q: 알림이 오지 않아요**
A:
1. JWT 토큰 유효성 확인
2. 브라우저 개발자 도구에서 네트워크 요청 확인
3. 데이터베이스 연결 상태 확인

**Q: 성능이 느려요**
A:
1. 캐시 히트율 확인 (`cached: true` 로그)
2. 데이터베이스 인덱스 상태 확인
3. 폴링 간격 조정 고려

**Q: 메모리 사용량이 높아요**
A:
1. 캐시 정리 함수 동작 확인
2. 폴링 중복 실행 여부 확인
3. 메모리 리크 패턴 분석

### 2. 디버깅 도구
```typescript
// 상세 로깅 활성화
localStorage.setItem('DEBUG_NOTIFICATIONS', 'true');

// 캐시 상태 확인
console.log('Cache entries:', responseCache.size);

// 폴링 상태 확인
console.log('Polling active:', isPolling);
```

## 📞 지원 및 문의

시스템 관련 문의사항이 있으시면 개발팀에 연락하세요.

---

*이 문서는 하이브리드 알림 시스템의 구현 및 운영 가이드입니다. 시스템 변경 시 이 문서도 함께 업데이트해 주세요.*