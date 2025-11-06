# 실사관리 페이지 Phase 필터 추가 설계

## 요구사항

`/facility` 페이지의 필터에 `/business/[사업장명]` 페이지의 phase 구분을 추가하여 사업장을 필터링할 수 있도록 개선

### Phase 종류 (from business/[businessName]/page.tsx)
1. **설치 전 실사** (`presurvey`)
2. **설치 후 사진** (`postinstall` / `completion`)
3. **AS 사진** (`aftersales`)

## 데이터 구조 분석

### 기존 사진 데이터 구조 (uploaded_files 테이블)
```typescript
interface UploadedFile {
  id: string;
  business_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  project_phase: 'presurvey' | 'installation' | 'completion'; // ⚠️ 주의: installation vs postinstall
  created_at: string;
}
```

### Phase 매핑 관계
- `presurvey` → 설치 전 실사
- `installation` / `completion` → 설치 후 사진 (postinstall)
- ⚠️ **AS 사진은 별도 필드 없음** → `project_phase` 구분 불가

### 실사자 정보 기반 Phase 판단 (business_info 테이블)
```typescript
interface BusinessInfo {
  // 설치 전 실사
  presurvey_inspector_name?: string;
  presurvey_inspector_contact?: string;
  presurvey_inspector_date?: string;

  // 설치 후 (postinstall)
  postinstall_installer_name?: string;
  postinstall_installer_contact?: string;
  postinstall_installer_date?: string;

  // AS (aftersales)
  aftersales_technician_name?: string;
  aftersales_technician_contact?: string;
  aftersales_technician_date?: string;
}
```

## 필터링 전략

### 옵션 1: 실사자 정보 기반 (현재 구현 가능)
- **장점**: 추가 DB 스키마 변경 불필요
- **단점**: AS 사진 phase를 명확히 구분하기 어려움
- **구현**: 실사자명이 입력된 phase만 "진행됨"으로 간주

### 옵션 2: uploaded_files 테이블에 phase 추가 (권장)
- **장점**: 사진 단위로 정확한 phase 구분 가능
- **단점**: DB 스키마 변경 필요, 기존 데이터 마이그레이션 필요
- **구현**: `uploaded_files.project_phase`를 `'presurvey' | 'postinstall' | 'aftersales'`로 확장

### ✅ 선택: 옵션 1 (실사자 정보 기반 - 빠른 구현)
이유:
1. 즉시 구현 가능 (DB 변경 불필요)
2. 사용자 요구사항 충족 가능
3. 향후 옵션 2로 마이그레이션 가능

## UI 설계

### FilterPanel 컴포넌트 확장

```
┌─────────────────────────────────────────────────┐
│ [기본 검색]                                      │
│ 🔍 사업장명 검색...                              │
│                                                  │
│ [고급 필터 ▼] (4)  ← 활성 필터 개수 업데이트    │
├─────────────────────────────────────────────────┤
│ 👤 실사자명: [전체 ▼]                            │
│                                                  │
│ 📅 실사일자: [시작일] ~ [종료일]                  │
│                                                  │
│ 📷 사진 등록: ○ 전체  ○ 있음  ○ 없음             │
│                                                  │
│ 🔧 진행 단계:  ← NEW                             │
│   ☑ 설치 전 실사                                 │
│   ☑ 설치 후 사진                                 │
│   ☑ AS 사진                                     │
│   (복수 선택 가능)                               │
│                                                  │
│ [필터 초기화 (4개)]                              │
└─────────────────────────────────────────────────┘
```

### BusinessCard 컴포넌트 확장

```
┌───────────────────────────────────────────────┐
│ 🏢  (유)태현환경                               │
│                                                │
│     👤 김철수 | 📅 2025-01-15                  │
│                                                │
│     🔍 설치 전 실사  📸 설치 후 사진  ← NEW     │
│     📷 사진 12장                               │
└───────────────────────────────────────────────┘
```

## 데이터 구조

### FilterState 확장
```typescript
interface FilterState {
  searchTerm: string;
  inspectorName: string | null;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  photoStatus: 'all' | 'with_photos' | 'without_photos';

  // NEW: Phase 필터 (복수 선택)
  phases: {
    presurvey: boolean;      // 설치 전 실사
    postinstall: boolean;    // 설치 후 사진
    aftersales: boolean;     // AS 사진
  };
}
```

### BusinessInfo 확장 (API 응답)
```typescript
interface BusinessInfo {
  id: string;
  business_name: string;

  // 실사자 정보 (기존)
  presurvey_inspector_name?: string;
  presurvey_inspector_date?: string;
  postinstall_installer_name?: string;
  postinstall_installer_date?: string;
  aftersales_technician_name?: string;
  aftersales_technician_date?: string;

  // 사진 통계 (기존)
  photo_count?: number;
  has_photos?: boolean;

  // NEW: Phase 진행 상태
  phases: {
    presurvey: boolean;      // 설치 전 실사 진행됨
    postinstall: boolean;    // 설치 후 사진 진행됨
    aftersales: boolean;     // AS 사진 진행됨
  };
}
```

## 필터링 로직

### Phase 진행 여부 판단 기준
```typescript
const phases = {
  presurvey: !!business.presurvey_inspector_name,     // 실사자명 입력 여부
  postinstall: !!business.postinstall_installer_name, // 설치자명 입력 여부
  aftersales: !!business.aftersales_technician_name   // AS 담당자명 입력 여부
};
```

### 필터링 알고리즘
```typescript
// 1. Phase 필터가 모두 선택되어 있으면 필터링 안 함
const allPhasesSelected = phases.presurvey && phases.postinstall && phases.aftersales;

// 2. 하나라도 선택되어 있으면 해당 phase만 표시
if (!allPhasesSelected) {
  const hasSelectedPhase =
    (phases.presurvey && business.phases.presurvey) ||
    (phases.postinstall && business.phases.postinstall) ||
    (phases.aftersales && business.phases.aftersales);

  if (!hasSelectedPhase) return false; // 필터링 제외
}
```

## 구현 단계

### Phase 1: API 확장 (business-list)
1. `business_info` 데이터에서 실사자 정보 기반 phase 진행 상태 계산
2. 응답에 `phases` 객체 추가

### Phase 2: FilterPanel 컴포넌트 확장
1. Phase 필터 UI 추가 (체크박스 3개)
2. 활성 필터 개수 계산 로직 업데이트
3. 필터 초기화에 phase 필터 포함

### Phase 3: BusinessCard 컴포넌트 확장
1. Phase 배지 표시 (진행된 phase만)
2. 아이콘: 🔍 설치 전 실사, 📸 설치 후 사진, 🔧 AS 사진

### Phase 4: 필터링 로직 구현
1. `facility/page.tsx`의 `filteredList` useMemo에 phase 필터 추가
2. 복수 선택 로직 구현 (OR 조건)

### Phase 5: 타입 정의 업데이트
1. `BusinessInfo` 인터페이스에 `phases` 추가
2. `FilterState` 타입에 `phases` 추가

## 예상 효과

### 사용자 편의성
- ✅ Phase별 사업장 빠른 조회
- ✅ 진행 단계별 업무 현황 파악
- ✅ 미진행 단계 사업장 즉시 확인

### 업무 효율성
- 🚀 단계별 업무 관리 용이
- 🎯 진행 상태별 사업장 분류
- 📊 진행 현황 통계 파악

### 확장성
- 🔄 향후 DB 스키마 확장 시 쉽게 마이그레이션 가능
- 🔧 Phase별 사진 개수 통계 추가 가능
- 📈 진행률 계산 기능 추가 가능

## 주의사항

### 데이터 정합성
- 실사자명이 입력되지 않은 경우 해당 phase는 "미진행"으로 간주
- 사진이 업로드되어 있어도 실사자명이 없으면 "미진행"

### 성능
- Phase 계산은 클라이언트 사이드에서 수행 (API 응답 포함)
- useMemo를 통한 캐싱으로 성능 최적화

### 향후 개선
- `uploaded_files` 테이블에 `aftersales_phase` 추가 고려
- Phase별 사진 개수 통계 추가
- 진행률(%) 표시 기능 추가
