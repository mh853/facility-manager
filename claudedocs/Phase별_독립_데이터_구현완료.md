# Phase별 독립 데이터 저장 구현 완료

## 개요

설치 전/후/AS 각 단계별로 독립적인 담당자 정보와 특이사항을 저장하도록 시스템을 업그레이드했습니다.

## 구현 상세

### 1. 데이터베이스 스키마 변경

**파일**: `sql/add_phase_specific_columns.sql`

각 phase별로 독립적인 컬럼 추가:

```sql
-- 설치 전 실사 (Presurvey)
presurvey_inspector_name VARCHAR(100)
presurvey_inspector_contact VARCHAR(20)
presurvey_inspector_date DATE
presurvey_special_notes TEXT

-- 설치 후 (Post-Installation)
postinstall_installer_name VARCHAR(100)
postinstall_installer_contact VARCHAR(20)
postinstall_installer_date DATE
postinstall_special_notes TEXT

-- AS (After Sales)
aftersales_technician_name VARCHAR(100)
aftersales_technician_contact VARCHAR(20)
aftersales_technician_date DATE
aftersales_special_notes TEXT
```

### 2. TypeScript 타입 정의

**파일**: `types/index.ts`

`BusinessInfo` 인터페이스에 phase별 필드 추가 (lines 122-145)

### 3. API 업데이트

**파일**: `app/api/facility-management/route.ts`

#### GET 엔드포인트
- 기존 데이터 조회 시 phase별 모든 필드 반환
- 모든 컬럼 선택 (`select('*')`)으로 자동 포함

#### PUT 엔드포인트 (lines 126-203)
Phase별 필드 처리 추가:
```typescript
// 요청 파라미터
presurvey_inspector_name
presurvey_inspector_contact
presurvey_inspector_date
presurvey_special_notes
// ... (postinstall, aftersales 동일)

// 제공된 필드만 업데이트
if (presurvey_inspector_name !== undefined) updateData.presurvey_inspector_name = presurvey_inspector_name;
// ... 각 필드별 처리
```

### 4. 프론트엔드 상태 관리

**파일**: `app/business/[businessName]/page.tsx`

#### 상태 구조 변경 (lines 75-98)
```typescript
const [phaseData, setPhaseData] = useState({
  presurvey: {
    inspectorInfo: { name: '', contact: '', date: '' },
    specialNotes: ''
  },
  postinstall: {
    inspectorInfo: { name: '', contact: '', date: '' },
    specialNotes: ''
  },
  aftersales: {
    inspectorInfo: { name: '', contact: '', date: '' },
    specialNotes: ''
  }
});

// 현재 phase 데이터 getter
const getCurrentPhaseData = () => phaseData[currentPhase];
const inspectorInfo = getCurrentPhaseData().inspectorInfo;
const specialNotes = getCurrentPhaseData().specialNotes;
```

#### 데이터 로딩 (lines 313-340)
Phase별로 독립적인 데이터 로드:
```typescript
setPhaseData({
  presurvey: {
    inspectorInfo: {
      name: business.presurvey_inspector_name || '',
      contact: business.presurvey_inspector_contact || '',
      date: business.presurvey_inspector_date || defaultDate
    },
    specialNotes: business.presurvey_special_notes || ''
  },
  // postinstall, aftersales 동일
});
```

#### 업데이트 핸들러 (lines 410-459)
Phase별 데이터 업데이트:
```typescript
const handleInspectorUpdate = (info) => {
  setPhaseData(prev => ({
    ...prev,
    [currentPhase]: {
      ...prev[currentPhase],
      inspectorInfo: info
    }
  }));
};

const handleNotesUpdate = (notes) => {
  setPhaseData(prev => ({
    ...prev,
    [currentPhase]: {
      ...prev[currentPhase],
      specialNotes: notes
    }
  }));
};
```

#### 저장 함수 (lines 461-616)
Phase별 필드명 매핑 및 저장:
```typescript
// 담당자 정보 저장
const fieldMap = {
  presurvey: {
    name: 'presurvey_inspector_name',
    contact: 'presurvey_inspector_contact',
    date: 'presurvey_inspector_date'
  },
  postinstall: {
    name: 'postinstall_installer_name',
    contact: 'postinstall_installer_contact',
    date: 'postinstall_installer_date'
  },
  aftersales: {
    name: 'aftersales_technician_name',
    contact: 'aftersales_technician_contact',
    date: 'aftersales_technician_date'
  }
};

// API 요청
fetch('/api/facility-management', {
  method: 'PUT',
  body: JSON.stringify({
    businessId: businessInfo.id,
    phase: currentPhase,
    [fields.name]: info.name,
    [fields.contact]: info.contact,
    [fields.date]: info.date
  })
});
```

### 5. UI 컴포넌트

**파일**: `components/sections/InspectorInfoSection.tsx`

Phase별 제목 및 라벨 표시:
- `title` prop으로 "실사자 정보" / "설치자 정보" / "AS 담당자 정보" 구분
- 필드 라벨도 동적으로 변경 (실사자명/설치자명/AS 담당자명)

## 배포 순서

1. **데이터베이스 마이그레이션 실행**
   ```bash
   # Supabase SQL Editor에서 실행
   sql/add_phase_specific_columns.sql
   ```

2. **애플리케이션 배포**
   ```bash
   npm run build
   npm start
   # 또는 Vercel 배포
   ```

3. **기존 데이터 검증**
   - 기존 `inspector_name`, `inspector_contact`, `inspector_date`, `special_notes` 데이터가 자동으로 `presurvey_*` 컬럼으로 복사됨 (migration SQL 포함)

## 테스트 시나리오

### 시나리오 1: 설치 전 실사 데이터 입력
1. 사업장 상세 페이지 진입
2. 상단 드롭다운에서 "🔍 설치 전 실사" 선택
3. 실사자 정보 입력:
   - 실사자명: "홍길동"
   - 연락처: "010-1234-5678" (자동 하이픈)
   - 실사일자: 오늘 날짜
4. 특이사항 입력: "설치 전 현장 확인 완료"
5. 각 섹션의 "저장" 버튼 클릭
6. 초록색 토스트: "실사자 정보가 저장되었습니다." 확인

### 시나리오 2: 설치 후 데이터 입력
1. 상단 드롭다운에서 "📸 설치 후 사진" 선택
2. **데이터가 비어있음을 확인** (설치 전 실사 데이터와 독립)
3. 설치자 정보 입력:
   - 설치자명: "김설치"
   - 연락처: "010-9876-5432"
   - 설치일자: 오늘 날짜
4. 특이사항 입력: "설치 완료, 정상 작동 확인"
5. 저장 후 토스트: "설치자 정보가 저장되었습니다." 확인

### 시나리오 3: AS 데이터 입력
1. 상단 드롭다운에서 "🔧 AS 사진" 선택
2. **데이터가 비어있음을 확인** (다른 phase와 독립)
3. AS 담당자 정보 입력:
   - AS 담당자명: "박수리"
   - 연락처: "010-5555-6666"
   - AS 작업일자: 오늘 날짜
4. 특이사항 입력: "센서 교체 작업 완료"
5. 저장 후 토스트: "AS 담당자 정보가 저장되었습니다." 확인

### 시나리오 4: Phase 전환 시 독립성 확인
1. "설치 전 실사" → "설치 후 사진" → "AS 사진" 순서로 phase 전환
2. 각 phase에서 입력한 데이터가 독립적으로 유지되는지 확인
3. 페이지 새로고침 후에도 각 phase별 데이터가 올바르게 로드되는지 확인

### 시나리오 5: 데이터베이스 검증
```sql
-- 특정 사업장의 phase별 데이터 조회
SELECT
  business_name,
  -- 설치 전 실사
  presurvey_inspector_name,
  presurvey_inspector_contact,
  presurvey_inspector_date,
  presurvey_special_notes,
  -- 설치 후
  postinstall_installer_name,
  postinstall_installer_contact,
  postinstall_installer_date,
  postinstall_special_notes,
  -- AS
  aftersales_technician_name,
  aftersales_technician_contact,
  aftersales_technician_date,
  aftersales_special_notes
FROM business_info
WHERE business_name = '(유)태현환경';
```

## 예상 결과

각 phase별로 완전히 독립적인 데이터 저장 및 조회:
- 설치 전 실사: 실사자 홍길동, 현장 확인 내용
- 설치 후: 설치자 김설치, 설치 완료 내용
- AS: AS 담당자 박수리, 수리 내용

Phase 전환 시:
- 각 phase의 데이터가 독립적으로 유지
- 다른 phase의 데이터가 덮어써지지 않음
- UI 라벨이 phase에 맞게 자동 변경

## 하위 호환성

기존 `inspector_name`, `inspector_contact`, `inspector_date`, `special_notes` 필드는 유지되어 하위 호환성 보장.

## 주의사항

1. **SQL 마이그레이션 먼저 실행**: 애플리케이션 배포 전에 데이터베이스 스키마 변경 필수
2. **기존 데이터 백업**: 마이그레이션 전 데이터 백업 권장
3. **점진적 배포**: 테스트 환경에서 충분히 검증 후 프로덕션 배포

## 파일 목록

### 새로 생성된 파일
- `sql/add_phase_specific_columns.sql` - 데이터베이스 마이그레이션

### 수정된 파일
- `types/index.ts` - BusinessInfo 타입 확장
- `app/api/facility-management/route.ts` - API PUT 엔드포인트 확장
- `app/business/[businessName]/page.tsx` - Phase별 상태 관리 및 저장 로직
- `components/sections/InspectorInfoSection.tsx` - 동적 제목 지원

## 다음 단계

1. SQL 마이그레이션 실행
2. 로컬 환경 테스트
3. 스테이징 환경 배포 및 검증
4. 프로덕션 배포
5. 사용자 교육 및 피드백 수집

## 롤백 계획

문제 발생 시:
1. 애플리케이션 이전 버전으로 롤백
2. 데이터는 그대로 유지 (새 컬럼은 nullable이므로 문제 없음)
3. 필요 시 새로 추가된 컬럼 제거:
   ```sql
   ALTER TABLE business_info
   DROP COLUMN IF EXISTS presurvey_inspector_name,
   DROP COLUMN IF EXISTS presurvey_inspector_contact,
   -- ... (나머지 컬럼)
   ```
