# 견적서 대기배출시설 허가증 기능 구현 가이드

## 문제 진단 및 해결

### 원인 분석

견적서 미리보기 및 PDF에 허가증이 표시되지 않는 문제의 근본 원인:

1. **데이터베이스 스키마 불일치**
   - `business_info` 테이블에 `air_permit` 컬럼이 존재하지 않음
   - 대신 별도의 `air_permit_info` 테이블이 존재
   - `estimate_history` 테이블에 `air_permit` 컬럼이 없음

2. **API 데이터 조회 누락**
   - 견적서 미리보기 API가 `air_permit_info` 테이블을 조회하지 않음
   - 견적서 생성 API가 허가증 데이터를 저장하지 않음

### 해결 방법

#### 1. 데이터베이스 마이그레이션

**필수 마이그레이션 파일:** `sql/add_air_permit_to_estimates.sql`

```sql
ALTER TABLE estimate_history
ADD COLUMN IF NOT EXISTS air_permit JSONB DEFAULT NULL;
```

이 마이그레이션을 실행하면:
- `estimate_history` 테이블에 `air_permit` 컬럼이 추가됨
- JSONB 타입으로 허가증 데이터를 저장할 수 있음
- 기존 데이터에는 NULL 값이 설정됨

#### 2. API 수정 사항

**2.1. 견적서 미리보기 API** (`app/api/estimates/preview/route.ts`)

```typescript
// 대기필증 정보 조회 추가
const { data: airPermitData } = await supabaseAdmin
  .from('air_permit_info')
  .select('*')
  .eq('business_id', businessId)
  .eq('is_deleted', false)
  .maybeSingle()

// 배출구, 배출시설, 방지시설 정보 조회
// emission_facilities, prevention_facilities 배열 구성

air_permit = {
  business_type: airPermitData.business_type || '',
  category: airPermitData.additional_info?.category || '',
  first_report_date: airPermitData.first_report_date || '',
  operation_start_date: airPermitData.operation_start_date || '',
  emission_facilities,
  prevention_facilities
}
```

**2.2. 견적서 생성 API** (`app/api/estimates/generate/route.ts`)

동일한 로직으로 `air_permit` 데이터를 조회하고 저장

```typescript
.insert({
  // ... 기존 필드들
  air_permit  // 추가
})
```

**2.3. TypeScript 인터페이스** (`EstimatePreviewModal.tsx`)

```typescript
interface AirPermit {
  business_type: string
  category: string
  first_report_date: string
  operation_start_date: string
  emission_facilities: Array<{
    name: string
    scale: string
    fuel: string
  }>
  prevention_facilities: Array<{
    name: string
    type: string
    quantity: string
  }>
}

interface EstimatePreviewData {
  // ... 기존 필드들
  air_permit?: AirPermit
}
```

## 데이터 구조

### air_permit_info 테이블 구조

```
air_permit_info
├── id (UUID)
├── business_id (UUID) → business_info.id
├── business_type (VARCHAR)
├── first_report_date (DATE)
├── operation_start_date (DATE)
├── additional_info (JSONB)
│   └── category (STRING)
└── is_deleted (BOOLEAN)

discharge_outlets (배출구)
├── id (UUID)
├── air_permit_id (UUID) → air_permit_info.id
├── outlet_number (INTEGER)
└── outlet_name (VARCHAR)

discharge_facilities (배출시설)
├── id (UUID)
├── outlet_id (UUID) → discharge_outlets.id
├── facility_name (VARCHAR)
├── capacity (VARCHAR)
└── additional_info (JSONB)
    └── fuel (STRING)

prevention_facilities (방지시설)
├── id (UUID)
├── outlet_id (UUID) → discharge_outlets.id
├── facility_name (VARCHAR)
├── quantity (INTEGER)
└── additional_info (JSONB)
    └── type (STRING)
```

### estimate_history.air_permit JSONB 구조

```json
{
  "business_type": "제조업",
  "category": "4종",
  "first_report_date": "2020-01-15",
  "operation_start_date": "2020-02-01",
  "emission_facilities": [
    {
      "name": "소각로",
      "scale": "50kg/hr",
      "fuel": "LNG"
    }
  ],
  "prevention_facilities": [
    {
      "name": "전기집진기",
      "type": "EP-1",
      "quantity": "1"
    }
  ]
}
```

## 실행 순서

1. **Supabase 대시보드 접속**
   - SQL Editor로 이동

2. **마이그레이션 실행**
   ```sql
   -- sql/add_air_permit_to_estimates.sql 내용 복사 및 실행
   ```

3. **검증**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'estimate_history'
     AND column_name = 'air_permit';
   ```

4. **애플리케이션 재시작**
   - 코드 변경 사항이 이미 적용되어 있으므로
   - Next.js dev 서버가 자동으로 재컴파일됨

5. **테스트**
   - 대기필증이 있는 사업장 선택
   - 견적서 미리보기 모달 열기
   - 허가증 섹션 확인
   - PDF 다운로드 후 2페이지 확인

## 참고 사항

- 발주서 API (`app/api/document-automation/purchase-order/route.ts`)는 이미 동일한 방식으로 구현되어 있음
- 발주서의 구현을 참고하여 견적서 기능을 통일함
- 허가증이 없는 사업장에서는 해당 섹션이 표시되지 않음 (조건부 렌더링)
- UI는 이미 구현되어 있었으나 데이터만 누락된 상태였음
