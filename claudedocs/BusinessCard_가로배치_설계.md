# BusinessCard 가로 배치 레이아웃 설계

## 현재 구조 분석

### 현재 레이아웃 (세로 배치)
```
┌──────────────────────────────────────────────┐
│ [아이콘] 사업장명                             │
│          실사자 | 날짜                        │
│          🔍 설치 전 실사  📸 설치 후 사진     │
│          📷 사진 12장                         │
│                                         [→]  │
└──────────────────────────────────────────────┘
```

**문제점**:
- 정보가 세로로 쌓여 카드 높이가 증가
- 오른쪽 공간이 비어있음 (max-w-6xl로 확장했지만 활용 안 됨)
- 많은 정보를 표시할 때 수직 공간 낭비

## 개선된 레이아웃 (가로 배치)

### 설계 A: 2단 가로 배치 (권장)
```
┌────────────────────────────────────────────────────────────────────────┐
│ [아이콘] 사업장명                  │ 실사자: 김철수 │ 날짜: 2025-01-15 │
│          🔍 설치 전 실사  📸 설치 후 사진  🔧 AS 사진  📷 사진 12장    │  [→]
└────────────────────────────────────────────────────────────────────────┘
```

**장점**:
- 가로 공간 효율적 활용
- 카드 높이 감소 (페이지당 더 많은 항목 표시 가능)
- 정보 스캔 용이 (왼쪽에서 오른쪽 읽기 흐름)

### 설계 B: 그리드 배치 (대안)
```
┌────────────────────────────────────────────────────────────────────────┐
│ [아이콘] 사업장명                  │ 실사자: 김철수                     │
│                                     │ 날짜: 2025-01-15                  │  [→]
│          🔍 설치 전 실사  📸 설치 후 사진  🔧 AS 사진  📷 사진 12장    │
└────────────────────────────────────────────────────────────────────────┘
```

**특징**:
- 실사자/날짜가 오른쪽 별도 영역
- Phase와 사진 정보는 하단 가로 배치
- 정보 구역 명확 분리

## 선택: 설계 A (2단 가로 배치)

### 이유
1. **공간 효율**: 카드 높이 최소화
2. **스캔 용이**: 왼→오 자연스러운 읽기 흐름
3. **밀도**: 페이지당 더 많은 항목 표시 가능
4. **일관성**: 모든 정보가 균등하게 배치

## 상세 설계

### 레이아웃 구조

```tsx
<button className="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3">
  {/* 1열: 아이콘 */}
  <div className="flex items-center">
    <Building2 icon />
  </div>

  {/* 2열: 메인 정보 영역 */}
  <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
    {/* 2-1: 사업장명 + Phase 배지 */}
    <div>
      <h3>사업장명</h3>
      <div className="flex gap-1.5">
        Phase 배지들...
      </div>
    </div>

    {/* 2-2: 실사자 */}
    <div className="flex items-center gap-1.5">
      <User icon />
      <span>실사자명</span>
    </div>

    {/* 2-3: 날짜 + 사진 */}
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Calendar icon />
        <span>날짜</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Camera icon />
        <span>사진 12장</span>
      </div>
    </div>
  </div>

  {/* 3열: 화살표 */}
  <div className="flex items-center">
    →
  </div>
</button>
```

### 반응형 설계

```tsx
// 데스크탑 (≥1024px): 3열 그리드
className="grid grid-cols-[auto_1fr_auto] gap-4"

// 태블릿 (768-1023px): 2열 그리드 (화살표 생략)
className="md:grid md:grid-cols-[auto_1fr] gap-3"

// 모바일 (<768px): 세로 배치 (기존 구조 유지)
className="flex flex-col gap-2"
```

### 스타일 가이드

#### 간격 (Spacing)
- 카드 패딩: `px-6 py-3` (기존 py-4에서 py-3으로 감소)
- 열 간격: `gap-4` (16px)
- 요소 간격: `gap-1.5` (6px)

#### 텍스트 크기
- 사업장명: `text-base font-semibold` (16px)
- 실사자/날짜: `text-sm` (14px)
- Phase 배지: `text-xs` (12px)
- 사진 정보: `text-xs` (12px)

#### 색상
- 실사자명: `text-gray-700`
- 날짜: `text-gray-600`
- Phase 배지: 기존 유지 (blue/purple/green)
- 사진 정보: 기존 유지 (green-700 / gray-500)

## 구현 세부사항

### 1. 그리드 시스템
```tsx
// 메인 그리드: 아이콘 | 정보 영역 | 화살표
grid-cols-[auto_1fr_auto]

// 정보 영역 서브 그리드: 사업장명 | 실사자 | 날짜+사진
grid-cols-[2fr_1fr_1fr]
```

### 2. 정보 우선순위

**왼쪽 (주요 정보)**:
1. 사업장명
2. Phase 배지

**가운데 (실사자)**:
- 실사자명 (우선순위: 설치 전 > 설치자 > AS)

**오른쪽 (상세 정보)**:
- 실사일자
- 사진 개수

### 3. Phase 배지 배치
```tsx
// 사업장명 아래 가로 배치
<div className="flex flex-wrap gap-1 mt-1">
  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
    🔍 설치 전 실사
  </span>
  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
    📸 설치 후 사진
  </span>
  <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
    🔧 AS 사진
  </span>
</div>
```

### 4. 날짜 + 사진 스택
```tsx
// 오른쪽 영역에 세로 스택
<div className="flex flex-col gap-1.5 text-sm">
  <div className="flex items-center gap-1.5 text-gray-600">
    <Calendar className="w-3.5 h-3.5" />
    <span>2025-01-15</span>
  </div>
  <div className="flex items-center gap-1.5">
    <Camera className="w-3.5 h-3.5" />
    <span className="text-green-700">사진 12장</span>
  </div>
</div>
```

## 비교: Before vs After

### Before (세로 배치)
- 카드 높이: ~120px
- 페이지당 항목: 10개 기준 → 약 1200px
- 정보 밀도: 낮음

### After (가로 배치)
- 카드 높이: ~70px (약 42% 감소)
- 페이지당 항목: 10개 기준 → 약 700px
- 정보 밀도: 높음
- **추가 효과**: 동일한 화면에 더 많은 항목 표시 가능

## 접근성 개선

### 키보드 네비게이션
```tsx
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick(business.business_name);
    }
  }}
  aria-label={`${business.business_name} 상세 정보 보기`}
>
```

### 스크린 리더
```tsx
<div className="sr-only">
  사업장: {business.business_name}
  실사자: {primaryInspector}
  실사일: {formatDate(primaryDate)}
  진행 단계: {phases.map(...).join(', ')}
  사진: {photoCount}장
</div>
```

## 성능 최적화

### 렌더링 최적화
```tsx
// memo로 불필요한 재렌더링 방지 (이미 적용됨)
export default memo(function BusinessCard({ business, onClick }: BusinessCardProps) {
  // ...
});
```

### 조건부 렌더링
```tsx
// Phase 배지가 없으면 영역 자체를 렌더링하지 않음
{business.phases && hasAnyPhase(business.phases) && (
  <div className="flex flex-wrap gap-1 mt-1">
    {/* Phase 배지들 */}
  </div>
)}
```

## 예상 효과

### 공간 효율
- ✅ 카드 높이 42% 감소
- ✅ 페이지당 더 많은 항목 표시
- ✅ 스크롤 거리 감소

### 가독성
- 📊 정보 스캔 용이 (왼→오 흐름)
- 📊 관련 정보 그룹핑 (실사자+날짜+사진)
- 📊 시각적 계층 명확

### 사용성
- 🎯 빠른 정보 파악
- 🎯 클릭 영역 유지
- 🎯 반응형 지원

## 구현 단계

### Phase 1: 레이아웃 구조 변경
1. 메인 그리드 적용 (`grid-cols-[auto_1fr_auto]`)
2. 정보 영역 서브 그리드 적용
3. 요소 재배치

### Phase 2: 스타일 조정
1. 간격 조정 (py-4 → py-3)
2. 텍스트 크기 조정
3. Phase 배지 배치 변경

### Phase 3: 반응형 적용
1. 모바일/태블릿/데스크탑 브레이크포인트
2. 각 화면 크기별 레이아웃 테스트

### Phase 4: 접근성 검증
1. 키보드 네비게이션 테스트
2. 스크린 리더 테스트
