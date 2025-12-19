# 에코센스 발주서 사업장관리코드 자동 입력 설계

## 📋 요구사항

**목표**: 에코센스 제조사 사업장의 발주서를 Excel 템플릿으로 다운로드할 때, K25 셀에 사업장관리코드를 자동으로 입력

**위치**: `admin/document-automation` (문서 자동화 페이지)
**대상**: 제조사가 "에코센스"인 사업장
**템플릿 파일**: `양식/@_발주서(에코센스_KT무선)_250701.xlsx`
**입력 셀**: K25

## 🏗️ 시스템 아키텍처

### 현재 워크플로우
```
사용자 → PurchaseOrderModal → API → Excel Generator → 템플릿 기반 생성 → 다운로드
```

### 데이터 흐름
```
1. PurchaseOrderModal (Frontend)
   └─ business_id로 사업장 정보 로드

2. API (/api/document-automation/purchase-order)
   └─ business_info 테이블 조회
   └─ business_management_code 포함

3. Excel Generator (excel-generator-ecosense-template.ts)
   └─ 템플릿 로드
   └─ 데이터 채우기 (현재 K25 비어있음)
   └─ Excel 버퍼 반환
```

## 📊 데이터베이스 스키마

### business_info 테이블
```sql
CREATE TABLE business_info (
  id UUID PRIMARY KEY,
  business_name TEXT NOT NULL,
  business_management_code INTEGER,  -- ✅ 사업장관리코드
  manufacturer TEXT,                  -- 제조사 (에코센스, 크린어스 등)
  address TEXT,
  ...
)
```

**주요 컬럼**:
- `business_management_code`: 사업장관리코드 (INTEGER, nullable)
- `manufacturer`: 제조사 구분 필드

## 🔧 구현 설계

### 1️⃣ TypeScript 타입 확장

**파일**: `types/document-automation.ts`

```typescript
export interface PurchaseOrderDataEcosense extends PurchaseOrderData {
  // ... 기존 필드들

  // ✅ 추가: 사업장관리코드
  business_management_code?: number | null
}
```

**변경 이유**: Excel 생성기에 사업장관리코드를 전달하기 위한 타입 확장

### 2️⃣ API 데이터 조회 수정

**파일**: `app/api/document-automation/purchase-order/route.ts`

**GET 엔드포인트 수정**:
```typescript
// 현재 (line 88-96)
console.log('[PURCHASE-ORDER] 사업장 데이터:', {
  id: business.id,
  name: business.business_name,
  manufacturer: business.manufacturer,
  ph_meter: business.ph_meter,
  ...
})

// ✅ 수정 후
console.log('[PURCHASE-ORDER] 사업장 데이터:', {
  id: business.id,
  name: business.business_name,
  manufacturer: business.manufacturer,
  business_management_code: business.business_management_code,  // ✅ 추가
  ph_meter: business.ph_meter,
  ...
})

// 데이터 변환 부분에 추가 (line ~130)
const purchaseOrderData: PurchaseOrderDataEcosense = {
  business_name: business.business_name,
  business_management_code: business.business_management_code,  // ✅ 추가
  address: business.address || '',
  manufacturer: business.manufacturer as Manufacturer,
  ...
}
```

**변경 이유**: DB에서 조회한 `business_management_code`를 API 응답에 포함

### 3️⃣ Excel 템플릿 생성기 수정

**파일**: `lib/document-generators/excel-generator-ecosense-template.ts`

**K25 셀 입력 로직 추가**:
```typescript
export async function generateEcosensePurchaseOrderFromTemplate(
  data: PurchaseOrderDataEcosense
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // 템플릿 로드 (line 14-27)
  const templatePath = path.join(
    process.cwd(),
    '양식',
    '@_발주서(에코센스_KT무선)_250701.xlsx'
  )
  await workbook.xlsx.readFile(templatePath)

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error('워크시트를 찾을 수 없습니다')
  }

  // ============================================================================
  // ✅ 추가: 사업장관리코드 (K25 셀)
  // ============================================================================
  if (data.business_management_code !== null && data.business_management_code !== undefined) {
    worksheet.getCell('K25').value = data.business_management_code
    console.log('[ECOSENSE-TEMPLATE] K25 사업장관리코드 설정:', {
      business_management_code: data.business_management_code,
      cell: 'K25'
    })
  } else {
    console.log('[ECOSENSE-TEMPLATE] K25 사업장관리코드 없음 (null/undefined)')
  }

  // 기존 코드 계속 (블루온 담당자 정보, 품목 항목 등)
  worksheet.getCell('AF3').value = data.manager_name || '담당자'
  ...
}
```

**추가 위치**: line 34 (데이터 채우기 시작) 직후, 블루온 담당자 정보(line 39) 이전

**변경 이유**:
- K25 셀에 사업장관리코드 입력
- 값이 없는 경우(null/undefined) 빈 셀로 유지
- 디버깅을 위한 로그 추가

### 4️⃣ Frontend 모달 검증 (변경 불필요)

**파일**: `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**현재 동작 확인**:
```typescript
// line 41-94: loadData()
const loadData = async () => {
  const response = await fetch(
    `/api/document-automation/purchase-order?business_id=${businessId}`,
    ...
  )
  const result = await response.json()
  const loadedData = result.data.data as PurchaseOrderDataEcosense

  // ✅ API에서 business_management_code가 포함되어 있으면
  // editedData에 자동으로 포함됨
  setData(loadedData)
  setEditedData(loadedData)
}
```

**검증 포인트**:
- API 응답에 `business_management_code`가 포함되면 자동으로 state에 저장됨
- `handleGenerate()` 실행 시 `editedData`가 API로 전달됨 (line 181-196)
- **별도 수정 불필요** ✅

## 📂 파일 변경 요약

| 파일 | 변경 내용 | 우선순위 |
|------|-----------|----------|
| `types/document-automation.ts` | `PurchaseOrderDataEcosense` 타입에 `business_management_code` 필드 추가 | 🔴 HIGH |
| `app/api/document-automation/purchase-order/route.ts` | GET 응답 데이터에 `business_management_code` 포함 | 🔴 HIGH |
| `lib/document-generators/excel-generator-ecosense-template.ts` | K25 셀에 사업장관리코드 입력 로직 추가 | 🔴 HIGH |
| `app/admin/document-automation/components/PurchaseOrderModal.tsx` | 검증만 필요 (수정 불필요) | 🟢 LOW |

## 🧪 테스트 시나리오

### 테스트 케이스 1: 사업장관리코드가 있는 경우
```
조건: business_management_code = 12345
기대 결과: K25 셀에 "12345" 입력
```

### 테스트 케이스 2: 사업장관리코드가 없는 경우
```
조건: business_management_code = null
기대 결과: K25 셀 비어있음
```

### 테스트 케이스 3: 다른 제조사 (크린어스)
```
조건: manufacturer = "크린어스"
기대 결과: PDF 생성 (Excel 템플릿 사용 안 함)
영향 없음: K25 셀 로직은 에코센스 템플릿에만 적용
```

## 🔍 검증 방법

### 1단계: 타입 체크
```bash
npm run type-check
```

### 2단계: 로컬 테스트
1. 사업장관리코드가 있는 에코센스 사업장 선택
2. 발주서 생성 모달 열기
3. "발주서 다운로드" 클릭
4. Excel 파일 다운로드 후 K25 셀 확인

### 3단계: 콘솔 로그 확인
```javascript
// API 로그
[PURCHASE-ORDER] 사업장 데이터: { business_management_code: 12345 }

// Excel 생성기 로그
[ECOSENSE-TEMPLATE] K25 사업장관리코드 설정: { business_management_code: 12345, cell: 'K25' }
```

## 🚨 주의사항

### 데이터 타입
- **DB**: `INTEGER` (null 허용)
- **TypeScript**: `number | null | undefined`
- **Excel**: 숫자로 입력됨 (문자열 아님)

### 템플릿 파일 위치
- 절대 경로: `/Users/mh.c/claude/facility-manager/양식/@_발주서(에코센스_KT무선)_250701.xlsx`
- 상대 경로: `process.cwd() + '/양식/@_발주서(에코센스_KT무선)_250701.xlsx'`
- K25 셀이 템플릿에 존재하는지 사전 확인 필요

### 제조사 필터링
- 에코센스 발주서만 Excel 템플릿 사용 (line 179-223)
- 다른 제조사는 PDF 생성 (line 225-269)
- K25 셀 입력은 **에코센스 Excel 생성 시에만 실행됨**

## 📈 성능 고려사항

- **영향 없음**: K25 셀 1개 추가 입력은 성능 영향 미미
- **메모리**: 기존 템플릿 로드 방식과 동일
- **네트워크**: API 응답 크기 증가 없음 (정수 1개)

## 🔐 보안 고려사항

- **사업장관리코드**: 민감 정보 아님 (공개 가능한 사업장 식별 코드)
- **인증**: 기존 JWT 인증 유지 (`checkUserPermission`)
- **권한**: 로그인된 사용자만 발주서 생성 가능

## 🎯 구현 우선순위

1. **타입 정의 추가** (`types/document-automation.ts`)
2. **API 데이터 포함** (`route.ts`)
3. **Excel 생성기 수정** (`excel-generator-ecosense-template.ts`)
4. **테스트 및 검증**

## 📚 참고 파일

- **템플릿 파일**: `양식/@_발주서(에코센스_KT무선)_250701.xlsx`
- **DB 스키마**: `sql/02_business_schema.sql` (line 30)
- **타입 정의**: `types/database.ts` (line 34)
- **사업장 조회 API**: `app/api/business-unified/route.ts` (line 147)

## ✅ 구현 체크리스트

- [ ] TypeScript 타입에 `business_management_code` 추가
- [ ] API GET 응답에 `business_management_code` 포함
- [ ] Excel 생성기에 K25 셀 입력 로직 추가
- [ ] 타입 체크 통과 (`npm run type-check`)
- [ ] 로컬 테스트: 사업장관리코드 있는 경우
- [ ] 로컬 테스트: 사업장관리코드 없는 경우
- [ ] 콘솔 로그 확인
- [ ] Excel 파일 K25 셀 확인
- [ ] 프로덕션 배포 전 최종 검증

---

**작성일**: 2025-12-18
**작성자**: Claude Code (design mode)
**문서 버전**: 1.0
