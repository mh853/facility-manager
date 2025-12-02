# 에코센스 발주서 Excel 다운로드 수정

## 문제 상황

에코센스 제조사 사업장의 발주서를 생성할 때 Excel이 아닌 PDF로 다운로드되는 문제 발생

## 근본 원인 (확정)

### 1. 제조사 값 불일치 ⚠️
**DB 저장 값**: `'에코센스'` (한글)
**코드 비교 값**: `'ecosense'` (영문)
**결과**: `'에코센스' === 'ecosense'` → `false` → PDF 다운로드

브라우저 콘솔 로그:
```
[PURCHASE-ORDER-MODAL] 제조사 확인: {
  manufacturer: '에코센스',
  businessName: '영화산업사',
  isEcosense: false  // ← 한글이라서 false!
}
```

### 2. 문제의 핵심
- business_info 테이블의 manufacturer 컬럼에 **한글로 저장**됨
- 코드는 영문 문자열 비교로 작성됨
- 다른 제조사들도 같은 문제 발생 가능

## 해결 방법

### 1. 제조사 정규화 함수 추가 ⭐

**핵심 수정**: 한글/영문 제조사 값을 모두 처리하는 정규화 함수

[PurchaseOrderModal.tsx:148-179](app/admin/document-automation/components/PurchaseOrderModal.tsx#L148-L179):
```typescript
// 제조사 정규화: 한글 → 영문 코드 변환
const normalizeManufacturer = (value: string | null | undefined): string => {
  if (!value) return ''
  const normalized = value.trim().toLowerCase()

  // 한글 → 영문 매핑
  const mapping: Record<string, string> = {
    '에코센스': 'ecosense',
    'ecosense': 'ecosense',
    '크린어스': 'cleanearth',
    'cleanearth': 'cleanearth',
    '가이아씨앤에스': 'gaia_cns',
    'gaia_cns': 'gaia_cns',
    '이브이에스': 'evs',
    'evs': 'evs'
  }

  return mapping[normalized] || normalized
}

const normalizedManufacturer = normalizeManufacturer(manufacturer)
const isEcosense = normalizedManufacturer === 'ecosense'

console.log('[PURCHASE-ORDER-MODAL] 제조사 확인:', {
  originalManufacturer: manufacturer,
  normalizedManufacturer,
  businessName: editedData.business_name,
  isEcosense
})
```

**개선 효과**:
- ✅ `'에코센스'` → `'ecosense'` 자동 변환
- ✅ 한글/영문 모두 처리 가능
- ✅ 대소문자 무시 (case-insensitive)
- ✅ trim으로 공백 제거
- ✅ null/undefined 안전 처리
- ✅ 다른 제조사도 동일하게 처리
- ✅ 상세한 디버깅 로그로 정규화 과정 추적

### 2. 디버깅 로그 강화

**API 엔드포인트 로그 추가** ([route.ts:91](app/api/document-automation/purchase-order/route.ts#L91)):
```typescript
console.log('[PURCHASE-ORDER] 사업장 데이터:', {
  id: business.id,
  name: business.business_name,
  manufacturer: business.manufacturer,  // ✅ 제조사 확인용 로그 추가
  // ...
})
```

**클라이언트 로그 추가** ([PurchaseOrderModal.tsx:148-152](app/admin/document-automation/components/PurchaseOrderModal.tsx#L148-L152)):
```typescript
console.log('[PURCHASE-ORDER-MODAL] 제조사 확인:', {
  manufacturer,
  businessName: editedData.business_name,
  isEcosense: manufacturer === 'ecosense'
})
```

### 2. 대기필증 정보 Excel 추가

**새 기능**: 대기필증 정보가 있으면 Excel 파일에 별도 시트로 추가

[excel-generator-ecosense-template.ts:205-306](lib/document-generators/excel-generator-ecosense-template.ts#L205-L306)에 대기필증 시트 생성 로직 추가:

**포함 정보**:
- 사업장 기본 정보 (사업장명, 업종, 종별)
- 배출구별 정보:
  - 🏭 배출시설 (시설명, 용량, 수량, 녹색기업코드)
  - 🛡️ 방지시설 (시설명, 용량, 수량, 녹색기업코드)

**스타일링**:
- 헤더 굵은 글씨 + 배경색
- 배출시설: 분홍색 배경 (#FCE4EC)
- 방지시설: 초록색 배경 (#E8F5E9)
- 테이블 형식으로 정리
- 적절한 컬럼 너비 자동 조정

### 3. 타입 에러 수정

**Buffer 타입 호환성** ([PurchaseOrderModal.tsx:206](app/admin/document-automation/components/PurchaseOrderModal.tsx#L206)):
```typescript
// ❌ 기존 (타입 에러)
const blob = new Blob([pdfBuffer], { type: 'application/pdf' })

// ✅ 수정 (Uint8Array로 변환)
const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' })
```

## 검증 방법

### 1. 브라우저 콘솔 확인
에코센스 사업장의 발주서 생성 시 다음 로그 확인:
```
[PURCHASE-ORDER-MODAL] 제조사 확인: {
  manufacturer: "ecosense",  // ← 이 값 확인
  businessName: "○○○ 사업장",
  isEcosense: true
}
```

### 2. DB 제조사 값 확인 (Supabase)
```sql
SELECT business_name, manufacturer
FROM business_info
WHERE manufacturer IS NOT NULL
LIMIT 20;
```

**확인 사항**:
- 제조사 값이 정확히 `'ecosense'`인지
- 대소문자 일치 여부
- null/공백 여부

### 3. Excel 다운로드 테스트
1. 에코센스 제조사 사업장 선택
2. 발주서 생성 클릭
3. **예상 결과**: `.xlsx` 파일 다운로드
4. **대기필증 정보 확인**: Excel 파일에 "대기필증 정보" 시트 존재 여부

## 개선 제안

### 향후 고려사항
제조사 값 비교를 더 견고하게 만들기:

```typescript
// 대소문자 무시 + trim + null 처리
const normalizedManufacturer = manufacturer?.toLowerCase().trim()

if (normalizedManufacturer === 'ecosense') {
  // Excel 생성
} else {
  // PDF 생성
}
```

## 관련 파일

### 수정된 파일
- [app/api/document-automation/purchase-order/route.ts](app/api/document-automation/purchase-order/route.ts) - 제조사 로그 추가
- [app/admin/document-automation/components/PurchaseOrderModal.tsx](app/admin/document-automation/components/PurchaseOrderModal.tsx) - 제조사 확인 로그 + Buffer 타입 수정
- [lib/document-generators/excel-generator-ecosense-template.ts](lib/document-generators/excel-generator-ecosense-template.ts) - 대기필증 시트 추가

### 참조 파일
- [양식/@_발주서(에코센스_KT무선)_250701.xlsx](양식/@_발주서(에코센스_KT무선)_250701.xlsx) - 템플릿 파일 (정상 작동)

## 추가 정보

### 템플릿 파일 검증 결과
- ✅ 파일 존재: 942,444 bytes
- ✅ 형식: Microsoft Excel 2007+ (xlsx)
- ✅ ExcelJS 로딩: 정상
- ✅ 워크시트: "발주서" (85행 53열)
- ✅ "단가" 시트: 존재 (수식 참조 가능)

### 파일 형식 라우팅 로직
```typescript
// 제조사별 파일 형식
ecosense       → Excel (서버 생성, 템플릿 기반)
cleanearth     → PDF (클라이언트 생성)
gaia_cns       → PDF (클라이언트 생성)
evs            → PDF (클라이언트 생성)
기타           → PDF (클라이언트 생성)
```

## 다음 단계

1. **즉시 확인**: 브라우저 콘솔에서 제조사 값 확인
2. **DB 확인**: Supabase에서 실제 저장된 제조사 값 확인
3. **필요시 수정**: 제조사 값이 다르면 DB 업데이트 또는 코드 수정
4. **테스트**: 에코센스 사업장 발주서 Excel 다운로드 확인
5. **대기필증 검증**: Excel 파일에 대기필증 시트 확인

## 배포 후 확인사항

- [ ] 에코센스 사업장 발주서가 Excel로 다운로드됨
- [ ] Excel 파일에 데이터가 정상적으로 채워짐
- [ ] 대기필증 정보가 있는 경우 별도 시트에 표시됨
- [ ] 다른 제조사는 여전히 PDF로 다운로드됨
