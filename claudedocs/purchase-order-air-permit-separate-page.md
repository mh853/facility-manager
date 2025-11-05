# 발주서 PDF - 대기필증 별도 페이지 출력

## 변경 일시
2025-11-04

## 개요
발주서 PDF 생성 시 대기필증 정보를 완전히 별도의 페이지에 출력하도록 개선했습니다. 이전에는 CSS `page-break-before` 속성을 사용했으나, HTML-to-Canvas 방식에서는 작동하지 않아 근본적인 구조 변경을 수행했습니다.

## 문제 상황

### 기존 구현의 문제점
```typescript
// 이전 방식: 전체 HTML을 하나의 Canvas로 변환
const htmlContent = generatePurchaseOrderHtml(data) // 대기필증 포함
const canvas = await html2canvas(tempDiv, {...})

// CSS page-break-before가 작동하지 않음
${data.air_permit ? `
  <div style="page-break-before: always;">
    <!-- 대기필증 내용 -->
  </div>
` : ''}
```

**문제점**:
1. HTML을 먼저 Canvas 이미지로 변환한 후 PDF로 출력
2. CSS의 page-break 속성은 이미지에서 무시됨
3. 대기필증이 페이지 중간에 걸쳐서 출력되는 문제 발생

## 해결 방법

### 1. 아키텍처 변경: 두 단계 렌더링

**핵심 전략**: 메인 발주서와 대기필증을 별도의 Canvas로 생성한 후 각각 PDF 페이지에 추가

```typescript
export async function generateEcosensePurchaseOrderPDF(
  data: PurchaseOrderDataEcosense
): Promise<Buffer> {
  const doc = new jsPDF('p', 'mm', 'a4')

  // 1단계: 메인 발주서 렌더링 (대기필증 제외)
  const mainHtmlContent = generatePurchaseOrderHtml(data, false)
  const mainCanvas = await renderHtmlToCanvas(mainHtmlContent)
  await addCanvasToPdf(doc, mainCanvas, margin, pageWidth, pageHeight, false)

  // 2단계: 대기필증이 있으면 새 페이지에 별도 렌더링
  if (data.air_permit) {
    const airPermitHtml = generateAirPermitHtml(data)
    const airPermitCanvas = await renderHtmlToCanvas(airPermitHtml)

    doc.addPage() // 명시적으로 새 페이지 추가

    await addCanvasToPdf(doc, airPermitCanvas, margin, pageWidth, pageHeight, true)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
```

### 2. HTML 생성 함수 분리

#### 2.1. generatePurchaseOrderHtml() 수정

**파일**: `lib/document-generators/pdf-generator-ecosense.ts` (line 166)

```typescript
function generatePurchaseOrderHtml(
  data: PurchaseOrderDataEcosense,
  includeAirPermit: boolean = true  // 파라미터 추가
): string {
  // 메인 발주서 내용만 생성
  // 대기필증 섹션 제거됨
  return `
    <div>
      <!-- 발주서 제목 -->
      <!-- 담당자 정보 -->
      <!-- 품목 정보 -->
      <!-- 설치 정보 -->
      <!-- 사업장 정보 -->
      <!-- 장비 설정 -->
      <!-- 전류계 타입 -->
      <!-- 발주 금액 및 결제조건 -->
      <!-- 하단 정보 -->
    </div>
  `
}
```

**변경 사항**:
- 대기필증 섹션 완전히 제거 (lines 343-439 삭제)
- 하단 정보 다음에 `</div>` 바로 닫기
- 깔끔한 단일 페이지 발주서 구조

#### 2.2. generateAirPermitHtml() 신규 생성

**파일**: `lib/document-generators/pdf-generator-ecosense.ts` (lines 346-456)

```typescript
function generateAirPermitHtml(data: PurchaseOrderDataEcosense): string {
  if (!data.air_permit) return ''

  return `
    <div style="...">
      <!-- 대기필증 제목 -->
      <div style="text-align: center; margin-bottom: 20px;">
        <h1>대기배출시설 허가증</h1>
        <p>${data.business_name}</p>
      </div>

      <!-- 기본 정보 -->
      <div style="margin-bottom: 15px;">
        <h2>기본 정보</h2>
        <table>
          <!-- 업종, 시설번호, 그린링크코드, 최초신고일, 가동개시일 -->
        </table>
      </div>

      <!-- 배출구 및 시설 정보 -->
      <div style="margin-top: 20px;">
        <h2>배출구 및 시설 정보</h2>
        ${data.air_permit.outlets?.map(outlet => `
          <div>
            <h3>${outlet.outlet_name}</h3>
            <!-- 배출시설 테이블 -->
            <!-- 방지시설 테이블 -->
          </div>
        `).join('')}
      </div>
    </div>
  `
}
```

**특징**:
- 독립적인 문서 구조 (자체 제목, 사업장명 표시)
- 별도 페이지용 디자인 (여백과 간격 최적화)
- 기본 정보 섹션에 명확한 제목 추가
- 배출구별 정보도 별도 섹션화

### 3. 헬퍼 함수 추가

#### 3.1. renderHtmlToCanvas()

**파일**: `lib/document-generators/pdf-generator-ecosense.ts` (lines 47-105)

```typescript
async function renderHtmlToCanvas(htmlContent: string): Promise<HTMLCanvasElement> {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  tempDiv.style.cssText = `...` // 스타일 적용

  document.body.appendChild(tempDiv)
  await new Promise(resolve => setTimeout(resolve, 500)) // 폰트 로딩 대기

  const canvas = await html2canvas(tempDiv, {
    scale: 2,
    backgroundColor: '#ffffff',
    // ... 기타 옵션
  })

  document.body.removeChild(tempDiv)
  return canvas
}
```

**역할**:
- HTML 문자열을 Canvas로 변환하는 재사용 가능한 함수
- DOM 생성/삭제 처리
- 폰트 로딩 대기
- html2canvas 설정 캡슐화

#### 3.2. addCanvasToPdf()

**파일**: `lib/document-generators/pdf-generator-ecosense.ts` (lines 107-164)

```typescript
async function addCanvasToPdf(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  isNewSection: boolean
): Promise<void> {
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let remainingHeight = imgHeight
  let yPosition = 0

  while (remainingHeight > 0) {
    const currentPageHeight = Math.min(pageHeight, remainingHeight)

    // Canvas 자르기 (페이지 높이에 맞춤)
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')

    if (cropCtx) {
      // Canvas 크롭 및 PDF 이미지 추가
      // ...
    }

    remainingHeight -= currentPageHeight
    yPosition += currentPageHeight

    if (remainingHeight > 0) {
      doc.addPage() // 다음 페이지 필요 시 추가
    }
  }
}
```

**역할**:
- Canvas를 PDF에 추가 (페이지 높이 초과 시 자동 분할)
- 여러 페이지 처리 지원
- 이미지 크롭 및 배치 최적화

## 동작 흐름

### 메인 함수 실행 순서

```
generateEcosensePurchaseOrderPDF(data)
    ↓
1. jsPDF 인스턴스 생성
    ↓
2. 메인 발주서 HTML 생성 (대기필증 제외)
   → generatePurchaseOrderHtml(data, false)
    ↓
3. HTML을 Canvas로 렌더링
   → renderHtmlToCanvas(mainHtmlContent)
    ↓
4. Canvas를 PDF 첫 페이지(들)에 추가
   → addCanvasToPdf(doc, mainCanvas, ...)
    ↓
5. 대기필증 있는지 확인
   if (data.air_permit) {
    ↓
6. 대기필증 HTML 생성
   → generateAirPermitHtml(data)
    ↓
7. HTML을 Canvas로 렌더링
   → renderHtmlToCanvas(airPermitHtml)
    ↓
8. 새 페이지 추가
   → doc.addPage()
    ↓
9. Canvas를 새 페이지에 추가
   → addCanvasToPdf(doc, airPermitCanvas, ...)
   }
    ↓
10. PDF Buffer 반환
    → Buffer.from(doc.output('arraybuffer'))
```

### Canvas-to-PDF 처리 상세

```
addCanvasToPdf(canvas)
    ↓
1. Canvas 높이 계산
   imgHeight = (canvas.height * pageWidth) / canvas.width
    ↓
2. 페이지 높이와 비교
   while (remainingHeight > 0) {
    ↓
3. 현재 페이지에 들어갈 높이 계산
   currentPageHeight = min(pageHeight, remainingHeight)
    ↓
4. Canvas 자르기
   cropCanvas.drawImage(원본, 자를영역, 대상영역)
    ↓
5. JPEG로 변환
   cropImgData = cropCanvas.toDataURL('image/jpeg', 0.95)
    ↓
6. PDF에 이미지 추가
   doc.addImage(cropImgData, 'JPEG', x, y, width, height)
    ↓
7. 남은 높이 업데이트
   remainingHeight -= currentPageHeight
    ↓
8. 아직 남았으면 새 페이지 추가
   if (remainingHeight > 0) doc.addPage()
   }
```

## 변경된 파일

### lib/document-generators/pdf-generator-ecosense.ts

**주요 변경 사항**:

1. **generateEcosensePurchaseOrderPDF()** (lines 8-45)
   - 두 단계 렌더링 구조로 전환
   - 메인 발주서와 대기필증 별도 처리
   - 명시적 페이지 추가 (`doc.addPage()`)

2. **renderHtmlToCanvas()** (lines 47-105) - 신규
   - HTML → Canvas 변환 로직 캡슐화
   - 재사용 가능한 헬퍼 함수

3. **addCanvasToPdf()** (lines 107-164) - 신규
   - Canvas → PDF 페이지 추가 로직 캡슐화
   - 여러 페이지 분할 처리

4. **generatePurchaseOrderHtml()** (line 166)
   - `includeAirPermit` 파라미터 추가 (사용되지 않지만 호환성 유지)
   - 대기필증 섹션 완전히 제거 (lines 343-439)

5. **generateAirPermitHtml()** (lines 346-456) - 신규
   - 대기필증 전용 HTML 생성
   - 독립 문서 구조 (제목, 사업장명 포함)

## 성능 최적화

### 렌더링 최적화
- **병렬 처리 불가**: Canvas 렌더링은 DOM 조작이 필요하므로 순차 처리 필수
- **폰트 로딩 대기**: 각 Canvas 생성 시 500ms 대기 (한글 폰트 로딩 보장)
- **Canvas 재사용 없음**: 각 섹션마다 새 Canvas 생성 (메모리 정리 용이)

### 메모리 관리
```typescript
// DOM 요소 즉시 제거
document.body.appendChild(tempDiv)
const canvas = await html2canvas(tempDiv, {...})
document.body.removeChild(tempDiv) // 렌더링 후 바로 제거

// Canvas 참조만 유지 (GC 대상)
```

### PDF 압축
```typescript
const cropImgData = cropCanvas.toDataURL('image/jpeg', 0.95)
// JPEG 품질 95% (파일 크기와 품질 균형)
```

## UI/UX 개선

### 대기필증 페이지 디자인

**제목 영역**:
```css
text-align: center;
margin-bottom: 20px;
border-bottom: 2px solid #2563eb;
```
- 중앙 정렬 제목
- 사업장명 부제목
- 파란색 하단 테두리

**섹션 구분**:
```css
h2 {
  font-size: 14px;
  color: #2563eb;
  border-left: 3px solid #2563eb;
  padding-left: 7px;
}
```
- "기본 정보", "배출구 및 시설 정보" 명확히 구분
- 좌측 파란색 강조선

**배출구별 정보**:
```css
h3 {
  background-color: #f8f9fa;
  padding: 8px;
  border-left: 3px solid #2563eb;
}
```
- 배출구명 + 배출구 번호 표시
- 회색 배경으로 구분

**시설 구분**:
- 배출시설: 빨간색 테마 (#dc2626)
- 방지시설: 초록색 테마 (#16a34a)
- 각각 아이콘 표시 (🏭, 🛡️)

### 메인 발주서 변경 없음
- 기존 레이아웃 유지
- 하단 정보까지 단일 구조
- 깔끔한 종료

## 테스트 시나리오

### 시나리오 1: 대기필증이 있는 사업장 (예: 주포산업(주))

**예상 결과**:
- 1페이지: 발주서 전체 내용
- 2페이지: 대기필증 정보
  - 제목: "대기배출시설 허가증"
  - 부제목: "주포산업(주)"
  - 기본 정보 테이블
  - 배출구별 시설 정보

**검증 항목**:
```
✅ 발주서가 1페이지에 완전히 표시됨
✅ 대기필증이 2페이지 시작부터 표시됨
✅ 페이지 중간에 걸리지 않음
✅ 모든 배출구 정보가 포함됨
✅ 배출시설/방지시설 색상 구분 정상
✅ PDF 다운로드 정상 작동
```

### 시나리오 2: 대기필증이 없는 사업장

**예상 결과**:
- 1페이지: 발주서 전체 내용
- 2페이지 없음

**검증 항목**:
```
✅ 발주서만 1페이지에 표시
✅ 빈 페이지 생성되지 않음
✅ PDF 파일 크기 정상 (대기필증 없는 버전)
```

### 시나리오 3: 대기필증 정보가 많은 경우 (배출구 5개 이상)

**예상 결과**:
- 1페이지: 발주서
- 2페이지: 대기필증 시작
- 3페이지: 대기필증 계속 (필요 시)

**검증 항목**:
```
✅ 대기필증이 2페이지부터 시작
✅ 내용이 많으면 자동으로 3페이지로 확장
✅ 페이지 넘김이 자연스러움
✅ 모든 배출구 정보 누락 없음
```

## 기술적 장점

### 1. 명확한 페이지 분리
**Before (CSS page-break)**:
```typescript
// 작동하지 않음
<div style="page-break-before: always;">대기필증</div>
```

**After (별도 Canvas)**:
```typescript
// 확실한 페이지 분리
doc.addPage() // 명시적 새 페이지
await addCanvasToPdf(doc, airPermitCanvas, ...)
```

### 2. 유연한 레이아웃 관리
- 메인 발주서와 대기필증 각각 독립적 디자인 가능
- 페이지 크기 초과 시 자동 분할 (각 섹션별)
- 섹션별 여백 및 간격 최적화

### 3. 유지보수성 향상
```typescript
// 함수별 명확한 책임 분리
generatePurchaseOrderHtml()  // 발주서만
generateAirPermitHtml()      // 대기필증만
renderHtmlToCanvas()         // HTML → Canvas
addCanvasToPdf()             // Canvas → PDF
```

### 4. 확장 가능성
- 추가 섹션 필요 시 같은 패턴으로 구현 가능
- 각 섹션별 조건부 출력 용이
- 섹션 순서 변경 간단

## 제약 사항

### 1. 렌더링 시간 증가
```
Before: 1회 Canvas 생성 (~500ms)
After:  2회 Canvas 생성 (~1000ms)
```
- 대기필증 있을 때 렌더링 시간 2배
- 사용자 경험상 큰 차이 없음 (1초 이내)

### 2. 메모리 사용량 증가
- 두 개의 Canvas 동시 메모리 유지 (짧은 시간)
- 현대 브라우저에서 문제 없음

### 3. 코드 복잡도 증가
- 단일 함수 → 4개 함수로 분리
- 유지보수성 향상으로 상쇄

## 향후 개선 가능 사항

### 1. 프로그레스 바 표시
```typescript
// 렌더링 진행 상황 표시
setProgress(0.3) // 메인 발주서 렌더링 중...
setProgress(0.6) // 대기필증 렌더링 중...
setProgress(1.0) // 완료
```

### 2. 섹션 순서 옵션
```typescript
// 사용자가 섹션 순서 선택 가능
const options = {
  airPermitFirst: false, // 대기필증을 첫 페이지에
  separatePages: true    // 별도 페이지 출력
}
```

### 3. 캐싱 최적화
```typescript
// 대기필증 Canvas 캐싱 (동일 사업장 재사용)
const cacheKey = `air_permit_${businessId}`
if (canvasCache.has(cacheKey)) {
  return canvasCache.get(cacheKey)
}
```

### 4. PDF 메타데이터 추가
```typescript
doc.setProperties({
  title: `발주서_${businessName}_${date}`,
  subject: '에코센스 발주서',
  keywords: '발주서, 대기필증',
  creator: '블루온 IoT'
})
```

## 관련 문서

- `claudedocs/purchase-order-air-permit-integration.md` - 초기 대기필증 통합
- `claudedocs/purchase-order-air-permit-auto-load.md` - 자동 로딩 기능
- `claudedocs/air-permit-pdf-csrf-fix.md` - CSRF 문제 해결
- `types/document-automation.ts:159-181` - air_permit 타입 정의

## 변경 이력

- 2025-11-04: 대기필증 별도 페이지 출력 구현 완료
