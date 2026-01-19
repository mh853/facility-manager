# 관리자 대시보드 매입금액 계산 오류 분석

## 📊 분석 일시
2026-01-15

## 🎯 문제 요약
**관리자 대시보드의 매입금액이 실제보다 현저히 낮게 계산됨**

---

## 🔍 증상 분석

### 2025-07월 데이터 비교

#### 대시보드 (admin/page.tsx)
- **매출**: ₩1,290,720,000
- **매입**: ₩163,489,000 ⚠️
- **순이익**: ₩862,038,600
- **매입/매출 비율**: 12.6% (비정상적으로 낮음)

#### 매출 관리 페이지 (admin/revenue/page.tsx)
- **총 사업장**: 556개
- **총 매출**: ₩2,734,470,000
- **총 매입**: ₩1,420,534,200 ✅
- **매입/매출 비율**: 51.9% (정상)

### 상위 6개 사업장 샘플 (매출 관리 페이지)

| 사업장명 | 매출 | 매입 | 이익률 |
|---------|------|------|--------|
| (주)병산산업 | ₩3,500,000 | ₩889,600 | 50.6% |
| (주)병산산업(보조금 동시설행) | ₩7,560,000 | ₩1,344,800 | 59.6% |
| 대송레미판(주) | ₩12,580,000 | ₩4,100,000 | 48.6% |
| 삼양기업(주) | ₩3,500,000 | ₩889,600 | 50.6% |
| 삼양기업(주)(보조금 동시설행) | ₩10,320,000 | ₩1,756,000 | 59.7% |
| 포성오앤피(주) 의성공장 | ₩7,800,000 | ₩2,300,000 | 52.9% |

**샘플 6개 합계**:
- 매출: ₩45,260,000
- 매입: ₩11,280,000
- 비율: 24.9% (정상)

---

## 🐛 근본 원인 분석

### 문제 발생 위치
**파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)

### 1. 제조사 이름 매칭 실패 (Line 279-296)

```typescript
// 사업장의 제조사 정보
const rawManufacturer = business.manufacturer || 'ecosense';
const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

// 제조사 원가 맵에서 검색
let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];

// 정규화된 이름으로도 못 찾으면 원본 이름으로 시도
if (!manufacturerCosts) {
  manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
}

// ⚠️ 매칭 실패 시 경고만 출력하고 계속 진행
if (Object.keys(manufacturerCosts).length === 0) {
  console.warn(`⚠️ [매입 데이터 누락] 사업장: ${business.business_name}`);
}
```

**문제점**: 제조사 이름이 매칭되지 않으면 `manufacturerCosts = {}` (빈 객체)

### 2. 매입 원가 계산 로직 (Line 304-322)

```typescript
equipmentFields.forEach(field => {
  const quantity = business[field] || 0;

  if (quantity <= 0) return;

  const priceInfo = priceMap[field];
  if (!priceInfo) return;

  // 매출 = 환경부 고시가 × 수량
  businessRevenue += priceInfo.official_price * quantity;

  // 🔴 문제: manufacturerCosts가 빈 객체일 때 항상 0
  let costPrice = manufacturerCosts[field] || 0;

  manufacturerCost += costPrice * quantity;  // ⚠️ 0 × quantity = 0
});
```

**문제점**:
- `manufacturerCosts = {}`일 때, `manufacturerCosts[field]`는 `undefined`
- `undefined || 0` → **항상 0**
- 결과: **매입 원가가 전혀 계산되지 않음**

### 3. 최종 집계 (Line 374, 393)

```typescript
const totalCost = Number(manufacturerCost) || 0;  // ⚠️ 거의 항상 0

// 월별 데이터 업데이트
current.cost += totalCost;  // ⚠️ 매입이 누적되지 않음
```

---

## 📊 제조사 이름 불일치 가능성

### 가능한 원인

1. **DB에 저장된 제조사 이름** (manufacturer_pricing 테이블)
   ```
   - ecosense
   - cleanearth
   - gaia_cns
   - evs
   ```

2. **사업장 정보의 제조사 이름** (business_info 테이블)
   ```
   - 에코센스
   - 클린어스
   - 가이아씨앤에스
   - 이브이에스
   - EcoSense
   - Ecosense
   - ECOSENSE
   ```

### 매칭 실패 시나리오

| business.manufacturer | 정규화 | manufacturerCostMap 키 | 매칭 결과 |
|----------------------|--------|------------------------|-----------|
| "에코센스" | "에코센스" | "ecosense" | ❌ 실패 |
| "EcoSense" | "ecosense" | "ecosense" | ✅ 성공 |
| "Ecosense" | "ecosense" | "ecosense" | ✅ 성공 |
| "ecosense " | "ecosense" | "ecosense" | ✅ 성공 |

**결론**: **한글 제조사 이름이 DB에 영문 코드로 저장되어 있어서 매칭 실패**

---

## 🔧 비교: 매출 관리 API는 왜 정상 작동하는가?

### 매출 관리 API 로직 (app/api/revenue/calculate/route.ts)

#### 1. 제조사 코드 변환 (Line 244-252)

```typescript
// ✅ 한글 → 영문 코드 명시적 변환
const manufacturerCodeMap: Record<string, string> = {
  '에코센스': 'ecosense',
  '클린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
};

const manufacturerCode = manufacturerCodeMap[manufacturer] || manufacturer.toLowerCase();
```

#### 2. 영문 코드로 제조사별 원가 조회 (Line 167-184)

```typescript
// ✅ 변환된 영문 코드로 DB 조회
const manufacturerPricing = await queryAll(
  `SELECT * FROM manufacturer_pricing
   WHERE manufacturer = $1
   AND is_active = true`,
  [manufacturerCode]  // ← "ecosense" 같은 영문 코드
);
```

**성공 이유**: 한글 제조사명을 영문 코드로 명시적 변환 후 DB 조회

---

## 💡 해결 방안

### 방법 1: 제조사 코드 변환 추가 (권장)

**대시보드 API에도 동일한 변환 로직 추가**

```typescript
// Line 279 이전에 추가
const manufacturerCodeMap: Record<string, string> = {
  '에코센스': 'ecosense',
  '클린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
};

const rawManufacturer = business.manufacturer || 'ecosense';
const manufacturerCode = manufacturerCodeMap[rawManufacturer] || rawManufacturer.toLowerCase().trim();

// 변환된 코드로 검색
let manufacturerCosts = manufacturerCostMap[manufacturerCode];
```

**장점**:
- ✅ 매출 관리 API와 동일한 로직
- ✅ 즉시 적용 가능
- ✅ 기존 데이터 변경 불필요

**단점**:
- ⚠️ 하드코딩된 매핑 테이블 유지 필요

---

### 방법 2: 데이터베이스 구조 개선 (장기)

**제조사 마스터 테이블 생성**

```sql
CREATE TABLE manufacturers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,     -- 'ecosense'
  name_ko VARCHAR(100) NOT NULL,        -- '에코센스'
  name_en VARCHAR(100) NOT NULL,        -- 'EcoSense'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- business_info 테이블 수정
ALTER TABLE business_info
  ADD COLUMN manufacturer_id INTEGER REFERENCES manufacturers(id);

-- manufacturer_pricing 테이블 수정
ALTER TABLE manufacturer_pricing
  ADD COLUMN manufacturer_id INTEGER REFERENCES manufacturers(id);
```

**장점**:
- ✅ 제조사 정보 중앙 관리
- ✅ 이름 변경 시 한 곳만 수정
- ✅ 외래키로 데이터 무결성 보장

**단점**:
- ⚠️ 대규모 DB 마이그레이션 필요
- ⚠️ 기존 데이터 변환 작업 필요
- ⚠️ 모든 관련 API 수정 필요

---

### 방법 3: 제조사 이름 정규화 함수 (절충안)

**공통 유틸리티 함수 생성**

```typescript
// lib/manufacturer-utils.ts
export function normalizeManufacturerName(name: string | null | undefined): string {
  if (!name) return 'ecosense';

  const manufacturerCodeMap: Record<string, string> = {
    '에코센스': 'ecosense',
    '클린어스': 'cleanearth',
    '가이아씨앤에스': 'gaia_cns',
    '이브이에스': 'evs',
    'EcoSense': 'ecosense',
    'CleanEarth': 'cleanearth',
    'Gaia C&S': 'gaia_cns',
    'EVS': 'evs'
  };

  // 1. 정확한 매핑 확인
  if (manufacturerCodeMap[name]) {
    return manufacturerCodeMap[name];
  }

  // 2. 소문자 변환 후 확인
  const normalized = name.toLowerCase().trim();
  return normalized;
}
```

**사용 예시**:

```typescript
// 대시보드 API
const manufacturerCode = normalizeManufacturerName(business.manufacturer);
let manufacturerCosts = manufacturerCostMap[manufacturerCode];

// 매출 관리 API
const manufacturerCode = normalizeManufacturerName(businessInfo.manufacturer);
```

**장점**:
- ✅ 모든 API에서 일관된 제조사명 처리
- ✅ 코드 중복 제거
- ✅ 유지보수 용이

**단점**:
- ⚠️ 여전히 하드코딩된 매핑 필요

---

## 🎯 권장 조치 순서

### 즉시 조치 (방법 1 적용)

1. **대시보드 API 수정** ([app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts))
   - Line 279 근처에 제조사 코드 변환 로직 추가
   - 매출 관리 API와 동일한 `manufacturerCodeMap` 사용

2. **테스트**
   - 2025-07월 데이터 확인
   - 매입금액이 정상적으로 계산되는지 검증
   - 매출 관리 페이지와 금액 일치 확인

### 중기 개선 (방법 3 적용)

1. **공통 유틸리티 함수 생성**
   - `lib/manufacturer-utils.ts` 파일 생성
   - `normalizeManufacturerName()` 함수 구현

2. **모든 API에 적용**
   - 대시보드 API
   - 매출 관리 API
   - 기타 제조사 관련 API

### 장기 개선 (방법 2 검토)

1. **제조사 마스터 테이블 설계**
2. **마이그레이션 계획 수립**
3. **점진적 전환**

---

## 📊 예상 수정 효과

### Before (현재)
```
2025-07월:
- 매출: ₩1,290,720,000
- 매입: ₩163,489,000 (12.6%) ❌
- 순이익: ₩862,038,600
```

### After (수정 후 예상)
```
2025-07월:
- 매출: ₩1,290,720,000
- 매입: ₩650,000,000 ~ ₩700,000,000 (50~54%) ✅
- 순이익: ₩400,000,000 ~ ₩450,000,000
```

**근거**: 매출 관리 페이지의 매입/매출 비율 51.9%를 기준으로 추정

---

## 🔗 관련 파일

1. **대시보드 매출 API**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)
   - 수정 필요: Line 279-296 (제조사 코드 변환 추가)

2. **매출 관리 API**: [app/api/revenue/calculate/route.ts](app/api/revenue/calculate/route.ts)
   - 참고: Line 244-252 (제조사 코드 변환 로직)

3. **대시보드 차트**: [components/dashboard/charts/RevenueChart.tsx](components/dashboard/charts/RevenueChart.tsx)
   - 영향: 매입 데이터 정상화 후 차트 자동 반영

---

## ✅ 결론

**근본 원인**: 한글 제조사명이 영문 코드로 DB에 저장되어 있으나, 대시보드 API가 변환 없이 직접 매칭 시도 → 실패 → 매입 원가 0원 계산

**해결 방법**: 매출 관리 API처럼 한글 → 영문 코드 변환 로직 추가

**우선순위**: 🔴 긴급 (데이터 정확성 문제)

**작업 시간**: 10-15분 (코드 복사 및 테스트)

---

**작성자**: Claude Code
**분석일**: 2026-01-15
**심각도**: 🔴 Critical (데이터 정확성 문제)
