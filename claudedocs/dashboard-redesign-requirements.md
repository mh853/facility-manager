# 대시보드 개편 요구사항 명세서

## 📋 프로젝트 개요

**목적**: 시설 관리 시스템의 관리자 대시보드를 데이터 중심의 그래프 기반 인터페이스로 전면 개편

**작성일**: 2025-10-28
**페이지**: `/app/admin/page.tsx` (기존 페이지 전면 리뉴얼)

---

## 🎯 핵심 요구사항

### 1. 제거할 요소
- 기존 통계 카드 (StatsCard 컴포넌트들)
- 최근 활동 섹션
- 빠른 작업 버튼들
- **유지**: 조직현황 (OrganizationChart) 영역만 보존

### 2. 추가할 그래프 (3개)

#### 📊 그래프 1: 월별 매출/매입/이익 현황
- **타입**: Composed Chart (Bar + Line 혼합)
- **데이터 소스**: `/api/revenue/calculate` + `/api/business-info-direct`
- **기간**: 최근 12개월
- **표시 항목**:
  - 매출 (Bar, 파란색)
  - 매입 (Bar, 주황색)
  - 순이익 (Line, 초록색)
- **추가 지표**:
  - 이익률 (순이익 / 매출 × 100)
  - 전월 대비 증감률
  - 12개월 평균 라인
  - 월별 목표 대비 달성률

#### 💰 그래프 2: 월별 미수금 현황
- **타입**: Area Chart (면적 그래프)
- **데이터 소스**: `/api/business-invoices` (계산서 데이터)
- **기간**: 최근 12개월
- **표시 항목**:
  - 누적 미수금 (빨간색 계열)
  - 회수된 금액 (초록색 계열)
- **추가 지표**:
  - 전월 대비 증감
  - 12개월 평균
  - 회수율 표시

#### 🔧 그래프 3: 월별 설치 현황
- **타입**: Stacked Bar Chart (누적 막대)
- **데이터 소스**: `/api/business-info-direct` (installation_date, progress_status)
- **기간**: 최근 12개월
- **표시 항목**:
  - 대기 (회색)
  - 진행중 (노란색)
  - 완료 (초록색)
- **추가 지표**:
  - 전월 대비 증감
  - 완료율 (완료 / 전체)
  - 월평균 설치 건수

---

## 🎨 UI/UX 요구사항

### 레이아웃
- **구조**: 3열 그리드 레이아웃
  - 1행: 조직현황 (전체 너비)
  - 2행: 매출/매입/이익 그래프 (전체 너비)
  - 3행: 미수금 그래프 (왼쪽 50%) + 설치 현황 그래프 (오른쪽 50%)
- **반응형**:
  - 데스크탑: 3열 그리드
  - 태블릿: 2열 그리드
  - 모바일: 1열 (세로 스택)

### 필터링 기능
각 그래프 상단에 필터 패널 제공:
- **지사별 필터**: 서울/부산/대구/광주 등
- **제조사별 필터**: 시스템에 등록된 제조사 목록
- **진행구분 필터**: 대기/진행중/완료
- **영업점별 필터**: 각 영업 담당자별 구분
- **필터 초기화 버튼**: 모든 필터 해제

### 상호작용 기능
1. **툴팁 표시**: 마우스 호버 시 정확한 수치 표시
2. **데이터 포인트 강조**: 호버 시 포인트 크기 확대/강조
3. **클릭 상세보기**: 그래프 데이터 클릭 시 해당 월 상세 모달 오픈
4. **범례 토글**: 범례 클릭으로 데이터 숨기기/보이기

### 로딩 상태
- **Skeleton UI**: 그래프 모양의 플레이스홀더 표시
- **부분 로딩**: 각 그래프가 독립적으로 로딩 (병렬 처리)

### 데이터 새로고침
- **자동**: 페이지 로드 시 자동 로드
- **수동**: 새로고침 버튼 제공 (각 그래프 우측 상단)
- **실시간 표시**: 마지막 업데이트 시각 표시

### 빈 데이터 처리
- **0으로 표시**: 데이터 없는 월은 0으로 표시하여 연속성 유지
- **안내 메시지**: "해당 월 데이터가 없습니다" 툴팁 표시

---

## 🛠 기술 스택

### 그래프 라이브러리
- **Recharts** v2.x
- 이유: React 친화적, 반응형 우수, 커스터마이징 쉬움
- 번들 크기: ~400KB (허용 범위)

### 필요한 Recharts 컴포넌트
```typescript
import {
  ComposedChart,
  AreaChart,
  BarChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
```

### 상태 관리
- React useState/useEffect 사용
- 필터 상태: 각 그래프별 독립적 상태 관리

### 데이터 페칭
- fetch API 사용
- 병렬 로딩: `Promise.all()` 활용
- 에러 핸들링: try-catch + fallback UI

---

## 📊 데이터 구조

### 1. 매출/매입/이익 데이터 구조
```typescript
interface RevenueData {
  month: string;           // "2025-01", "2025-02"
  revenue: number;         // 매출
  cost: number;           // 매입
  profit: number;         // 순이익
  profitRate: number;     // 이익률 (%)
  target: number;         // 월별 목표
  achievementRate: number; // 달성률 (%)
  prevMonthChange: number; // 전월 대비 증감률 (%)
}
```

### 2. 미수금 데이터 구조
```typescript
interface ReceivableData {
  month: string;           // "2025-01"
  outstanding: number;     // 미수금
  collected: number;       // 회수 금액
  collectionRate: number;  // 회수율 (%)
  prevMonthChange: number; // 전월 대비 증감
}
```

### 3. 설치 현황 데이터 구조
```typescript
interface InstallationData {
  month: string;           // "2025-01"
  waiting: number;         // 대기
  inProgress: number;      // 진행중
  completed: number;       // 완료
  total: number;          // 전체
  completionRate: number; // 완료율 (%)
  prevMonthChange: number; // 전월 대비 증감
}
```

---

## 🔗 API 엔드포인트

### 1. 매출 데이터 조회
```
GET /api/dashboard/revenue?months=12&filters={...}
```
**쿼리 파라미터**:
- `months`: 조회 개월 수 (기본 12)
- `office`: 지사별 필터
- `manufacturer`: 제조사별 필터
- `salesOffice`: 영업점별 필터

**응답**:
```json
{
  "data": [
    {
      "month": "2025-01",
      "revenue": 50000000,
      "cost": 30000000,
      "profit": 20000000,
      "profitRate": 40,
      "target": 25000000,
      "achievementRate": 80
    }
  ],
  "summary": {
    "avgProfit": 18000000,
    "avgProfitRate": 36
  }
}
```

### 2. 미수금 데이터 조회
```
GET /api/dashboard/receivables?months=12&filters={...}
```
**응답**:
```json
{
  "data": [
    {
      "month": "2025-01",
      "outstanding": 15000000,
      "collected": 35000000,
      "collectionRate": 70
    }
  ],
  "summary": {
    "totalOutstanding": 180000000,
    "avgCollectionRate": 65
  }
}
```

### 3. 설치 현황 조회
```
GET /api/dashboard/installations?months=12&filters={...}
```
**응답**:
```json
{
  "data": [
    {
      "month": "2025-01",
      "waiting": 5,
      "inProgress": 12,
      "completed": 23,
      "total": 40,
      "completionRate": 57.5
    }
  ],
  "summary": {
    "avgMonthlyInstallations": 35,
    "avgCompletionRate": 60
  }
}
```

---

## 🎯 월별 목표 관리

### 목표 설정 UI
- **위치**: 각 그래프 우측 상단 "목표 설정" 버튼
- **기능**: 월별 개별 목표 설정 가능
- **저장**: Supabase `dashboard_targets` 테이블에 저장

### 데이터베이스 스키마
```sql
CREATE TABLE dashboard_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL,  -- 'revenue', 'receivable', 'installation'
  month TEXT NOT NULL,         -- '2025-01'
  target_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(target_type, month)
);
```

---

## ✅ 구현 체크리스트

### Phase 1: 환경 설정
- [ ] Recharts 라이브러리 설치
- [ ] 타입 정의 파일 생성
- [ ] 컴포넌트 디렉토리 구조 생성

### Phase 2: API 개발
- [ ] `/api/dashboard/revenue` 엔드포인트 구현
- [ ] `/api/dashboard/receivables` 엔드포인트 구현
- [ ] `/api/dashboard/installations` 엔드포인트 구현
- [ ] 필터링 로직 구현
- [ ] 에러 핸들링 및 검증

### Phase 3: 데이터 처리 로직
- [ ] 월별 데이터 집계 함수
- [ ] 전월 대비 증감률 계산
- [ ] 평균값 계산
- [ ] 달성률 계산

### Phase 4: 그래프 컴포넌트
- [ ] RevenueChart 컴포넌트 (Composed Chart)
- [ ] ReceivableChart 컴포넌트 (Area Chart)
- [ ] InstallationChart 컴포넌트 (Stacked Bar)
- [ ] 공통 Tooltip 컴포넌트
- [ ] 공통 Legend 컴포넌트

### Phase 5: 필터 시스템
- [ ] FilterPanel 컴포넌트
- [ ] 필터 상태 관리
- [ ] 필터 적용 로직
- [ ] 필터 초기화 기능

### Phase 6: UI 개선
- [ ] Skeleton 로딩 컴포넌트
- [ ] 새로고침 버튼
- [ ] 상세보기 모달
- [ ] 목표 설정 모달

### Phase 7: 대시보드 통합
- [ ] `/app/admin/page.tsx` 리팩토링
- [ ] 조직현황 영역 유지
- [ ] 그래프 영역 통합
- [ ] 레이아웃 반응형 대응

### Phase 8: 테스트 및 최적화
- [ ] 타입 체크 (`npx tsc --noEmit`)
- [ ] 성능 테스트 (데이터 로딩 속도)
- [ ] 반응형 테스트 (모바일/태블릿/데스크탑)
- [ ] 브라우저 호환성 테스트

---

## 🚀 배포 전 확인사항

1. **데이터 정합성**: 기존 API와 데이터 일치 확인
2. **권한 검증**: 관리자 권한 레벨별 접근 제어
3. **성능**: 12개월 데이터 로딩 시간 < 2초
4. **오류 처리**: 네트워크 에러, 빈 데이터 등 엣지 케이스 처리
5. **문서화**: API 문서 및 컴포넌트 주석 작성

---

## 📝 추가 고려사항

### 향후 확장 가능성
1. **데이터 내보내기**: 그래프 데이터를 Excel/CSV로 내보내기
2. **인쇄 기능**: 대시보드 PDF 출력
3. **알림 설정**: 목표 미달 시 알림
4. **비교 모드**: 연도별, 지사별 비교 뷰
5. **대시보드 커스터마이징**: 사용자별 위젯 배치 변경

### 성능 최적화
1. **데이터 캐싱**: React Query 또는 SWR 도입 고려
2. **Lazy Loading**: 스크롤 시 그래프 로드
3. **메모이제이션**: useMemo/React.memo 활용
4. **번들 최적화**: Dynamic import로 Recharts 지연 로딩

### 접근성
1. **키보드 네비게이션**: 그래프 키보드 탐색 지원
2. **스크린 리더**: ARIA 레이블 추가
3. **색상 대비**: WCAG AA 기준 충족
4. **대체 텍스트**: 그래프 데이터의 텍스트 버전 제공

---

## 🎉 예상 효과

1. **가시성 향상**: 한눈에 전체 현황 파악 가능
2. **의사결정 지원**: 데이터 기반 경영 판단 지원
3. **트렌드 분석**: 월별 추이를 통한 패턴 파악
4. **목표 관리**: 달성률 추적으로 성과 관리 강화
5. **업무 효율**: 수치 확인을 위한 페이지 이동 감소

---

## 📞 문의 및 피드백

구현 중 추가 요구사항이나 변경사항이 있을 경우 즉시 반영 가능합니다.
