# 대시보드 데이터 연동 수정 완료

## 📋 문제 분석

### 발견된 문제
- **증상**: 대시보드에서 매출/미수금/설치 현황 그래프에 데이터가 표시되지 않음
- **원인**: 대시보드 Revenue API가 `revenue_calculations` 테이블을 참조했지만, 실제 매출 관리 페이지는 실시간 계산 방식 사용
- **결과**: `revenue_calculations` 테이블이 비어있어 대시보드에 데이터 미표시

### 데이터 흐름 분석

#### 기존 구조 (문제)
```
대시보드 Revenue API → revenue_calculations 테이블 (비어있음)
매출 관리 페이지    → 실시간 계산 (business_info + government_pricing)
```

#### 수정된 구조 (해결)
```
대시보드 Revenue API → 실시간 계산 (business_info + government_pricing)
매출 관리 페이지    → 실시간 계산 (business_info + government_pricing)
```

---

## ✅ 수정 완료 사항

### 1. Revenue API 전면 수정 (`/api/dashboard/revenue/route.ts`)

#### 주요 변경사항
1. **revenue_calculations 테이블 제거**: 더 이상 사용하지 않음
2. **실시간 계산 로직 추가**: 매출 관리와 동일한 방식 적용
3. **데이터 소스 변경**: `business_info` + `government_pricing` 조합

#### 계산 로직

```typescript
// 1. 설치 완료된 사업장 조회
const businesses = await supabase
  .from('business_info')
  .select('*')
  .eq('is_active', true)
  .eq('is_deleted', false)
  .not('installation_date', 'is', null);

// 2. 환경부 고시가 정보 조회
const pricingData = await supabase
  .from('government_pricing')
  .select('*')
  .eq('is_active', true);

// 3. 사업장별 매출 계산
businesses.forEach(business => {
  // 매출 = 측정기기별 (수량 × 고시가)
  let businessRevenue = 0;
  let businessCost = 0;

  equipmentFields.forEach(field => {
    const quantity = business[field] || 0;
    businessRevenue += priceMap[field].official_price * quantity;
    businessCost += priceMap[field].manufacturer_price * quantity;
  });

  // 추가공사비 및 협의사항 반영
  businessRevenue += business.additional_cost || 0;
  businessRevenue -= business.negotiation || 0;

  const profit = businessRevenue - businessCost;

  // 월별 집계
  monthlyData[monthKey].revenue += businessRevenue;
  monthlyData[monthKey].cost += businessCost;
  monthlyData[monthKey].profit += profit;
});
```

### 2. 기존 API 검증

#### Receivables API (`/api/dashboard/receivables/route.ts`)
- ✅ **정상**: `business_invoices` 테이블 사용
- ✅ 실제 계산서 데이터 기반 미수금/회수금 집계
- ✅ 수정 불필요

#### Installations API (`/api/dashboard/installations/route.ts`)
- ✅ **정상**: `business_info` 테이블의 `progress_status` 사용
- ✅ 실제 설치 진행 상태 기반 집계
- ✅ 수정 불필요

---

## 🔄 데이터 흐름도

### 매출/매입/이익 현황

```
[business_info 테이블]
├─ installation_date (설치일 기준 월별 집계)
├─ 측정기기 수량 (ph_meter, differential_pressure_meter, ...)
├─ additional_cost (추가공사비)
└─ negotiation (협의사항)

[government_pricing 테이블]
├─ official_price (환경부 고시가)
└─ manufacturer_price (제조사 가격)

↓ 실시간 계산

[월별 집계 데이터]
├─ revenue = Σ(수량 × 고시가) + 추가공사비 - 협의사항
├─ cost = Σ(수량 × 제조사가격)
├─ profit = revenue - cost
├─ profitRate = (profit / revenue) × 100
└─ prevMonthChange = 전월 대비 증감률
```

### 미수금 현황

```
[business_invoices 테이블]
├─ invoice_date (계산서 발행일)
├─ invoice_amount (계산서 금액)
└─ payment_status ('미수령' | '완료')

↓ 월별 집계

[월별 집계 데이터]
├─ outstanding = Σ(미수령 금액)
├─ collected = Σ(완료 금액)
├─ collectionRate = (collected / total) × 100
└─ prevMonthChange = 전월 대비 증감률
```

### 설치 현황

```
[business_info 테이블]
├─ installation_date (설치일)
└─ progress_status ('대기' | '진행중' | '완료')

↓ 월별 집계

[월별 집계 데이터]
├─ waiting = '대기' 상태 개수
├─ inProgress = '진행중' 상태 개수
├─ completed = '완료' 상태 개수
├─ total = 전체 개수
├─ completionRate = (completed / total) × 100
└─ prevMonthChange = 전월 대비 증감률
```

---

## 📊 측정기기 필드 목록

대시보드 매출 계산에 사용되는 16개 측정기기:

```typescript
const equipmentFields = [
  'ph_meter',                                              // pH 측정기
  'differential_pressure_meter',                           // 차압계
  'temperature_meter',                                     // 온도계
  'discharge_current_meter',                               // 토출전류계
  'fan_current_meter',                                     // 팬전류계
  'pump_current_meter',                                    // 펌프전류계
  'gateway',                                               // 게이트웨이
  'vpn_wired',                                             // 유선 VPN
  'vpn_wireless',                                          // 무선 VPN
  'explosion_proof_differential_pressure_meter_domestic',  // 방폭형 차압계(국산)
  'explosion_proof_temperature_meter_domestic',            // 방폭형 온도계(국산)
  'expansion_device',                                      // 확장기기
  'relay_8ch',                                             // 릴레이 8채널
  'relay_16ch',                                            // 릴레이 16채널
  'main_board_replacement',                                // 메인보드 교체
  'multiple_stack'                                         // 다중연도
];
```

---

## 🎯 기대 효과

### 1. 정확한 데이터 표시
- ✅ 대시보드에 실제 매출 데이터 표시
- ✅ 매출 관리 페이지와 동일한 계산 로직 사용
- ✅ 데이터 일관성 확보

### 2. 실시간 반영
- ✅ `business_info` 업데이트 시 즉시 반영
- ✅ `government_pricing` 변경 시 자동 적용
- ✅ 별도의 배치 작업 불필요

### 3. 유지보수 용이성
- ✅ 단일 데이터 소스 사용
- ✅ 중복 저장소 제거 (revenue_calculations 불필요)
- ✅ 매출 관리와 대시보드 로직 일관성

---

## 🧪 테스트 체크리스트

### 기능 테스트
- [ ] 대시보드 접속 시 매출 그래프에 데이터 표시
- [ ] 최근 12개월 데이터 정상 표시
- [ ] 월별 매출/매입/이익 값 계산 정확성
- [ ] 이익률 계산 정확성
- [ ] 전월 대비 증감률 계산 정확성

### 필터 테스트
- [ ] 영업점별 필터 동작
- [ ] 제조사별 필터 동작
- [ ] 필터 조합 동작

### 통합 테스트
- [ ] 미수금 그래프 데이터 표시
- [ ] 설치 현황 그래프 데이터 표시
- [ ] 전체 대시보드 로딩 성능
- [ ] 새로고침 버튼 동작

### 데이터 일관성 테스트
- [ ] 매출 관리 페이지와 대시보드 값 비교
- [ ] business_info 업데이트 후 대시보드 반영 확인
- [ ] government_pricing 변경 후 계산 결과 확인

---

## 📝 주의사항

### 1. 성능 고려사항
- **사업장 수 증가**: 사업장이 많아지면 실시간 계산 시간이 증가할 수 있음
- **해결책**: 향후 필요시 캐싱 또는 배치 계산 도입 고려

### 2. 데이터 정확성
- `installation_date`가 null인 사업장은 제외됨
- `government_pricing`에 해당 측정기기 정보가 없으면 매출 0으로 계산
- `is_active = false` 또는 `is_deleted = true`인 사업장은 제외됨

### 3. 월별 집계 기준
- **기준일**: `installation_date` (설치일)
- **범위**: 최근 12개월 (기본값)
- **정렬**: 최신순 (reverse 정렬)

---

## 🔧 문제 해결 가이드

### 데이터가 표시되지 않는 경우

1. **사업장 확인**
   ```sql
   SELECT COUNT(*) FROM business_info
   WHERE is_active = true
     AND is_deleted = false
     AND installation_date IS NOT NULL;
   ```

2. **고시가 정보 확인**
   ```sql
   SELECT COUNT(*) FROM government_pricing
   WHERE is_active = true
     AND effective_from <= CURRENT_DATE;
   ```

3. **브라우저 콘솔 로그 확인**
   - F12 → Console 탭
   - "Dashboard Revenue API" 로그 확인
   - 에러 메시지 확인

4. **API 직접 테스트**
   ```bash
   curl http://localhost:3001/api/dashboard/revenue?months=12
   ```

### 매출 값이 이상한 경우

1. **측정기기 수량 확인**
   - `business_info` 테이블의 측정기기 필드 값 확인
   - null 또는 0이 아닌지 확인

2. **고시가 매핑 확인**
   - `government_pricing` 테이블의 `equipment_type` 값이 측정기기 필드명과 일치하는지 확인

3. **추가공사비/협의사항 확인**
   - `business_info.additional_cost` 값 확인
   - `business_info.negotiation` 값 확인

---

## 📦 수정된 파일 목록

### API
- `app/api/dashboard/revenue/route.ts` - **전면 수정** (220줄 → 실시간 계산 로직)

### 문서
- `claudedocs/dashboard-data-integration-fix.md` - **신규 작성**

---

## 🎉 완료

- ✅ Revenue API 실시간 계산 방식으로 수정
- ✅ Receivables API 및 Installations API 검증 완료
- ✅ 데이터 소스 일관성 확보
- ✅ 문서화 완료

**다음 단계**: 브라우저에서 대시보드 접속하여 데이터 표시 확인

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.2.0
