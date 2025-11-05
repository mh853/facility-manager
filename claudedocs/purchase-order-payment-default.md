# 발주서 결제조건 기본값 설정

## 완료일
2025-11-04

## 요약
발주서 생성 모달에서 결제조건의 기본값을 "기타사항(선입금)"으로 설정했습니다.

---

## 변경 사항

### 결제조건 기본값 설정
- **이전**: 기본값 없음 (사용자가 반드시 선택해야 함)
- **현재**: **기타사항(선입금)** 자동 선택 ⭐

---

## 수정된 파일 (3개)

### 1. `app/admin/document-automation/components/PurchaseOrderModal.tsx`

#### 기본값 설정 로직
```typescript
// 기본값 설정
if (!loadedData.temperature_sensor_type) {
  loadedData.temperature_sensor_type = 'flange'
}
if (!loadedData.temperature_sensor_length) {
  loadedData.temperature_sensor_length = '10cm'
}
if (!loadedData.ph_indicator_location) {
  loadedData.ph_indicator_location = 'independent_box'
}
if (!loadedData.payment_terms) {
  loadedData.payment_terms = 'other_prepaid'  // ⭐ 추가
}
```

#### UI 표시
```tsx
{/* 결제조건 */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-semibold text-gray-900 mb-4">결제조건*세금계산서 발행 후 7일 이내</h3>
  <div className="space-y-2">
    {/* ... 체크박스들 ... */}
  </div>
  <p className="text-sm text-blue-600 mt-2">* 기본값: 기타사항(선입금)</p>
</div>
```

### 2. `lib/document-generators/excel-generator-ecosense-template.ts`

#### Excel 생성 시 기본값 적용
```typescript
// ============================================================================
// 결제조건*세금계산서 발행 후 7일 이내 (50행)
// ============================================================================
// U50(선금5|잔금5), AE50(납품 후 완납), AO50(기타사항-선입금)
// 기본값: 기타사항(선입금)
const paymentTerms = data.payment_terms || 'other_prepaid'

worksheet.getCell('U50').value = paymentTerms === 'prepay_5_balance_5' ? '☑' : '☐'
worksheet.getCell('AE50').value = paymentTerms === 'full_after_delivery' ? '☑' : '☐'
worksheet.getCell('AO50').value = paymentTerms === 'other_prepaid' ? '☑' : '☐'
```

### 3. `types/document-automation.ts`

#### 타입 정의 주석 업데이트
```typescript
// 결제조건*세금계산서 발행 후 7일 이내
payment_terms?: 'prepay_5_balance_5' | 'full_after_delivery' | 'other_prepaid'
// 선금5(발주기준)|잔금5(납품완료기준) / 납품 후 완납(납품완료기준) / 기타사항(선입금) (기본값: other_prepaid)
```

---

## 업데이트된 기본값 정책

| 필드 | 기본값 | 변경 여부 |
|------|--------|----------|
| 온도센서 타입 | 프렌지타입 | 유지 |
| 온도센서 길이 | 10CM | 유지 |
| PH 인디게이터 부착위치 | 독립형하이박스부착 | 유지 |
| **결제조건** | **기타사항(선입금)** | ⭐ **NEW** |

---

## 사용자 경험 개선

### Before (기본값 없음)
```
발주서 모달 열기
→ 결제조건: (선택 필요)
→ 사용자가 반드시 선택해야 함
```

### After (기본값 자동 선택)
```
발주서 모달 열기
→ 결제조건: ☑ 기타사항(선입금) [자동 선택됨]
→ 필요시 다른 옵션으로 변경 가능
```

**개선 효과:**
- ✅ 사용자가 별도로 선택하지 않아도 기본값으로 처리됨
- ✅ 가장 많이 사용되는 옵션이 자동 선택되어 편의성 향상
- ✅ Excel 파일 생성 시에도 기본값이 자동으로 체크됨

---

## 모달 오픈 시 자동 선택되는 기본값 전체

발주서 생성 모달을 열면 다음 값들이 자동으로 선택됩니다:

1. ✅ **온도센서 타입**: 프렌지타입
2. ✅ **온도센서 길이**: 10CM
3. ✅ **PH 인디게이터 부착위치**: 독립형하이박스부착
4. ✅ **결제조건**: 기타사항(선입금) ⭐ NEW

---

## 테스트 시나리오

### 시나리오 1: 기본값 확인
1. 발주서 생성 모달 열기
2. **결과**:
   - 온도센서 타입: ☑ 프렌지타입
   - 온도센서 길이: ☑ 10CM
   - PH 인디게이터: ☑ 독립형하이박스부착
   - **결제조건: ☑ 기타사항(선입금)** ⭐

### 시나리오 2: 기본값으로 발주서 생성
1. 모달 열기
2. 아무것도 변경하지 않고 "발주서 다운로드" 클릭
3. **결과**:
   - Excel 파일 생성됨
   - 50행: ☐ 선금5|잔금5, ☐ 납품완납, **☑ 기타사항(선입금)**

### 시나리오 3: 기본값 변경
1. 모달 열기
2. 결제조건에서 "선금5|잔금5" 선택
3. **결과**:
   - ☑ 선금5|잔금5
   - ☐ 납품완납
   - ☐ 기타사항(선입금)

---

## Excel 파일 매핑

```
@_발주서(에코센스_KT무선)_250701.xlsx

[ 50행 ] 결제조건*세금계산서 발행 후 7일 이내
         U50: 선금5|잔금5 ☐
         AE50: 납품완납 ☐
         AO50: 기타사항(선입금) ☑ (기본값)
```

---

## 완료 ✅

결제조건의 기본값이 성공적으로 설정되었습니다:

1. ✅ PurchaseOrderModal.tsx에 기본값 로직 추가
2. ✅ 모달에서 "* 기본값: 기타사항(선입금)" 표시 추가
3. ✅ Excel 생성기에 기본값 주석 추가
4. ✅ 타입 정의 파일에 기본값 문서화

이제 모든 입력 필드에 기본값이 설정되어 사용자 편의성이 크게 향상되었습니다! 🎉
