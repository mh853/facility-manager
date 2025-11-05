# PDF 한글 인코딩 문제 해결 방안

## 문제 요약

**에러:** `ReferenceError: document is not defined`

**원인:**
- HTML-to-Canvas 방식은 브라우저 환경에서만 작동 (`document`, `html2canvas` 필요)
- Next.js API 라우트는 서버 사이드에서 실행됨
- 서버 환경에는 `document` 객체가 존재하지 않음

## 해결 방안

### 방안 1: 클라이언트 사이드 PDF 생성 ⭐ (권장)

**장점:**
- 한글 폰트 완벽 지원
- HTML/CSS 활용 가능
- 브라우저 렌더링 엔진 사용

**구현:**
```typescript
// 클라이언트 컴포넌트에서 PDF 생성
'use client'

import { generateEcosensePurchaseOrderPDF } from '@/lib/document-generators/pdf-generator-ecosense'

const handleDownloadPDF = async () => {
  const pdfBuffer = await generateEcosensePurchaseOrderPDF(data)
  // 다운로드 처리
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'purchase-order.pdf'
  a.click()
}
```

**단점:**
- 파일을 서버에 저장하지 않고 직접 다운로드만 가능
- Supabase storage에 업로드 불가

### 방안 2: Puppeteer 사용 (서버 사이드)

**장점:**
- 서버에서 한글 PDF 생성 가능
- 파일을 Supabase에 저장 가능
- API 엔드포인트 유지

**구현:**
```typescript
import puppeteer from 'puppeteer'

export async function generatePDFWithPuppeteer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.setContent(html, {
    waitUntil: 'networkidle0'
  })

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  })

  await browser.close()
  return pdfBuffer
}
```

**단점:**
- Puppeteer 설치 필요 (용량 큼: ~300MB)
- 서버 리소스 사용량 증가
- 실행 시간 증가

### 방안 3: 기존 jsPDF + 영문 라벨 (임시 방편)

**현재 적용된 방식:**
```typescript
// 한글 텍스트를 영문으로 대체
doc.text('PURCHASE ORDER', x, y)  // '발 주 서' 대신
doc.text('Business Name:', x, y)  // '사업장명:' 대신
```

**장점:**
- 즉시 사용 가능
- 추가 설치 불필요

**단점:**
- 한글 데이터는 여전히 깨짐
- 사용자 경험 저하

## 권장 솔루션

### 단계별 접근

**1단계: 즉시 해결 (클라이언트 사이드)**
- 모달에서 "발주서 다운로드" 클릭 시
- 클라이언트에서 직접 PDF 생성
- 사용자가 즉시 다운로드
- Supabase 업로드는 생략

**2단계: 장기 해결 (Puppeteer 또는 다른 서비스)**
- Puppeteer 설치 및 설정
- 서버 사이드 PDF 생성 구현
- Supabase 저장 기능 추가

## 구현 계획

### 즉시 적용: 클라이언트 PDF 생성

**수정 파일:**
1. `app/admin/document-automation/components/PurchaseOrderModal.tsx`
   - `handleGenerate` 함수 수정
   - PDF일 경우 클라이언트에서 직접 생성

2. `lib/document-generators/pdf-generator-ecosense.ts`
   - 이미 작성완료 (클라이언트 전용)

**예상 코드:**
```typescript
const handleGenerate = async (fileFormat: 'excel' | 'pdf') => {
  const manufacturer = editedData.manufacturer

  if (manufacturer === 'ecosense') {
    // Excel은 서버에서 생성
    // API 호출
  } else {
    if (fileFormat === 'pdf') {
      // PDF는 클라이언트에서 생성
      const pdfBuffer = await generateEcosensePurchaseOrderPDF(editedData)
      // 직접 다운로드
    } else {
      // API 호출
    }
  }
}
```

## 최종 결론

**현재 상황:**
- ❌ 서버 사이드에서 html2canvas 사용 불가
- ✅ 클라이언트 사이드에서만 가능

**즉시 해결:**
- PDF 생성을 클라이언트로 이동
- 사용자가 직접 다운로드

**장기 해결:**
- Puppeteer 도입 검토
- 또는 PDF 생성 전용 서비스 사용 (PDF.co, DocRaptor 등)
