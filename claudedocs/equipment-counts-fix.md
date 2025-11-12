# 측정기기 수량 표시 문제 해결

## 문제 상황
계약서에서 측정기기 수량이 모두 0으로 표시됨

## 근본 원인
1. **SQL 마이그레이션 미실행**: `add_contract_history_columns.sql` 파일의 `equipment_counts` JSONB 컬럼이 추가되지 않음
2. **기존 계약서 데이터**: 컬럼 추가 전에 생성된 계약서는 `equipment_counts = NULL`
3. **컬럼명 불일치 (해결완료)**: API가 `business_id`로 쿼리했지만, `discharge_facilities`와 `prevention_facilities` 테이블은 `business_name` 컬럼 사용

## 해결 방법

### 1단계: SQL 마이그레이션 확인 및 실행

Supabase SQL 에디터에서 다음 확인:

```sql
-- equipment_counts 컬럼 존재 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contract_history'
  AND column_name = 'equipment_counts';
```

**결과가 없으면** → `sql/add_contract_history_columns.sql` 실행 필요

### 2단계: 테스트 쿼리로 데이터 확인

```sql
-- 최근 계약서의 equipment_counts 확인
SELECT
  id,
  contract_number,
  equipment_counts
FROM contract_history
ORDER BY created_at DESC
LIMIT 5;
```

### 3단계: 새 계약서 생성하여 테스트

1. 측정기기가 등록된 사업장 선택
2. 자비 계약서 생성
3. 미리보기에서 수량 확인

**예상 결과**:
- 배출전류계: 실제 등록된 개수
- 송풍전류계+펌프전류계: 합계
- 게이트웨이: 1 (장비가 있으면)
- VPN: 1 (장비가 있으면)

### 4단계: 기존 계약서 수량 업데이트 (선택사항)

기존에 생성된 계약서의 수량을 업데이트하려면:

```sql
-- 수동으로 특정 계약서 업데이트 예시
UPDATE contract_history
SET equipment_counts = '{
  "ph_meter": 2,
  "differential_pressure_meter": 1,
  "temperature_meter": 1,
  "discharge_current_meter": 3,
  "fan_current_meter": 2,
  "pump_current_meter": 1,
  "gateway": 1,
  "vpn": 1
}'::jsonb
WHERE id = 'YOUR_CONTRACT_ID';
```

## 데이터 흐름 확인

### API에서 장비 수량 계산
```typescript
// discharge_facilities 테이블에서 조회
SELECT discharge_ct FROM discharge_facilities
WHERE business_id = ? AND is_deleted = false

// 카운트 로직
if (discharge_ct && discharge_ct !== '면제' && discharge_ct !== '없음') {
  dischargeCtCount++
}

// prevention_facilities 테이블에서 조회
SELECT ph, pressure_differential, temperature, pump_ct, fan_ct
FROM prevention_facilities
WHERE business_id = ? AND is_deleted = false

// 각 필드별 카운트
if (ph && ph !== '면제' && ph !== '없음') phCount++
```

### DB 저장
```typescript
equipment_counts: {
  ph_meter: phCount,
  differential_pressure_meter: pressureCount,
  temperature_meter: temperatureCount,
  discharge_current_meter: dischargeCtCount,
  fan_current_meter: fanCtCount,
  pump_current_meter: pumpCtCount,
  gateway: hasEquipment ? 1 : 0,
  vpn: hasEquipment ? 1 : 0
}
```

### 템플릿 표시
```typescript
const equipment = data.equipment_counts || { /* 기본값 0 */ }
const fanPumpTotal = equipment.fan_current_meter + equipment.pump_current_meter

<td>{equipment.discharge_current_meter}</td>
<td>{fanPumpTotal}</td>
<td>{equipment.gateway}</td>
<td>{equipment.vpn}</td>
```

## 디버깅 방법

### 1. 콘솔 로그 추가

API route.ts에 로그 추가:
```typescript
console.log('장비 수량:', {
  discharge: dischargeCtCount,
  ph: phCount,
  pressure: pressureCount,
  temperature: temperatureCount,
  fan: fanCtCount,
  pump: pumpCtCount,
  gateway: gatewayCount,
  vpn: vpnCount
})
```

### 2. 브라우저 개발자 도구

1. 계약서 생성 시 Network 탭 확인
2. `/api/document-automation/contract` POST 요청 확인
3. Response에서 `equipment_counts` 값 확인

### 3. Supabase 데이터베이스 직접 확인

```sql
-- 최근 생성된 계약서의 equipment_counts 확인
SELECT
  contract_number,
  business_name,
  equipment_counts,
  created_at
FROM contract_history
WHERE is_deleted = false
ORDER BY created_at DESC
LIMIT 10;
```

## 예상 결과

### BEFORE (문제 상황)
```json
{
  "ph_meter": 0,
  "differential_pressure_meter": 0,
  "temperature_meter": 0,
  "discharge_current_meter": 0,
  "fan_current_meter": 0,
  "pump_current_meter": 0,
  "gateway": 0,
  "vpn": 0
}
```

### AFTER (정상 작동)
```json
{
  "ph_meter": 2,
  "differential_pressure_meter": 1,
  "temperature_meter": 1,
  "discharge_current_meter": 3,
  "fan_current_meter": 2,
  "pump_current_meter": 1,
  "gateway": 1,
  "vpn": 1
}
```

## 트러블슈팅

### 문제 1: SQL 마이그레이션 실행했는데도 0으로 나옴
**원인**: 사업장에 측정기기가 등록되지 않았거나 모두 '면제'/'없음' 상태
**확인**:
```sql
SELECT * FROM discharge_facilities WHERE business_id = 'YOUR_BUSINESS_ID';
SELECT * FROM prevention_facilities WHERE business_id = 'YOUR_BUSINESS_ID';
```

### 문제 2: 일부 장비만 0으로 나옴
**원인**: 해당 시설 테이블에 데이터가 없음
**해결**: 사업장 관리 페이지에서 해당 측정기기 정보 등록

### 문제 3: 새로 생성한 계약서는 정상인데 기존 계약서는 0
**원인**: 기존 계약서는 컬럼 추가 전에 생성되어 NULL
**해결**: 기존 계약서 재생성 또는 SQL UPDATE로 수동 업데이트

## 확인 체크리스트

- [ ] `sql/add_contract_history_columns.sql` 실행 완료
- [ ] `equipment_counts` JSONB 컬럼 존재 확인
- [ ] 사업장에 측정기기 정보 등록 확인
- [x] API 컬럼명 불일치 수정 완료 (`business_id` → `business_name`)
- [ ] 새 계약서 생성하여 수량 표시 확인
- [ ] 미리보기 모달에서 수량 확인
- [ ] PDF 다운로드하여 수량 확인

## 결론

**필수 작업**: `sql/add_contract_history_columns.sql` SQL 마이그레이션 실행
**검증 방법**: 측정기기가 등록된 사업장으로 새 계약서 생성
**예상 소요 시간**: 5분 (SQL 실행 + 테스트)
