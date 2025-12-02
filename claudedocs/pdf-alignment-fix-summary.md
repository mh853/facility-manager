# 착공신고서 PDF 정렬 문제 해결 요약

## 📋 문제 요약

**증상**: 착공신고서 PDF 생성 시 "구비서류" 섹션에서 번호(1., 2., 3., ...)와 한글 텍스트의 수직 정렬이 맞지 않는 문제

**영향**: Page 1의 구비서류 목록 표시에서 시각적 불일치 발생

**근본 원인**: Puppeteer의 Chromium 렌더링 엔진이 아라비아 숫자와 한글 문자의 baseline을 다르게 계산하여 발생

## 🔧 시도한 해결 방법

### 1차 시도: HTML 구조 단순화 ❌
- **방법**: 복잡한 테이블 구조를 제거하고 `<br/>` 태그로 변경
- **결과**: 실패 - 정렬 문제 지속

### 2차 시도: 라이브러리 버전 확인 ℹ️
- **확인 결과**:
  - `puppeteer`: v24.31.0 (최신)
  - `docx`: v9.5.1 (최신)
- **결론**: 라이브러리 업데이트로는 해결 불가

### 3차 시도 (최종): CSS Print 최적화 ✅
- **방법**: Puppeteer 전용 CSS 속성 추가
- **적용 파일**: `/lib/pdf-templates/construction-report-html.ts`

## ✅ 최종 해결책 상세

### 적용된 CSS 최적화

#### 1. Print Color Adjustment (전체 요소)
```css
* {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```
- **목적**: PDF 렌더링 시 정확한 색상 및 스타일 재현
- **효과**: 브라우저의 인쇄 최적화 비활성화로 정확한 렌더링 보장

#### 2. Font Smoothing (본문)
```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```
- **목적**: 일관된 폰트 렌더링
- **효과**: 문자별 렌더링 차이 최소화

#### 3. Table Layout (테이블)
```css
table {
  table-layout: fixed;
}
```
- **목적**: 고정 테이블 레이아웃으로 예측 가능한 셀 크기
- **효과**: 셀 너비 및 정렬 일관성 보장

#### 4. Absolute Line Height (테이블 셀)
```css
th, td {
  vertical-align: top;
  line-height: 20px;  /* 상대값(1.8) 대신 절대값(20px) 사용 */
}
```
- **목적**: 픽셀 기반 절대 정렬
- **효과**: 모든 문자가 동일한 baseline에 정렬

### 구비서류 섹션 구조

```html
<table style="width: 100%; border: none; border-collapse: collapse; border-spacing: 0;">
  <tr>
    <td style="width: 20px; padding: 0; margin: 0; border: none;
                font-size: 14px; line-height: 20px; vertical-align: top;">
      1.
    </td>
    <td style="padding: 0 0 6px 4px; margin: 0; border: none;
                font-size: 14px; line-height: 20px; vertical-align: top;">
      대기배출시설 설치 허가(신고)증 사본 1부.
    </td>
  </tr>
  <!-- 추가 항목들... -->
</table>
```

**핵심 설정**:
- 번호 열: `width: 20px` (고정 너비)
- 모든 셀: `line-height: 20px` (절대값)
- 모든 셀: `vertical-align: top` (상단 정렬 강제)
- 모든 셀: `padding: 0; margin: 0` (여백 제거)

## 🧪 테스트 방법

### 1. HTML 미리보기 테스트
```bash
# 테스트 HTML 파일 생성 및 브라우저 열기
node test-pdf-alignment.js
open test-alignment.html
```

**확인 사항**:
- ✓ "1."과 "대기배출시설..." 텍스트가 같은 높이에 있는가?
- ✓ "2."와 "계약서..." 텍스트가 같은 높이에 있는가?
- ✓ 모든 줄이 일관된 간격을 유지하는가?
- ✓ "정렬 비교" 섹션과 차이가 있는가?

### 2. PDF 인쇄 미리보기 테스트
1. 브라우저에서 `Cmd+P` (macOS) 또는 `Ctrl+P` (Windows) 실행
2. 인쇄 미리보기에서 정렬 확인
3. PDF로 저장하여 최종 확인

### 3. 실제 API 테스트
```bash
# 개발 서버 실행
npm run dev

# Supabase에 테스트 데이터 생성 후 PDF 다운로드
# http://localhost:3000/api/construction-reports/pdf?id={report_id}
```

## 🔄 대안 솔루션 (현재 해결책이 작동하지 않는 경우)

### Option 1: Playwright로 전환 (권장)
**장점**:
- Puppeteer의 후속 프로젝트로 더 나은 렌더링 엔진
- 최신 브라우저 기능 지원
- 더 정확한 PDF 생성

**마이그레이션**:
```bash
npm install playwright
npm uninstall puppeteer
```

```typescript
// app/api/construction-reports/pdf/route.ts
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html)
const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
```

### Option 2: PDF-Lib 사용
**장점**:
- HTML 중간 단계 없이 직접 PDF 생성
- 정밀한 레이아웃 컨트롤
- 더 가벼운 의존성

**단점**:
- 완전히 새로운 레이아웃 코드 작성 필요
- 복잡한 표 구조 구현에 시간 소요

### Option 3: wkhtmltopdf 사용
**장점**:
- Qt WebKit 기반으로 안정적인 렌더링
- 한글 폰트 지원 우수

**단점**:
- 서버에 시스템 패키지 설치 필요
- Vercel 등 서버리스 환경에서 추가 설정 필요

### Option 4: DOCX만 사용
**장점**:
- 이미 구현된 DOCX 생성 코드 활용
- Word에서 PDF 변환은 사용자가 직접 수행
- 정렬 문제 없음

**단점**:
- 사용자 경험 저하 (추가 변환 단계 필요)
- PDF 자동 생성 기능 상실

## 📊 예상 결과

### 개선 전
```
1.         대기배출시설 설치 허가(신고)증 사본 1부.
    ^-- 숫자가 위로 올라가 있음

2.         계약서(사본) 1부.
    ^-- 정렬 불일치
```

### 개선 후
```
1. 대기배출시설 설치 허가(신고)증 사본 1부.
^-- 같은 baseline에 정렬

2. 계약서(사본) 1부.
^-- 일관된 정렬
```

## ✅ 체크리스트

- [x] CSS print 최적화 적용 완료
- [x] 테스트 HTML 파일 생성
- [ ] 브라우저에서 시각적 확인 (사용자 확인 필요)
- [ ] PDF 인쇄 미리보기 확인 (사용자 확인 필요)
- [ ] 실제 API 엔드포인트 테스트 (사용자 확인 필요)
- [ ] 대안 솔루션 검토 (필요 시)

## 📝 다음 단계

1. **즉시**: `test-alignment.html` 파일을 브라우저에서 열어 정렬 확인
2. **확인**: 인쇄 미리보기(Cmd+P)로 PDF 렌더링 확인
3. **테스트**: 실제 착공신고서 데이터로 PDF 생성하여 최종 검증
4. **필요시**: 정렬 문제가 지속되면 대안 솔루션(Playwright) 검토

## 🔗 관련 파일

- **HTML 템플릿**: `/lib/pdf-templates/construction-report-html.ts`
- **PDF API**: `/app/api/construction-reports/pdf/route.ts`
- **DOCX API**: `/app/api/construction-reports/download/route.ts`
- **테스트 스크립트**: `/test-pdf-alignment.js`
- **테스트 HTML**: `/test-alignment.html`

## 📚 참고 자료

- [Puppeteer PDF 문서](https://pptr.dev/api/puppeteer.page.pdf)
- [CSS Print Media 가이드](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print)
- [Playwright 마이그레이션 가이드](https://playwright.dev/docs/puppeteer)

---

**작성일**: 2025-11-26
**상태**: CSS 최적화 적용 완료, 사용자 테스트 대기 중
