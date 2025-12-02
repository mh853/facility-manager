# 실사비 조정 기능 구현 요약

## 📋 개요
사업장별로 기본 실사비용(100,000원)을 상황에 따라 조정할 수 있는 '실사비 조정' 필드를 추가했습니다.

## 🎯 구현 범위

### 1. TypeScript 타입 정의 추가
**파일**: `types/index.ts`

- `BusinessInfo` 인터페이스에 `survey_fee_adjustment?: number` 추가
- `CalculatedData` 인터페이스에 실사비 조정 관련 필드 추가:
  - `survey_fee_adjustment?: number`
  - `adjusted_survey_costs?: number`

### 2. 백엔드 API 업데이트
**파일**: `app/api/revenue/calculate/route.ts`

**변경사항**:
```typescript
// 실사비 조정 반영 (라인 442)
const surveyFeeAdjustment = businessInfo.survey_fee_adjustment || 0;
const totalSurveyCosts = baseSurveyCosts + totalAdjustments + surveyFeeAdjustment;
```

**계산 로직**:
- 기본 실사비용 = 실사일에 따른 기본 비용 합계
- 총 실사비용 = 기본 실사비용 + 실사비 조정 + 기타 조정사항

### 3. 매출 관리 모달 UI 업데이트
**파일**: `components/business/BusinessRevenueModal.tsx`

**추가된 UI 요소**:
1. **실사비용 카드** (라인 649-674):
   - 조정 여부를 나타내는 배지 표시
   - 기본 금액과 조정 금액 분리 표시
   - 조정 금액이 양수/음수에 따라 색상 구분

2. **순이익 계산 공식** (라인 753-763):
   - 실사비용 항목에 조정 내역 상세 표시
   - 예: "(기본 100,000원 + 50,000원 조정)"

### 4. 사업장 관리 페이지 (수정/삭제 모달)
**파일**: `app/admin/business/page.tsx`

**추가된 UI 컴포넌트** (라인 4959-4977):
```tsx
<div>
  <label>실사비 조정 (원)
    <span>(기본 100,000원 기준 ±조정)</span>
  </label>
  <input
    type="text"
    value={formData.survey_fee_adjustment?.toLocaleString() || ''}
    onChange={(e) => {
      const value = e.target.value.replace(/,/g, '');
      setFormData({...formData, survey_fee_adjustment: value ? parseInt(value) : null});
    }}
    placeholder="실사비 조정 금액 (예: -50,000 또는 50,000)"
  />
  <p>💡 양수(+)는 실사비 증가, 음수(-)는 실사비 감소</p>
</div>
```

**데이터 처리**:
1. 폼 초기화 (라인 2386): `survey_fee_adjustment: null`
2. 기존 데이터 로드 (라인 2480): `survey_fee_adjustment: freshData.survey_fee_adjustment`
3. Excel 업로드 매핑 (라인 2743): `survey_fee_adjustment: row['실사비조정']`
4. 서버 데이터 동기화 (라인 3150): `survey_fee_adjustment: serverData.survey_fee_adjustment`
5. Supabase 저장 (라인 2140): `survey_fee_adjustment: business.survey_fee_adjustment`

## 💰 이익금액 계산에 미치는 영향

### 계산 공식
```
순이익 = 매출금액
       - 매입금액
       - 조정된 영업비용
       - (기본 실사비용 + 실사비 조정)  ← 새로 추가됨
       - 기본설치비
       - 추가설치비
```

### 예시
- **기본 실사비**: 100,000원
- **실사비 조정**: +50,000원 (증액)
- **최종 실사비용**: 150,000원
- **이익금액 변화**: -50,000원 (조정 금액만큼 이익 감소)

또는:
- **기본 실사비**: 100,000원
- **실사비 조정**: -30,000원 (감액)
- **최종 실사비용**: 70,000원
- **이익금액 변화**: +30,000원 (조정 금액만큼 이익 증가)

## 🔄 데이터 흐름

1. **입력**: 사업장 관리 > 수정 모달 > 비용 정보 섹션
2. **저장**: Supabase `business_info` 테이블의 `survey_fee_adjustment` 컬럼
3. **계산**: `/api/revenue/calculate` API에서 실사비용 계산 시 반영
4. **표시**:
   - 매출 관리 모달의 실사비용 카드
   - 순이익 계산 공식에 상세 내역 표시

## ✅ 테스트 체크리스트

- [x] TypeScript 타입 정의 추가
- [x] API 계산 로직 업데이트
- [x] 매출 관리 모달 UI 표시
- [x] 사업장 관리 모달에 입력 필드 추가
- [x] 폼 데이터 초기화 및 로드
- [x] Excel 업로드 시 매핑
- [x] Supabase 저장/업데이트
- [x] 이익금액 계산에 반영

## 📌 주의사항

1. **양수/음수 구분**:
   - 양수(+): 실사비 증가 → 이익 감소
   - 음수(-): 실사비 감소 → 이익 증가

2. **기본값**:
   - 입력하지 않으면 `null`
   - 계산 시 `0`으로 처리

3. **표시 형식**:
   - 입력: 천단위 구분자 지원 (예: 50,000)
   - 표시: "조정됨" 배지 + 분리된 금액 표시

4. **Excel 업로드**:
   - 컬럼명: `실사비조정`
   - 숫자 형식으로 입력

## 🎨 UI/UX 개선사항

1. **매출 관리 모달**:
   - 조정 여부 한눈에 파악 가능한 배지
   - 기본 금액과 조정 금액 명확히 분리
   - 양수/음수에 따른 색상 구분 (녹색/빨간색)

2. **사업장 관리 모달**:
   - 입력 필드에 명확한 설명 제공
   - 플레이스홀더로 입력 예시 제공
   - 도움말 텍스트로 사용법 안내

## 📝 추가 작업 필요사항

1. **데이터베이스 마이그레이션**:
   ```sql
   ALTER TABLE business_info
   ADD COLUMN survey_fee_adjustment INTEGER DEFAULT NULL;
   ```

2. **Excel 템플릿 업데이트**:
   - '실사비조정' 컬럼 추가
   - 샘플 데이터 및 설명 추가

## 🔗 관련 파일

- `types/index.ts` - TypeScript 타입 정의
- `app/api/revenue/calculate/route.ts` - 매출 계산 API
- `components/business/BusinessRevenueModal.tsx` - 매출 관리 모달
- `app/admin/business/page.tsx` - 사업장 관리 페이지

## 📅 구현일
2025-12-01
