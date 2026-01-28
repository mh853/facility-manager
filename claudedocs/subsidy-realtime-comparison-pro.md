# Supabase Realtime vs Polling 비교 분석 (Pro 플랜 기준)

**작성일**: 2026-01-28
**전제 조건**: Supabase Pro 플랜 사용 중
**결론**: ⭐ **Supabase Realtime 권장**

---

## 📊 상세 비교표

| 항목 | Supabase Realtime (Pro) | Polling (30초) |
|------|------------------------|----------------|
| **실시간성** | ⚡ 즉시 (< 1초) | ⏱️ 최대 30초 지연 |
| **서버 부하** | ✅ 거의 없음 (푸시 방식) | ⚠️ 30초마다 API 호출 |
| **네트워크 효율** | ✅ 매우 높음 (변경 시만 전송) | ⚠️ 낮음 (매번 전체 데이터) |
| **구현 복잡도** | 🟡 중간 | 🟢 낮음 |
| **비용** | ✅ Pro 플랜 포함 | ⚠️ API 호출 비용 |
| **확장성** | ✅ 수천 동시 연결 가능 | ⚠️ API 제한에 의존 |
| **배터리 소모** | ✅ 낮음 (WebSocket 1개) | ⚠️ 높음 (주기적 요청) |
| **사용자 경험** | ⭐ 최고 (즉시 반영) | 🟡 보통 (지연 있음) |

---

## 🎯 Supabase Pro 플랜의 Realtime 제한

### Pro 플랜 스펙
```yaml
Realtime Limits:
  동시 연결: 500개 (Free: 200개)
  메시지 처리량: 500 메시지/초
  채널 수: 무제한
  데이터베이스 변경 추적: ✅
  Presence 기능: ✅
  Broadcast 기능: ✅
```

### 현재 프로젝트 예상 사용량
```yaml
예상 동시 사용자: 5-20명 (관리자)
동시 연결: 5-20개
메시지 빈도: 시간당 0-10개 (새 공고 추가)
→ Pro 플랜 제한의 4% 미만 사용 ✅
```

**결론**: 제한 걱정 전혀 없음 ✅

---

## 🏗️ Supabase Realtime 구현 설계

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Supabase Database                     │
│  ┌──────────────────────────────────────────┐  │
│  │  subsidy_announcements 테이블            │  │
│  │  - INSERT 이벤트 발생                    │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
│                 ↓                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Realtime Server                         │  │
│  │  - 변경 사항 감지                        │  │
│  │  - WebSocket으로 브로드캐스트            │  │
│  └──────────────┬───────────────────────────┘  │
└─────────────────┼───────────────────────────────┘
                  │
                  ↓ WebSocket
         ┌────────┴─────────┐
         ↓                  ↓
   ┌─────────┐        ┌─────────┐
   │ User A  │        │ User B  │
   │ Browser │        │ Browser │
   └─────────┘        └─────────┘
```

### 구현 단계

#### Phase 1: Realtime Hook 생성

```typescript
// hooks/useSubsidyRealtime.ts
import { useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SubsidyAnnouncement } from '@/types/subsidy';

interface UseSubsidyRealtimeOptions {
  enabled?: boolean;
  onInsert?: (announcement: SubsidyAnnouncement) => void;
  onUpdate?: (announcement: SubsidyAnnouncement) => void;
  onDelete?: (id: string) => void;
}

export function useSubsidyRealtime(options: UseSubsidyRealtimeOptions) {
  const { enabled = true, onInsert, onUpdate, onDelete } = options;

  useEffect(() => {
    if (!enabled) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('[Realtime] 구독 시작: subsidy_announcements');

    // Realtime 채널 생성 및 구독
    const channel = supabase
      .channel('subsidy_announcements_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 새 공고 추가:', payload.new);
          if (onInsert) {
            onInsert(payload.new as SubsidyAnnouncement);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 공고 수정:', payload.new);
          if (onUpdate) {
            onUpdate(payload.new as SubsidyAnnouncement);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'subsidy_announcements'
        },
        (payload) => {
          console.log('[Realtime] 공고 삭제:', payload.old.id);
          if (onDelete) {
            onDelete(payload.old.id as string);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] 구독 상태:', status);
      });

    // Cleanup
    return () => {
      console.log('[Realtime] 구독 해제');
      channel.unsubscribe();
    };
  }, [enabled, onInsert, onUpdate, onDelete]);
}
```

---

#### Phase 2: 페이지 컴포넌트 통합

```typescript
// app/admin/subsidy/page.tsx
import { useSubsidyRealtime } from '@/hooks/useSubsidyRealtime';

export default function SubsidyAnnouncementsPage() {
  // ... 기존 코드 ...

  const [newAnnouncementCount, setNewAnnouncementCount] = useState(0);

  // Realtime 이벤트 핸들러
  const handleRealtimeInsert = useCallback((newAnnouncement: SubsidyAnnouncement) => {
    console.log('[Subsidy] 실시간 새 공고:', newAnnouncement.title);

    // 1. 상태 업데이트 (목록에 추가)
    setAllAnnouncements(prev => [newAnnouncement, ...prev]);

    // 2. 통계 새로고침
    loadStats();

    // 3. 새 공고 카운트 증가 (알림 배너용)
    setNewAnnouncementCount(prev => prev + 1);

    // 4. 선택사항: 토스트 알림
    // toast.success(`새 공고: ${newAnnouncement.title}`);
  }, [loadStats]);

  const handleRealtimeUpdate = useCallback((updatedAnnouncement: SubsidyAnnouncement) => {
    console.log('[Subsidy] 실시간 공고 수정:', updatedAnnouncement.id);

    // 목록에서 해당 공고 업데이트
    setAllAnnouncements(prev =>
      prev.map(a => a.id === updatedAnnouncement.id ? updatedAnnouncement : a)
    );

    // 상세 모달이 열려있으면 업데이트
    if (selectedAnnouncement?.id === updatedAnnouncement.id) {
      setSelectedAnnouncement(updatedAnnouncement);
    }

    // 통계 새로고침
    loadStats();
  }, [selectedAnnouncement, loadStats]);

  const handleRealtimeDelete = useCallback((deletedId: string) => {
    console.log('[Subsidy] 실시간 공고 삭제:', deletedId);

    // 목록에서 제거
    setAllAnnouncements(prev => prev.filter(a => a.id !== deletedId));

    // 상세 모달이 열려있으면 닫기
    if (selectedAnnouncement?.id === deletedId) {
      setSelectedAnnouncement(null);
    }

    // 통계 새로고침
    loadStats();
  }, [selectedAnnouncement, loadStats]);

  // Realtime 구독
  useSubsidyRealtime({
    enabled: !authLoading && user !== null, // 로그인 상태일 때만
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete
  });

  // ... 기존 코드 ...

  return (
    <AdminLayout>
      {/* 새 공고 알림 배너 */}
      <NewAnnouncementBanner
        count={newAnnouncementCount}
        onDismiss={() => setNewAnnouncementCount(0)}
        onView={() => {
          setNewAnnouncementCount(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 기존 콘텐츠 */}
      <div className="space-y-6">
        {/* ... */}
      </div>
    </AdminLayout>
  );
}
```

---

#### Phase 3: Supabase RLS 설정 (보안)

Realtime을 사용하려면 Row Level Security (RLS) 정책 확인 필요:

```sql
-- subsidy_announcements 테이블의 RLS 정책 확인
-- Supabase Dashboard → Authentication → Policies

-- 읽기 권한 (모든 인증된 사용자)
CREATE POLICY "인증된 사용자는 공고를 볼 수 있음"
ON public.subsidy_announcements
FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE는 기존 정책 유지
-- (role >= 1 이상만 가능)
```

**중요**: Realtime은 RLS 정책을 따르므로, 클라이언트는 권한 있는 데이터만 받습니다.

---

#### Phase 4: 알림 배너 컴포넌트 (재사용)

폴링 설계에서 이미 만든 `NewAnnouncementBanner` 컴포넌트를 그대로 사용:

```typescript
// components/subsidy/NewAnnouncementBanner.tsx
// (이미 설계된 컴포넌트 그대로 사용)
```

---

## 🔧 고급 기능 (선택사항)

### 1. 필터 기반 구독

특정 조건의 공고만 구독:

```typescript
const channel = supabase
  .channel('relevant_announcements')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'subsidy_announcements',
      filter: 'relevance_score=gt.0.75' // 관련도 75% 이상만
    },
    (payload) => {
      onInsert(payload.new);
    }
  )
  .subscribe();
```

### 2. 재연결 로직

네트워크 끊김 시 자동 재연결:

```typescript
const channel = supabase
  .channel('subsidy_announcements_changes')
  // ... 기존 이벤트 핸들러 ...
  .subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] ✅ 연결됨');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('[Realtime] ❌ 오류:', err);
      // 자동 재연결 시도 (Supabase 자동 처리)
    } else if (status === 'TIMED_OUT') {
      console.warn('[Realtime] ⏱️ 타임아웃 - 재연결 중...');
    } else if (status === 'CLOSED') {
      console.log('[Realtime] 🔌 연결 닫힘');
    }
  });
```

### 3. Presence 기능 (누가 온라인인지)

```typescript
// 선택사항: 현재 페이지를 보고 있는 관리자 표시
const channel = supabase.channel('subsidy_page_presence');

// 내 presence 등록
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('[Presence] 현재 온라인:', Object.keys(state).length, '명');
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: user?.id,
        user_name: user?.name,
        online_at: new Date().toISOString()
      });
    }
  });
```

---

## 🧪 테스트 시나리오

### 1. 기본 실시간 업데이트
- [ ] 새 공고 추가 시 즉시 목록에 표시
- [ ] 공고 수정 시 즉시 반영
- [ ] 공고 삭제 시 즉시 목록에서 제거
- [ ] 통계 카드 자동 업데이트

### 2. 알림 시스템
- [ ] 새 공고 추가 시 알림 배너 표시
- [ ] 여러 공고가 연속으로 추가되면 카운트 누적
- [ ] "지금 확인하기" 클릭 시 페이지 최상단 스크롤

### 3. 네트워크 안정성
- [ ] WiFi 끊김 후 재연결 시 자동 복구
- [ ] 탭 백그라운드/포그라운드 전환 시 정상 작동
- [ ] 브라우저 슬립 모드 후 깨어날 때 재연결

### 4. 다중 사용자
- [ ] 관리자 A가 추가한 공고가 관리자 B 화면에 즉시 표시
- [ ] 관리자 A가 수정한 공고가 관리자 B 화면에 반영
- [ ] 동시 사용자 10명일 때 성능 저하 없음

### 5. 권한 및 보안
- [ ] 로그아웃 시 Realtime 구독 해제
- [ ] 비로그인 사용자는 실시간 업데이트 안 됨
- [ ] RLS 정책에 따라 권한 있는 데이터만 수신

---

## 📊 성능 비교 (실제 사용 시나리오)

### 시나리오: 관리자가 페이지를 30분간 열어둔 상태

#### Polling 방식 (30초)
```yaml
API 호출 횟수: 60회 (30분 / 30초)
데이터 전송량:
  - 요청: 60 × 1KB = 60KB
  - 응답: 60 × 50KB = 3MB
총 데이터: 3.06MB

배터리 소모: 🔋🔋🔋 (중간)
실시간성: 최대 30초 지연
```

#### Realtime 방식
```yaml
API 호출 횟수: 1회 (초기 구독)
데이터 전송량:
  - WebSocket 연결: 1KB
  - 새 공고 3건 알림: 3 × 2KB = 6KB
총 데이터: 7KB (99% 절감 ✅)

배터리 소모: 🔋 (낮음)
실시간성: 즉시 (< 1초)
```

---

## 🎯 최종 권장 사항

### ⭐ Supabase Realtime 선택 이유

1. **Pro 플랜 이미 사용 중** → 추가 비용 없음
2. **진짜 실시간** → 사용자 경험 최고
3. **네트워크 효율** → 데이터 전송량 99% 절감
4. **배터리 친화적** → 모바일에서도 효율적
5. **확장성** → 사용자 증가 시에도 문제없음

### 🔄 마이그레이션 전략

**Step 1**: Realtime 구현 (Phase 1-2)
**Step 2**: 테스트 환경에서 검증
**Step 3**: 프로덕션 배포
**Step 4**: 모니터링 (연결 상태, 메시지 수)

### 📈 모니터링 포인트

```typescript
// Supabase Dashboard에서 확인 가능
- 동시 연결 수: 평균 5-20개 (목표)
- 메시지 처리량: 시간당 0-10개 (예상)
- 연결 에러율: < 1% (목표)
```

---

## 🚀 구현 우선순위

### Phase 1: 필수 (즉시 구현)
1. ✅ `useSubsidyRealtime` Hook 생성
2. ✅ INSERT 이벤트 핸들러
3. ✅ 페이지 컴포넌트 통합

### Phase 2: 중요 (1주일 내)
4. ✅ UPDATE/DELETE 이벤트 핸들러
5. ✅ 알림 배너 통합
6. ✅ 재연결 로직

### Phase 3: 선택 (시간 여유 있을 때)
7. ⚪ 필터 기반 구독 (관련 공고만)
8. ⚪ Presence 기능 (온라인 사용자 표시)
9. ⚪ 네트워크 상태 표시기

---

## 🆚 최종 결론

| 기준 | Polling | Realtime |
|------|---------|----------|
| **실시간성** | ⚠️ 30초 지연 | ⭐ 즉시 |
| **비용** | ⚠️ API 호출 비용 | ✅ Pro 플랜 포함 |
| **구현 난이도** | ✅ 쉬움 | 🟡 중간 |
| **유지보수** | ✅ 간단 | 🟡 보통 |
| **사용자 경험** | 🟡 보통 | ⭐ 최고 |
| **성능** | ⚠️ 낮음 | ⭐ 높음 |
| **확장성** | ⚠️ 제한적 | ⭐ 우수 |

### 💡 Pro 플랜 사용 중이라면?

**Supabase Realtime 강력 권장 ⭐⭐⭐**

- 추가 비용 없음
- 훨씬 나은 사용자 경험
- 더 나은 성능과 효율성
- 향후 확장에도 유리

---

**작성자**: Claude Sonnet 4.5
**버전**: 2.0 (Pro 플랜 기준)
**최종 수정**: 2026-01-28
