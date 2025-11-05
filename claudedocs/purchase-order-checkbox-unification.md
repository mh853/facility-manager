# 발주서 UI 통일성 개선 - 모든 필드 체크박스로 통일

## 완료일
2025-11-04

## 요약
발주서 생성 모달의 모든 선택 필드를 체크박스 형태로 통일하여 UI 일관성을 확보했습니다.

---

## 개선 사항

### 1. 입력 폼 (PurchaseOrderModal.tsx)

모든 선택 필드를 라디오 버튼에서 체크박스로 변경:

| 필드 | 이전 | 현재 |
|------|------|------|
| 온도센서 타입 | 라디오 버튼 | ✅ 체크박스 |
| 온도센서 길이 | 라디오 버튼 | ✅ 체크박스 |
| PH 인디게이터 부착위치 | 라디오 버튼 | ✅ 체크박스 |
| 결제조건 | 라디오 버튼 | ✅ 체크박스 |

### 2. 미리보기 (EcosensePurchaseOrderForm.tsx)

결제조건도 체크박스 형태로 표시하도록 변경:

**Before:**
```
결제조건*세금계산서 발행 후 7일 이내
결제방식: 선금5(발주기준) | 잔금5(납품완료기준)
```

**After:**
```
결제조건*세금계산서 발행 후 7일 이내
☑ 선금5(발주기준) | 잔금5(납품완료기준)
☐ 납품 후 완납(납품완료기준)
☐ 기타사항(선입금)
```

---

## 수정된 파일 (2개)

### 1. `app/admin/document-automation/components/PurchaseOrderModal.tsx`

#### 온도센서 타입
```tsx
{/* 온도센서 타입 */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-semibold text-gray-900 mb-4">온도센서 타입</h3>
  <div className="grid grid-cols-2 gap-4">
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editedData.temperature_sensor_type === 'flange'}
        onChange={(e) => setEditedData({ ...editedData, temperature_sensor_type: 'flange' })}
        className="w-4 h-4 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">프렌지타입</span>
    </label>
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editedData.temperature_sensor_type === 'nipple'}
        onChange={(e) => setEditedData({ ...editedData, temperature_sensor_type: 'nipple' })}
        className="w-4 h-4 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">니플(소켓)타입</span>
    </label>
  </div>
  <p className="text-sm text-blue-600 mt-2">* 기본값: 프렌지타입</p>
</div>
```

#### 결제조건
```tsx
{/* 결제조건 */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-semibold text-gray-900 mb-4">결제조건*세금계산서 발행 후 7일 이내</h3>
  <div className="space-y-2">
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editedData.payment_terms === 'prepay_5_balance_5'}
        onChange={(e) => setEditedData({ ...editedData, payment_terms: 'prepay_5_balance_5' })}
        className="w-4 h-4 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">선금5(발주기준) | 잔금5(납품완료기준)</span>
    </label>
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editedData.payment_terms === 'full_after_delivery'}
        onChange={(e) => setEditedData({ ...editedData, payment_terms: 'full_after_delivery' })}
        className="w-4 h-4 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">납품 후 완납(납품완료기준)</span>
    </label>
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editedData.payment_terms === 'other_prepaid'}
        onChange={(e) => setEditedData({ ...editedData, payment_terms: 'other_prepaid' })}
        className="w-4 h-4 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">기타사항(선입금)</span>
    </label>
  </div>
</div>
```

### 2. `components/EcosensePurchaseOrderForm.tsx`

#### 결제조건 미리보기
```tsx
{/* 결제조건 */}
<div className="section">
  <h2 className="section-title">결제조건*세금계산서 발행 후 7일 이내</h2>
  <div className="checkbox-group">
    <label className="checkbox-item">
      <input
        type="checkbox"
        checked={data.payment_terms === 'prepay_5_balance_5'}
        readOnly
      />
      <span>선금5(발주기준) | 잔금5(납품완료기준)</span>
    </label>
    <label className="checkbox-item">
      <input
        type="checkbox"
        checked={data.payment_terms === 'full_after_delivery'}
        readOnly
      />
      <span>납품 후 완납(납품완료기준)</span>
    </label>
    <label className="checkbox-item">
      <input
        type="checkbox"
        checked={data.payment_terms === 'other_prepaid'}
        readOnly
      />
      <span>기타사항(선입금)</span>
    </label>
  </div>
</div>
```

---

## UI 통일성 개선 효과

### Before (통일성 없음)
```
온도센서 타입:    ⦿ 프렌지타입  ○ 니플타입     (라디오 버튼)
온도센서 길이:    ⦿ 10CM  ○ 20CM  ○ 40CM      (라디오 버튼)
PH 인디게이터:    ⦿ 독립형  ○ 판넬  ○ 없음     (라디오 버튼)
결제조건:         ⦿ 선금5|잔금5  ○ 완납  ○ 기타 (라디오 버튼)
```

### After (모두 체크박스로 통일)
```
온도센서 타입:    ☑ 프렌지타입  ☐ 니플타입     (체크박스)
온도센서 길이:    ☑ 10CM  ☐ 20CM  ☐ 40CM      (체크박스)
PH 인디게이터:    ☑ 독립형  ☐ 판넬  ☐ 없음     (체크박스)
결제조건:         ☑ 선금5|잔금5  ☐ 완납  ☐ 기타 (체크박스)
```

**개선 효과:**
- ✅ 모든 선택 필드가 동일한 UI 패턴 사용
- ✅ Excel 파일의 체크박스(☑/☐) 표현과 일관성
- ✅ 사용자가 선택된 값을 시각적으로 명확하게 인식
- ✅ 미리보기와 입력 폼의 UI 일관성

---

## 전체 필드 요약

발주서 생성 모달의 모든 선택 필드:

| 순서 | 필드명 | 입력 방식 | 미리보기 방식 | 기본값 |
|------|--------|-----------|--------------|--------|
| 1 | 전류계 타입 | 숫자 입력 | 테이블 | - |
| 2 | 온도센서 타입 | ✅ 체크박스 | ✅ 체크박스 | 프렌지타입 |
| 3 | 온도센서 길이 | ✅ 체크박스 | ✅ 체크박스 | 10CM |
| 4 | PH 인디게이터 부착위치 | ✅ 체크박스 | ✅ 체크박스 | 독립형하이박스부착 |
| 5 | 결제조건 | ✅ 체크박스 | ✅ 체크박스 | - |
| 6 | 택배 주소 | 선택 드롭다운 | 텍스트 | - |

---

## 사용자 경험 개선

### 1. 시각적 통일성
- 모든 선택 필드가 체크박스 스타일로 표시됨
- Excel 파일과 동일한 UI 패턴 사용

### 2. 선택 상태 명확성
- 체크(☑)와 미체크(☐)가 명확히 구분됨
- 현재 선택된 값을 한눈에 파악 가능

### 3. 실시간 미리보기
- 입력 폼에서 선택한 값이 미리보기에 즉시 반영
- 미리보기에서도 동일한 체크박스 형태로 표시

---

## 테스트 시나리오

### 시나리오 1: 기본값 확인
1. 발주서 생성 모달 열기
2. **결과**:
   - 온도센서 타입: ☑ 프렌지타입
   - 온도센서 길이: ☑ 10CM
   - PH 인디게이터: ☑ 독립형하이박스부착
   - 결제조건: (선택 필요)

### 시나리오 2: 모든 필드 변경
1. 온도센서 타입: 니플(소켓)타입 선택
2. 온도센서 길이: 40CM 선택
3. PH 인디게이터: 방지시설판넬(타공) 선택
4. 결제조건: 선금5|잔금5 선택
5. **결과**: 미리보기에서 모든 변경사항이 체크박스로 표시됨 ✅

### 시나리오 3: Excel 파일 확인
1. 발주서 다운로드
2. Excel 파일 열기
3. **결과**: 선택한 항목들이 모두 체크(☑)로 표시됨 ✅

---

## 완료 ✅

모든 선택 필드를 체크박스 형태로 통일하여 UI 일관성을 확보했습니다:

1. ✅ 온도센서 타입: 라디오 버튼 → 체크박스
2. ✅ 온도센서 길이: 라디오 버튼 → 체크박스
3. ✅ PH 인디게이터 부착위치: 라디오 버튼 → 체크박스
4. ✅ 결제조건: 라디오 버튼 → 체크박스
5. ✅ 미리보기에서 결제조건도 체크박스로 표시

발주서 생성 모달의 UI가 완전히 통일되었습니다! 🎉
