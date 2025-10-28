# 대시보드 개선 워크플로우

**날짜**: 2025-10-27
**목적**: 대시보드를 1행 레이아웃으로 정리하고 실제 데이터 표시

---

## 📋 요구사항

1. **통계 카드 레이아웃**: 2x2 그리드 → 1x4 그리드로 변경
2. **실제 데이터 표시**: Mock 데이터 → Supabase 실제 데이터
3. **조직현황 위치**: 상단 → 페이지 최하단으로 이동

---

## 🔍 현재 상태 분석

### 레이아웃 (app/admin/page.tsx)
```tsx
Line 237: grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6
Line 287: <OrganizationChart /> // 상단 위치
```

### 데이터 소스 현황

| 통계 항목 | 현재 상태 | 데이터 소스 | 필요 API |
|----------|----------|------------|----------|
| **전체 사업장** | ✅ 실제 데이터 | `/api/business-list` | 기존 사용 |
| **이번 달 매출** | ❌ Mock (15,000,000) | 없음 | `/api/revenue/calculate` GET |
| **설치 진행중** | ❌ Mock (3) | 없음 | `/api/facility-tasks` |
| **예정된 설치** | ❌ Mock (5) | 없음 | `/api/facility-tasks` |
| **최근 활동** | ❌ Mock 배열 | 없음 | 신규 API 또는 기존 APIs 조합 |

### 사용 가능한 API 엔드포인트

#### 1. 매출 데이터
- **GET `/api/revenue/calculate`**:
  - 저장된 매출 계산 결과 조회
  - 파라미터: `start_date`, `end_date`, `sales_office`, `limit`, `offset`
  - 응답: `revenue_calculations` 테이블 데이터

#### 2. 설치 업무 데이터
- **GET `/api/facility-tasks`**:
  - 시설 업무 관리 데이터
  - 파라미터: `status`, `assigned_to`, `business_id`
  - 응답: `facility_tasks` 테이블 데이터
  - 상태: `backlog`, `in_progress`, `completed`, `blocked`

#### 3. 사업장 데이터
- **GET `/api/business-list`**: ✅ 이미 사용 중
  - 전체 사업장 목록
  - 응답: `businesses` 배열

---

## 🎯 구현 계획

### Phase 1: 레이아웃 변경 (30분)

**Task 1.1: 통계 카드 그리드 변경**
```tsx
// Before
<div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6">

// After
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
```

**Task 1.2: 조직현황 최하단 이동**
- Line 287의 `<OrganizationChart />` 제거
- Line 460 직전 (미래 기능 프리뷰 아래)에 삽입

---

### Phase 2: 실제 데이터 통합 (1-2시간)

**Task 2.1: 매출 데이터 API 호출**
```typescript
// 새 함수 추가
const loadMonthlyRevenue = async () => {
  try {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    const response = await fetch(
      `/api/revenue/calculate?start_date=${startDate}&end_date=${endDate}&limit=1000`
    )

    if (response.ok) {
      const data = await response.json()
      const totalRevenue = data.data?.reduce((sum, item) =>
        sum + (item.net_profit || 0), 0
      ) || 0

      setStats(prev => ({
        ...prev,
        monthlyRevenue: totalRevenue
      }))
    }
  } catch (error) {
    console.warn('Monthly revenue loading error:', error)
  }
}
```

**Task 2.2: 설치 업무 데이터 API 호출**
```typescript
// 새 함수 추가
const loadInstallationStats = async () => {
  try {
    const response = await fetch('/api/facility-tasks')

    if (response.ok) {
      const data = await response.json()
      const tasks = data.data || []

      const inProgress = tasks.filter(t => t.status === 'in_progress').length
      const completed = tasks.filter(t =>
        t.status === 'completed' &&
        new Date(t.updated_at).getMonth() === new Date().getMonth()
      ).length
      const upcoming = tasks.filter(t => t.status === 'backlog').length

      setStats(prev => ({
        ...prev,
        installationsInProgress: inProgress,
        completedThisMonth: completed,
        upcomingInstallations: upcoming
      }))
    }
  } catch (error) {
    console.warn('Installation stats loading error:', error)
  }
}
```

**Task 2.3: 최근 활동 데이터 (선택)**

**Option A**: 기존 APIs 조합
```typescript
const loadRecentActivities = async () => {
  // business-list, facility-tasks, revenue/calculate 결과 조합
  // 각 API의 updated_at 기준으로 최신 5개 추출
}
```

**Option B**: 간소화 (권장)
- Mock 데이터 유지하되 "준비중" 안내 추가
- 향후 activity_log 테이블 구축 시 실제 데이터 연결

---

### Phase 3: 통합 및 테스트 (30분)

**Task 3.1: loadDashboardData 함수 수정**
```typescript
const loadDashboardData = async () => {
  try {
    setLoading(true)

    // 병렬 실행으로 성능 최적화
    await Promise.all([
      loadBusinessStats(),      // 기존
      loadMonthlyRevenue(),     // 신규
      loadInstallationStats(),  // 신규
    ])
  } catch (error) {
    console.warn('Dashboard data loading error:', error)
  } finally {
    setLoading(false)
  }
}
```

**Task 3.2: 에러 핸들링 강화**
- 각 API 호출 실패 시 기본값 유지
- 사용자에게 에러 노출하지 않음 (silent fail)
- 콘솔에만 warning 로그

**Task 3.3: 테스트**
1. 개발 서버 실행: `npm run dev`
2. `/admin` 접속
3. 확인 사항:
   - 통계 카드 1행 정렬 확인 (데스크톱)
   - 모바일 반응형 정상 동작
   - 실제 데이터 표시 확인
   - 조직현황 최하단 위치 확인

---

## 📊 데이터베이스 스키마 참고

### revenue_calculations 테이블
```sql
- calculation_date: 계산 날짜
- business_id: 사업장 ID
- net_profit: 순이익 (사용)
- created_at, updated_at
```

### facility_tasks 테이블
```sql
- status: backlog|in_progress|completed|blocked
- created_at, updated_at
- business_id
```

### businesses 테이블
```sql
- id, business_name
- created_at, updated_at
```

---

## ✅ 완료 체크리스트

### Phase 1: 레이아웃
- [ ] 통계 카드 그리드를 `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`로 변경
- [ ] OrganizationChart를 페이지 최하단으로 이동

### Phase 2: 데이터
- [ ] `loadMonthlyRevenue()` 함수 구현
- [ ] `loadInstallationStats()` 함수 구현
- [ ] `loadDashboardData()`에 통합
- [ ] 에러 핸들링 추가

### Phase 3: 검증
- [ ] 데스크톱에서 1행 레이아웃 확인
- [ ] 모바일 반응형 테스트
- [ ] 실제 데이터 로딩 확인
- [ ] 에러 발생 시 기본값 표시 확인
- [ ] 조직현황 위치 확인

---

## 🚨 주의사항

1. **권한 체크**:
   - `/api/revenue/calculate`는 권한 1 이상 필요 (최근 수정됨)
   - Dashboard는 일반적으로 권한 1 이상 접근

2. **성능 최적화**:
   - API 호출을 `Promise.all()`로 병렬 처리
   - `limit` 파라미터로 데이터 양 제한

3. **에러 핸들링**:
   - API 실패 시 사용자에게 에러 노출하지 않음
   - 기본값 유지로 UX 보장

4. **반응형 디자인**:
   - 모바일: 1열
   - 태블릿: 2열
   - 데스크톱: 4열

---

## 📝 구현 순서

1. ✅ 워크플로우 문서 작성 (현재)
2. ⏳ Phase 1: 레이아웃 변경
3. ⏳ Phase 2: 데이터 API 통합
4. ⏳ Phase 3: 테스트 및 검증
5. ⏳ Git 커밋 및 푸시

---

**예상 소요 시간**: 2-3시간
**난이도**: 중간
**영향 범위**: `app/admin/page.tsx` (1개 파일)
