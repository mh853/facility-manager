# 발주서에 대기필증 정보 통합

## 변경 일시
2025-11-04

## 개요
발주서 미리보기 및 PDF 출력물에 대기필증(대기배출시설 허가증) 정보를 추가하여, 사업장의 배출시설 및 방지시설 정보를 함께 확인할 수 있도록 개선했습니다.

## 변경 사항

### 1. 대기필증 PDF 디버깅 로그 제거
**파일**: `app/admin/air-permit-detail/page.tsx` (lines 908-962)

CSRF 문제 해결 후 더 이상 필요하지 않은 상세 디버깅 로그를 제거하여 코드를 깔끔하게 정리했습니다.

**Before**: 15+ console.log 문으로 모든 단계 추적
**After**: 최소한의 에러 로깅만 유지

```typescript
// 깔끔해진 PDF 생성 함수
const generatePDF = async () => {
  if (!permitDetail) return

  try {
    setIsGeneratingPdf(true)
    const response = await fetch('/api/air-permit-pdf', {...})
    const { data: pdfData } = await response.json()
    const { generateKoreanAirPermitPdf } = await import('@/utils/korean-pdf-generator')
    const pdfBlob = await generateKoreanAirPermitPdf(pdfData)
    // 다운로드 처리
  } catch (error) {
    console.error('PDF 생성 오류:', error)
  } finally {
    setIsGeneratingPdf(false)
  }
}
```

### 2. PurchaseOrderDataEcosense 타입 확장
**파일**: `types/document-automation.ts` (lines 159-181)

발주서 데이터 타입에 대기필증 정보 필드를 추가했습니다.

```typescript
export interface PurchaseOrderDataEcosense extends PurchaseOrderData {
  // ... 기존 필드들 ...

  // 대기필증 정보 (옵션)
  air_permit?: {
    business_type?: string // 업종
    facility_number?: string // 시설번호
    green_link_code?: string // 그린링크코드
    first_report_date?: string // 최초신고일
    operation_start_date?: string // 가동개시일
    outlets?: Array<{
      outlet_number: number // 배출구 번호
      outlet_name: string // 배출구명
      discharge_facilities?: Array<{ // 배출시설
        name: string
        capacity: string
        quantity: number
      }>
      prevention_facilities?: Array<{ // 방지시설
        name: string
        capacity: string
        quantity: number
      }>
    }>
  }
}
```

**특징**:
- 옵션 필드로 구현 (기존 발주서와 호환성 유지)
- 대기필증 페이지와 동일한 데이터 구조 사용
- 중첩된 배출구-시설 구조 지원

### 3. 발주서 미리보기 컴포넌트 업데이트
**파일**: `components/EcosensePurchaseOrderForm.tsx`

#### 3.1. 대기필증 섹션 추가 (lines 320-416)

결제조건 섹션 바로 다음, 하단 정보 바로 앞에 대기필증 섹션을 추가했습니다.

```tsx
{/* 대기필증 정보 */}
{data.air_permit && (
  <div className="section air-permit-section">
    <h2 className="section-title">대기배출시설 허가증</h2>

    {/* 기본 정보 테이블 */}
    <div className="permit-basic-info">
      <table className="permit-table">
        {/* 업종, 시설번호, 그린링크코드, 최초신고일, 가동개시일 */}
      </table>
    </div>

    {/* 배출구별 시설 정보 */}
    {data.air_permit.outlets?.map((outlet) => (
      <div className="outlet-item">
        <h3 className="outlet-title">{outlet.outlet_name}</h3>

        {/* 배출시설 테이블 */}
        {outlet.discharge_facilities?.length > 0 && (
          <div className="facility-group">
            <h4 className="facility-title discharge">🏭 배출시설</h4>
            <table className="facility-table">
              {/* 시설번호, 시설명, 용량, 수량 */}
            </table>
          </div>
        )}

        {/* 방지시설 테이블 */}
        {outlet.prevention_facilities?.length > 0 && (
          <div className="facility-group">
            <h4 className="facility-title prevention">🛡️ 방지시설</h4>
            <table className="facility-table">
              {/* 시설번호, 시설명, 용량, 수량 */}
            </table>
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

**구조**:
1. **기본 정보**: 업종, 시설번호, 그린링크코드, 최초신고일, 가동개시일
2. **배출구별 정보**: 각 배출구마다 배출시설과 방지시설을 테이블로 표시
3. **조건부 렌더링**: air_permit 데이터가 있을 때만 표시

#### 3.2. 스타일 추가 (lines 647-774)

대기필증 섹션을 위한 전용 스타일을 추가했습니다.

**주요 스타일**:
```css
.air-permit-section {
  margin-top: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border: 2px solid #2563eb; /* 파란색 강조 테두리 */
  border-radius: 6px;
}

.facility-title.discharge {
  background-color: #fef2f2;
  color: #dc2626; /* 빨간색 - 배출시설 */
  border-left: 4px solid #dc2626;
}

.facility-title.prevention {
  background-color: #f0fdf4;
  color: #16a34a; /* 초록색 - 방지시설 */
  border-left: 4px solid #16a34a;
}
```

**디자인 특징**:
- 파란색 테두리로 대기필증 섹션 강조
- 배출시설(빨간색)과 방지시설(초록색) 색상으로 구분
- 테이블 반응형 레이아웃
- 인쇄 시에도 정상 출력

### 4. PDF 생성기 업데이트
**파일**: `lib/document-generators/pdf-generator-ecosense.ts` (lines 303-397)

PDF 출력물에도 동일한 대기필증 정보를 추가했습니다.

```typescript
${data.air_permit ? `
<!-- 대기필증 정보 -->
<div style="margin-top: 12px; margin-bottom: 10px;">
  <h2 style="...">대기배출시설 허가증</h2>

  <!-- 기본 정보 테이블 -->
  <table style="...">
    <tr>
      <td>업종</td>
      <td>${escapeHtml(data.air_permit.business_type || '-')}</td>
      ...
    </tr>
  </table>

  <!-- 배출구별 시설 정보 -->
  ${data.air_permit.outlets?.map(outlet => `
    <div style="...">
      <h3>${escapeHtml(outlet.outlet_name)} (배출구 #${outlet.outlet_number})</h3>

      <!-- 배출시설 테이블 -->
      ${outlet.discharge_facilities?.length > 0 ? `
        <h4>🏭 배출시설</h4>
        <table>...</table>
      ` : ''}

      <!-- 방지시설 테이블 -->
      ${outlet.prevention_facilities?.length > 0 ? `
        <h4>🛡️ 방지시설</h4>
        <table>...</table>
      ` : ''}
    </div>
  `).join('')}
</div>
` : ''}
```

**PDF 최적화**:
- 인라인 스타일로 일관된 렌더링
- 축소된 폰트 크기 (11px) - 공간 절약
- 테이블 너비 최적화 (시설번호 12%, 시설명 48%, 용량 28%, 수량 12%)
- 한글 폰트 지원 (escapeHtml 처리)
- 조건부 렌더링으로 데이터 없을 때 깔끔한 출력

## 데이터 흐름

```
사업장 선택
    ↓
대기필증 조회 (air_permit_info 테이블)
    ↓
배출구 정보 조회 (discharge_outlets 테이블)
    ↓
배출시설/방지시설 조회 (discharge_facilities, prevention_facilities 테이블)
    ↓
PurchaseOrderDataEcosense 타입으로 변환
    ↓
발주서 미리보기 + PDF 생성
```

## 변경된 파일 목록

1. `app/admin/air-permit-detail/page.tsx` - 디버깅 로그 제거
2. `types/document-automation.ts` - air_permit 필드 추가
3. `components/EcosensePurchaseOrderForm.tsx` - 대기필증 섹션 + 스타일 추가
4. `lib/document-generators/pdf-generator-ecosense.ts` - PDF 대기필증 섹션 추가

## 사용 방법

### 1. 발주서 생성 시 대기필증 데이터 포함

```typescript
const purchaseOrderData: PurchaseOrderDataEcosense = {
  // ... 기존 발주서 데이터 ...

  // 대기필증 정보 추가 (옵션)
  air_permit: {
    business_type: '제조업',
    facility_number: 'FAC-2024-001',
    green_link_code: 'GL123456',
    first_report_date: '2024-01-15',
    operation_start_date: '2024-02-01',
    outlets: [
      {
        outlet_number: 1,
        outlet_name: '배출구 1호',
        discharge_facilities: [
          {
            name: '도장시설',
            capacity: '100kg/h',
            quantity: 2
          }
        ],
        prevention_facilities: [
          {
            name: '활성탄 흡착시설',
            capacity: '500CMM',
            quantity: 1
          }
        ]
      }
    ]
  }
}
```

### 2. 미리보기 확인
- 발주서 미리보기 화면에서 대기필증 섹션 확인
- 결제조건 아래, 하단 정보 위에 표시됨

### 3. PDF 다운로드
- PDF 다운로드 버튼 클릭
- 생성된 PDF에 대기필증 정보 포함 확인

## 호환성

### 기존 발주서와의 호환성 ✅
- `air_permit` 필드는 **옵션**이므로 기존 발주서는 영향 없음
- 대기필증 데이터가 없으면 섹션이 표시되지 않음
- 기존 발주서 생성/출력 기능 정상 작동

### 브라우저 호환성 ✅
- 모던 브라우저 전체 지원 (Chrome, Edge, Firefox, Safari)
- 인쇄 스타일 최적화
- 반응형 디자인

## 테스트 시나리오

### 1. 대기필증 있는 사업장
✅ 발주서 미리보기에 대기필증 섹션 표시
✅ PDF 다운로드 시 대기필증 정보 포함
✅ 배출구별 시설 정보 정확히 표시
✅ 배출시설/방지시설 색상 구분 정상

### 2. 대기필증 없는 사업장
✅ 발주서 미리보기 정상 (대기필증 섹션 미표시)
✅ PDF 다운로드 정상 (대기필증 섹션 미포함)
✅ 기존 발주서와 동일한 출력

### 3. 부분 데이터
✅ 기본 정보만 있고 배출구 없는 경우 처리
✅ 배출시설만 있고 방지시설 없는 경우 처리
✅ 빈 값 처리 ('-' 표시)

## UI/UX 개선

### 시각적 구분
- **파란색 테두리**: 대기필증 섹션 강조
- **빨간색**: 배출시설 (🏭 아이콘)
- **초록색**: 방지시설 (🛡️ 아이콘)

### 정보 계층
1. 대기배출시설 허가증 (제목)
2. 기본 정보 (업종, 시설번호 등)
3. 배출구별 정보
   - 배출구명
   - 배출시설 목록
   - 방지시설 목록

### 가독성
- 테이블 형식으로 정리된 데이터
- 적절한 여백과 패딩
- 명확한 레이블과 값 구분

## 향후 고려사항

### 1. 대기필증 데이터 자동 연결
현재는 수동으로 air_permit 데이터를 전달해야 하지만, 향후 business_id를 기반으로 자동으로 대기필증 정보를 조회하여 포함시킬 수 있습니다.

```typescript
// 발주서 생성 API에서 자동으로 대기필증 조회
const airPermit = await DatabaseService.getAirPermitByBusinessId(business_id)
if (airPermit) {
  purchaseOrderData.air_permit = formatAirPermitForPurchaseOrder(airPermit)
}
```

### 2. 대기필증 정보 필터링
모든 배출구/시설 정보가 아닌, 발주서와 관련된 정보만 선택적으로 포함할 수 있습니다.

### 3. PDF 페이지 최적화
대기필증 정보가 많을 경우 페이지 넘김 처리를 개선할 수 있습니다.

## 관련 문서
- `claudedocs/air-permit-pdf-csrf-fix.md` - CSRF 문제 해결
- `claudedocs/air-permit-pdf-debug-instructions.md` - PDF 디버깅 가이드
- `claudedocs/pdf-text-size-and-alignment-fix.md` - PDF 스타일 개선
