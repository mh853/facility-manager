# 측정기기 수량 및 추가비용 표시 문제 해결

## 수정 완료 사항

### 1. 추가공사비 및 협의사항 저장 및 표시 ✅

**문제**: 추가공사비와 협의사항이 항상 0으로 저장됨

**원인**:
- API 인터페이스에 `additional_cost`, `negotiation_cost` 필드 누락
- DB 저장 시 하드코딩된 0 값 사용

**수정**:
```typescript
// 1. 인터페이스에 필드 추가 (line 16-17)
interface ContractGenerationRequest {
  // ... 기존 필드
  additional_cost?: number;
  negotiation_cost?: number;
}

// 2. 요청 바디에서 값 추출 (line 63-64)
const {
  // ... 기존 필드
  additional_cost,
  negotiation_cost
} = body;

// 3. DB 저장 시 실제 값 사용 (line 276-277)
additional_cost: additional_cost || 0,
negotiation_cost: negotiation_cost || 0,
```

### 2. 측정기기 컬럼명 수정 ✅

**문제**: API에서 존재하지 않는 컬럼명 사용

**원인**:
- API 코드: `pressure_differential`, `pump_ct`, `fan_ct`
- 실제 DB: `pressure`, `pump`, `fan`

**수정**:
```typescript
// SELECT 쿼리 (line 119)
.select('ph, pressure, temperature, pump, fan')

// 데이터 검증 (line 140-144)
if (f.pressure && f.pressure !== '면제' && f.pressure !== '없음') pressureCount++;
if (f.pump && f.pump !== '면제' && f.pump !== '없음') pumpCtCount++;
if (f.fan && f.fan !== '면제' && f.fan !== '없음') fanCtCount++;
```

### 3. 디버깅 로그 추가 ✅

**계약서 생성 요청 데이터 로깅** (line 67-74):
```typescript
console.log('📝 계약서 생성 요청 데이터:', {
  business_id,
  contract_type,
  payment_advance_ratio,
  payment_balance_ratio,
  additional_cost,
  negotiation_cost
});
```

**장비 수량 계산 결과 로깅** (line 154-168):
```typescript
console.log('🔧 장비 수량 계산 결과:', {
  business_name: business.business_name,
  discharge_facilities_count: dischargeFacilities?.length || 0,
  prevention_facilities_count: preventionFacilities?.length || 0,
  equipment_counts: { ... }
});
```

---

## 측정기기 수량 0 문제 - 데이터 확인 필요

### 현재 상황
```
discharge_facilities_count: 0
prevention_facilities_count: 0
```

### 가능한 원인

1. **데이터가 실제로 없음** ⭐ 가장 가능성 높음
   - `(주)영빈산업(방2)` 사업장에 측정기기 정보가 등록되지 않음

2. **business_name 불일치**
   - DB: `(주) 영빈산업(방2)` (공백 있음)
   - API: `(주)영빈산업(방2)` (공백 없음)

3. **모든 값이 '면제' 또는 '없음'**
   - 데이터는 있지만 카운트 대상이 아님

### 확인 방법

**STEP 1**: `equipment-debug-query.sql` 실행
```sql
-- 실제 스키마 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'discharge_facilities';

-- 영빈산업 사업장명 확인
SELECT DISTINCT business_name
FROM business_info
WHERE business_name LIKE '%영빈산업%';

-- prevention_facilities 데이터 확인
SELECT business_name, ph, pressure, temperature, pump, fan
FROM prevention_facilities
WHERE business_name LIKE '%영빈산업%';

-- discharge_facilities 데이터 확인
SELECT *
FROM discharge_facilities
WHERE business_name LIKE '%영빈산업%';
```

**STEP 2**: `find-businesses-with-equipment.sql` 실행
- 실제 측정기기 데이터가 있는 사업장 목록 확인
- 해당 사업장으로 테스트 진행

### 해결 방법

#### Case 1: 데이터가 없음
**해결책**: 사업장 관리 페이지에서 측정기기 정보 등록
1. `/business/(주)영빈산업(방2)` 페이지 접속
2. 배출시설/방지시설 정보 입력
3. 측정기기 정보 등록

#### Case 2: business_name 불일치
**해결책 A - DB 데이터 통일**:
```sql
UPDATE prevention_facilities
SET business_name = '(주)영빈산업(방2)'
WHERE business_name LIKE '%영빈산업%';

UPDATE discharge_facilities
SET business_name = '(주)영빈산업(방2)'
WHERE business_name LIKE '%영빈산업%';
```

**해결책 B - API 쿼리 수정 (LIKE 사용)**:
현재는 `eq()` 정확히 일치만 찾음 → `like()` 또는 `ilike()` 부분 일치로 변경

#### Case 3: 데이터 있는 사업장으로 테스트
1. `find-businesses-with-equipment.sql` 실행
2. 결과에 나온 사업장으로 계약서 생성
3. 수량이 정상 표시되는지 확인

---

## 테스트 체크리스트

- [ ] 페이지 새로고침 (코드 변경 적용)
- [ ] SQL 쿼리 실행하여 데이터 확인
- [ ] 추가공사비 입력하여 계약서 생성
- [ ] 협의사항 입력하여 계약서 생성
- [ ] 미리보기에서 추가공사비/협의사항 표시 확인
- [ ] 측정기기 데이터 있는 사업장으로 테스트
- [ ] 서버 콘솔에서 `📝 계약서 생성 요청 데이터` 로그 확인
- [ ] 서버 콘솔에서 `🔧 장비 수량 계산 결과` 로그 확인
- [ ] 미리보기 제 3조에서 측정기기 수량 확인

---

## 수정된 파일

1. **app/api/document-automation/contract/route.ts**
   - Line 10-18: ContractGenerationRequest 인터페이스에 additional_cost, negotiation_cost 추가
   - Line 57-74: 요청 바디 파싱 및 디버깅 로그 추가
   - Line 119: prevention_facilities SELECT 쿼리 컬럼명 수정
   - Line 140-144: 데이터 검증 로직 컬럼명 수정
   - Line 154-168: 장비 수량 계산 디버깅 로그 추가
   - Line 276-277: DB 저장 시 실제 additional_cost, negotiation_cost 값 사용

2. **utils/contractPdfGenerator.ts**
   - Line 162-176: PDF 업로드 API 응답 디버깅 로그 추가

3. **claudedocs/equipment-debug-query.sql** (생성)
   - 측정기기 데이터 확인용 SQL 쿼리

4. **claudedocs/find-businesses-with-equipment.sql** (생성)
   - 측정기기 데이터가 있는 사업장 찾기 쿼리
