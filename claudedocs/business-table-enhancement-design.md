# Admin/Business 페이지 테이블 개선 설계

## 📋 요구사항 분석

### 1. 영업점 컬럼 추가
- **목적**: 사업장별 영업점 정보를 테이블에 표시
- **데이터 소스**: `sales_office` 필드 (이미 DB에 존재)
- **현재 상태**: 영업점 데이터는 있으나 테이블에 컬럼 미표시

### 2. 설치완료 컬럼 추가
- **목적**: 설치일 데이터 유무를 시각적으로 표시
- **데이터 소스**: `installation_date` 필드
- **표시 방식**: ✓ 체크 아이콘 또는 "설치 완료" 텍스트 배지

### 3. 설치완료 필터 추가
- **목적**: 설치가 완료된 사업장만 필터링
- **필터 조건**: `installation_date` 값이 존재하는 사업장
- **UI 위치**: 기존 "제출일 필터" 영역

### 4. 필터 UI 개선
- **"제출일 필터" → "상세 필터"로 이름 변경**
- 설치완료 필터를 상세 필터 영역에 통합

---

## 🎨 UI/UX 설계

### 테이블 컬럼 구조 (순서 제안)

```
[사업장명] [담당자] [연락처] [영업점*] [제조사] [주소] [사업진행연도] [진행구분] [설치완료*] [현재단계]
```

**새로 추가되는 컬럼**:
- **영업점**: 제조사 앞에 배치 (영업-제조사 순서가 자연스러움)
- **설치완료**: 진행구분과 현재단계 사이에 배치 (진행 상태 관련 컬럼 그룹)

### 컬럼 상세 설계

#### 1️⃣ 영업점 컬럼
```typescript
{
  key: 'sales_office',
  title: '영업점',
  width: '90px',
  render: (item: any) => {
    const office = item.sales_office || item.영업점 || '-'

    // 영업점별 색상 구분 (옵션)
    const getOfficeStyle = (name: string) => {
      if (name === '-') return 'text-gray-400 text-xs'
      return 'px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200'
    }

    return (
      <div className="text-center">
        <span className={getOfficeStyle(office)}>
          {searchQuery ? highlightSearchTerm(office, searchQuery) : office}
        </span>
      </div>
    )
  }
}
```

#### 2️⃣ 설치완료 컬럼
```typescript
{
  key: 'installation_status',
  title: '설치완료',
  width: '80px',
  render: (item: any) => {
    const hasInstallation = !!item.installation_date

    return (
      <div className="flex justify-center items-center">
        {hasInstallation ? (
          <div className="flex items-center gap-1">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-600 font-medium">완료</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>
    )
  }
}
```

**대안 디자인 (배지 스타일)**:
```typescript
return (
  <div className="text-center">
    {hasInstallation ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <Check className="w-3 h-3" />
        완료
      </span>
    ) : (
      <span className="text-xs text-gray-400">미완료</span>
    )}
  </div>
)
```

---

## 🔍 필터 시스템 설계

### 상태 관리 업데이트

```typescript
// 기존 submissionDateFilters 확장
const [submissionDateFilters, setSubmissionDateFilters] = useState<{
  order_date: boolean;
  construction_report: boolean;
  greenlink_confirmation: boolean;
  attachment_completion: boolean;
  installation_complete: boolean; // ✨ 새로 추가
}>({
  order_date: false,
  construction_report: false,
  greenlink_confirmation: false,
  attachment_completion: false,
  installation_complete: false // ✨ 새로 추가
})
```

### 필터 로직 업데이트

```typescript
// 필터 적용 함수 (line 1509-1530 영역 수정)
if (hasActiveSubmissionFilter) {
  filtered = filtered.filter(b => {
    let matchesFilter = true

    if (submissionDateFilters.order_date) {
      matchesFilter = matchesFilter && !!b.order_date
    }
    if (submissionDateFilters.construction_report) {
      matchesFilter = matchesFilter && !!b.construction_report_submitted_at
    }
    if (submissionDateFilters.greenlink_confirmation) {
      matchesFilter = matchesFilter && !!b.greenlink_confirmation_submitted_at
    }
    if (submissionDateFilters.attachment_completion) {
      matchesFilter = matchesFilter && !!b.attachment_completion_submitted_at
    }
    // ✨ 새로 추가: 설치완료 필터
    if (submissionDateFilters.installation_complete) {
      matchesFilter = matchesFilter && !!b.installation_date
    }

    return matchesFilter
  })
}
```

### 필터 UI 업데이트

```tsx
{/* 상세 필터 (기존 제출일 필터 영역) - line 3990-4050 */}
<div className="mt-3 pt-3 border-t border-gray-200">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-blue-600" />  {/* CalendarClock → Filter */}
      <h4 className="text-sm md:text-sm font-semibold text-gray-800">상세 필터</h4>  {/* 제목 변경 */}
      <button
        onClick={() => setIsSubmissionFilterExpanded(!isSubmissionFilterExpanded)}
        className="ml-1 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label={isSubmissionFilterExpanded ? '필터 접기' : '필터 펼치기'}
      >
        {isSubmissionFilterExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
    </div>
    {hasActiveSubmissionFilter && (
      <button
        onClick={clearSubmissionFilters}
        className="text-xs text-red-500 hover:text-red-600 font-medium"
      >
        초기화 ✕
      </button>
    )}
  </div>

  {/* 필터 버튼들 */}
  <div className={`grid grid-cols-2 md:grid-cols-5 gap-2 transition-all duration-300 overflow-hidden ${
    isSubmissionFilterExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
  }`}>
    {/* 기존 4개 필터 */}
    <button
      onClick={() => toggleSubmissionFilter('order_date')}
      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
        submissionDateFilters.order_date
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      발주일 있음
    </button>

    <button
      onClick={() => toggleSubmissionFilter('construction_report')}
      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
        submissionDateFilters.construction_report
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      착공신고서
    </button>

    <button
      onClick={() => toggleSubmissionFilter('greenlink_confirmation')}
      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
        submissionDateFilters.greenlink_confirmation
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      그린링크확인서
    </button>

    <button
      onClick={() => toggleSubmissionFilter('attachment_completion')}
      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
        submissionDateFilters.attachment_completion
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      부착완료통보서
    </button>

    {/* ✨ 새로 추가: 설치완료 필터 */}
    <button
      onClick={() => toggleSubmissionFilter('installation_complete')}
      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
        submissionDateFilters.installation_complete
          ? 'bg-green-50 text-green-700 border-green-300'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      설치완료
    </button>
  </div>
</div>
```

---

## 📦 Import 추가 필요

```typescript
import { Check, Filter } from 'lucide-react'  // Check, Filter 아이콘 추가
```

기존에 이미 있는 import:
- `CalendarClock` (제출일 필터에서 사용 중)
- `ChevronUp`, `ChevronDown` (접기/펼치기)

---

## 🔄 변경 영역 요약

### 1. 컬럼 정의 (line 3500-3650 영역)
- **제조사 컬럼 앞에** "영업점" 컬럼 추가
- **현재단계 컬럼 앞에** "설치완료" 컬럼 추가

### 2. 상태 관리 (line 788-818 영역)
- `submissionDateFilters` 상태에 `installation_complete` 필드 추가
- `clearSubmissionFilters` 함수에 필드 추가

### 3. 필터 로직 (line 1509-1530 영역)
- 설치완료 필터 조건 추가

### 4. 필터 UI (line 3990-4050 영역)
- 제목 변경: "제출일 필터" → "상세 필터"
- 아이콘 변경: `CalendarClock` → `Filter`
- 그리드 컬럼 변경: `grid-cols-4` → `grid-cols-5`
- 설치완료 필터 버튼 추가

### 5. Import 추가 (최상단)
```typescript
import { Check, Filter } from 'lucide-react'
```

---

## 🎯 예상 결과

### Before (현재)
```
[사업장명] [담당자] [연락처] [제조사] [주소] [사업진행연도] [진행구분] [현재단계]

필터:
└─ 📅 제출일 필터
   ├─ 발주일 있음
   ├─ 착공신고서
   ├─ 그린링크확인서
   └─ 부착완료통보서
```

### After (개선)
```
[사업장명] [담당자] [연락처] [영업점*] [제조사] [주소] [사업진행연도] [진행구분] [설치완료*] [현재단계]

필터:
└─ 🔍 상세 필터
   ├─ 발주일 있음
   ├─ 착공신고서
   ├─ 그린링크확인서
   ├─ 부착완료통보서
   └─ 설치완료*  ← 새로 추가
```

---

## 📊 데이터 흐름

```
Database (businesses 테이블)
  ├─ sales_office → 영업점 컬럼
  └─ installation_date → 설치완료 컬럼 (있으면 ✓ 표시)

필터 상태 (submissionDateFilters)
  └─ installation_complete: true → installation_date 필터링
```

---

## ✅ 구현 체크리스트

- [ ] Import 추가 (`Check`, `Filter` 아이콘)
- [ ] 영업점 컬럼 추가 (제조사 앞에 배치)
- [ ] 설치완료 컬럼 추가 (진행구분 뒤에 배치)
- [ ] `submissionDateFilters` 상태에 `installation_complete` 추가
- [ ] 필터 로직에 설치완료 조건 추가
- [ ] 필터 UI 제목 변경 ("상세 필터")
- [ ] 필터 UI 아이콘 변경 (`Filter`)
- [ ] 필터 UI 그리드 확장 (`grid-cols-5`)
- [ ] 설치완료 필터 버튼 추가
- [ ] `clearSubmissionFilters` 함수에 필드 추가
- [ ] 테스트: 영업점 데이터 표시 확인
- [ ] 테스트: 설치완료 아이콘 표시 확인
- [ ] 테스트: 설치완료 필터 동작 확인

---

## 🎨 UI 스타일 가이드

### 컬러 시스템
- **영업점**: Purple 계열 (`bg-purple-50`, `text-purple-700`, `border-purple-200`)
- **설치완료**: Green 계열 (`bg-green-50`, `text-green-700`, `border-green-200`)
- **필터 활성화**: Blue 계열 (기존 통일)

### 컴포넌트 크기
- **영업점 컬럼**: `width: '90px'` (제조사와 동일)
- **설치완료 컬럼**: `width: '80px'` (간결한 표시)
- **필터 버튼**: `px-3 py-2 text-xs` (기존 통일)

---

## 🔮 향후 개선 아이디어

1. **영업점별 통계**: 영업점별 사업장 수, 설치완료율 등
2. **설치완료 일자 표시**: 마우스 오버 시 실제 설치일 툴팁
3. **복합 필터**: 영업점 + 설치완료 조합 필터
4. **필터 프리셋**: 자주 사용하는 필터 조합 저장

---

## 📝 주의사항

1. **데이터 일관성**: `sales_office`와 `영업점` 필드 병합 처리 필요
2. **검색 하이라이트**: `highlightSearchTerm` 함수 적용 유지
3. **반응형**: 모바일 카드 뷰에도 영업점, 설치완료 정보 표시 필요
4. **성능**: 필터 추가로 인한 렌더링 성능 영향 모니터링
