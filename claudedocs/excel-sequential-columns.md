# Excel 발주서 품목 순차 배치 개선

## 완료일
2025-11-04

## 요약
Excel 발주서에서 품목을 왼쪽부터 순서대로 빈칸 없이 배치하도록 개선했습니다.

---

## 문제점

### Before (기존 방식)
품목이 **고정된 컬럼 위치**에 배치되어 중간에 빈칸 발생:

```
예시: PH센서 3개, 온도계 1개, VPN(유선) 1개만 있는 경우

구분 | H열     | N열  | T열    | Z열  | AF열       | AL열 | AR열
-----|---------|------|--------|------|------------|------|------
품목 | PH센서  | (빈) | 온도계 | (빈) | VPN(유선)  | (빈) | (빈)
수량 | 3       | (빈) | 1      | (빈) | 1          | (빈) | (빈)
```

**문제**: H, T, AF열만 채워지고 N, Z, AL, AR열은 비어있음

---

## 해결 방법

### After (개선 방식)
수량이 있는 품목을 **왼쪽부터 순서대로** 빈칸 없이 배치:

```
예시: PH센서 3개, 온도계 1개, VPN(유선) 1개만 있는 경우

구분 | H열     | N열    | T열        | Z열  | AF열 | AL열 | AR열
-----|---------|--------|------------|------|------|------|------
품목 | PH센서  | 온도계 | VPN(유선)  | (빈) | (빈) | (빈) | (빈)
수량 | 3       | 1      | 1          | (빈) | (빈) | (빈) | (빈)
```

**개선**: H, N, T열에 연속으로 채워지고 빈칸은 오른쪽으로 몰림

---

## 구현 변경사항

### 파일
`lib/document-generators/excel-generator-ecosense-template.ts`

### Before (고정 위치 배치)
```typescript
const equipmentItems = [
  { col: 'H', name: 'PH센서', count: Number(data.equipment.ph_sensor) || 0 },
  { col: 'N', name: '차압계', count: Number(data.equipment.differential_pressure_meter) || 0 },
  // ... 등등
]

equipmentItems.forEach(item => {
  if (item.count > 0) {
    worksheet.getCell(`${item.col}12`).value = item.name  // ❌ 고정된 컬럼
    worksheet.getCell(`${item.col}13`).value = item.count
  }
})
```

**문제**: 각 품목이 미리 정해진 컬럼에만 배치됨

### After (순차 배치)
```typescript
// 1단계: 모든 품목 데이터 준비
const allEquipmentItems = [
  { name: 'PH센서', count: Number(data.equipment.ph_sensor) || 0 },
  { name: '차압계', count: Number(data.equipment.differential_pressure_meter) || 0 },
  { name: '온도계', count: Number(data.equipment.temperature_meter) || 0 },
  { name: '게이트웨이', count: Number(data.equipment.gateway) || 0 },
  { name: 'VPN(유선)', count: Number(data.equipment.vpn_router_wired) || 0 },
  { name: 'VPN(무선)', count: Number(data.equipment.vpn_router_wireless) || 0 },
  { name: '확장디바이스', count: Number(data.equipment.expansion_device) || 0 }
]

// 2단계: 수량이 0보다 큰 항목만 필터링
const validItems = allEquipmentItems.filter(item => item.count > 0)

// 3단계: 왼쪽부터 순서대로 빈칸 없이 배치
const allColumns = ['H', 'N', 'T', 'Z', 'AF', 'AL', 'AR']
validItems.forEach((item, index) => {
  if (index < allColumns.length) {
    const col = allColumns[index]  // ✅ 인덱스 순서대로 컬럼 할당
    worksheet.getCell(`${col}12`).value = item.name
    worksheet.getCell(`${col}13`).value = item.count
  }
})
```

**핵심 로직**:
1. `filter(item => item.count > 0)`: 수량이 있는 항목만 선택
2. `forEach((item, index)`: 필터링된 항목을 순서대로 처리
3. `allColumns[index]`: 왼쪽부터 순차적으로 컬럼 할당

---

## 동작 예시

### 사례 1: 3개 품목만 있는 경우

**입력**:
- PH센서: 3개
- 차압계: 0개 ← 없음
- 온도계: 1개
- 게이트웨이: 0개 ← 없음
- VPN(유선): 1개
- VPN(무선): 0개 ← 없음
- 확장디바이스: 0개 ← 없음

**Before (기존)**:
```
H(PH센서:3) | N(빈) | T(온도계:1) | Z(빈) | AF(VPN유선:1) | AL(빈) | AR(빈)
```

**After (개선)**:
```
H(PH센서:3) | N(온도계:1) | T(VPN유선:1) | Z(빈) | AF(빈) | AL(빈) | AR(빈)
```

### 사례 2: 모든 품목이 있는 경우

**입력**:
- 모든 품목에 수량 있음

**Before & After (동일)**:
```
H(PH센서) | N(차압계) | T(온도계) | Z(게이트웨이) | AF(VPN유선) | AL(VPN무선) | AR(확장디바이스)
```

**결과**: 모든 품목이 있으면 기존과 동일

### 사례 3: 1개 품목만 있는 경우

**입력**:
- 게이트웨이: 1개만
- 나머지: 모두 0개

**Before**:
```
H(빈) | N(빈) | T(빈) | Z(게이트웨이:1) | AF(빈) | AL(빈) | AR(빈)
```

**After**:
```
H(게이트웨이:1) | N(빈) | T(빈) | Z(빈) | AF(빈) | AL(빈) | AR(빈)
```

---

## 개선 효과

### ✅ 장점

1. **깔끔한 레이아웃**: 품목이 왼쪽부터 연속으로 배치됨
2. **가독성 향상**: 빈칸이 오른쪽으로 몰려 테이블이 깔끔해짐
3. **일관된 위치**: 첫 번째 품목은 항상 H열에 표시됨
4. **유연성**: 품목 개수에 관계없이 왼쪽부터 채워짐

### ⚠️ 주의사항

1. **품목 위치 변경**: 같은 품목이라도 다른 품목의 유무에 따라 컬럼이 달라질 수 있음
   ```
   사업장 A: H(PH센서) | N(온도계) | T(게이트웨이)
   사업장 B: H(PH센서) | N(게이트웨이) | T(빈)  ← 온도계 없음
   ```

2. **템플릿 의존성**: Excel 템플릿이 최대 7개 컬럼을 지원해야 함

---

## 테스트 시나리오

### 테스트 1: 일부 품목만
**입력**: PH센서 2개, 게이트웨이 1개
**결과**:
```
H열: PH센서(2)
N열: 게이트웨이(1)
T~AR열: 빈칸
```
✅ 왼쪽부터 빈칸 없이 채워짐

### 테스트 2: 모든 품목
**입력**: 모든 품목 1개씩
**결과**:
```
H~AR열: 모두 채워짐
```
✅ 7개 컬럼 모두 사용됨

### 테스트 3: 품목 없음
**입력**: 모든 품목 0개
**결과**:
```
H~AR열: 모두 빈칸
```
✅ 정상 동작

### 테스트 4: 역순 품목
**입력**: 확장디바이스 1개만 (마지막 품목)
**결과**:
```
H열: 확장디바이스(1)  ← 왼쪽 첫 번째 컬럼에 배치됨
N~AR열: 빈칸
```
✅ 마지막 품목도 H열부터 시작

---

## Before/After 비교

### 스크린샷 문제점
```
구분 | (빈칸) | 차압계 | 온도계 | 게이트웨이 | (빈칸) | VPN(무선) | (빈칸)
수량 |   -    |   1    |   1    |     1      |   -    |     1     |   -
```

**문제**: 빈칸들이 중간에 섞여 있음

### 개선 후
```
구분 | 차압계 | 온도계 | 게이트웨이 | VPN(무선) | (빈칸) | (빈칸) | (빈칸)
수량 |   1    |   1    |     1      |     1     |   -    |   -    |   -
```

**개선**: 품목들이 왼쪽부터 연속으로 채워지고 빈칸은 오른쪽에만

---

## 완료 ✅

품목 배치 로직을 개선했습니다:

1. ✅ 수량이 있는 품목만 필터링
2. ✅ 왼쪽부터 순서대로 배치 (H → N → T → Z → AF → AL → AR)
3. ✅ 빈칸은 오른쪽으로 몰림
4. ✅ 깔끔하고 가독성 좋은 테이블 생성

이제 Excel 발주서의 품목 테이블이 훨씬 깔끔하게 표시됩니다! 🎉
