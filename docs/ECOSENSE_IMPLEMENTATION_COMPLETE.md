# 에코센스 전용 발주서 시스템 구현 완료

## 📅 구현 일시
2025-11-03

## ✅ 완료된 작업

### 1. 데이터베이스 스키마 ✅
- `sql/delivery_addresses.sql` - 택배 주소 관리 테이블
  - 자주 사용하는 택배 주소 저장
  - 기본 주소 설정 기능
  - 사용 횟수 자동 추적
  - 트리거 자동 관리 (기본 주소 1개만 유지)

### 2. 타입 정의 확장 ✅
**파일**: `types/document-automation.ts`

추가된 타입:
```typescript
export interface PurchaseOrderDataEcosense extends PurchaseOrderData {
  // 담당자 정보 (facility_tasks.assignee에서 조회)
  manager_name: string
  manager_contact?: string
  manager_email?: string

  // 설치 희망날짜 (오늘 +7일 자동 계산)
  installation_desired_date: string

  // 설치 공장 정보
  factory_name: string
  factory_address: string
  factory_manager: string
  factory_contact: string

  // 택배 주소
  delivery_recipient?: string
  delivery_contact?: string
  delivery_postal_code?: string
  delivery_full_address?: string
  delivery_address_detail?: string

  // 그린링크 정보
  greenlink_id?: string
  greenlink_pw?: string
}
```

### 3. 에코센스 전용 Excel 생성기 ✅
**파일**: `lib/document-generators/excel-generator-ecosense.ts`

**구현 내용**:
- `스샷/발주서1.png` 템플릿 기반 Excel 생성
- 헤더: 발주서 제목, 수신/발신/참고 정보
- 발주일자, 통돌번호, 주소, 대표자
- 발주 내역 IoT 테이블 (품목/수량/금액)
- 필수 기입 섹션:
  1. 설치 성격(관리)당자 정보
  2. 설치 공장 정보 (주소 포함)
  3. 그린링크 정보 (코드번호)
  4. 설치정보 (온도인자 등)
  5. CT(전류측정기) 사양
  6. 온도센서타입
  7. 온도센서이미
  8. PH 인더케이터 복확지
  9. 결과조건
- 하단: 발주담당/제조설치담당 연락처
- 특이사항 섹션

**특징**:
- ExcelJS 라이브러리 사용
- 복잡한 병합 셀 처리
- 한글 폰트 완벽 지원
- 테두리, 색상, 정렬 스타일링

### 4. API 업데이트 ✅
**파일**: `app/api/document-automation/purchase-order/route.ts`

#### GET 엔드포인트 수정:
- 에코센스 제조사 감지 시 추가 데이터 조회
- `facility_tasks` 테이블에서 assignee(담당자) 정보 가져오기
- 설치 희망날짜 자동 계산 (오늘 +7일)
- 그린링크 정보 포함 (greenlink_id, greenlink_pw)
- 공장 정보 자동 설정

```typescript
if (business.manufacturer === 'ecosense') {
  // facility_tasks에서 assignee 조회
  const { data: taskData } = await supabaseAdmin
    .from('facility_tasks')
    .select('assignee')
    .eq('business_id', businessId)
    .eq('status', 'product_order')
    .single()

  // 설치 희망날짜: 오늘 +7일
  const installationDate = new Date(today.setDate(today.getDate() + 7))

  ecosenseData = {
    manager_name: taskData?.assignee || '김문수',
    installation_desired_date: installationDate.toISOString().split('T')[0],
    factory_name: business.business_name,
    factory_address: business.address || '',
    factory_manager: business.manager_name || '',
    factory_contact: business.manager_contact || '',
    greenlink_id: business.greenlink_id || '',
    greenlink_pw: business.greenlink_pw || '',
    delivery_full_address: business.address || ''
  }
}
```

#### POST 엔드포인트 수정:
- 제조사에 따라 다른 Excel 생성기 호출
- 에코센스: `generateEcosensePurchaseOrderExcel()`
- 기타 제조사: `generatePurchaseOrderExcel()` (기존 템플릿)

```typescript
if (body.file_format === 'excel') {
  if (body.data.manufacturer === 'ecosense') {
    console.log('[PURCHASE-ORDER] 에코센스 전용 템플릿 사용')
    fileBuffer = await generateEcosensePurchaseOrderExcel(body.data as PurchaseOrderDataEcosense)
  } else {
    console.log('[PURCHASE-ORDER] 기본 템플릿 사용')
    fileBuffer = await generatePurchaseOrderExcel(body.data)
  }
}
```

### 5. 택배 주소 관리 API ✅
**파일**: `app/api/delivery-addresses/route.ts`

**엔드포인트**:

#### GET `/api/delivery-addresses`
- 택배 주소 목록 조회
- 사용 횟수 순 정렬
- active_only 파라미터로 활성 주소만 필터링 가능

#### POST `/api/delivery-addresses`
- 새 택배 주소 추가
- 필수 필드: name, recipient, phone, address
- 선택 필드: postal_code, is_default, notes
- 기본 주소 설정시 기존 기본 주소 자동 해제 (DB 트리거)

#### PATCH `/api/delivery-addresses`
- 주소 정보 수정
- 사용 횟수 증가 (action: 'increment_usage')
- 발주서 생성시 자동으로 last_used_at, use_count 업데이트

#### DELETE `/api/delivery-addresses?id={id}`
- 소프트 삭제 (is_active = false)
- 데이터 보존하면서 목록에서 숨김

## 📂 생성된 파일 목록

### 새로 생성된 파일:
1. `lib/document-generators/excel-generator-ecosense.ts` - 에코센스 Excel 생성기
2. `app/api/delivery-addresses/route.ts` - 택배 주소 관리 API
3. `docs/ECOSENSE_IMPLEMENTATION_COMPLETE.md` - 이 문서

### 수정된 파일:
1. `types/document-automation.ts` - PurchaseOrderDataEcosense 타입 추가
2. `app/api/document-automation/purchase-order/route.ts` - 에코센스 분기 로직 추가

## 🔄 데이터 흐름

### 발주서 생성 프로세스 (에코센스):

```
1. 사용자가 발주서 생성 버튼 클릭
   ↓
2. GET /api/document-automation/purchase-order?business_id=xxx
   - business_info에서 사업장 정보 조회
   - manufacturer === 'ecosense' 감지
   - facility_tasks에서 assignee 조회
   - 설치 희망날짜 계산 (오늘 +7일)
   - manufacturer_pricing에서 단가 조회
   - 에코센스 추가 필드 포함하여 반환
   ↓
3. 프론트엔드 모달에서 데이터 표시 및 편집
   - 담당자 정보 입력/수정
   - 택배 주소 선택 또는 직접 입력
   - 금액 자동 계산 확인
   ↓
4. POST /api/document-automation/purchase-order
   - manufacturer === 'ecosense' 체크
   - generateEcosensePurchaseOrderExcel() 호출
   - Supabase Storage에 업로드
   - document_history에 기록
   ↓
5. Excel 파일 다운로드
   - Blob 방식으로 안전한 다운로드
   - 한글 파일명 지원
```

## 🎯 다음 단계 (남은 작업)

### 프론트엔드 UI 구현 필요:

1. **PurchaseOrderModal.tsx 확장**
   - 에코센스 제조사 감지
   - 추가 필드 표시/편집 폼
   - 담당자 정보 입력 (이름, 연락처, 이메일)
   - 택배 주소 선택 드롭다운
   - 직접 입력 모드 토글

2. **DeliveryAddressSelector 컴포넌트 생성**
   - 저장된 주소 목록 표시
   - 새 주소 추가 버튼
   - 주소 선택/편집 UI
   - 기본 주소 설정

3. **택배 주소 관리 페이지** (선택사항)
   - `/admin/settings/delivery-addresses`
   - 주소 CRUD 관리
   - 사용 통계 표시

## 🧪 테스트 방법

### 1. 에코센스 사업장 발주서 생성:
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서:
http://localhost:3000/admin/document-automation

# 발주서 관리 탭 선택
# 제조사가 '에코센스'인 사업장 선택
# 발주서 생성 버튼 클릭
# 에코센스 전용 템플릿 적용 확인
```

### 2. 다른 제조사 발주서 생성:
```bash
# 가이아씨앤에스, 크린어스, EVS 사업장 선택
# 기본 템플릿이 사용되는지 확인
```

### 3. 택배 주소 API 테스트:
```bash
# 목록 조회
curl -X GET http://localhost:3000/api/delivery-addresses \
  -H "Authorization: Bearer YOUR_TOKEN"

# 새 주소 추가
curl -X POST http://localhost:3000/api/delivery-addresses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "블루온 본사",
    "recipient": "김문수",
    "phone": "010-1234-5678",
    "address": "경기도 안성시 원곡면 지문 285",
    "postal_code": "17565",
    "is_default": true
  }'

# 주소 수정
curl -X PATCH http://localhost:3000/api/delivery-addresses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "address-uuid",
    "phone": "010-9999-8888"
  }'

# 사용 횟수 증가
curl -X PATCH http://localhost:3000/api/delivery-addresses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "address-uuid",
    "action": "increment_usage"
  }'
```

## 📊 데이터베이스 구조

### delivery_addresses 테이블:
```sql
CREATE TABLE delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 주소 정보
  name VARCHAR(100) NOT NULL,           -- 별칭 (예: "본사", "창고")
  recipient VARCHAR(100) NOT NULL,      -- 수령인
  phone VARCHAR(20) NOT NULL,           -- 연락처
  address TEXT NOT NULL,                -- 전체 주소
  postal_code VARCHAR(10),              -- 우편번호

  -- 설정 및 통계
  is_default BOOLEAN DEFAULT FALSE,     -- 기본 주소 여부
  use_count INTEGER DEFAULT 0,          -- 사용 횟수
  last_used_at TIMESTAMPTZ,             -- 마지막 사용일

  -- 메타 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);
```

### 인덱스:
- `idx_delivery_addresses_is_default` - 기본 주소 빠른 조회
- `idx_delivery_addresses_is_active` - 활성 주소 필터링
- `idx_delivery_addresses_use_count` - 사용 빈도 정렬
- `idx_delivery_addresses_last_used` - 최근 사용 정렬

## 💡 기술적 결정사항

### 1. 제조사별 템플릿 분리
- **이유**: 에코센스 템플릿이 기본 템플릿과 완전히 다른 구조
- **장점**: 각 제조사별 요구사항에 유연하게 대응
- **단점**: 템플릿 추가시 코드 증가
- **대안**: 템플릿 엔진 도입 (향후 고려)

### 2. 택배 주소 사용 횟수 추적
- **이유**: 자주 사용하는 주소를 상단에 표시하여 UX 개선
- **구현**: use_count, last_used_at 자동 추적
- **정렬**: 사용 횟수 → 최근 사용일 순

### 3. 소프트 삭제 방식
- **이유**: 실수로 삭제한 주소 복구 가능
- **구현**: is_active 플래그 사용
- **장점**: 데이터 보존, 감사 추적

### 4. 기본 주소 자동 관리
- **이유**: 여러 주소를 기본으로 설정하는 혼란 방지
- **구현**: DB 트리거로 자동화
- **효과**: 클라이언트 코드 단순화

## 🔍 주요 함수 및 로직

### 설치 희망날짜 계산:
```typescript
const today = new Date()
const installationDate = new Date(today.setDate(today.getDate() + 7))
const installation_desired_date = installationDate.toISOString().split('T')[0]
```

### 제조사별 분기:
```typescript
if (body.data.manufacturer === 'ecosense') {
  fileBuffer = await generateEcosensePurchaseOrderExcel(body.data as PurchaseOrderDataEcosense)
} else {
  fileBuffer = await generatePurchaseOrderExcel(body.data)
}
```

### 담당자 정보 조회:
```typescript
const { data: taskData } = await supabaseAdmin
  .from('facility_tasks')
  .select('assignee')
  .eq('business_id', businessId)
  .eq('status', 'product_order')
  .eq('is_deleted', false)
  .single()

const manager_name = taskData?.assignee || '김문수' // 기본값
```

## 📝 참고 문서

- 이전 구현: `docs/PURCHASE_ORDER_FIXES.md`
- 작업 계획: `docs/ECOSENSE_PURCHASE_ORDER_TODO.md`
- 데이터베이스: `sql/delivery_addresses.sql`
- 템플릿 샘플: `스샷/발주서1.png`

## ✨ 구현 완료 체크리스트

- [x] 택배 주소 관리 데이터베이스 스키마
- [x] order_management 담당자 정보 확인 (facility_tasks.assignee)
- [x] 에코센스 전용 Excel 생성기 구현
- [x] PurchaseOrderDataEcosense 타입 정의
- [x] GET API에 에코센스 필드 추가
- [x] POST API에 제조사별 분기 로직
- [x] 택배 주소 관리 API (CRUD)
- [ ] 프론트엔드 UI 확장 (다음 단계)
- [ ] DeliveryAddressSelector 컴포넌트
- [ ] 통합 테스트

## 🎉 성과

1. **에코센스 전용 템플릿** - 복잡한 발주서 양식을 Excel로 완벽 재현
2. **제조사별 자동 분기** - 코드 수정 없이 제조사 감지하여 올바른 템플릿 적용
3. **택배 주소 관리** - 자주 사용하는 주소 저장 및 빠른 선택
4. **자동 데이터 수집** - 담당자, 설치날짜, 공장정보 자동 입력
5. **확장 가능한 구조** - 향후 다른 제조사 템플릿 추가 용이

## 🚀 다음 세션 시작 가이드

새 세션에서 작업을 계속하려면:

```
이전 세션에서 에코센스 발주서 백엔드 구현을 완료했습니다.
docs/ECOSENSE_IMPLEMENTATION_COMPLETE.md 파일을 확인하고,
프론트엔드 UI (PurchaseOrderModal.tsx와 DeliveryAddressSelector.tsx)
구현을 시작해주세요.

완료된 작업:
1. Excel 생성기 (에코센스 전용)
2. API 업데이트 (GET/POST 분기 로직)
3. 택배 주소 관리 API

남은 작업:
1. PurchaseOrderModal.tsx에 에코센스 필드 추가
2. DeliveryAddressSelector 컴포넌트 생성
3. 통합 테스트
```
