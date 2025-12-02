# 측정기기 데이터 누락 문제 진단

## 문제 상황
사업장관리 수정모달의 측정기기 항목에 값이 표시되지 않는 문제 보고

## 진단 결과

### 1. UI 코드 분석 ✅ 정상
[app/admin/business/page.tsx:4791-4970](app/admin/business/page.tsx#L4791-L4970)

모든 측정기기 입력 필드가 정상적으로 구현되어 있음:
- PH센서: `formData.ph_meter`
- 차압계: `formData.differential_pressure_meter`
- 온도계: `formData.temperature_meter`
- 배출전류계: `formData.discharge_current_meter`
- 송풍전류계: `formData.fan_current_meter`
- 펌프전류계: `formData.pump_current_meter`
- 게이트웨이: `formData.gateway`
- VPN(유선): `formData.vpn_wired`
- VPN(무선): `formData.vpn_wireless`
- 방폭차압계(국산): `formData.explosion_proof_differential_pressure_meter_domestic`
- 방폭온도계(국산): `formData.explosion_proof_temperature_meter_domestic`
- 확장디바이스: `formData.expansion_device`
- 중계기(8채널): `formData.relay_8ch`
- 중계기(16채널): `formData.relay_16ch`
- 메인보드교체: `formData.main_board_replacement`
- 복수굴뚝: `formData.multiple_stack`

### 2. 데이터 로딩 로직 분석 ✅ 정상
[app/admin/business/page.tsx:2410-2559](app/admin/business/page.tsx#L2410-L2559)

`openEditModal` 함수가 `/api/business-info-direct?id={id}` 호출하여 최신 데이터를 가져옴:

```typescript
const freshData = result.data?.[0] || business;

setFormData({
  // ... 기본 정보 ...

  // 측정기기 필드들 - 모두 정상 매핑됨
  ph_meter: freshData.ph_meter,
  differential_pressure_meter: freshData.differential_pressure_meter,
  temperature_meter: freshData.temperature_meter,
  discharge_current_meter: freshData.discharge_current_meter,
  fan_current_meter: freshData.fan_current_meter,
  pump_current_meter: freshData.pump_current_meter,
  gateway: freshData.gateway,

  vpn_wired: freshData.vpn_wired,
  vpn_wireless: freshData.vpn_wireless,
  multiple_stack: freshData.multiple_stack,

  explosion_proof_differential_pressure_meter_domestic: freshData.explosion_proof_differential_pressure_meter_domestic,
  explosion_proof_temperature_meter_domestic: freshData.explosion_proof_temperature_meter_domestic,
  expansion_device: freshData.expansion_device,
  relay_8ch: freshData.relay_8ch,
  relay_16ch: freshData.relay_16ch,
  main_board_replacement: freshData.main_board_replacement,
  // ...
});
```

### 3. API 엔드포인트 분석 ✅ 정상
[app/api/business-info-direct/route.ts:19-129](app/api/business-info-direct/route.ts#L19-L129)

GET 메소드가 `select('*')`로 모든 컬럼을 조회:

```typescript
let query = supabaseAdmin.from('business_info').select('*', { count: 'exact' });

if (id) {
  query = query.eq('id', id);
}
```

**모든 코드가 정상적으로 구현되어 있으며, 데이터를 제대로 가져와서 표시하도록 되어 있습니다.**

## 원인 분석

코드에는 문제가 없으므로, 다음 두 가지 가능성이 있습니다:

### 가능성 1: DB에 실제로 데이터가 없음
- 사용자가 "DB에 다 입력했었는데"라고 했지만, 실제로는 저장되지 않았을 가능성
- 또는 다른 테이블/컬럼에 입력했을 가능성

### 가능성 2: 특정 사업장만 문제
- 일부 사업장은 데이터가 있고 일부는 없을 가능성
- 조회한 사업장이 우연히 측정기기 데이터가 없는 사업장일 가능성

## 진단 SQL 쿼리

다음 SQL을 Supabase에서 실행하여 실제 데이터 상태를 확인하세요:

```sql
-- 1. 측정기기 데이터가 있는 사업장 확인 (샘플 10개)
SELECT
  business_name,
  ph_meter,
  differential_pressure_meter,
  temperature_meter,
  discharge_current_meter,
  fan_current_meter,
  pump_current_meter,
  gateway,
  vpn_wired,
  vpn_wireless,
  multiple_stack,
  explosion_proof_differential_pressure_meter_domestic,
  explosion_proof_temperature_meter_domestic,
  expansion_device,
  relay_8ch,
  relay_16ch,
  main_board_replacement
FROM business_info
WHERE
  is_deleted = false
  AND (
    ph_meter > 0
    OR differential_pressure_meter > 0
    OR temperature_meter > 0
    OR discharge_current_meter > 0
    OR fan_current_meter > 0
    OR pump_current_meter > 0
    OR gateway > 0
    OR vpn_wired > 0
    OR vpn_wireless > 0
    OR multiple_stack > 0
    OR explosion_proof_differential_pressure_meter_domestic > 0
    OR explosion_proof_temperature_meter_domestic > 0
    OR expansion_device > 0
    OR relay_8ch > 0
    OR relay_16ch > 0
    OR main_board_replacement > 0
  )
ORDER BY updated_at DESC
LIMIT 10;

-- 2. 전체 사업장 중 측정기기 데이터가 있는 사업장 개수
SELECT
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN
    ph_meter > 0
    OR differential_pressure_meter > 0
    OR temperature_meter > 0
    OR discharge_current_meter > 0
    OR fan_current_meter > 0
    OR pump_current_meter > 0
    OR gateway > 0
  THEN 1 END) as businesses_with_basic_devices,
  COUNT(CASE WHEN
    explosion_proof_differential_pressure_meter_domestic > 0
    OR explosion_proof_temperature_meter_domestic > 0
    OR expansion_device > 0
    OR relay_8ch > 0
    OR relay_16ch > 0
    OR main_board_replacement > 0
  THEN 1 END) as businesses_with_additional_devices
FROM business_info
WHERE is_deleted = false;

-- 3. 특정 사업장 데이터 확인 (사업장명으로 검색)
-- 아래 '사업장명' 부분을 실제 확인하고 싶은 사업장명으로 변경하세요
SELECT
  business_name,
  ph_meter,
  differential_pressure_meter,
  temperature_meter,
  discharge_current_meter,
  fan_current_meter,
  pump_current_meter,
  gateway,
  vpn_wired,
  vpn_wireless,
  explosion_proof_differential_pressure_meter_domestic,
  explosion_proof_temperature_meter_domestic,
  expansion_device,
  relay_8ch,
  relay_16ch,
  main_board_replacement,
  multiple_stack,
  updated_at
FROM business_info
WHERE business_name LIKE '%사업장명%'
  AND is_deleted = false;

-- 4. NULL vs 0 확인 (NULL이면 DB에 저장 안된 것, 0이면 저장은 되었지만 값이 0)
SELECT
  business_name,
  CASE
    WHEN ph_meter IS NULL THEN 'NULL'
    WHEN ph_meter = 0 THEN '0'
    ELSE CAST(ph_meter AS TEXT)
  END as ph_meter_status,
  CASE
    WHEN differential_pressure_meter IS NULL THEN 'NULL'
    WHEN differential_pressure_meter = 0 THEN '0'
    ELSE CAST(differential_pressure_meter AS TEXT)
  END as differential_pressure_meter_status
FROM business_info
WHERE is_deleted = false
ORDER BY updated_at DESC
LIMIT 20;
```

## 다음 단계

1. **위의 SQL 쿼리 실행** → 실제 DB 데이터 상태 확인
2. **결과에 따라 조치**:
   - 데이터가 있는 경우: 브라우저 캐시 문제일 수 있으니 하드 리프레시 (Ctrl+Shift+R)
   - 데이터가 없는 경우: 엑셀 업로드로 측정기기 데이터 재입력 필요
   - 일부만 있는 경우: 어떤 사업장에 데이터가 있고 없는지 패턴 파악

## 브라우저 디버깅 방법

1. 사업장 수정 모달 열기
2. 브라우저 개발자 도구 (F12) → Network 탭
3. `business-info-direct?id=...` 요청 찾기
4. Response 탭에서 실제 반환된 데이터 확인
5. `ph_meter`, `differential_pressure_meter` 등의 값 확인

예상 응답:
```json
{
  "success": true,
  "data": [{
    "id": "...",
    "business_name": "...",
    "ph_meter": 2,           // ← 이 값이 있어야 함
    "differential_pressure_meter": 1,
    "temperature_meter": 1,
    // ...
  }],
  "count": 1
}
```

만약 `ph_meter: null` 또는 `ph_meter: 0`이면 DB에 데이터가 없는 것입니다.
