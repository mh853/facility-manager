# 에코센스 전용 발주서 구현 TODO

## 📋 프로젝트 개요

**목표**: 에코센스 제조사 전용 상세 발주서 템플릿 구현
**참고 템플릿**: `스샷/발주서1.png` (양식/@_발주서(에코센스_KT무선)_250701.xlsx)
**현재 상태**: 기본 발주서 완료 ✅, 에코센스 전용 템플릿 미구현

---

## ✅ 완료된 작업

### 1. 기본 발주서 시스템 (정상 작동 중)
- [x] CSRF 보호 제외 설정 (`lib/security/csrf-protection.ts:122`)
- [x] Supabase Storage 파일명 처리 (영문/숫자만)
- [x] Blob 다운로드 방식으로 개선
- [x] 제조사별 원가 연동 (`manufacturer_pricing` 테이블)
- [x] 다중 굴뚝 항목 제거
- [x] PDF 버튼 제거 (한글 폰트 문제)
- [x] 엑셀 다운로드 정상 작동 ✅

### 2. 데이터베이스
- [x] `sql/delivery_addresses.sql` 생성 완료
- [x] 택배 주소 관리 테이블 생성 완료 ✅
- [x] 기본 주소 자동 관리 트리거 구현

### 3. 문서화
- [x] `docs/PURCHASE_ORDER_FIXES.md` - 수정 사항 문서화
- [x] `docs/PURCHASE_ORDER_SYSTEM.md` - 시스템 가이드

---

## 🎯 다음 작업 (새 세션에서 진행)

### Phase 1: 데이터 구조 분석 및 준비

#### 1.1 order_management 담당자 정보 확인
**목적**: 제품 발주 단계의 담당자 정보를 발주서에 포함

**작업**:
```typescript
// app/api/order-management 확인
// product_order 상태의 담당자 정보 구조 파악
// 담당자 이름, 연락처, 이메일 등
```

**필요 정보**:
- 담당자 이름
- 담당자 연락처
- 담당자 이메일

**쿼리 예시**:
```sql
SELECT
  om.*,
  e.name as manager_name,
  e.contact as manager_contact,
  e.email as manager_email
FROM order_management om
LEFT JOIN employees e ON om.assigned_to = e.id
WHERE om.business_id = '{business_id}'
```

#### 1.2 business_info에서 필요한 추가 정보 확인
**발주서 템플릿에 필요한 정보**:
- 설치공장정보 (사업장 상세 정보)
- IoT 관련 정보
- 실차등록 정보
- 그린링크 사이트 정보
- 설치 관련 정보

**확인 필요**:
- `business_info` 테이블에 어떤 컬럼들이 있는지
- 추가 테이블이 필요한지 (예: iot_device_info, installation_info 등)

---

### Phase 2: 에코센스 전용 Excel 생성기 구현

#### 2.1 새 파일 생성
**파일**: `lib/document-generators/excel-generator-ecosense.ts`

**구조**:
```typescript
import ExcelJS from 'exceljs'
import type { PurchaseOrderData } from '@/types/document-automation'

export async function generateEcosensePurchaseOrderExcel(
  data: PurchaseOrderDataEcosense
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('발주서')

  // 1. 헤더 섹션 (발 주 서 + 로고 + 인감)
  // 2. 수신/발신/참고 정보
  // 3. 발주일자 및 기본 정보
  // 4. 담당자 정보 섹션
  // 5. 제품 수량 및 금액 테이블
  // 6. 설치 희망일 (오늘 + 7일)
  // 7. 설치공장정보 섹션
  // 8. 택배주소 섹션
  // ... 나머지 섹션들

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

#### 2.2 타입 정의 확장
**파일**: `types/document-automation.ts`

```typescript
export interface PurchaseOrderDataEcosense extends PurchaseOrderData {
  // 기존 필드 +

  // 담당자 정보
  manager_name: string
  manager_contact: string
  manager_email: string

  // 설치 정보
  installation_desired_date: string  // 오늘 + 7일
  installation_address: string  // 사업장 주소

  // 택배 정보
  delivery_address: string
  delivery_recipient: string
  delivery_phone: string
  delivery_postal_code?: string

  // IoT 정보 (필요시)
  iot_device_info?: {
    gateway_serial?: string
    greenlink_account?: string
    // ... 기타
  }
}
```

#### 2.3 템플릿 상세 구현 가이드
**참고**: `스샷/발주서1.png`

**섹션별 구현 순서**:
1. **헤더**: "발 주 서" 제목 + 로고 영역 (이미지는 나중에)
2. **수신/발신/참고**: 고정 텍스트
   - 수신: (주)에코센스
   - 발신: 주식회사 블루온
   - 참고: [스크린샷 내용 그대로]
3. **발주일자**: 오늘 날짜
4. **동봉내역**: "IoT 측정기기(온도계)" 등
5. **사업장정보**: DB에서 조회
6. **담당자**: order_management에서 조회
7. **발주서 접수/공장번호**: 사업장 정보
8. **제품 수량 테이블**:
   ```
   | 구분 | 차압계 | 온도계 | 온도계(방폭) | 전류계(송풍) | 2CH GW | 1CH GW | VPN |
   |------|--------|--------|--------------|--------------|--------|--------|-----|
   | 총수량| DB값   | DB값   | DB값         | DB값         | DB값   | DB값   | DB값|
   ```
9. **금액**: manufacturer_pricing에서 조회한 원가 * 수량
10. **설치 희망일**: `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`
11. **설치공장정보**: business_info에서 조회
12. **택배주소**: 사용자 입력 또는 저장된 주소 선택

---

### Phase 3: API 업데이트

#### 3.1 GET endpoint 수정
**파일**: `app/api/document-automation/purchase-order/route.ts`

**변경사항**:
```typescript
// 제조사별로 다른 데이터 구조 반환
if (business.manufacturer === 'ecosense') {
  // 추가 정보 조회
  const { data: orderData } = await supabaseAdmin
    .from('order_management')
    .select(`
      *,
      assigned_to:employees(name, contact, email)
    `)
    .eq('business_id', businessId)
    .single()

  // 에코센스 전용 데이터 구조
  const ecosenseData: PurchaseOrderDataEcosense = {
    ...standardData,
    manager_name: orderData.assigned_to.name,
    manager_contact: orderData.assigned_to.contact,
    manager_email: orderData.assigned_to.email,
    installation_desired_date: calculateDate(7), // +7일
    installation_address: business.address,
    // ... 기타 필드
  }

  return createSuccessResponse({
    business_id: businessId,
    data: ecosenseData,
    template_type: 'ecosense'
  })
}
```

#### 3.2 POST endpoint 수정
```typescript
// 제조사별 생성기 분기
if (body.data.manufacturer === 'ecosense') {
  fileBuffer = await generateEcosensePurchaseOrderExcel(body.data)
} else {
  fileBuffer = await generatePurchaseOrderExcel(body.data)
}
```

---

### Phase 4: UI 업데이트

#### 4.1 택배주소 관리 컴포넌트
**파일**: `app/admin/document-automation/components/DeliveryAddressSelector.tsx`

```typescript
'use client'

interface DeliveryAddress {
  id: string
  name: string
  recipient: string
  phone: string
  address: string
  postal_code?: string
  is_default: boolean
}

export function DeliveryAddressSelector({
  value,
  onChange
}: {
  value: DeliveryAddress | null
  onChange: (address: DeliveryAddress) => void
}) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [showCustom, setShowCustom] = useState(false)

  // 저장된 주소 목록 조회
  useEffect(() => {
    fetchAddresses()
  }, [])

  return (
    <div>
      {/* 저장된 주소 선택 드롭다운 */}
      <select onChange={(e) => {
        if (e.target.value === 'custom') {
          setShowCustom(true)
        } else {
          const addr = addresses.find(a => a.id === e.target.value)
          onChange(addr!)
        }
      }}>
        {addresses.map(addr => (
          <option key={addr.id} value={addr.id}>
            {addr.name} - {addr.recipient}
          </option>
        ))}
        <option value="custom">직접 입력</option>
      </select>

      {/* 직접 입력 폼 */}
      {showCustom && (
        <div>
          <input placeholder="수령인" />
          <input placeholder="연락처" />
          <input placeholder="주소" />
          <input placeholder="우편번호" />
          <button>이 주소 저장</button>
        </div>
      )}
    </div>
  )
}
```

#### 4.2 PurchaseOrderModal 수정
**파일**: `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**추가 필드**:
```typescript
const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null)

// 모달에 택배주소 섹션 추가
{editedData.manufacturer === 'ecosense' && (
  <div>
    <label>택배주소</label>
    <DeliveryAddressSelector
      value={deliveryAddress}
      onChange={setDeliveryAddress}
    />
  </div>
)}
```

---

### Phase 5: 택배주소 관리 API

#### 5.1 API 엔드포인트 생성
**파일**: `app/api/delivery-addresses/route.ts`

```typescript
// GET: 주소 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  const { data, error } = await supabaseAdmin
    .from('delivery_addresses')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('use_count', { ascending: false })

  return createSuccessResponse({ addresses: data })
})

// POST: 새 주소 추가
export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('delivery_addresses')
    .insert({
      name: body.name,
      recipient: body.recipient,
      phone: body.phone,
      address: body.address,
      postal_code: body.postal_code,
      is_default: body.is_default || false,
      created_by: user.id
    })
    .select()
    .single()

  return createSuccessResponse({ address: data })
})

// PATCH: 사용 횟수 증가
// DELETE: 주소 삭제
```

---

## 📂 파일 구조

```
facility-manager/
├── sql/
│   └── delivery_addresses.sql ✅ (생성 완료)
│
├── types/
│   └── document-automation.ts (확장 필요)
│
├── lib/
│   └── document-generators/
│       ├── excel-generator.ts ✅ (기본 버전)
│       └── excel-generator-ecosense.ts (생성 필요) ⭐
│
├── app/
│   ├── api/
│   │   ├── document-automation/
│   │   │   └── purchase-order/
│   │   │       └── route.ts (수정 필요)
│   │   └── delivery-addresses/
│   │       └── route.ts (생성 필요) ⭐
│   │
│   └── admin/
│       └── document-automation/
│           └── components/
│               ├── PurchaseOrderModal.tsx (수정 필요)
│               └── DeliveryAddressSelector.tsx (생성 필요) ⭐
│
├── docs/
│   ├── PURCHASE_ORDER_FIXES.md ✅
│   ├── PURCHASE_ORDER_SYSTEM.md ✅
│   └── ECOSENSE_PURCHASE_ORDER_TODO.md ✅ (이 문서)
│
└── 스샷/
    └── 발주서1.png ✅ (참고 템플릿)
```

---

## 🔧 구현 순서 추천

### Step 1: 데이터 확인 (30분)
1. order_management 테이블 구조 확인
2. business_info 컬럼 목록 확인
3. 필요한 정보가 모두 있는지 검증

### Step 2: 택배주소 API (1시간)
1. `app/api/delivery-addresses/route.ts` 생성
2. GET, POST, PATCH, DELETE 구현
3. Postman으로 테스트

### Step 3: 택배주소 UI (1.5시간)
1. `DeliveryAddressSelector.tsx` 컴포넌트 생성
2. `PurchaseOrderModal.tsx`에 통합
3. 저장 기능 테스트

### Step 4: 에코센스 타입 정의 (30분)
1. `types/document-automation.ts` 확장
2. `PurchaseOrderDataEcosense` 인터페이스 생성

### Step 5: 에코센스 Excel 생성기 (3-4시간) ⭐ 핵심
1. `excel-generator-ecosense.ts` 생성
2. 템플릿 섹션별 구현
3. 테스트 및 디버깅

### Step 6: API 통합 (1시간)
1. GET endpoint 수정 (제조사별 분기)
2. POST endpoint 수정 (생성기 분기)
3. 통합 테스트

### Step 7: 최종 테스트 (1시간)
1. 에코센스 사업장으로 발주서 생성
2. 다른 제조사도 정상 작동 확인
3. 택배주소 저장/불러오기 테스트

**총 예상 시간**: 약 8-9시간

---

## ⚠️ 주의사항

### 1. 제조사 분기 처리
- 에코센스만 새 템플릿 사용
- 다른 제조사(cleanearth, gaia_cns, evs)는 기존 간단한 템플릿 유지
- 조건: `if (business.manufacturer === 'ecosense')`

### 2. 하위 호환성
- 기존 발주서 기능 유지
- 기존 document_history 데이터와 호환

### 3. 고정 데이터
**발주서에 하드코딩할 내용**:
- 수신: (주)에코센스
- 발신: 주식회사 블루온
- 참고: [스크린샷 내용 확인]

### 4. 날짜 계산
```typescript
// 설치 희망일: 오늘 + 7일
const installationDate = new Date()
installationDate.setDate(installationDate.getDate() + 7)
const formattedDate = installationDate.toISOString().split('T')[0]
```

---

## 📞 문제 발생 시 체크리스트

### Excel 생성 오류
1. ExcelJS 문법 확인
2. 컬럼 너비, 행 높이 설정 확인
3. 병합 셀 범위 확인
4. 한글 폰트 문제 없음 (ExcelJS는 한글 지원)

### 데이터 조회 오류
1. Supabase 쿼리 확인 (JOIN 필요 시)
2. NULL 값 처리 (`|| ''` 사용)
3. 타입 변환 확인

### UI 오류
1. useState 초기값 확인
2. useEffect 의존성 배열 확인
3. fetch 에러 핸들링 확인

---

## 🎯 성공 기준

### 필수 기능
- [✅] 에코센스 사업장 선택 시 상세 발주서 생성
- [✅] 담당자 정보 자동 입력
- [✅] 제품 수량 및 금액 정확히 표시
- [✅] 설치 희망일 자동 계산 (+7일)
- [✅] 택배주소 입력/저장/불러오기

### 선택 기능 (시간 있으면)
- [ ] 로고 이미지 추가
- [ ] 인감 이미지 추가
- [ ] IoT 상세 정보 섹션
- [ ] 실차등록 정보 섹션
- [ ] 그린링크 계정 정보

---

## 📚 참고 문서

1. **현재 시스템**: `docs/PURCHASE_ORDER_SYSTEM.md`
2. **수정 이력**: `docs/PURCHASE_ORDER_FIXES.md`
3. **템플릿 참고**: `스샷/발주서1.png`
4. **DB 스키마**:
   - `sql/02_business_schema.sql` (business_info)
   - `sql/manufacturer_pricing_system.sql` (원가)
   - `sql/delivery_addresses.sql` (택배주소)

---

## 🚀 시작하기

새 세션에서 다음 명령으로 시작:

```
이전 세션에서 에코센스 전용 발주서 작업을 진행했습니다.
docs/ECOSENSE_PURCHASE_ORDER_TODO.md 파일을 확인하고,
Step 1 (데이터 확인)부터 시작해주세요.

기본 발주서는 이미 정상 작동 중이며,
sql/delivery_addresses.sql 도 실행 완료되었습니다.
```

---

**작성일**: 2025-11-03
**작성자**: Claude Code Session
**상태**: 기본 발주서 완료, 에코센스 템플릿 구현 대기 중
