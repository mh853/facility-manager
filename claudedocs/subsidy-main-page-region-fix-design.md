# Subsidy Main Page - Region Display Fix & Unannounced Regions Stats Design

**작성일**: 2026-01-28
**목적**:
1. 메인 페이지 공고 목록에서 "IoT" 대신 정확한 지역명 표시
2. 신청가능한공고 모달에 "미공고 지자체" 통계 카드 추가

---

## 📋 Part 1: 지역명 표시 수정

### 현재 상황
- **메인 페이지** (`/app/admin/subsidy/page.tsx`)의 공고 목록에서 지역명이 "IoT"로 표시됨
- **신청가능한공고 모달**에서는 이미 수정되어 정확한 지역명이 표시됨
- 스크린샷의 2, 3번째 항목: "📝 수동등록 **IoT**"로 표시

### 원인 파악
메인 페이지에서 지역명을 추출하는 로직이 제목에서만 추출하고 있어서, `region_name` 필드를 우선적으로 사용하지 않음

### 해결 방법
신청가능한공고 모달에서 수정한 것과 동일한 로직을 메인 페이지에 적용:
- `region_name` 필드가 있으면 우선 사용
- 없으면 제목에서 추출

---

## 🔍 영향 범위

### 수정 대상 파일
**`/app/admin/subsidy/page.tsx`**
- 공고 목록 테이블 (데스크톱)
- 공고 카드 (모바일)
- 지역명 표시 로직

---

## 🎨 UI 개선 사항

### 현재 표시 방식
```tsx
// 잘못된 표시 예시
📝 수동등록  IoT
2025년 사물인터넷[IoT] 측정기기 부착 지원사업 2차 변경 공고(포천시)
```

### 개선된 표시 방식
```tsx
// 정확한 지역명 표시
📝 수동등록  포천시
2025년 사물인터넷[IoT] 측정기기 부착 지원사업 2차 변경 공고(포천시)
```

---

## 🔧 기술 구현

### 1. 지역명 추출 함수 추가/수정

메인 페이지에 `extractRegion` 함수가 이미 존재하는지 확인 필요.
- **존재하면**: 함수를 수정하여 `region_name` 우선 사용
- **존재하지 않으면**: 신청가능한공고 모달과 동일한 함수 추가

```tsx
// 지역명 추출 함수 (region_name 우선)
const extractRegion = (title: string, regionName: string): string => {
  // region_name이 있으면 우선 사용 (IoT 같은 잘못된 추출 방지)
  if (regionName && regionName.trim()) {
    return regionName;
  }

  // region_name이 없으면 제목에서 추출
  const bracketMatches = title.match(/\[([^\]]+)\]/g);
  if (!bracketMatches || bracketMatches.length === 0) {
    return '미분류';
  }

  const regionMap: Record<string, string> = {
    '서울': '서울특별시',
    '부산': '부산광역시',
    '대구': '대구광역시',
    '인천': '인천광역시',
    '광주': '광주광역시',
    '대전': '대전광역시',
    '울산': '울산광역시',
    '세종': '세종특별자치시',
    '경기': '경기도',
    '강원': '강원특별자치도',
    '충북': '충청북도',
    '충남': '충청남도',
    '전북': '전북특별자치도',
    '전남': '전라남도',
    '경북': '경상북도',
    '경남': '경상남도',
    '제주': '제주특별자치도',
  };

  // 첫 번째 대괄호 내용 추출
  const firstBracket = bracketMatches[0].replace(/[\[\]]/g, '');

  // 지역명으로 매핑
  for (const [key, value] of Object.entries(regionMap)) {
    if (firstBracket.includes(key)) {
      return value;
    }
  }

  // 구체적인 시/군/구 이름이 포함되어 있으면 그대로 반환
  const cityPattern = /(특별시|광역시|특별자치시|특별자치도|도)$/;
  if (cityPattern.test(firstBracket)) {
    return firstBracket;
  }

  // 시/군/구가 포함되어 있으면 그대로 반환
  const detailedPattern = /시$|군$|구$/;
  if (detailedPattern.test(firstBracket)) {
    return firstBracket;
  }

  return firstBracket;
};
```

### 2. 지역명 표시 수정

#### 데스크톱 테이블
```tsx
<td className="px-3 sm:px-4 py-2 sm:py-3">
  <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
    {announcement.source === 'manual' ? (
      <>
        <span>📝</span>
        <span className="font-medium text-purple-600">수동등록</span>
      </>
    ) : (
      <>
        <span>🤖</span>
        <span className="text-gray-600">자동수집</span>
      </>
    )}
  </span>
  {/* 지역명 표시 - region_name 우선 사용 */}
  <div className="mt-1 text-[10px] sm:text-xs text-gray-600 truncate">
    {extractRegion(announcement.title, announcement.region_name)}
  </div>
</td>
```

#### 모바일 카드
```tsx
<div className="flex items-start justify-between mb-2">
  <div className="flex items-center gap-1.5">
    {announcement.source === 'manual' ? (
      <>
        <span className="text-base">📝</span>
        <span className="text-xs font-medium text-purple-600">수동등록</span>
      </>
    ) : (
      <>
        <span className="text-base">🤖</span>
        <span className="text-xs text-gray-600">자동수집</span>
      </>
    )}
    {/* 지역명 표시 - region_name 우선 사용 */}
    <span className="text-xs text-gray-600">
      {extractRegion(announcement.title, announcement.region_name)}
    </span>
  </div>
  {/* 상태 배지 */}
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[announcement.status].bg} ${statusColors[announcement.status].text}`}>
    {statusColors[announcement.status].label}
  </span>
</div>
```

---

## 📊 수정 위치

### `/app/admin/subsidy/page.tsx`

#### 1. 함수 추가 (Line ~100-170)
```tsx
// 기존 helper 함수들 근처에 extractRegion 함수 추가
const extractRegion = (title: string, regionName: string): string => {
  // ... (위의 구현 참조)
};
```

#### 2. 데스크톱 테이블 지역명 표시 수정 (Line ~700-800)
```tsx
{/* 출처/지역 컬럼 */}
<td className="px-3 sm:px-4 py-2 sm:py-3">
  {/* ... 기존 출처 표시 ... */}
  <div className="mt-1 text-[10px] sm:text-xs text-gray-600 truncate">
    {extractRegion(announcement.title, announcement.region_name)}
  </div>
</td>
```

#### 3. 모바일 카드 지역명 표시 수정 (Line ~900-1000)
```tsx
<div className="flex items-center gap-1.5">
  {/* ... 기존 출처 표시 ... */}
  <span className="text-xs text-gray-600">
    {extractRegion(announcement.title, announcement.region_name)}
  </span>
</div>
```

---

## ✅ 검증 체크리스트

### 데이터 검증
- [ ] `region_name` 필드가 있는 공고에서 정확한 지역명 표시
- [ ] `region_name` 필드가 없는 공고에서 제목 기반 추출
- [ ] "IoT", "사물인터넷" 등 비지역명이 표시되지 않음

### UI 검증
- [ ] 데스크톱 테이블에서 지역명 정확히 표시
- [ ] 모바일 카드에서 지역명 정확히 표시
- [ ] 텍스트 오버플로우 처리 (truncate)

### 일관성 검증
- [ ] 신청가능한공고 모달과 동일한 지역명 표시
- [ ] 메인 페이지 목록과 상세 모달에서 동일한 지역명 표시

---

## 🧪 테스트 시나리오

### 시나리오 1: region_name 필드가 있는 공고
- **입력**: `region_name = "포천시"`, `title = "사물인터넷[IoT] 측정기기 부착 지원사업"`
- **예상 출력**: "포천시"
- **현재 문제**: "IoT" 표시

### 시나리오 2: region_name 필드가 없는 공고
- **입력**: `region_name = null`, `title = "[서울] 2026년 환경개선 지원사업"`
- **예상 출력**: "서울특별시"

### 시나리오 3: 복잡한 제목
- **입력**: `region_name = "동두천시"`, `title = "2025년 사물인터넷(IoT) 측정기기 부착 지원사업"`
- **예상 출력**: "동두천시"
- **현재 문제**: "IoT" 표시

---

## 🎯 기대 효과

### 사용자 경험 개선
- 메인 페이지에서 정확한 지역명으로 공고를 식별 가능
- "IoT" 같은 기술 용어가 지역명으로 오인되는 문제 해결

### 일관성 향상
- 신청가능한공고 모달과 메인 페이지에서 동일한 지역명 표시
- 전체 시스템에서 일관된 지역명 추출 로직 사용

---

## 📋 Part 2: 미공고 지자체 통계 카드

### 요구사항
- **목적**: URL 데이터관리에 등록된 지자체 중 공고문이 없는 지자체를 표시
- **위치**: 신청가능한공고 모달의 통계 카드 영역
- **명칭**: "미공고 지자체"

### 데이터 흐름

#### 1. URL 데이터 소스
**위치**: URL 데이터관리 (UrlDataManager 컴포넌트)
- Supabase 테이블: `subsidy_crawl_urls` (추정)
- 필드: `region_name`, `is_active`, 기타 메타데이터

#### 2. 공고 데이터 소스
**위치**: 신청가능한공고 모달
- Props로 전달받는 `announcements` 배열
- 각 공고의 `region_name` 필드

#### 3. 미공고 지자체 계산 로직
```tsx
// 1. URL 데이터관리에서 활성화된 지자체 목록 조회
const registeredRegions = await fetchRegisteredRegions(); // ["서울특별시", "부산광역시", "포천시", ...]

// 2. 현재 신청가능한 공고의 지역 목록 추출
const activeAnnouncementRegions = new Set(
  activeAnnouncements.map(a => extractRegion(a.title, a.region_name))
);

// 3. 차집합 계산
const unannounceRegions = registeredRegions.filter(
  region => !activeAnnouncementRegions.has(region)
);

// 4. 통계
const unannounceCount = unannounceRegions.length;
```

### UI 디자인

#### 통계 카드 추가
```tsx
{/* 기존 통계 배지들 */}
<button onClick={() => handleUrgencyFilter('all')}>
  📋 전체 {sortedAnnouncements.length}건
</button>
<button onClick={() => handleUrgencyFilter('urgent')}>
  🔥 긴급 {stats.urgent}건
</button>
{/* ... 나머지 배지들 ... */}

{/* 새로운 미공고 지자체 배지 */}
<button
  onClick={() => handleUnannounceRegionsView()}
  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:shadow-sm"
>
  <span className="text-lg">📭</span>
  <span className="text-sm font-medium text-slate-800">
    미공고 지자체 {unannounceCount}곳
  </span>
</button>
```

#### 클릭 시 동작
**옵션 1: 툴팁/모달로 목록 표시**
```tsx
const [showUnannounceModal, setShowUnannounceModal] = useState(false);

const handleUnannounceRegionsView = () => {
  setShowUnannounceModal(true);
};

// 미공고 지자체 모달
{showUnannounceModal && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-auto">
      <h3 className="text-lg font-bold mb-4">📭 미공고 지자체 목록</h3>
      <p className="text-sm text-gray-600 mb-4">
        URL 관리에 등록되었지만 현재 신청가능한 공고가 없는 지자체입니다.
      </p>
      <div className="space-y-2">
        {unannounceRegions.map(region => (
          <div key={region} className="p-2 bg-slate-50 rounded border border-slate-200">
            {region}
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowUnannounceModal(false)}
        className="mt-4 w-full py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
      >
        닫기
      </button>
    </div>
  </div>
)}
```

**옵션 2: 드롭다운으로 목록 표시**
```tsx
const [showUnannounceDropdown, setShowUnannounceDropdown] = useState(false);

<div className="relative">
  <button
    onClick={() => setShowUnannounceDropdown(!showUnannounceDropdown)}
    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100"
  >
    <span className="text-lg">📭</span>
    <span className="text-sm font-medium text-slate-800">
      미공고 지자체 {unannounceCount}곳
    </span>
    <ChevronDown className="w-4 h-4" />
  </button>

  {showUnannounceDropdown && (
    <div className="absolute top-full mt-2 left-0 bg-white border rounded-lg shadow-lg p-4 w-64 max-h-80 overflow-auto z-10">
      <h4 className="font-semibold mb-2 text-sm">미공고 지자체 목록</h4>
      <div className="space-y-1">
        {unannounceRegions.map(region => (
          <div key={region} className="text-sm text-gray-700 py-1 px-2 hover:bg-slate-50 rounded">
            {region}
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

### API 구현

#### 새로운 API 엔드포인트 (옵션)
```tsx
// /app/api/subsidy-crawler/registered-regions/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // URL 데이터관리에서 활성화된 지역 목록 조회
    const { data, error } = await supabase
      .from('subsidy_crawl_urls')
      .select('region_name')
      .eq('is_active', true);

    if (error) throw error;

    // 중복 제거 및 정렬
    const uniqueRegions = [...new Set(data.map(d => d.region_name))].sort();

    return NextResponse.json({
      success: true,
      data: uniqueRegions,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
```

#### 또는 기존 데이터 활용
`ActiveAnnouncementsModal`이 이미 모든 공고를 받으므로, URL 데이터를 별도로 로드하거나 부모 컴포넌트에서 전달:

```tsx
// app/admin/subsidy/page.tsx에서
const [registeredRegions, setRegisteredRegions] = useState<string[]>([]);

useEffect(() => {
  async function loadRegisteredRegions() {
    const response = await fetch('/api/subsidy-crawler/registered-regions');
    const data = await response.json();
    if (data.success) {
      setRegisteredRegions(data.data);
    }
  }
  loadRegisteredRegions();
}, []);

// 모달에 props로 전달
<ActiveAnnouncementsModal
  isOpen={showActiveAnnouncementsModal}
  onClose={...}
  announcements={allAnnouncements}
  registeredRegions={registeredRegions} // 추가
  onAnnouncementClick={...}
/>
```

### 구현 단계

#### Phase 1: API 및 데이터 로딩
1. **API 엔드포인트 생성** (선택사항)
   - `/api/subsidy-crawler/registered-regions` 생성
   - Supabase에서 활성화된 지역 목록 조회

2. **부모 컴포넌트에서 데이터 로드**
   - `page.tsx`에서 `registeredRegions` state 추가
   - 컴포넌트 마운트 시 API 호출
   - 모달에 props로 전달

#### Phase 2: 모달 컴포넌트 수정
1. **Props 타입 확장**
```tsx
interface ActiveAnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: SubsidyAnnouncement[];
  onAnnouncementClick: (announcement: SubsidyAnnouncement) => void;
  registeredRegions?: string[]; // 추가
}
```

2. **미공고 지자체 계산 로직**
```tsx
const unannounceRegions = useMemo(() => {
  if (!registeredRegions || registeredRegions.length === 0) return [];

  const activeRegions = new Set(
    activeAnnouncements.map(a => extractRegion(a.title, a.region_name))
  );

  return registeredRegions.filter(region => !activeRegions.has(region));
}, [registeredRegions, activeAnnouncements]);
```

3. **UI 추가**
   - 통계 배지 영역에 "미공고 지자체" 버튼 추가
   - 클릭 시 모달 또는 드롭다운 표시

#### Phase 3: 테스트
1. **데이터 검증**
   - URL 관리에 등록된 지역 목록 확인
   - 미공고 지자체 계산 정확성 검증

2. **UI 테스트**
   - 배지 클릭 시 목록 표시
   - 데이터 없을 때 처리 (0곳)
   - 반응형 디자인 확인

### 엣지 케이스 처리

#### 1. 등록된 지역이 없는 경우
```tsx
{registeredRegions && registeredRegions.length > 0 && (
  <button onClick={() => handleUnannounceRegionsView()}>
    📭 미공고 지자체 {unannounceCount}곳
  </button>
)}
```

#### 2. 미공고 지자체가 없는 경우 (100% 커버리지)
```tsx
<button
  onClick={() => handleUnannounceRegionsView()}
  className={`
    flex items-center gap-2 px-3 py-2 rounded-lg transition-all
    ${unannounceCount === 0
      ? 'bg-green-50 border border-green-200 cursor-not-allowed opacity-60'
      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}
  `}
  disabled={unannounceCount === 0}
>
  <span className="text-lg">{unannounceCount === 0 ? '✅' : '📭'}</span>
  <span className="text-sm font-medium text-slate-800">
    {unannounceCount === 0 ? '전체 지자체 공고 있음' : `미공고 지자체 ${unannounceCount}곳`}
  </span>
</button>
```

#### 3. 지역명 매칭 불일치
- `extractRegion` 함수의 정규화 로직 일관성 확보
- URL 관리와 공고의 지역명 형식 통일 (예: "서울특별시" vs "서울")

### 통계 카드 배치 순서

**권장 배치**:
```
[📋 전체 10건] [🔥 긴급 3건] [⚠️ 주의 2건] [✅ 여유 4건] [♾️ 예산소진시 1건] [📭 미공고 지자체 5곳]
```

또는 분리:
```
긴급도 통계: [전체] [긴급] [주의] [여유] [예산소진시]
---
지역 통계: [미공고 지자체 5곳]
```

### 예상 효과

#### 사용자 가치
1. **공고 커버리지 파악**: 어느 지자체에서 공고가 없는지 한눈에 확인
2. **크롤링 상태 모니터링**: URL 관리는 되어 있지만 공고가 없는 지역 식별
3. **업무 우선순위**: 미공고 지자체에 대한 수동 확인 필요성 판단

#### 시스템 가치
1. **데이터 품질 지표**: 크롤링 시스템의 효율성 측정
2. **관리자 알림**: 특정 지자체에서 지속적으로 공고가 없으면 URL 점검 필요

---

**작성자**: Claude Sonnet 4.5
**버전**: 2.0 (미공고 지자체 추가)
**최종 수정**: 2026-01-28
