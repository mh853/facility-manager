# 발주서 관리 시스템 설치 및 사용 가이드

## 📋 개요

사업장의 측정기기 정보를 기반으로 발주서를 자동으로 생성하고 관리하는 시스템입니다.
엑셀(XLSX)과 PDF 형식으로 출력이 가능합니다.

## 🎯 주요 기능

1. **발주서 자동 생성**
   - 사업장별 측정기기 정보 자동 입력
   - 제조사별 품목 자동 분류
   - 금액 자동 계산 (단가 × 수량 + VAT)

2. **다양한 출력 형식**
   - 엑셀 (XLSX) 다운로드
   - PDF 다운로드

3. **실시간 편집**
   - 발주 정보 수정 가능
   - 특이사항 추가 가능

4. **문서 이력 관리**
   - 생성된 문서 자동 저장
   - 이력 조회 및 재다운로드

## 🚀 설치 가이드

### 1. 데이터베이스 스키마 적용

```bash
# Supabase SQL Editor에서 실행
psql -h <SUPABASE_HOST> -U postgres -d postgres -f sql/document_automation_schema.sql
```

또는 Supabase Dashboard → SQL Editor에서 `sql/document_automation_schema.sql` 파일 내용을 실행하세요.

### 2. Supabase Storage 버킷 확인

`facility-files` 버킷이 존재하는지 확인하고, 없으면 생성하세요.

```sql
-- Supabase Dashboard → Storage → New Bucket
-- Bucket Name: facility-files
-- Public: Yes (또는 인증된 사용자만 접근 가능하도록 설정)
```

### 3. 필요한 라이브러리 설치 확인

```bash
npm install
# 이미 설치됨: exceljs, jspdf, jspdf-autotable, file-saver
```

### 4. 환경 변수 확인

`.env.local` 파일에 Supabase 설정이 올바른지 확인하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. 개발 서버 재시작

```bash
npm run dev
```

## 📖 사용 방법

### 1. 발주서 생성

#### 방법 A: 문서 자동화 페이지에서
1. `/admin/document-automation` 접속
2. "발주서 관리" 탭 클릭
3. 사업장 검색 또는 사업장 관리로 이동
4. 사업장 선택
5. 발주서 데이터 확인 및 수정
6. "엑셀 다운로드" 또는 "PDF 다운로드" 클릭

#### 방법 B: 사업장 관리 페이지에서 (향후 추가 예정)
1. `/admin/business-management` 접속
2. 사업장 선택
3. "발주서 생성" 버튼 클릭

### 2. 문서 이력 조회

1. `/admin/document-automation` 접속
2. "실행 이력" 탭 클릭
3. 생성된 문서 목록 확인
4. 다운로드 버튼 클릭하여 재다운로드

## 🗂️ 파일 구조

```
facility-manager/
├── sql/
│   └── document_automation_schema.sql     # 데이터베이스 스키마
├── types/
│   └── document-automation.ts             # 타입 정의
├── lib/
│   └── document-generators/
│       ├── excel-generator.ts             # 엑셀 생성 유틸리티
│       └── pdf-generator.ts               # PDF 생성 유틸리티
├── app/
│   ├── api/
│   │   └── document-automation/
│   │       ├── purchase-order/
│   │       │   └── route.ts               # 발주서 API
│   │       └── history/
│   │           └── route.ts               # 문서 이력 API
│   └── admin/
│       └── document-automation/
│           ├── page.tsx                   # 문서 자동화 페이지
│           └── components/
│               └── PurchaseOrderModal.tsx # 발주서 생성 모달
└── docs/
    └── PURCHASE_ORDER_SYSTEM.md           # 이 문서
```

## 🔧 API 엔드포인트

### GET /api/document-automation/purchase-order

사업장의 발주서 데이터 조회 (자동 채우기용)

**Query Parameters:**
- `business_id` (required): 사업장 ID

**Response:**
```json
{
  "success": true,
  "data": {
    "business_id": "uuid",
    "data": {
      "business_name": "사업장명",
      "address": "주소",
      "manufacturer": "ecosense",
      "equipment": { ... },
      "item_details": [ ... ],
      "subtotal": 1000000,
      "vat": 100000,
      "grand_total": 1100000
    }
  }
}
```

### POST /api/document-automation/purchase-order

발주서 생성 및 저장

**Request Body:**
```json
{
  "business_id": "uuid",
  "data": {
    "business_name": "사업장명",
    "order_date": "2025-11-03",
    "item_details": [ ... ],
    ...
  },
  "file_format": "excel" | "pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "history_id": "uuid",
    "document_name": "발주서_사업장명_2025-11-03.xlsx",
    "file_path": "documents/purchase-orders/...",
    "file_url": "https://...",
    "file_format": "excel",
    "created_at": "2025-11-03T..."
  }
}
```

### GET /api/document-automation/history

문서 이력 목록 조회

**Query Parameters:**
- `business_id` (optional): 사업장 ID로 필터링
- `document_type` (optional): 문서 타입 (purchase_order, estimate, contract)
- `file_format` (optional): 파일 형식 (excel, pdf)
- `page` (optional): 페이지 번호 (기본값: 1)
- `limit` (optional): 페이지 크기 (기본값: 20)

## 🎨 커스터마이징

### 단가표 수정

`app/api/document-automation/purchase-order/route.ts` 파일의 `unitPrices` 객체를 수정하세요:

```typescript
const unitPrices: Record<string, number> = {
  ph_sensor: 150000,              // pH센서 단가
  differential_pressure_meter: 120000,
  temperature_meter: 100000,
  // ...
}
```

### 엑셀 템플릿 디자인 수정

`lib/document-generators/excel-generator.ts` 파일에서 색상, 폰트, 레이아웃 등을 수정하세요.

### PDF 템플릿 디자인 수정

`lib/document-generators/pdf-generator.ts` 파일에서 레이아웃을 수정하세요.

## 🐛 트러블슈팅

### 문제: 발주서 생성 시 "파일 업로드 오류" 발생

**원인:** Supabase Storage 권한 문제

**해결:**
1. Supabase Dashboard → Storage → facility-files 버킷 확인
2. Policies 탭에서 업로드 권한 확인
3. Service Role Key가 올바른지 확인

### 문제: 엑셀 파일이 깨져서 열리지 않음

**원인:** Buffer 변환 오류

**해결:**
1. `lib/document-generators/excel-generator.ts` 파일 확인
2. `Buffer.from(buffer)` 변환 로직 확인

### 문제: PDF에 한글이 깨짐

**원인:** jsPDF 한글 폰트 미지원

**해결:**
1. 한글 폰트 파일 추가 필요 (향후 개선 예정)
2. 현재는 영문과 숫자만 정상 표시

## 🔜 향후 개선 계획

1. **PDF 한글 폰트 지원**
   - 나눔고딕 또는 맑은 고딕 임베딩

2. **사업장 목록 통합**
   - 문서 자동화 페이지 내에서 사업장 검색 및 선택 기능

3. **견적서 템플릿 추가**
   - 발주서와 유사한 방식으로 견적서 자동 생성

4. **계약서 템플릿 추가**
   - 계약서 자동 생성 및 관리

5. **이메일 발송 기능**
   - 생성된 문서를 이메일로 직접 발송

6. **템플릿 관리 UI**
   - 관리자가 직접 템플릿 수정 가능

## 📞 지원

문제가 발생하거나 기능 개선 제안이 있으시면 이슈를 등록해주세요.
