# 무선 라우터 관리 기능 구현 워크플로우

## 📋 요구사항 요약

### 기능 개요
- 무선 라우터 재고 관리 (상품명, S/N, MAC, IMEI)
- 발주 시 사업장에 라우터 할당
- 출고일 관리 및 추적 (개별/일괄)
- 재고 현황 및 통계 확인

### 사용자 요구사항
- ✅ **재고 추가**: Excel 데이터 복사-붙여넣기
- ✅ **라우터 할당**: 발주 모달에서 직접 선택 (가이아씨앤에스만, 추후 크린어스)
- ✅ **출고일 입력**: 개별/일괄 모두 지원
- ✅ **상태 추적**: 입고 완료 상태만 관리

---

## ✅ 완료된 작업

### Phase 1: 데이터베이스 스키마 ✅
**파일**: `sql/router_inventory.sql`

**테이블 구조**:
```sql
router_inventory (
  - 기본 정보: product_name, serial_number, mac_address, imei
  - 입고 정보: received_date, received_batch, supplier
  - 출고 정보: shipped_date, shipped_batch
  - 할당 정보: assigned_business_id, order_management_id
  - 상태: status (in_stock, assigned, installed)
)
```

**실행 방법**:
```bash
# Supabase SQL Editor에서 실행
# sql/router_inventory.sql 내용 전체 복사하여 실행
```

### Phase 2: TypeScript 타입 정의 ✅
**파일**: `types/router-inventory.ts`

**주요 타입**:
- `RouterInventoryItem`: 라우터 재고 항목
- `RouterBulkAddRequest`: 일괄 추가 요청
- `RouterListResponse`: 목록 응답
- `RouterAssignRequest`: 할당 요청

### Phase 3: API 엔드포인트 ✅
**파일**: `app/api/router-inventory/route.ts`

**완료**:
- GET: 라우터 목록 조회 (필터, 검색, 페이지네이션)
- POST: 라우터 일괄 추가

### Phase 4: 추가 API 엔드포인트 ✅

**완료된 엔드포인트**:
- ✅ `app/api/router-inventory/[id]/route.ts` - 개별 라우터 조회/수정/삭제
- ✅ `app/api/router-inventory/shipping/route.ts` - 출고일 일괄 업데이트
- ✅ `app/api/router-inventory/assign/route.ts` - 라우터 할당/할당 해제
- ✅ `app/api/router-inventory/stats/route.ts` - 재고 통계 조회

---

## 🔄 남은 작업

---

### Phase 5: UI 컴포넌트 개발

#### 5.1 라우터 관리 메인 페이지
**파일**: `app/admin/order-management/page.tsx` (탭 추가)

**구조**:
```tsx
<AdminLayout title="발주 관리">
  <Tabs>
    <Tab value="발주 필요">발주 필요 목록</Tab>
    <Tab value="발주 진행 전">발주 진행 전 목록</Tab>
    <Tab value="발주 완료">발주 완료 목록</Tab>
    <Tab value="무선 라우터 관리">라우터 재고 관리</Tab> {/* 신규 */}
  </Tabs>
</AdminLayout>
```

#### 5.2 라우터 재고 목록 컴포넌트
**파일**: `app/admin/order-management/components/RouterInventoryList.tsx`

**기능**:
- 재고 현황 통계 카드
- 라우터 목록 테이블 (S/N, MAC, IMEI, 상태, 출고일, 할당 사업장)
- 검색 및 필터 (상태, S/N 검색)
- 페이지네이션

#### 5.3 라우터 추가 모달
**파일**: `app/admin/order-management/components/RouterAddModal.tsx`

**기능**:
- Excel 데이터 복사-붙여넣기 입력 필드
- 파싱 및 검증
- 일괄 추가 API 호출

**예시**:
```
상품명	S/N	MAC	IMEI
Router-X100	SN12345	AA:BB:CC:DD:EE:FF	123456789012345
Router-X100	SN12346	AA:BB:CC:DD:EE:F0	123456789012346
```

#### 5.4 출고일 일괄 입력 모달
**파일**: `app/admin/order-management/components/RouterShippingModal.tsx`

**기능**:
- 라우터 다중 선택 (체크박스)
- 출고일 날짜 선택
- 출고 배치 번호 입력 (선택)
- 일괄 업데이트 API 호출

#### 5.5 라우터 상세/수정 모달
**파일**: `app/admin/order-management/components/RouterDetailModal.tsx`

**기능**:
- 라우터 정보 표시 (읽기 전용)
- 출고일 개별 수정
- 비고 입력
- 할당 이력 표시

---

### Phase 6: 발주 모달에 라우터 할당 추가

#### 6.1 OrderDetailModal 수정
**파일**: `app/admin/order-management/components/OrderDetailModal.tsx`

**변경사항**:
```typescript
// 제조사가 가이아씨앤에스인 경우만 라우터 선택 표시
{workflow.manufacturer === 'gaia_cns' && (
  <div className="라우터 선택 섹션">
    <label>무선 라우터</label>
    <select value={selectedRouterId}>
      <option value="">선택 안함</option>
      {availableRouters.map(router => (
        <option key={router.id} value={router.id}>
          {router.product_name} ({router.serial_number})
        </option>
      ))}
    </select>
  </div>
)}
```

#### 6.2 발주 저장 시 라우터 할당
```typescript
const handleSave = async () => {
  // 1. 발주 정보 저장
  await savOrderDetails()

  // 2. 라우터 할당 (선택한 경우)
  if (selectedRouterId) {
    await assignRouter({
      router_id: selectedRouterId,
      business_id: businessId,
      order_management_id: orderId
    })
  }
}
```

---

### Phase 7: 테스트 및 검증

#### 7.1 데이터베이스 테스트
- [ ] SQL 스키마 생성 확인
- [ ] 인덱스 및 트리거 동작 확인
- [ ] RLS 정책 테스트

#### 7.2 API 테스트
- [ ] 라우터 목록 조회 (필터, 검색)
- [ ] 라우터 일괄 추가 (복사-붙여넣기)
- [ ] 출고일 일괄 업데이트
- [ ] 라우터 할당
- [ ] 통계 조회

#### 7.3 UI/UX 테스트
- [ ] 라우터 관리 탭 접근
- [ ] 재고 추가 (복사-붙여넣기)
- [ ] 출고일 입력 (개별/일괄)
- [ ] 발주 모달에서 라우터 선택
- [ ] 할당 후 재고 상태 변경 확인

---

## 📝 구현 순서

### 우선순위 1: 핵심 기능
1. ✅ 데이터베이스 스키마 생성 및 실행
2. ✅ TypeScript 타입 정의
3. ✅ 라우터 목록 조회 API
4. ✅ 라우터 일괄 추가 API
5. ✅ 라우터 할당 API
6. ✅ 출고일 업데이트 API
7. ✅ 라우터 개별 조회/수정/삭제 API
8. ✅ 라우터 통계 API

### 우선순위 2: UI 컴포넌트
9. ⏳ 라우터 관리 탭 추가
10. ⏳ 라우터 재고 목록 컴포넌트
11. ⏳ 라우터 추가 모달 (복사-붙여넣기)
12. ⏳ 출고일 일괄 입력 모달

### 우선순위 3: 통합 기능
13. ⏳ 발주 모달에 라우터 선택 추가
14. ⏳ 라우터 할당 로직 통합
15. ⏳ 통계 및 대시보드 개선

---

## 🎯 다음 단계

### 즉시 실행 가능
1. **데이터베이스 생성**: Supabase SQL Editor에서 `sql/router_inventory.sql` 실행
2. **UI 컴포넌트 개발 시작**:
   - 라우터 관리 탭 추가 (발주 관리 페이지)
   - 기본 목록 컴포넌트
   - 라우터 추가 모달 (Excel 복사-붙여넣기)
   - 출고일 일괄 입력 모달

### 질문 사항
- 라우터 입고 시 자동으로 입고일을 설정할지? (현재는 수동 입력)
- 라우터 설치 완료 상태는 어떻게 변경할지? (발주 완료 시 자동? 수동?)
- 크린어스 제조사 라우터 할당 시기는? (구현 후 활성화만 하면 됨)

---

## 📚 참고 파일

- `sql/router_inventory.sql` - 데이터베이스 스키마
- `types/router-inventory.ts` - TypeScript 타입
- `app/api/router-inventory/route.ts` - 메인 API
- `app/admin/order-management/page.tsx` - 발주 관리 페이지
- `app/admin/order-management/components/OrderDetailModal.tsx` - 발주 상세 모달

---

**생성일**: 2025-10-31
**작성자**: Claude Code
**상태**: 진행 중 (Phase 1-4 완료, Phase 5-7 대기)

## 📦 구현된 API 엔드포인트 목록

### 메인 API
- **GET** `/api/router-inventory` - 라우터 목록 조회 (필터, 검색, 페이지네이션, 통계)
- **POST** `/api/router-inventory` - 라우터 일괄 추가 (Excel 데이터)

### 개별 라우터 관리
- **GET** `/api/router-inventory/[id]` - 라우터 상세 조회
- **PUT** `/api/router-inventory/[id]` - 라우터 정보 수정
- **DELETE** `/api/router-inventory/[id]` - 라우터 삭제 (소프트 삭제)

### 출고 관리
- **POST** `/api/router-inventory/shipping` - 출고일 일괄 업데이트

### 할당 관리
- **POST** `/api/router-inventory/assign` - 라우터 할당
- **DELETE** `/api/router-inventory/assign?router_id={id}` - 라우터 할당 해제

### 통계
- **GET** `/api/router-inventory/stats` - 재고 통계 조회
