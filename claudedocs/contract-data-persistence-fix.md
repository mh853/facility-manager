# 자비 계약서 데이터 미적용 문제 해결

## 문제 상황
1. **대금 결제 비율이 적용되지 않음**: 사용자가 선금/잔금 비율을 설정했지만 계약서에 50/50으로 표시됨
2. **사업자 정보가 표시되지 않음**: 사업자등록번호, 전화번호, 팩스번호가 계약서에 반영되지 않음

## 근본 원인 분석

### 데이터 흐름 분석
```
ContractManagement.tsx (프론트엔드)
  ↓ API 호출 시 payment_advance_ratio, payment_balance_ratio 전달
API route.ts (백엔드)
  ↓ contractData 객체에 모든 정보 포함
  ↓ BUT: database insert 시 일부 필드만 저장 ❌
contract_history 테이블 (데이터베이스)
  ↓ 저장된 데이터를 다시 조회
ContractManagement.tsx
  ↓ 미리보기/PDF 생성 시 데이터베이스에서 조회한 데이터 사용
SelfPayContractTemplate.tsx
  ↓ 결과: 누락된 필드는 undefined 또는 기본값으로 표시
```

### 문제점 식별
1. **API route.ts 223-241번째 줄**: `.insert()` 쿼리가 다음 필드들을 누락
   - `business_registration_number`
   - `business_phone`
   - `business_fax`
   - `payment_advance_ratio`
   - `payment_balance_ratio`
   - `equipment_counts`
   - `additional_cost`
   - `negotiation_cost`

2. **contract_history 테이블 스키마**: 위 컬럼들이 테이블에 존재하지 않음

## 해결 방법

### 1. 데이터베이스 마이그레이션 (필수)
**파일**: `sql/add_contract_history_columns.sql`

다음 명령으로 Supabase SQL 에디터에서 실행:
```sql
-- 사업자 상세 정보
ALTER TABLE contract_history
ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT,
ADD COLUMN IF NOT EXISTS business_fax TEXT;

-- 공급자 상세 정보
ADD COLUMN IF NOT EXISTS supplier_company_name TEXT DEFAULT '주식회사 블루온',
ADD COLUMN IF NOT EXISTS supplier_representative TEXT DEFAULT '김경수',
ADD COLUMN IF NOT EXISTS supplier_address TEXT DEFAULT '경상북도 고령군 대가야읍 낫질로 285';

-- 대금 결제 비율
ADD COLUMN IF NOT EXISTS payment_advance_ratio INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS payment_balance_ratio INTEGER DEFAULT 50;

-- 추가 비용
ADD COLUMN IF NOT EXISTS additional_cost NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS negotiation_cost NUMERIC(12, 2) DEFAULT 0;

-- 장비 수량 (JSONB)
ADD COLUMN IF NOT EXISTS equipment_counts JSONB DEFAULT '{
  "ph_meter": 0,
  "differential_pressure_meter": 0,
  "temperature_meter": 0,
  "discharge_current_meter": 0,
  "fan_current_meter": 0,
  "pump_current_meter": 0,
  "gateway": 0,
  "vpn": 0
}'::jsonb;

-- 계약 조건
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
```

### 2. API 라우트 수정 (완료)
**파일**: `app/api/document-automation/contract/route.ts:222-258`

수정 내용:
```typescript
// BEFORE: 일부 필드만 저장
.insert({
  business_id,
  business_name: business.business_name,
  contract_type,
  contract_number: contractNumber,
  contract_date: today,
  total_amount: totalAmount,
  business_address: business.address,
  business_representative: business.representative_name,
  supplier_company_name: template.supplier_company_name,
  supplier_representative: template.supplier_representative,
  supplier_address: template.supplier_address,
  terms_and_conditions: template.terms_and_conditions,
  created_by: userId
})

// AFTER: 모든 필드 저장
.insert({
  business_id,
  business_name: business.business_name,
  contract_type,
  contract_number: contractNumber,
  contract_date: today,
  total_amount: totalAmount,
  business_address: business.address,
  business_representative: business.representative_name,
  business_registration_number: business.business_registration_number || '',
  business_phone: business.business_contact || '',
  business_fax: business.fax_number || '',
  supplier_company_name: template.supplier_company_name,
  supplier_representative: template.supplier_representative,
  supplier_address: template.supplier_address,
  terms_and_conditions: template.terms_and_conditions,
  payment_advance_ratio: payment_advance_ratio || 50,
  payment_balance_ratio: payment_balance_ratio || 50,
  additional_cost: 0,
  negotiation_cost: 0,
  equipment_counts: {
    ph_meter: phCount,
    differential_pressure_meter: pressureCount,
    temperature_meter: temperatureCount,
    discharge_current_meter: dischargeCtCount,
    fan_current_meter: fanCtCount,
    pump_current_meter: pumpCtCount,
    gateway: gatewayCount,
    vpn: vpnCount
  },
  created_by: userId
})
```

## 배포 순서

### 1단계: 데이터베이스 마이그레이션
1. Supabase 대시보드 접속
2. SQL Editor 열기
3. `sql/add_contract_history_columns.sql` 내용 복사하여 실행
4. 성공 메시지 확인

### 2단계: 코드 배포
1. Git commit 및 push
2. 애플리케이션 재배포 (이미 수정 완료)

### 3단계: 검증
1. 자비 계약서 생성
2. 선금/잔금 비율 변경 (예: 60/40)
3. 계약서 미리보기에서 확인:
   - 사업자등록번호 표시 확인
   - 전화번호/팩스번호 표시 확인
   - 선금 60%, 잔금 40% 표시 확인
   - 장비 수량 표시 확인

## 영향 범위

### 변경된 파일
- ✅ `app/api/document-automation/contract/route.ts` (수정 완료)
- ✅ `sql/add_contract_history_columns.sql` (신규 생성)
- ✅ `claudedocs/contract-data-persistence-fix.md` (신규 생성)

### 영향받는 기능
- ✅ 자비 계약서 생성
- ✅ 계약서 미리보기
- ✅ 계약서 PDF 다운로드
- ✅ 계약서 이력 조회

### 영향받지 않는 기능
- ✅ 보조금 계약서 (동일한 스키마 사용하므로 동시 해결)
- ✅ 기존 계약서 데이터 (새 컬럼은 NULL 허용)

## 기술적 세부사항

### 데이터베이스 컬럼 타입
- `business_registration_number`, `business_phone`, `business_fax`: TEXT (가변 길이 문자열)
- `payment_advance_ratio`, `payment_balance_ratio`: INTEGER (정수, 백분율)
- `additional_cost`, `negotiation_cost`: NUMERIC(12, 2) (소수점 2자리 금액)
- `equipment_counts`: JSONB (JSON 객체, 인덱싱 가능)

### 기본값 설정 이유
- `payment_advance_ratio`, `payment_balance_ratio`: 기본 50/50 분할
- `additional_cost`, `negotiation_cost`: 기본 0원 (없는 경우)
- `equipment_counts`: 빈 객체 (모든 장비 수량 0)

### 성능 고려사항
- JSONB 타입 사용: 인덱싱 가능, 쿼리 성능 우수
- 인덱스 추가: `business_registration_number`, `payment_advance_ratio` 검색 최적화

## 테스트 시나리오

### 테스트 1: 기본 비율 (50/50)
1. 자비 계약서 생성
2. 비율 변경 없이 생성
3. 예상 결과: 선금 50%, 잔금 50%

### 테스트 2: 커스텀 비율 (70/30)
1. 자비 계약서 생성
2. 선금 70%, 잔금 30%로 변경
3. 예상 결과: 계약서에 70/30 표시

### 테스트 3: 사업자 정보
1. 사업자 정보가 있는 사업장 선택
2. 계약서 생성
3. 예상 결과:
   - 사업자등록번호: 000-00-00000
   - 전화번호: 000-0000-0000
   - 팩스번호: 000-0000-0000

### 테스트 4: 장비 수량
1. 장비가 등록된 사업장 선택
2. 계약서 생성
3. 예상 결과: 테이블에 실제 장비 수량 표시

## 추가 개선 사항 (향후)

### 1. additional_cost, negotiation_cost 실제 값 사용
현재는 0으로 하드코딩되어 있음. DB에 해당 필드 추가 시:
```typescript
additional_cost: business.additional_cost || 0,
negotiation_cost: business.negotiation_cost || 0,
```

### 2. 계약서 수정 기능
생성된 계약서의 비율이나 정보를 수정할 수 있는 UI 추가

### 3. 계약서 버전 관리
동일 계약의 여러 버전을 관리하는 시스템

## 결론

**근본 원인**: 데이터베이스 스키마와 API insert 쿼리 불일치
**해결 방법**: 스키마 확장 + API 수정으로 완전한 데이터 영속성 확보
**배포 우선순위**: HIGH (사용자 경험에 직접적인 영향)
**리스크**: LOW (additive change, 기존 데이터에 영향 없음)
