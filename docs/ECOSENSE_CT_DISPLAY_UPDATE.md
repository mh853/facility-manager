# 에코센스 발주서 - 전류계 표시 방식 복원

## 📅 수정 일시
2025-11-03

## 🔄 변경 사항

### 1. 전류계 표시 방식 변경
**변경 전**: "전류계 타입" - 타입별로 수량만 표시 (16L: 3, 24L: 2)
**변경 후**: "전류계 굵기" - 구분별로 16L/24L/36L 표시 (송풍+펌프 / 배출)

### 2. DB 컬럼 변경
**변경 전**: `users.phone` 컬럼 조회
**변경 후**: `users.mobile` 컬럼 조회

## ✅ 수정된 파일

### 1. `components/EcosensePurchaseOrderForm.tsx`

**변경 내용**:
- "전류계 타입" → "전류계 굵기"로 레이블 변경
- 테이블 구조 변경: 타입별 표시 → 구분별 표시

**이전 코드**:
```typescript
<h2 className="section-title">전류계 타입</h2>
<table className="ct-table">
  <thead>
    <tr>
      <th>타입</th>
      <th>수량</th>
    </tr>
  </thead>
  <tbody>
    {(data.ct_16l || 0) > 0 && (
      <tr>
        <td>16L</td>
        <td className="text-center">{data.ct_16l}</td>
      </tr>
    )}
    {(data.ct_24l || 0) > 0 && (
      <tr>
        <td>24L</td>
        <td className="text-center">{data.ct_24l}</td>
      </tr>
    )}
  </tbody>
</table>
```

**현재 코드**:
```typescript
<h2 className="section-title">전류계 굵기</h2>
<table className="ct-table">
  <thead>
    <tr>
      <th>구분</th>
      <th>16L</th>
      <th>24L</th>
      <th>36L</th>
    </tr>
  </thead>
  <tbody>
    {fanPumpTotal > 0 && (
      <tr>
        <td>송풍+펌프 전류계</td>
        <td className="text-center">{data.ct_16l || fanPumpTotal}</td>
        <td className="text-center">{data.ct_24l || 0}</td>
        <td className="text-center">{data.ct_36l || 0}</td>
      </tr>
    )}
    {dischargeCt > 0 && (
      <tr>
        <td>배출 전류계</td>
        <td className="text-center">{dischargeCt}</td>
        <td className="text-center">0</td>
        <td className="text-center">0</td>
      </tr>
    )}
  </tbody>
</table>
```

**주요 변경점**:
- 송풍+펌프 전류계: `ct_16l/ct_24l/ct_36l` 값 사용, 미설정 시 기본값 표시
- 배출 전류계: 항상 16L로 고정 표시
- 입력된 굵기 설정이 있으면 우선 적용

### 2. `app/admin/document-automation/components/PurchaseOrderModal.tsx`

**변경 내용**:
- "전류계 타입 설정" → "송풍+펌프 전류계 굵기 설정"으로 레이블 변경
- 검증 로직 변경: 전체 전류계 수량 → 송풍+펌프 수량만
- 안내 문구 추가: "배출 전류계는 항상 16L로 표시됩니다"

**이전 코드**:
```typescript
<h3>전류계 타입 설정</h3>
<p className="text-sm text-gray-500 mt-2">
  전체 전류계 수량: {totalCt}개
  (입력된 합계: {ct_16l + ct_24l + ct_36l}개)
</p>
```

**현재 코드**:
```typescript
<h3>송풍+펌프 전류계 굵기 설정</h3>
<p className="text-sm text-gray-500 mt-2">
  송풍+펌프 전류계 수량: {fanPumpTotal}개
  (입력된 합계: {ct_16l + ct_24l + ct_36l}개)
</p>
<p className="text-sm text-blue-600 mt-1">
  * 배출 전류계는 항상 16L로 표시됩니다.
</p>
```

**입력 검증 변경**:
```typescript
// 이전: 전체 전류계 수량
const totalCt =
  ((editedData as any).equipment?.discharge_ct || 0) +
  ((editedData as any).equipment?.fan_ct || 0) +
  ((editedData as any).equipment?.pump_ct || 0)

if (ct16l + ct24l + ct36l <= totalCt) { ... }

// 현재: 송풍+펌프만
const fanPumpTotal =
  ((editedData as any).equipment?.fan_ct || 0) +
  ((editedData as any).equipment?.pump_ct || 0)

if (ct16l + ct24l + ct36l <= fanPumpTotal) { ... }
```

**기본값 설정 변경**:
```typescript
// 이전
const totalCt =
  (loadedData.equipment?.discharge_ct || 0) +
  (loadedData.equipment?.fan_ct || 0) +
  (loadedData.equipment?.pump_ct || 0)

loadedData.ct_16l = totalCt

// 현재
const fanPumpTotal =
  (loadedData.equipment?.fan_ct || 0) +
  (loadedData.equipment?.pump_ct || 0)

loadedData.ct_16l = fanPumpTotal
```

### 3. `app/api/document-automation/purchase-order/route.ts`

**변경 내용**:
- `users` 테이블 조회 시 `phone` → `mobile` 컬럼 변경
- `manager_contact` 값 설정 시 `userData?.phone` → `userData?.mobile` 변경

**이전 코드**:
```typescript
const { data: userData, error: userError } = await supabaseAdmin
  .from('users')
  .select('name, email, phone')
  .eq('id', user.id)
  .single()

ecosenseData = {
  manager_name: userData?.name || user.name,
  manager_contact: userData?.phone || '010-4320-3521',
  manager_email: userData?.email || user.email || 'seoh1521@gmail.com',
  // ...
}
```

**현재 코드**:
```typescript
const { data: userData, error: userError } = await supabaseAdmin
  .from('users')
  .select('name, email, mobile')
  .eq('id', user.id)
  .single()

ecosenseData = {
  manager_name: userData?.name || user.name,
  manager_contact: userData?.mobile || '010-4320-3521',
  manager_email: userData?.email || user.email || 'seoh1521@gmail.com',
  // ...
}
```

## 📊 전류계 표시 로직

### 송풍+펌프 전류계
- **입력 가능**: 16L/24L/36L 굵기별 수량 직접 입력
- **기본값**: ct_16l/ct_24l/ct_36l 미설정 시 전체 송풍+펌프 수량을 16L에 할당
- **표시 규칙**:
  ```typescript
  16L: data.ct_16l || fanPumpTotal  // 입력값 우선, 없으면 전체 수량
  24L: data.ct_24l || 0              // 입력값 또는 0
  36L: data.ct_36l || 0              // 입력값 또는 0
  ```

### 배출 전류계
- **고정값**: 항상 16L로 표시
- **수량**: `equipment.discharge_ct` 값 사용
- **표시 규칙**:
  ```typescript
  16L: dischargeCt  // 배출 전류계 수량
  24L: 0            // 항상 0
  36L: 0            // 항상 0
  ```

## 🎯 UI 표시 예시

### 예시 1: 기본 설정 (굵기 미입력)
```
송풍+펌프 전류계 수량: 5개
입력된 합계: 5개

발주서 표시:
┌──────────────┬────┬────┬────┐
│    구분       │16L │24L │36L │
├──────────────┼────┼────┼────┤
│송풍+펌프 전류계│ 5  │ 0  │ 0  │
│배출 전류계    │ 2  │ 0  │ 0  │
└──────────────┴────┴────┴────┘
```

### 예시 2: 굵기 설정 (16L:3, 24L:2)
```
송풍+펌프 전류계 수량: 5개
입력된 합계: 5개 (16L:3, 24L:2)

발주서 표시:
┌──────────────┬────┬────┬────┐
│    구분       │16L │24L │36L │
├──────────────┼────┼────┼────┤
│송풍+펌프 전류계│ 3  │ 2  │ 0  │
│배출 전류계    │ 2  │ 0  │ 0  │
└──────────────┴────┴────┴────┘
```

### 예시 3: 배출 전류계만 있는 경우
```
송풍+펌프 전류계 수량: 0개

발주서 표시:
┌──────────────┬────┬────┬────┐
│    구분       │16L │24L │36L │
├──────────────┼────┼────┼────┤
│배출 전류계    │ 3  │ 0  │ 0  │
└──────────────┴────┴────┴────┘
```

## 🧪 테스트 시나리오

### 시나리오 1: 송풍+펌프만 (기본 16L)
```
1. 사업장 선택
   - 송풍 전류계: 3개
   - 펌프 전류계: 2개
   - 배출 전류계: 0개
2. 발주서 생성 모달 확인
   - 송풍+펌프 전류계 수량: 5개
   - 기본값: 16L 5개
3. 미리보기 확인
   - 송풍+펌프 전류계: 16L 5개, 24L 0개, 36L 0개
```

### 시나리오 2: 혼합 굵기 입력
```
1. 송풍+펌프 전류계 굵기 설정
   - 16L: 3개 입력
   - 24L: 2개 입력
2. 미리보기 확인
   - 송풍+펌프 전류계: 16L 3개, 24L 2개, 36L 0개
```

### 시나리오 3: 배출 포함
```
1. 사업장 선택
   - 송풍 전류계: 2개
   - 펌프 전류계: 3개
   - 배출 전류계: 2개
2. 발주서 생성 모달 확인
   - 송풍+펌프 전류계 수량: 5개
   - 배출 전류계는 항상 16L 안내 표시
3. 미리보기 확인
   - 송풍+펌프 전류계: 16L 5개, 24L 0개, 36L 0개
   - 배출 전류계: 16L 2개, 24L 0개, 36L 0개
```

### 시나리오 4: 휴대전화 번호 표시
```
1. 로그인한 사용자의 mobile 컬럼에 값 확인
2. 발주서 생성
3. 미리보기에서 "블루온 담당자" 섹션 확인
   - 연락처에 mobile 값 표시 확인
4. 서버 로그 확인
   - [PURCHASE-ORDER] 사용자 정보 조회 로그에서 mobile 값 확인
```

## 🔍 디버깅 가이드

### mobile 값이 표시되지 않는 경우

1. **서버 로그 확인**:
```bash
# 개발 서버 로그에서 다음 메시지 확인
[PURCHASE-ORDER] 사용자 정보 조회: {
  userId: 'xxx',
  userData: { name: '김문수', email: 'xxx@xxx', mobile: '010-xxxx-xxxx' },
  userError: null
}
```

2. **DB 확인**:
```sql
-- users 테이블에 mobile 컬럼이 있는지 확인
SELECT name, email, mobile FROM users WHERE id = 'user_id';
```

3. **데이터 없는 경우**:
   - `userData?.mobile`이 null/undefined인 경우
   - 기본값 '010-4320-3521' 사용됨
   - DB에 mobile 값 입력 필요

## ✅ 완료 체크리스트

- [x] 전류계 표시 방식 변경 (타입 → 굵기)
- [x] 구분별 표시 (송풍+펌프 / 배출)
- [x] 송풍+펌프 전류계 굵기 입력 UI
- [x] 입력 검증 로직 수정 (송풍+펌프만)
- [x] 기본값 설정 로직 수정
- [x] DB 컬럼 변경 (phone → mobile)
- [x] API 수정 (mobile 컬럼 조회)
- [x] 안내 문구 추가
- [ ] 실제 데이터로 테스트
- [ ] mobile 값 표시 확인

## 📝 관련 파일

- `components/EcosensePurchaseOrderForm.tsx` - 전류계 굵기 표시
- `app/admin/document-automation/components/PurchaseOrderModal.tsx` - 전류계 굵기 입력 UI
- `app/api/document-automation/purchase-order/route.ts` - mobile 컬럼 조회
- `types/document-automation.ts` - ct_16l/ct_24l/ct_36l 타입 정의

## 🎉 주요 개선점

1. **명확한 구분**: 송풍+펌프와 배출 전류계를 명확히 구분
2. **직관적인 UI**: 기존 템플릿과 동일한 표시 방식 사용
3. **정확한 DB 컬럼**: mobile 컬럼 사용으로 정확한 연락처 표시
4. **유연한 입력**: 송풍+펌프 전류계만 굵기 설정 가능
5. **자동 기본값**: 설정하지 않으면 16L로 자동 할당

## 🔮 향후 개선 사항

1. **배출 전류계 굵기 설정**: 필요시 배출 전류계도 굵기 설정 가능하게 확장
2. **프리셋 저장**: 자주 사용하는 굵기 조합 저장 기능
3. **DB 마이그레이션**: phone → mobile 컬럼 마이그레이션 스크립트 작성
