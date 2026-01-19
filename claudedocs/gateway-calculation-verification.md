# Gateway 계산 검증 결과

## 📊 검증 일시
2026-01-15

## 🎯 검증 결과 요약

**Gateway_1_2는 정상적으로 계산되고 있습니다!**

### Gateway 사용 현황 (2025년 7월, 224개 사업장)

| 필드 | 사용 사업장 | 총 매입금액 | 상태 |
|------|-----------|-----------|------|
| `gateway` (구형) | 다수 | ₩0 | ❌ DB 원가 없음 (폐기됨) |
| `gateway_1_2` (신형) | 198개 | ₩174,410,000 | ✅ 정상 계산 중 |
| `gateway_3_4` (신형) | 0개 | ₩0 | - |

### 제조사별 Gateway_1_2 원가

| 제조사 | Gateway_1_2 원가 |
|--------|-----------------|
| 에코센스 | ₩1,000,000 |
| 크린어스 | ₩630,000 |
| 가이아씨앤에스 | ₩550,000 |
| 이브이에스 | ₩1,100,000 |

---

## 🔍 상세 분석

### 1. Gateway 필드 변경사항

**수정 전** (`app/api/dashboard/revenue/route.ts` Line 256-263):
```typescript
const equipmentFields = [
  'ph_meter', 'differential_pressure_meter', 'temperature_meter',
  'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
  'gateway', 'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',  // gateway 포함
  // ...
];
```

**수정 후**:
```typescript
const equipmentFields = [
  'ph_meter', 'differential_pressure_meter', 'temperature_meter',
  'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
  'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',  // gateway 제거
  // ...
];
```

### 2. 수정의 효과

**결과**: **매입금액 변동 없음 (0원 차이)**

**이유**:
1. 폐기된 `gateway` 필드는 모든 제조사의 manufacturer_pricing 테이블에서 원가가 **0원**
2. `gateway_1_2`는 **수정 전에도 이미 포함**되어 있었음
3. 따라서 `gateway` 제거는 실제 계산에 영향 없음

---

## 📊 전체 매입금액 계산 검증

### 스크립트 계산 결과 (scripts/analyze-cost-calculation.js)

```
총 사업장: 224개
총 매입금액: ₩354,679,000
원가 0원인 장비: 202개 (vpn_wireless, multiple_stack)
```

**계산 항목별 기여도**:
- Gateway_1_2: ₩174,410,000 (49.2%)
- 기타 측정기기: ₩180,269,000 (50.8%)
- Vpn_wireless (0원): 0개 기여
- Multiple_stack (0원): 0개 기여

### 대시보드 표시 금액

```
대시보드 (2025년 7월): ₩163,489,000
스크립트 계산: ₩354,679,000
차이: ₩191,190,000 (53.9% 낮음)
```

---

## ⚠️ 문제점

### 차이 발생 원인

대시보드 API가 스크립트와 **동일한 로직**을 사용하는데도 금액이 다른 이유:

1. **캐싱 문제?**
   - API는 `force-dynamic` 설정으로 캐싱 안 함
   - 브라우저 시크릿 모드 + 강제 새로고침 후에도 변동 없음

2. **서버 재시작 필요?**
   - 코드 수정 후 개발 서버 재시작 확인 필요
   - Next.js 14는 일반적으로 자동 재시작하지만 환경 변수나 DB 관련은 수동 재시작 필요

3. **DB 데이터 차이?**
   - 스크립트와 API가 다른 시점의 데이터를 조회할 수 있음
   - manufacturer_pricing 테이블의 effective_from/effective_to 조건 확인 필요

---

## 🔧 다음 단계

### 즉시 확인 사항

1. **서버 재시작**
   ```bash
   # 개발 서버 종료 후 재시작
   npm run dev
   ```

2. **브라우저 확인**
   ```
   시크릿 모드에서 접속: http://localhost:3000/admin
   강제 새로고침: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
   ```

3. **API 직접 호출 테스트**
   ```bash
   curl "http://localhost:3000/api/dashboard/revenue?months=2025-07"
   ```

### 예상 결과

서버 재시작 후 대시보드 매입금액:
- **현재**: ₩163,489,000
- **예상**: ₩354,679,000 (또는 그 근사값)
- **증가폭**: +₩191,190,000 (+117%)

---

## 📋 검증 완료 항목

- ✅ Gateway_1_2 필드가 equipmentFields 배열에 포함됨
- ✅ 제조사별 Gateway_1_2 원가가 DB에 정상 등록됨 (₩550,000 ~ ₩1,100,000)
- ✅ 198개 사업장이 Gateway_1_2 사용 중
- ✅ 스크립트로 계산한 Gateway_1_2 총 매입: ₩174,410,000
- ✅ 제조사 매칭 로직 정상 작동 (한글 → 소문자 정규화)
- ✅ 폐기된 `gateway` 필드 제거 (원가 0원이므로 계산에 영향 없음)

## ❓ 미해결 사항

- ⚠️ 대시보드 표시 금액 (₩163,489,000)이 스크립트 계산 (₩354,679,000)과 다른 이유
- ⚠️ 서버 재시작 후에도 변동 없다면 추가 원인 조사 필요

---

**작성자**: Claude Code
**검증일**: 2026-01-15
**상태**: 🟡 Gateway 계산은 정상, 전체 금액 차이 원인 조사 중
