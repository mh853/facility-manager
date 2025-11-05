# 발주서 데이터 오류 수정

## 완료일
2025-11-04

## 요약
Excel 발주서 생성 시 하드코딩된 데이터를 실제 데이터로 변경하고, 잘못 매핑된 이메일 주소를 수정했습니다.

---

## 수정된 문제

### 1. 하드코딩된 담당자명 제거
**문제**: 블루온 담당자명이 '김문수'로 하드코딩되어 있음
**해결**: 실제 로그인한 담당자명(`data.manager_name`) 사용

**영향 받는 셀:**
- `AF3`: 헤더 담당자명
- `K53`: 하단 블루온 담당자명

### 2. 사업장 담당자 이메일 오류 수정
**문제**: 사업장 담당자 이메일 위치(`AO21`)에 블루온 담당자 이메일이 들어감
**해결**: 사업장 담당자 이메일(`data.factory_email`) 사용

**영향 받는 셀:**
- `AO21`: 사업장 담당자 이메일 (21행)

### 3. 미리보기 동적 품목 표시
**확인**: 미리보기는 이미 동적으로 품목들을 표시하고 있음
**로직**: 수량이 0보다 큰 항목만 필터링하여 테이블에 표시

---

## 수정된 파일

### `lib/document-generators/excel-generator-ecosense-template.ts`

#### Before (하드코딩)
```typescript
// 블루온 담당자 정보
worksheet.getCell('AF3').value = '김문수'  // ❌ 하드코딩
worksheet.getCell('K53').value = '김문수'  // ❌ 하드코딩
worksheet.getCell('U53').value = data.manager_contact || '010-4320-3521'
worksheet.getCell('AJ53').value = data.manager_email || 'seoh1521@gmail.com'

// 사업장 및 담당자 정보
worksheet.getCell('K21').value = data.factory_name || data.business_name
worksheet.getCell('U21').value = data.factory_manager || data.manager_name || ''
worksheet.getCell('AE21').value = data.factory_contact || data.manager_contact || ''

const emailValue = data.manager_email || 'seoh1521@gmail.com'  // ❌ 블루온 이메일
worksheet.getCell('AO21').value = emailValue
```

#### After (동적 데이터)
```typescript
// 블루온 담당자 정보
worksheet.getCell('AF3').value = data.manager_name || '담당자'  // ✅ 동적
worksheet.getCell('K53').value = data.manager_name || '담당자'  // ✅ 동적
worksheet.getCell('U53').value = data.manager_contact || ''
worksheet.getCell('AJ53').value = data.manager_email || ''

// 사업장 및 담당자 정보
worksheet.getCell('K21').value = data.factory_name || data.business_name
worksheet.getCell('U21').value = data.factory_manager || ''  // ✅ 사업장 담당자만
worksheet.getCell('AE21').value = data.factory_contact || ''

// 사업장 담당자 이메일 (블루온 담당자 이메일이 아님!)
const emailValue = data.factory_email || ''  // ✅ 사업장 이메일
worksheet.getCell('AO21').value = emailValue
console.log('[ECOSENSE-TEMPLATE] AO21 이메일 설정:', {
  factory_email: data.factory_email,
  final_value: emailValue
})
```

---

## Excel 셀 매핑 정리

### 블루온 담당자 정보
| 셀 위치 | 항목 | 데이터 | 비고 |
|---------|------|--------|------|
| AF3 | 헤더 담당자 | `data.manager_name` | ⭐ 수정 |
| K53 | 하단 담당자명 | `data.manager_name` | ⭐ 수정 |
| U53 | 담당자 연락처 | `data.manager_contact` | - |
| AJ53 | 담당자 이메일 | `data.manager_email` | - |

### 사업장 담당자 정보 (21행)
| 셀 위치 | 항목 | 데이터 | 비고 |
|---------|------|--------|------|
| K21 | 사업장명 | `data.factory_name` | - |
| U21 | 사업장 담당자명 | `data.factory_manager` | ⭐ 수정 |
| AE21 | 사업장 연락처 | `data.factory_contact` | - |
| AO21 | 사업장 이메일 | `data.factory_email` | ⭐ 수정 |

### 품목 항목 (12-13행)
| 행 | 내용 | 로직 |
|----|------|------|
| 12행 | 품목명 | 수량이 0보다 큰 항목만 표시 |
| 13행 | 수량 | 해당 품목의 수량 |

**동적 컬럼 매핑:**
- H열: PH센서
- N열: 차압계
- T열: 온도계
- Z열: 게이트웨이
- AF열: VPN(유선)
- AL열: VPN(무선)
- AR열: 확장디바이스

---

## 미리보기 동적 품목 표시

### EcosensePurchaseOrderForm.tsx

**이미 구현된 동적 표시 로직:**

```typescript
// 품목 항목 필터링 (수량이 0보다 큰 것만)
const equipmentItems = [
  { name: 'PH센서', count: data.equipment.ph_sensor || 0 },
  { name: '차압계', count: data.equipment.differential_pressure_meter || 0 },
  { name: '온도계', count: data.equipment.temperature_meter || 0 },
  { name: '전류계', count: totalCtCount },  // 전류계 합산값
  { name: '게이트웨이', count: data.equipment.gateway || 0 },
  { name: 'VPN(유선)', count: data.equipment.vpn_router_wired || 0 },
  { name: 'VPN(무선)', count: data.equipment.vpn_router_wireless || 0 },
  { name: '확장디바이스', count: data.equipment.expansion_device || 0 }
].filter(item => item.count > 0)  // ✅ 수량이 0보다 큰 것만 표시
```

**테이블 렌더링:**
```tsx
<table className="items-table">
  <thead>
    <tr>
      <th>구분</th>
      {equipmentItems.map((item, index) => (
        <th key={index}>{item.name}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="row-header">수량</td>
      {equipmentItems.map((item, index) => (
        <td key={index} className="text-center">{item.count}</td>
      ))}
    </tr>
  </tbody>
</table>
```

---

## 수정 전후 비교

### 시나리오 1: 사용자 "홍길동"이 발주서 생성

#### Before
```
[헤더]
담당자: 김문수  ❌

[사업장 정보 - 21행]
사업장명: ABC 공장
담당자명: 김철수
연락처: 010-1234-5678
이메일: hong@blueon.com  ❌ (블루온 담당자 이메일)

[하단 블루온 담당자 - 53행]
담당자: 김문수  ❌
연락처: 010-4320-3521
이메일: seoh1521@gmail.com
```

#### After
```
[헤더]
담당자: 홍길동  ✅

[사업장 정보 - 21행]
사업장명: ABC 공장
담당자명: 김철수
연락처: 010-1234-5678
이메일: abc@factory.com  ✅ (사업장 담당자 이메일)

[하단 블루온 담당자 - 53행]
담당자: 홍길동  ✅
연락처: 010-1111-2222
이메일: hong@blueon.com
```

### 시나리오 2: 품목 동적 표시

#### 사업장 A (PH센서 2개, 게이트웨이 1개만 있음)
```
[12-13행]
구분      | PH센서 | 게이트웨이
수량      | 2      | 1

✅ 수량이 0인 항목들은 표시되지 않음
```

#### 사업장 B (모든 품목 있음)
```
[12-13행]
구분 | PH센서 | 차압계 | 온도계 | 게이트웨이 | VPN(유선) | VPN(무선) | 확장디바이스
수량 | 3      | 2      | 2      | 1          | 1         | 0         | 1

✅ VPN(무선) 수량이 0이면 해당 컬럼은 표시되지 않음
```

---

## 테스트 시나리오

### 테스트 1: 담당자명 확인
1. 사용자 "홍길동"으로 로그인
2. 발주서 생성
3. Excel 다운로드
4. **결과**: AF3, K53에 "홍길동" 표시됨 ✅

### 테스트 2: 이메일 확인
1. 사업장 담당자 이메일: `factory@test.com`
2. 블루온 담당자 이메일: `blueon@test.com`
3. Excel 다운로드
4. **결과**:
   - AO21: `factory@test.com` ✅
   - AJ53: `blueon@test.com` ✅

### 테스트 3: 동적 품목 표시
1. PH센서 2개, 게이트웨이 1개만 선택
2. 미리보기 확인
3. **결과**: 테이블에 PH센서, 게이트웨이 컬럼만 표시됨 ✅

---

## 주의사항

1. **기본값 처리**: 데이터가 없는 경우 빈 문자열로 표시됨 (하드코딩 제거)
2. **사업장 vs 블루온**:
   - 21행: 사업장 담당자 정보
   - 53행: 블루온 담당자 정보
3. **품목 필터링**: `filter(item => item.count > 0)` 로직으로 수량이 0인 항목 제외

---

## 완료 ✅

모든 하드코딩된 데이터를 제거하고 동적 데이터로 변경했습니다:

1. ✅ 담당자명 '김문수' 하드코딩 제거 → `data.manager_name` 사용
2. ✅ 사업장 이메일 오류 수정 → `data.factory_email` 사용
3. ✅ 미리보기 동적 품목 표시 확인 (이미 구현되어 있음)

Excel 발주서가 이제 정확한 데이터로 생성됩니다! 🎉
