# 추가 비용 정보 표시 오류 수정

## 문제 상황

BusinessRevenueModal의 "추가 비용 정보" 섹션에서 다음 항목들이 표시되지 않았음:
- 추가공사비 (additional_cost)
- 협의사항/할인 금액 (negotiation)

브라우저 콘솔 로그:
```javascript
💰 추가공사비: {raw: undefined, parsed: 0}
📋 협의사항: {raw: '', parsed: 0}
```

## 근본 원인 분석

### 데이터 흐름

1. **Frontend 요청**:
   - `app/admin/business/hooks/useBusinessData.ts` → `/api/business-info-direct` 호출
   - 사업장 목록 데이터 로드

2. **API 응답**:
   - [app/api/business-info-direct/route.ts](../app/api/business-info-direct/route.ts) (Line 51-75)
   - SELECT 쿼리에서 **`additional_cost` 컬럼이 누락됨**
   - `negotiation` 컬럼은 포함되어 있었음 (Line 66)

3. **Modal 전달**:
   - `components/business/modals/BusinessDetailModal.tsx` (Line 1225-1231)
   - `business` 객체 + Revenue Calculate API 응답 병합
   - `business` 객체에 `additional_cost`가 없어서 undefined 상태

### SELECT 쿼리 문제

**Before** (Line 66):
```sql
main_board_replacement, multiple_stack,
negotiation,  -- ✅ 있음
invoice_1st_date, invoice_1st_amount, payment_1st_date, payment_1st_amount,
```

**Missing**: `additional_cost` 컬럼이 SELECT 목록에 없음

## 해결 방법

### File: [app/api/business-info-direct/route.ts](../app/api/business-info-direct/route.ts:66)

SELECT 쿼리에 `additional_cost` 컬럼 추가:

```typescript
// ⚡ Direct PostgreSQL query - 필요한 필드만 선택 조회
const selectFields = `
  id, business_name, address, local_government,
  manager_name, manager_contact, manager_position, business_contact,
  representative_name, business_registration_number,
  manufacturer, sales_office, installation_date, progress_status,
  project_year, installation_team, is_active, is_deleted,
  updated_at, created_at, additional_info,
  ph_meter, differential_pressure_meter, temperature_meter,
  discharge_current_meter, fan_current_meter, pump_current_meter,
  gateway, gateway_1_2, gateway_3_4,
  vpn_wired, vpn_wireless,
  explosion_proof_differential_pressure_meter_domestic,
  explosion_proof_temperature_meter_domestic,
  expansion_device, relay_8ch, relay_16ch,
  main_board_replacement, multiple_stack,
  additional_cost, negotiation,  // ✅ additional_cost 추가
  invoice_1st_date, invoice_1st_amount, payment_1st_date, payment_1st_amount,
  ...
`;
```

## 검증 절차

### 1. 개발 서버 재시작
```bash
npm run dev
```

### 2. 브라우저에서 확인
1. 사업장 관리 페이지 접속: `http://localhost:3000/admin/business`
2. 사업장 상세보기 모달 열기
3. "매출 상세보기" 버튼 클릭
4. "추가 비용 정보" 섹션 확인:
   - ✅ 추가공사비: 값이 있으면 `+₩XXX,XXX`, 없으면 `₩0` 표시
   - ✅ 협의사항: 값이 있으면 `-₩XXX,XXX`, 없으면 `₩0` 표시

### 3. 콘솔 로그 확인
```javascript
// 정상 출력 예시
💰 추가공사비: {raw: 1000000, parsed: 1000000}  // 또는 {raw: null, parsed: 0}
📋 협의사항: {raw: '500000', parsed: 500000}    // 또는 {raw: '', parsed: 0}
```

## 기술적 세부사항

### 데이터베이스 스키마
- `business_info.additional_cost`: INTEGER (추가공사비)
- `business_info.negotiation`: TEXT (협의사항, 숫자 문자열 형태)

### 타입 정의
- `UnifiedBusinessInfo` interface에 두 필드 모두 정의되어 있음 (Line 74, 76)
- Frontend 매핑 로직도 정상 작동 (useBusinessData.ts Line 94, 211)

### Revenue Calculate API
- [app/api/revenue/calculate/route.ts](../app/api/revenue/calculate/route.ts:470-471)
- `businessInfo.additional_cost`와 `businessInfo.negotiation`을 읽어서 계산에 사용
- API 응답에는 포함하지 않음 (계산 내부에서만 사용)

### 렌더링 로직
- [components/business/BusinessRevenueModal.tsx](../components/business/BusinessRevenueModal.tsx:487-503)
- 올바르게 구현되어 있었음
- 데이터만 없었던 상황

## 관련 파일

| 파일 | 변경 사항 | 라인 |
|-----|---------|-----|
| `app/api/business-info-direct/route.ts` | ✅ `additional_cost` 컬럼 추가 | 66 |
| `components/business/BusinessRevenueModal.tsx` | ℹ️ 변경 없음 (이미 정상) | 487-503 |
| `app/admin/business/hooks/useBusinessData.ts` | ℹ️ 변경 없음 (이미 정상) | 94, 211 |
| `components/business/modals/BusinessDetailModal.tsx` | ℹ️ 변경 없음 (이미 정상) | 1225-1231 |

## 결론

**Single Point of Failure**: `/api/business-info-direct` GET 엔드포인트의 SELECT 쿼리에서 `additional_cost` 컬럼이 누락되어 있었음.

**Fix**: 한 줄 수정으로 해결 - `additional_cost, negotiation` (Line 66)

**Impact**: 전체 사업장 관리 시스템에서 `additional_cost` 데이터가 frontend에 전달되지 않았던 문제 해결.
