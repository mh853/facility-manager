# 대시보드 매입금액 계산 오류 수정

## 📊 수정 일시
2026-01-15

## 🎯 수정 내용
대시보드 API의 제조사 이름 매칭 실패로 인한 매입금액 계산 오류 해결

---

## 🐛 문제 요약

### 증상
- 대시보드에서 매입금액이 실제보다 현저히 낮게 표시됨
- 2025-07월 데이터: 매입 ₩163,489,000 (매출 대비 12.6%)
- 정상값: 매입 약 ₩650,000,000 (매출 대비 50%)

### 근본 원인
한글 제조사명("에코센스")이 DB의 영문 코드("ecosense")와 매칭되지 않아 매입 원가가 0원으로 계산됨

---

## 🔧 수정 내용

### 수정 파일
**[app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)** Line 279-296

### Before (문제 코드)
```typescript
// ❌ 한글 → 영문 변환 없이 직접 매칭 시도
const rawManufacturer = business.manufacturer || 'ecosense';
const normalizedManufacturer = rawManufacturer.toLowerCase().trim();

// 제조사 원가 맵에서 검색 (한글 이름으로 검색 실패)
let manufacturerCosts = manufacturerCostMap[normalizedManufacturer];

// 매칭 실패 시 빈 객체
if (!manufacturerCosts) {
  manufacturerCosts = manufacturerCostMap[rawManufacturer] || {};
}
```

**문제점**:
- "에코센스" → "에코센스" (변환 안됨)
- DB에는 "ecosense"로 저장되어 있어 매칭 실패
- 빈 객체 `{}`에서 원가 조회 → `undefined || 0` → **항상 0원**

---

### After (수정 코드)
```typescript
// ✅ 한글 제조사명 → 영문 코드 변환 (매출 관리 API와 동일)
const manufacturerCodeMap: Record<string, string> = {
  '에코센스': 'ecosense',
  '클린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
};

const rawManufacturer = business.manufacturer || 'ecosense';
// 한글 → 영문 코드 변환 후 소문자 정규화
const manufacturerCode = manufacturerCodeMap[rawManufacturer] || rawManufacturer.toLowerCase().trim();

// 변환된 영문 코드로 제조사 원가 맵에서 검색
let manufacturerCosts = manufacturerCostMap[manufacturerCode];

// 영문 코드로도 못 찾으면 원본으로 재시도
if (!manufacturerCosts) {
  manufacturerCosts = manufacturerCostMap[rawManufacturer.toLowerCase().trim()] || {};
}
```

**개선점**:
- ✅ "에코센스" → "ecosense" 자동 변환
- ✅ DB의 영문 코드와 정확히 매칭
- ✅ 제조사별 원가 정상 조회
- ✅ 매입금액 정확하게 계산

---

## 📊 수정 효과

### 예상 변경 사항

#### 2025-07월 데이터

**Before (수정 전)**:
```
매출: ₩1,290,720,000
매입: ₩163,489,000 (12.6%) ❌
순이익: ₩862,038,600
```

**After (수정 후 예상)**:
```
매출: ₩1,290,720,000
매입: ₩650,000,000 ~ ₩700,000,000 (50~54%) ✅
순이익: ₩400,000,000 ~ ₩450,000,000
```

**근거**: 매출 관리 페이지의 매입/매출 비율 51.9% 기준

---

## 🔍 수정 검증 방법

### 1. 개발 서버 재시작
```bash
npm run dev
```

### 2. 대시보드 접속
```
http://localhost:3000/admin
```

### 3. 매출/매입 차트 확인
- **2025-07월 데이터** 확인
- 매입금액이 정상적으로 표시되는지 확인 (매출의 약 50%)

### 4. 매출 관리 페이지와 비교
```
http://localhost:3000/admin/revenue
```

- 같은 월의 매출/매입 합계 비교
- 금액이 일치하는지 확인

### 5. 콘솔 로그 확인
개발자 도구에서 다음 로그 확인:
```
📊 [Dashboard Revenue API] Manufacturer pricing loaded: [제조사 수]
📊 [Dashboard Revenue API] 제조사별 원가 샘플: [...]
```

**경고 메시지 감소 확인**:
```
⚠️ [매입 데이터 누락] ... (이 메시지가 거의 없어야 함)
```

---

## 📝 추가 개선 사항

### 제조사 코드 매핑 확장 가능

현재 지원 제조사:
- 에코센스 → ecosense
- 클린어스 → cleanearth
- 가이아씨앤에스 → gaia_cns
- 이브이에스 → evs

**새 제조사 추가 방법**:
```typescript
const manufacturerCodeMap: Record<string, string> = {
  '에코센스': 'ecosense',
  '클린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs',
  '새로운제조사': 'new_manufacturer',  // ← 추가
};
```

---

## 🔗 관련 수정

### 매출 관리 API (참고용)
**[app/api/revenue/calculate/route.ts:244-252](app/api/revenue/calculate/route.ts#L244-L252)**

```typescript
// 이미 정상 작동 중 (수정 안 함)
const manufacturerCodeMap: Record<string, string> = {
  '에코센스': 'ecosense',
  '클린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
};
```

**동일한 로직 사용**으로 두 API 간 일관성 확보

---

## ✅ 체크리스트

### 수정 완료 항목
- [x] 대시보드 API에 제조사 코드 변환 로직 추가
- [x] 매출 관리 API와 동일한 `manufacturerCodeMap` 적용
- [x] 디버깅 로그 메시지 업데이트

### 검증 필요 항목
- [ ] 개발 서버 재시작 및 대시보드 접속
- [ ] 2025-07월 매입금액이 정상 범위인지 확인 (약 50%)
- [ ] 매출 관리 페이지와 금액 일치 확인
- [ ] 콘솔 경고 메시지 감소 확인

---

## 🎯 기대 효과

### 1. 데이터 정확성 향상
- ✅ 매입금액이 실제 값으로 정확히 계산
- ✅ 순이익이 정확한 값으로 표시
- ✅ 이익률이 현실적인 값으로 조정

### 2. 일관성 확보
- ✅ 대시보드와 매출 관리 페이지 데이터 일치
- ✅ 두 API가 동일한 로직 사용

### 3. 운영 신뢰성
- ✅ 경영진 의사결정에 정확한 데이터 제공
- ✅ 월별 수익성 분석 신뢰도 향상

---

## 📋 관련 문서

1. **문제 분석**: [claudedocs/dashboard-revenue-cost-bug-analysis.md](claudedocs/dashboard-revenue-cost-bug-analysis.md)
   - 근본 원인 상세 분석
   - 제조사 이름 매칭 실패 시나리오
   - 장기 개선 방안 (마스터 테이블 등)

2. **계산 로직 검증**: [claudedocs/financial-calculation-verification.md](claudedocs/financial-calculation-verification.md)
   - 매출 관리 vs 대시보드 계산 로직 비교
   - 데이터 소스 일치 여부 확인

---

## ✅ 수정 완료

**수정 파일**: [app/api/dashboard/revenue/route.ts](app/api/dashboard/revenue/route.ts)
**수정 라인**: Line 279-296
**수정 내용**: 한글 제조사명 → 영문 코드 변환 로직 추가

**테스트 방법**:
1. `npm run dev`로 개발 서버 재시작
2. `http://localhost:3000/admin`에서 매출/매입 차트 확인
3. 2025-07월 매입금액이 약 50% 수준인지 확인

**예상 결과**: 매입금액이 ₩650M ~ ₩700M 범위로 정상화

---

**작성자**: Claude Code
**수정일**: 2026-01-15
**우선순위**: 🔴 긴급 (데이터 정확성 문제)
**상태**: ✅ 수정 완료, 검증 대기
