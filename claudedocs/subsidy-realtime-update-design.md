# Subsidy Admin Page - 실시간 공고 업데이트 설계

**작성일**: 2026-01-28
**목적**: admin/subsidy 페이지에서 새 공고가 추가되면 자동으로 화면에 반영 (새로고침 불필요)

---

## 📋 현재 상황

### 문제점
- 크롤러나 수동 등록으로 새 공고가 추가되어도 페이지 새로고침을 해야만 보임
- 사용자가 장시간 페이지에 머물러 있을 경우 최신 공고를 놓칠 수 있음
- 실시간성이 중요한 관리 페이지에서 수동 새로고침은 비효율적

### 현재 데이터 로드 방식
```typescript
// app/admin/subsidy/page.tsx
const loadAllAnnouncements = useCallback(async () => {
  const response = await fetch(`/api/subsidy-announcements?${params}`);
  const data = await response.json();
  if (data.success) {
    setAllAnnouncements(data.data.announcements);
  }
}, []);

// 초기 로드만 실행 (페이지 마운트 시 1회)
useEffect(() => {
  loadData();
}, [loadData]);
```

---

## 🎯 설계 목표

1. **실시간 업데이트**: 새 공고 추가 시 자동으로 UI 반영
2. **사용자 경험**: 자연스러운 업데이트 (깜빡임 없음)
3. **성능 최적화**: 불필요한 API 호출 최소화
4. **알림 기능**: 새 공고 추가 시 시각적 알림

---

## 🏗️ 솔루션 옵션 비교

### Option 1: Polling (폴링) - ⭐ 권장
주기적으로 서버에 새 데이터를 요청

**장점**:
- ✅ 구현이 간단하고 안정적
- ✅ 기존 API 재사용 가능
- ✅ Supabase 플랜 영향 없음
- ✅ 방화벽/프록시 이슈 없음

**단점**:
- ⚠️ 실시간성이 폴링 주기에 의존 (30초~1분 지연)
- ⚠️ 새 데이터 없어도 API 호출 발생

**적합 상황**:
- 실시간성이 절대적이지 않은 경우 (1분 이내 업데이트 허용)
- 간단하고 안정적인 구현 선호
- **현재 프로젝트에 가장 적합** ✅

---

### Option 2: Supabase Realtime Subscriptions
Supabase의 실시간 구독 기능 사용

**장점**:
- ✅ 진짜 실시간 (즉시 업데이트)
- ✅ 서버 푸시 방식으로 효율적
- ✅ Supabase 네이티브 기능

**단점**:
- ⚠️ Supabase 플랜에 따라 제한 (Free: 200 동시 연결)
- ⚠️ 구현 복잡도 높음 (subscription 관리, 재연결 로직)
- ⚠️ 여러 테이블 조인 시 복잡함

**적합 상황**:
- 초단위 실시간 업데이트 필수
- Supabase Pro 플랜 이상 사용
- 단일 테이블 구독으로 충분

---

### Option 3: WebSocket (Socket.io)
Next.js API Routes로 WebSocket 서버 구현

**장점**:
- ✅ 완전한 실시간 (즉시 업데이트)
- ✅ 양방향 통신 가능
- ✅ 커스텀 로직 자유롭게 구현

**단점**:
- ❌ 구현 복잡도 매우 높음 (서버 설정, 연결 관리, 재연결 로직)
- ❌ Vercel에서 제한적 (Serverless Function 60초 타임아웃)
- ❌ 별도 WebSocket 서버 필요할 수 있음

**적합 상황**:
- 채팅, 협업 도구 등 양방향 실시간 통신 필수
- 자체 서버 운영 가능
- **현재 프로젝트에는 과도함** ❌

---

## 📐 선택된 솔루션: Polling (Option 1)

### 설계 사양

#### 1. 폴링 주기
```typescript
const POLLING_INTERVAL = 30000; // 30초 (권장)
// 또는
const POLLING_INTERVAL = 60000; // 1분 (트래픽 최소화)
```

**결정 근거**:
- 보조금 공고는 초단위 실시간성 불필요
- 30초~1분 지연은 사용자 경험에 큰 영향 없음
- API 비용 및 서버 부하 최소화

#### 2. 스마트 폴링 로직
```typescript
// 조건부 폴링: 페이지 활성화 상태일 때만
useEffect(() => {
  if (!document.hidden && !loading) {
    const interval = setInterval(() => {
      loadAllAnnouncements();
      loadStats();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }
}, [document.hidden, loading, loadAllAnnouncements, loadStats]);

// Page Visibility API 활용
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // 탭이 다시 활성화되면 즉시 데이터 갱신
      loadAllAnnouncements();
      loadStats();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [loadAllAnnouncements, loadStats]);
```

#### 3. 새 공고 알림 UI
```typescript
const [newAnnouncementCount, setNewAnnouncementCount] = useState(0);

// 폴링 후 새 공고 감지
const handlePollingUpdate = useCallback(async () => {
  const response = await fetch('/api/subsidy-announcements?page=1&pageSize=1000');
  const data = await response.json();

  if (data.success) {
    const newAnnouncements = data.data.announcements;
    const currentIds = new Set(allAnnouncements.map(a => a.id));
    const newItems = newAnnouncements.filter(a => !currentIds.has(a.id));

    if (newItems.length > 0) {
      setNewAnnouncementCount(newItems.length);
      // 부드러운 업데이트 (애니메이션)
      setAllAnnouncements(newAnnouncements);
    }
  }
}, [allAnnouncements]);

// UI 알림 배너
{newAnnouncementCount > 0 && (
  <div className="fixed top-20 right-6 z-50 animate-bounce">
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div>
          <p className="font-bold text-sm">새 공고 {newAnnouncementCount}건</p>
          <button
            onClick={() => {
              setNewAnnouncementCount(0);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs underline hover:text-blue-100"
          >
            확인하기
          </button>
        </div>
        <button
          onClick={() => setNewAnnouncementCount(0)}
          className="ml-2 text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
)}
```

#### 4. 성능 최적화

**중복 로드 방지**:
```typescript
const [isPolling, setIsPolling] = useState(false);

const handlePollingUpdate = useCallback(async () => {
  if (isPolling) return; // 이전 요청이 진행 중이면 스킵

  setIsPolling(true);
  try {
    await loadAllAnnouncements();
    await loadStats();
  } finally {
    setIsPolling(false);
  }
}, [isPolling, loadAllAnnouncements, loadStats]);
```

**변경 감지 최적화** (선택사항):
```typescript
// API에 Last-Modified 헤더 추가하여 변경 여부만 확인
const checkForUpdates = async () => {
  const response = await fetch('/api/subsidy-announcements/check-updates', {
    method: 'HEAD',
    headers: { 'If-Modified-Since': lastModified }
  });

  if (response.status === 304) {
    // Not Modified - 변경 없음
    return false;
  }

  // 변경 있음 - 전체 데이터 로드
  return true;
};
```

---

## 🔧 구현 단계

### Phase 1: 기본 폴링 구현

#### Step 1.1: 폴링 Hook 생성
```typescript
// hooks/usePolling.ts
import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  interval: number; // milliseconds
  enabled?: boolean;
  onVisibilityChange?: boolean; // Page Visibility API 사용 여부
}

export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions
) {
  const { interval, enabled = true, onVisibilityChange = true } = options;
  const savedCallback = useRef(callback);

  // 최신 콜백 유지
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // 폴링 로직
  useEffect(() => {
    if (!enabled) return;

    const tick = () => savedCallback.current();

    // 초기 실행은 하지 않음 (이미 초기 로드 완료)
    const id = setInterval(tick, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);

  // Page Visibility API
  useEffect(() => {
    if (!enabled || !onVisibilityChange) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, onVisibilityChange]);
}
```

#### Step 1.2: 페이지 컴포넌트에 적용
```typescript
// app/admin/subsidy/page.tsx
import { usePolling } from '@/hooks/usePolling';

const POLLING_INTERVAL = 30000; // 30초

export default function SubsidyAnnouncementsPage() {
  // ... 기존 코드 ...

  const [isPolling, setIsPolling] = useState(false);

  // 폴링 콜백
  const handlePollingUpdate = useCallback(async () => {
    if (isPolling || loading) return;

    setIsPolling(true);
    try {
      await Promise.all([
        loadAllAnnouncements(),
        loadStats(),
        loadRegisteredRegions()
      ]);
    } finally {
      setIsPolling(false);
    }
  }, [isPolling, loading, loadAllAnnouncements, loadStats, loadRegisteredRegions]);

  // 폴링 활성화
  usePolling(handlePollingUpdate, {
    interval: POLLING_INTERVAL,
    enabled: !authLoading && user !== null, // 로그인 상태일 때만
    onVisibilityChange: true
  });

  // ... 기존 코드 ...
}
```

---

### Phase 2: 새 공고 알림 UI 추가

#### Step 2.1: 새 공고 감지 로직
```typescript
const [newAnnouncementCount, setNewAnnouncementCount] = useState(0);
const [lastAnnouncementIds, setLastAnnouncementIds] = useState<Set<string>>(new Set());

// 폴링 후 새 공고 감지
useEffect(() => {
  if (allAnnouncements.length === 0 || loading) return;

  const currentIds = new Set(allAnnouncements.map(a => a.id));

  // 초기 로드 시 (lastAnnouncementIds가 비어있으면)
  if (lastAnnouncementIds.size === 0) {
    setLastAnnouncementIds(currentIds);
    return;
  }

  // 새로 추가된 공고 찾기
  const newIds = Array.from(currentIds).filter(id => !lastAnnouncementIds.has(id));

  if (newIds.length > 0) {
    setNewAnnouncementCount(prev => prev + newIds.length);
    console.log('[Subsidy] 새 공고 감지:', newIds.length, '건');
  }

  setLastAnnouncementIds(currentIds);
}, [allAnnouncements, loading, lastAnnouncementIds]);
```

#### Step 2.2: 알림 배너 컴포넌트
```typescript
// components/subsidy/NewAnnouncementBanner.tsx
'use client';

import { X, Bell } from 'lucide-react';

interface NewAnnouncementBannerProps {
  count: number;
  onDismiss: () => void;
  onView: () => void;
}

export default function NewAnnouncementBanner({
  count,
  onDismiss,
  onView
}: NewAnnouncementBannerProps) {
  if (count === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-4 rounded-lg shadow-2xl max-w-sm">
        <div className="flex items-start gap-4">
          {/* 아이콘 */}
          <div className="flex-shrink-0 animate-bounce">
            <Bell className="w-6 h-6" />
          </div>

          {/* 내용 */}
          <div className="flex-1">
            <p className="font-bold text-base mb-1">
              새 공고 {count}건 추가됨
            </p>
            <p className="text-sm text-blue-100 mb-3">
              최신 공고를 확인해보세요
            </p>
            <button
              onClick={onView}
              className="text-sm font-medium underline hover:text-blue-100 transition-colors"
            >
              지금 확인하기 →
            </button>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Tailwind CSS 애니메이션 추가 (tailwind.config.js)
module.exports = {
  theme: {
    extend: {
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        }
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out'
      }
    }
  }
};
```

#### Step 2.3: 페이지에 배너 통합
```typescript
// app/admin/subsidy/page.tsx
import NewAnnouncementBanner from '@/components/subsidy/NewAnnouncementBanner';

export default function SubsidyAnnouncementsPage() {
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

### Phase 3: 성능 최적화

#### Step 3.1: 조건부 폴링 (선택사항)
```typescript
// 특정 조건에서만 폴링 활성화
const shouldEnablePolling = useMemo(() => {
  // 1. 사용자가 로그인 상태
  if (!user) return false;

  // 2. 모달이 열려있지 않을 때만 (선택사항)
  if (showActiveAnnouncementsModal || showManualUploadModal) return false;

  // 3. 특정 필터 상태일 때만 (선택사항)
  // if (filterStatus !== 'all') return false;

  return true;
}, [user, showActiveAnnouncementsModal, showManualUploadModal]);

usePolling(handlePollingUpdate, {
  interval: POLLING_INTERVAL,
  enabled: shouldEnablePolling,
  onVisibilityChange: true
});
```

#### Step 3.2: API 응답 캐싱 (선택사항)
```typescript
// 폴링 시 If-None-Match 헤더 사용하여 변경 여부만 확인
const [etag, setEtag] = useState<string | null>(null);

const loadAllAnnouncementsOptimized = useCallback(async () => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetch('/api/subsidy-announcements?...', { headers });

  if (response.status === 304) {
    // Not Modified - 변경 없음
    console.log('[Subsidy] 폴링: 변경 사항 없음');
    return;
  }

  const newEtag = response.headers.get('ETag');
  if (newEtag) setEtag(newEtag);

  const data = await response.json();
  if (data.success) {
    setAllAnnouncements(data.data.announcements);
  }
}, [etag]);
```

---

## 🧪 테스트 시나리오

### 1. 기본 폴링 동작
- [ ] 페이지 접속 후 30초마다 자동 업데이트
- [ ] 새 공고가 추가되면 목록에 자동 반영
- [ ] 통계 카드도 자동 업데이트

### 2. Page Visibility API
- [ ] 탭을 다른 곳으로 전환하면 폴링 중지
- [ ] 탭을 다시 활성화하면 즉시 데이터 갱신

### 3. 새 공고 알림
- [ ] 새 공고 추가 시 알림 배너 표시
- [ ] "지금 확인하기" 클릭 시 페이지 최상단 스크롤
- [ ] 닫기 버튼 클릭 시 배너 사라짐

### 4. 성능
- [ ] 폴링 중복 방지 (이전 요청 완료 전 새 요청 차단)
- [ ] 로그인 안 된 상태에서는 폴링 비활성화
- [ ] 모달 열려있을 때 폴링 일시 중지 (선택사항)

### 5. 엣지 케이스
- [ ] 네트워크 오류 시 자동 재시도
- [ ] 빠른 연속 업데이트 시 UI 깜빡임 없음
- [ ] 대량 공고 추가 시 (100개+) 성능 저하 없음

---

## 📊 예상 효과

### 사용자 경험 개선
1. **실시간성**: 30초~1분 내 새 공고 자동 반영
2. **편의성**: 수동 새로고침 불필요
3. **알림**: 새 공고 추가 시 시각적 피드백

### 운영 효율성
1. **모니터링**: 관리자가 페이지를 계속 보고 있어도 최신 상태 유지
2. **신속 대응**: 중요 공고 등록 시 즉시 확인 가능

### 기술적 이점
1. **간단한 구현**: 기존 API 재사용, 추가 인프라 불필요
2. **안정성**: WebSocket보다 안정적, 방화벽 이슈 없음
3. **확장성**: 폴링 주기 조절로 트래픽 제어 가능

---

## 🚀 향후 개선 방향 (Phase 4+)

### 1. 선택적 실시간 업데이트
```typescript
// 사용자 설정으로 폴링 주기 조절
const [pollingInterval, setPollingInterval] = useState(30000);

// 설정 UI
<select onChange={(e) => setPollingInterval(Number(e.target.value))}>
  <option value="15000">15초 (빠름)</option>
  <option value="30000">30초 (권장)</option>
  <option value="60000">1분 (느림)</option>
  <option value="0">자동 업데이트 끄기</option>
</select>
```

### 2. 변경 내역 하이라이트
```typescript
// 새로 추가된 공고를 시각적으로 강조
{announcement.isNew && (
  <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 animate-pulse" />
)}
```

### 3. 푸시 알림 (선택사항)
```typescript
// Web Push API로 브라우저 알림
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification('새 보조금 공고', {
    body: `${newCount}건의 새로운 공고가 등록되었습니다.`,
    icon: '/icon.png'
  });
}
```

### 4. Supabase Realtime으로 업그레이드 (미래)
```typescript
// Supabase Pro 플랜으로 업그레이드 시
supabase
  .channel('subsidy_announcements')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'subsidy_announcements'
  }, payload => {
    // 새 공고 즉시 반영
    setAllAnnouncements(prev => [payload.new, ...prev]);
  })
  .subscribe();
```

---

## 🎯 구현 우선순위

### 🟢 Phase 1: 필수 (즉시 구현 권장)
1. ✅ 기본 폴링 구현 (30초 주기)
2. ✅ Page Visibility API 통합
3. ✅ 중복 로드 방지

### 🟡 Phase 2: 중요 (1주일 내)
4. ✅ 새 공고 알림 배너
5. ✅ 새 공고 감지 로직
6. ✅ 애니메이션 효과

### 🔵 Phase 3: 선택 (시간 여유 있을 때)
7. ⚪ 조건부 폴링 (모달 열림 시 중지)
8. ⚪ ETag 캐싱 최적화
9. ⚪ 사용자 설정 (폴링 주기 조절)

---

**작성자**: Claude Sonnet 4.5
**버전**: 1.0
**최종 수정**: 2026-01-28
