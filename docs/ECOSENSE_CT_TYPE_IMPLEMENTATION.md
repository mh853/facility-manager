# 에코센스 발주서 - 전류계 타입 입력 기능 구현

## 📅 구현 일시
2025-11-03

## ✅ 완료된 작업

### 1. 전류계 타입 입력 UI 추가
**파일**: `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**기능**:
- 16L/24L/36L 수량 입력 필드 추가
- 실시간 합계 계산 및 표시
- 전체 전류계 수량을 초과하지 못하도록 검증
- 기본값: 16L에 전체 수량 자동 할당

**UI 구조**:
```typescript
<div className="bg-gray-50 rounded-lg p-4">
  <h3>전류계 타입 설정</h3>
  <div className="grid grid-cols-3 gap-4">
    <input type="number" value={ct_16l} />  {/* 16L 수량 */}
    <input type="number" value={ct_24l} />  {/* 24L 수량 */}
    <input type="number" value={ct_36l} />  {/* 36L 수량 */}
  </div>
  <p>전체 전류계 수량: {totalCt}개 (입력된 합계: {ct_16l + ct_24l + ct_36l}개)</p>
</div>
```

**입력 검증**:
- 각 필드는 0 이상의 값만 입력 가능
- 16L + 24L + 36L 합계가 전체 전류계 수량을 초과할 수 없음
- 초과 입력 시도 시 입력 무시 (상태 업데이트 안됨)

### 2. 발주서 폼 컴포넌트 업데이트
**파일**: `components/EcosensePurchaseOrderForm.tsx`

**변경사항**:
- "전류계 굵기" → "전류계 타입"으로 레이블 변경
- 테이블 구조 변경: 구분별 표시 → 타입별 표시
- 입력된 타입만 표시 (16L/24L/36L 중 수량 > 0인 것만)
- 타입 미지정 시 "16L (기본)"으로 전체 수량 표시

**이전**:
```typescript
<table>
  <thead>
    <tr><th>구분</th><th>16L</th><th>24L</th><th>36L</th></tr>
  </thead>
  <tbody>
    <tr><td>송풍+펌프</td><td>{fanPump}</td><td>0</td><td>0</td></tr>
    <tr><td>배출</td><td>{discharge}</td><td>0</td><td>0</td></tr>
  </tbody>
</table>
```

**현재**:
```typescript
<table>
  <thead>
    <tr><th>타입</th><th>수량</th></tr>
  </thead>
  <tbody>
    {ct_16l > 0 && <tr><td>16L</td><td>{ct_16l}</td></tr>}
    {ct_24l > 0 && <tr><td>24L</td><td>{ct_24l}</td></tr>}
    {ct_36l > 0 && <tr><td>36L</td><td>{ct_36l}</td></tr>}
    {/* 타입 미지정 시 기본 16L */}
    {!ct_16l && !ct_24l && !ct_36l && <tr><td>16L (기본)</td><td>{totalCt}</td></tr>}
  </tbody>
</table>
```

### 3. 타입 정의 업데이트
**파일**: `types/document-automation.ts`

**추가된 필드**:
```typescript
export interface PurchaseOrderDataEcosense extends PurchaseOrderData {
  // 기존 필드들...

  // 전류계 타입 (16L/24L/36L 수량 분배)
  ct_16l?: number // 16L 전류계 수량
  ct_24l?: number // 24L 전류계 수량
  ct_36l?: number // 36L 전류계 수량
}
```

### 4. 기본값 설정 로직
**파일**: `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**loadData 함수 수정**:
```typescript
const loadedData = result.data.data

// 에코센스 발주서인 경우 기본 CT 타입 설정 (16L)
if (loadedData.manufacturer === 'ecosense' || loadedData.manufacturer === '에코센스') {
  const totalCt =
    (loadedData.equipment?.discharge_ct || 0) +
    (loadedData.equipment?.fan_ct || 0) +
    (loadedData.equipment?.pump_ct || 0)

  // CT 타입이 설정되지 않은 경우 기본값으로 16L에 전체 수량 할당
  if (!loadedData.ct_16l && !loadedData.ct_24l && !loadedData.ct_36l) {
    loadedData.ct_16l = totalCt
    loadedData.ct_24l = 0
    loadedData.ct_36l = 0
  }
}
```

### 5. 택배 주소 선택 기능 개선
**파일**: `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**handleDeliveryAddressChange 함수 수정**:
```typescript
const handleDeliveryAddressChange = (addressId: string) => {
  setSelectedDeliveryAddress(addressId)
  const selectedAddr = deliveryAddresses.find(addr => addr.id === addressId)

  if (selectedAddr && editedData) {
    // 에코센스 발주서인 경우 상세 정보 모두 업데이트
    if (editedData.manufacturer === 'ecosense' || editedData.manufacturer === '에코센스') {
      setEditedData({
        ...editedData,
        delivery_address: selectedAddr.address,
        delivery_recipient: selectedAddr.recipient,
        delivery_contact: selectedAddr.phone,
        delivery_postal_code: selectedAddr.postal_code,
        delivery_full_address: `${selectedAddr.postal_code ? `[${selectedAddr.postal_code}] ` : ''}${selectedAddr.address}`,
        delivery_address_detail: selectedAddr.address_detail || ''
      } as PurchaseOrderDataEcosense)
    } else {
      setEditedData({
        ...editedData,
        delivery_address: selectedAddr.address
      })
    }
  }
}
```

## 📊 데이터 흐름

```
1. 발주서 모달 열기
   ↓
2. loadData() 호출
   - API에서 사업장 데이터 조회
   - 전류계 수량 계산 (discharge + fan + pump)
   - ct_16l/ct_24l/ct_36l 미설정 시 기본값 할당
   ↓
3. 사용자가 전류계 타입 입력
   - 16L/24L/36L 수량 직접 입력
   - 합계가 전체를 초과하지 않도록 검증
   ↓
4. 미리보기 영역 실시간 업데이트
   - 입력한 타입만 표시
   - 타입 미지정 시 "16L (기본)" 표시
   ↓
5. 발주서 다운로드
   - editedData를 API로 전송
   - ct_16l/ct_24l/ct_36l 값 포함
```

## 🎯 주요 로직

### 전류계 총 수량 계산
```typescript
const totalCt =
  ((editedData as any).equipment?.discharge_ct || 0) +
  ((editedData as any).equipment?.fan_ct || 0) +
  ((editedData as any).equipment?.pump_ct || 0)
```

### 입력 검증 (초과 방지)
```typescript
const ct16l = Math.max(0, Number(e.target.value))
const ct24l = (editedData as PurchaseOrderDataEcosense).ct_24l || 0
const ct36l = (editedData as PurchaseOrderDataEcosense).ct_36l || 0

// 합계가 전체를 초과하지 않도록
if (ct16l + ct24l + ct36l <= totalCt) {
  setEditedData({
    ...editedData,
    ct_16l: ct16l
  } as PurchaseOrderDataEcosense)
}
```

### 조건부 렌더링
```typescript
{(data.ct_16l || 0) > 0 && (
  <tr>
    <td>16L</td>
    <td className="text-center">{data.ct_16l}</td>
  </tr>
)}

{/* 타입이 지정되지 않은 경우 기본 16L로 표시 */}
{(data.ct_16l || 0) === 0 && (data.ct_24l || 0) === 0 && (data.ct_36l || 0) === 0 && (
  <tr>
    <td>16L (기본)</td>
    <td className="text-center">{totalCtCount}</td>
  </tr>
)}
```

## 🧪 테스트 시나리오

### 시나리오 1: 기본 동작 (16L)
```
1. 에코센스 사업장 선택
2. 발주서 생성 모달 열기
3. 전류계 타입 확인
   - 16L: 전체 수량 (예: 5개)
   - 24L: 0개
   - 36L: 0개
4. 미리보기 확인
   - "전류계 타입" 섹션
   - "16L (기본): 5개" 표시
```

### 시나리오 2: 혼합 타입 입력
```
1. 전류계 타입 설정
   - 16L: 3개 입력
   - 24L: 2개 입력
   - 36L: 0개
2. 합계 확인
   - "입력된 합계: 5개" 표시
3. 미리보기 확인
   - "16L: 3" 표시
   - "24L: 2" 표시
   - 36L은 표시 안됨 (0개이므로)
```

### 시나리오 3: 초과 입력 방지
```
1. 전체 전류계 수량: 5개
2. 16L에 4개 입력
3. 24L에 3개 입력 시도
   → 입력 무시 (4 + 3 = 7 > 5)
4. 24L에 1개 입력
   → 정상 입력 (4 + 1 = 5)
5. 36L에 1개 입력 시도
   → 입력 무시 (4 + 1 + 1 = 6 > 5)
```

### 시나리오 4: 택배 주소 선택
```
1. 택배 주소 드롭다운에서 주소 선택
2. 선택한 주소 정보 자동 입력 확인
   - delivery_full_address 업데이트
   - delivery_recipient 업데이트
   - delivery_contact 업데이트
3. 미리보기에서 택배 주소 확인
```

## 🚀 사용 방법

### 1. 발주서 생성 모달 열기
```
http://localhost:3001/admin/document-automation
→ 발주서 관리 탭
→ 에코센스 사업장 선택
→ "발주서 생성" 버튼 클릭
```

### 2. 전류계 타입 설정
```
"전류계 타입 설정" 섹션에서:
- 16L 수량 입력
- 24L 수량 입력
- 36L 수량 입력

주의사항:
- 합계가 전체 전류계 수량을 초과할 수 없음
- 음수 입력 불가
```

### 3. 택배 주소 선택
```
"택배 주소" 드롭다운:
- 저장된 주소 중 선택
- 또는 "직접 입력" 선택하여 수동 입력
```

### 4. 미리보기 확인
```
"에코센스 발주서 미리보기" 영역:
- 실시간으로 입력 내용 반영
- 전류계 타입 섹션 확인
- 택배 주소 확인
```

### 5. 발주서 다운로드
```
"발주서 다운로드" 버튼 클릭
→ Excel 파일 생성 및 다운로드
```

## 📝 관련 파일

### 수정된 파일
- `app/admin/document-automation/components/PurchaseOrderModal.tsx` (전류계 타입 입력 UI, 택배 주소 개선)
- `components/EcosensePurchaseOrderForm.tsx` (전류계 타입 표시 변경)
- `types/document-automation.ts` (ct_16l/ct_24l/ct_36l 필드 추가)

### 기존 파일 (변경 없음)
- `app/api/document-automation/purchase-order/route.ts` (API)
- `app/api/delivery-addresses/route.ts` (택배 주소 API)
- `app/admin/document-automation/page.tsx` (메인 페이지)

## 🐛 알려진 이슈 및 해결

### Issue 1: 휴대전화 번호 미표시
**문제**: 블루온 담당자 휴대전화 번호가 DB에서 조회되지 않음
**상태**: 디버그 로깅 추가 완료, DB 데이터 확인 필요
**해결 방법**:
```typescript
console.log('[PURCHASE-ORDER] 사용자 정보 조회:', {
  userId: user.id,
  userData,
  userError
})
```
서버 로그 확인하여 `userData.phone` 값이 실제로 조회되는지 검증 필요

### Issue 2: 택배 주소 반영 안됨
**문제**: 택배 주소 선택 시 발주서에 반영되지 않음
**해결**: handleDeliveryAddressChange 함수에서 에코센스 발주서인 경우 상세 정보 모두 업데이트하도록 수정
**상태**: 해결 완료

### Issue 3: 전류계 굵기 → 타입 변경
**문제**: "전류계 굵기" 표현이 부정확
**해결**: "전류계 타입"으로 변경하고 입력 가능하게 수정
**상태**: 해결 완료

## ✅ 완료 체크리스트

- [x] 전류계 타입 입력 UI 구현 (16L/24L/36L)
- [x] 기본값 설정 로직 (16L에 전체 수량)
- [x] 입력 검증 (합계가 전체를 초과하지 않도록)
- [x] 실시간 합계 표시
- [x] 발주서 폼에 "전류계 타입" 섹션 업데이트
- [x] 조건부 렌더링 (입력된 타입만 표시)
- [x] 타입 정의 업데이트 (ct_16l/ct_24l/ct_36l)
- [x] 택배 주소 선택 기능 개선
- [ ] 휴대전화 번호 표시 이슈 해결 (DB 데이터 확인 필요)
- [ ] 전체 기능 테스트

## 🎉 성과

1. **사용자 편의성 향상**: 전류계 타입을 직접 입력할 수 있어 다양한 조합 가능
2. **데이터 정확성**: 입력 검증으로 잘못된 수량 입력 방지
3. **UI 개선**: 실시간 합계 표시로 사용자에게 명확한 피드백 제공
4. **확장성**: 새로운 타입 추가 시 쉽게 확장 가능한 구조
5. **택배 주소 통합**: 저장된 주소 재사용으로 입력 편의성 증대

## 🔮 향후 개선 사항

### 1. 자동 분배 기능
```typescript
// 전체 수량을 타입별로 자동 분배
const autoDistribute = (totalCt: number) => {
  // 예: 7개 → 16L: 5개, 24L: 2개
  return {
    ct_16l: Math.ceil(totalCt * 0.7),
    ct_24l: Math.floor(totalCt * 0.3),
    ct_36l: 0
  }
}
```

### 2. 타입별 단가 적용
```typescript
// 타입별로 다른 단가 적용
const ctPrices = {
  '16L': 50000,
  '24L': 60000,
  '36L': 70000
}
```

### 3. 타입 프리셋 저장
```typescript
// 자주 사용하는 타입 조합 저장
const presets = [
  { name: '기본 (16L)', ct_16l: 100, ct_24l: 0, ct_36l: 0 },
  { name: '혼합 (16L+24L)', ct_16l: 70, ct_24l: 30, ct_36l: 0 }
]
```

### 4. 타입별 재고 확인
```typescript
// 재고 확인 후 입력 가능 수량 표시
const checkStock = async (type: '16L' | '24L' | '36L') => {
  // 재고 조회 API 호출
  return availableQuantity
}
```
