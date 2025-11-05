# 발주서 대기필증 자동 연동 기능

## 변경 일시
2025-11-04

## 개요
발주서 생성 시 사업장의 대기필증 정보를 자동으로 조회하여 포함시키는 기능을 구현했습니다. 대기필증 정보가 없는 경우 안내 메시지와 함께 등록 바로가기 링크를 제공합니다.

## 문제 상황
- 발주서 미리보기에서 대기필증 레이아웃이 보이지 않음
- API에서 대기필증 데이터를 조회하지 않아서 미리보기와 PDF에 표시되지 않음
- 대기필증 정보가 없는 사업장에 대한 안내가 없음

## 해결 방법

### 1. API에서 대기필증 자동 조회
**파일**: `app/api/document-automation/purchase-order/route.ts` (lines 236-344)

발주서 데이터 조회 시 대기필증 정보를 자동으로 포함시킵니다.

```typescript
// 대기필증 정보 조회
const { data: airPermitData } = await supabaseAdmin
  .from('air_permit_info')
  .select(`
    *,
    business:business_info!air_permit_info_business_id_fkey(business_name, local_government)
  `)
  .eq('business_id', businessId)
  .eq('is_deleted', false)
  .maybeSingle()

let air_permit = undefined

if (airPermitData) {
  // 배출구 정보 조회
  const { data: outletsData } = await supabaseAdmin
    .from('discharge_outlets')
    .select('*')
    .eq('air_permit_id', airPermitData.id)
    .order('outlet_number', { ascending: true })

  if (outletsData && outletsData.length > 0) {
    const outletsWithFacilities = await Promise.all(
      outletsData.map(async (outlet) => {
        // 배출시설 조회
        const { data: dischargeFacilities } = await supabaseAdmin
          .from('discharge_facilities')
          .select('*')
          .eq('outlet_id', outlet.id)

        // 방지시설 조회
        const { data: preventionFacilities } = await supabaseAdmin
          .from('prevention_facilities')
          .select('*')
          .eq('outlet_id', outlet.id)

        return {
          outlet_number: outlet.outlet_number,
          outlet_name: outlet.outlet_name || `배출구 ${outlet.outlet_number}`,
          discharge_facilities: dischargeFacilities?.map(f => ({
            name: f.facility_name,
            capacity: f.capacity || '',
            quantity: f.quantity || 1
          })) || [],
          prevention_facilities: preventionFacilities?.map(f => ({
            name: f.facility_name,
            capacity: f.capacity || '',
            quantity: f.quantity || 1
          })) || []
        }
      })
    )

    air_permit = {
      business_type: airPermitData.business_type || '',
      facility_number: airPermitData.facility_number || '',
      green_link_code: airPermitData.green_link_code || '',
      first_report_date: airPermitData.first_report_date || '',
      operation_start_date: airPermitData.operation_start_date || '',
      outlets: outletsWithFacilities
    }
  }
}

// 발주서 데이터에 포함
const purchaseOrderData: PurchaseOrderDataEcosense = {
  // ... 기존 필드들 ...
  air_permit
}
```

**데이터 조회 순서**:
1. `air_permit_info` 테이블에서 사업장의 대기필증 기본 정보 조회
2. `discharge_outlets` 테이블에서 배출구 정보 조회
3. 각 배출구별로:
   - `discharge_facilities` 테이블에서 배출시설 조회
   - `prevention_facilities` 테이블에서 방지시설 조회
4. 모든 데이터를 구조화하여 `air_permit` 객체 생성

### 2. 빈 상태 UI 추가
**파일**: `components/EcosensePurchaseOrderForm.tsx` (lines 321-448)

대기필증 정보가 없을 때 표시할 안내 메시지와 등록 바로가기를 추가했습니다.

```tsx
<div className="section air-permit-section">
  <h2 className="section-title">대기배출시설 허가증</h2>

  {data.air_permit ? (
    // 대기필증 정보 표시
    <>{/* 기존 코드 */}</>
  ) : (
    // 빈 상태 UI
    <div className="air-permit-empty">
      <div className="empty-icon">📋</div>
      <h3 className="empty-title">대기필증 정보가 없습니다</h3>
      <p className="empty-description">
        사업장의 대기배출시설 허가증 정보를 등록하면<br />
        발주서에 자동으로 포함됩니다.
      </p>
      <a
        href="/admin/air-permit-detail"
        target="_blank"
        rel="noopener noreferrer"
        className="empty-action-button"
      >
        <span>대기필증 등록하기</span>
        <svg className="action-icon">...</svg>
      </a>
    </div>
  )}
</div>
```

**빈 상태 UI 구성**:
- 📋 아이콘: 시각적 표현
- 제목: "대기필증 정보가 없습니다"
- 설명: 등록하면 자동으로 포함된다는 안내
- 버튼: 대기필증 등록 페이지로 이동 (새 창)

### 3. 빈 상태 스타일 추가
**파일**: `components/EcosensePurchaseOrderForm.tsx` (lines 807-885)

사용자 친화적인 빈 상태 디자인을 적용했습니다.

```css
.air-permit-empty {
  padding: 60px 40px;
  text-align: center;
  background-color: white;
  border: 2px dashed #d1d5db; /* 점선 테두리 */
  border-radius: 8px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background-color: #2563eb;
  color: white;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.empty-action-button:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px); /* 호버 시 약간 위로 */
}
```

**인쇄 시 처리**:
```css
@media print {
  /* 빈 상태는 인쇄하지 않음 */
  .air-permit-empty {
    display: none !important;
  }

  /* 대기필증이 없으면 섹션 자체를 숨김 */
  .air-permit-section:has(.air-permit-empty) {
    display: none !important;
  }
}
```

## 변경된 파일 목록

1. `app/api/document-automation/purchase-order/route.ts`
   - 대기필증 자동 조회 로직 추가 (lines 236-302)
   - purchaseOrderData에 air_permit 포함 (line 338)
   - 로깅 추가 (lines 341-344)

2. `components/EcosensePurchaseOrderForm.tsx`
   - 대기필증 섹션을 항상 표시하도록 변경 (line 321)
   - 조건부 렌더링 추가 (lines 324-447)
   - 빈 상태 UI 구현 (lines 418-446)
   - 빈 상태 스타일 추가 (lines 807-864)
   - 인쇄 스타일 업데이트 (lines 873-885)

## 동작 흐름

### 대기필증 있는 경우
```
사용자: 발주서 모달 열기
    ↓
프론트엔드: GET /api/document-automation/purchase-order?business_id={id}
    ↓
백엔드: 사업장 정보 조회
    ↓
백엔드: 대기필증 정보 조회
    ↓
백엔드: 배출구 및 시설 정보 조회
    ↓
백엔드: air_permit 데이터 구성
    ↓
프론트엔드: 미리보기에 대기필증 정보 표시
```

### 대기필증 없는 경우
```
사용자: 발주서 모달 열기
    ↓
프론트엔드: GET /api/document-automation/purchase-order?business_id={id}
    ↓
백엔드: 사업장 정보 조회
    ↓
백엔드: 대기필증 정보 조회 (결과 없음)
    ↓
백엔드: air_permit = undefined
    ↓
프론트엔드: 빈 상태 UI 표시
    ↓
사용자: "대기필증 등록하기" 버튼 클릭
    ↓
새 창: /admin/air-permit-detail 페이지 열림
```

## UI/UX 개선

### 빈 상태 디자인
- **점선 테두리**: 빈 공간임을 시각적으로 표현
- **대형 아이콘**: 무엇을 등록해야 하는지 명확히 표시
- **명확한 안내**: 등록 방법과 효과를 설명
- **CTA 버튼**: 파란색 버튼으로 행동 유도
- **호버 효과**: 상호작용 가능함을 암시

### 사용자 경험
1. **발견 가능성**: 대기필증 섹션이 항상 표시되어 존재를 인식
2. **명확한 안내**: 왜 비어있고 어떻게 채워야 하는지 설명
3. **즉시 행동**: 한 번의 클릭으로 등록 페이지 이동
4. **새 창 열기**: 발주서 모달을 유지한 채 등록 가능
5. **자동 연동**: 등록 후 발주서 새로고침하면 자동 표시

## 테스트 시나리오

### 시나리오 1: 대기필증이 있는 사업장 (예: 주포산업(주))
✅ 발주서 모달 열기
✅ 대기필증 섹션에 실제 데이터 표시
✅ 기본 정보 (업종, 시설번호, 그린링크코드, 신고일, 가동일) 확인
✅ 배출구별 시설 정보 확인
✅ 배출시설(빨간색)과 방지시설(초록색) 구분 확인
✅ PDF 다운로드 시 대기필증 정보 포함 확인

### 시나리오 2: 대기필증이 없는 사업장
✅ 발주서 모달 열기
✅ 대기필증 섹션에 빈 상태 UI 표시
✅ "대기필증 정보가 없습니다" 메시지 확인
✅ "대기필증 등록하기" 버튼 표시 확인
✅ 버튼 클릭 시 새 창에서 /admin/air-permit-detail 열림
✅ 발주서 모달은 계속 열려있음
✅ PDF 다운로드 시 대기필증 섹션 미포함

### 시나리오 3: 대기필증 등록 후 발주서 확인
1. 대기필증이 없는 사업장의 발주서 열기
2. "대기필증 등록하기" 클릭
3. 새 창에서 대기필증 정보 입력 및 저장
4. 발주서 모달 닫기
5. 발주서 모달 다시 열기
6. ✅ 대기필증 정보가 자동으로 표시됨

## API 로깅

대기필증 조회 관련 로그가 추가되었습니다:

```typescript
console.log('[PURCHASE-ORDER] 대기필증 데이터:', air_permit ? '있음' : '없음')

console.log('[PURCHASE-ORDER] 발주서 데이터 구성 완료:', {
  hasAirPermit: !!air_permit,
  outletsCount: air_permit?.outlets?.length || 0
})
```

**로그 출력 예시**:
```
[PURCHASE-ORDER] 대기필증 데이터: 있음
[PURCHASE-ORDER] 발주서 데이터 구성 완료: {
  hasAirPermit: true,
  outletsCount: 2
}
```

## 성능 고려사항

### 데이터베이스 쿼리
- **총 쿼리 수**: 1 (대기필증) + N (배출구 수) * 2 (배출시설 + 방지시설)
- **예시**: 배출구 2개 → 1 + 2*2 = 5 쿼리
- **최적화**: 배출구 수가 많지 않으므로 현재 방식으로 충분

### 캐싱 고려사항
향후 개선 시 다음과 같은 최적화 가능:
- 대기필증 정보를 Redis에 캐싱
- 발주서 데이터와 함께 캐시 무효화
- TTL: 1시간 (대기필증 정보는 자주 변경되지 않음)

## 향후 개선사항

### 1. 스마트 링크
현재 대기필증 등록 페이지로 이동하지만, 향후 다음과 같이 개선 가능:
```tsx
<a href={`/admin/air-permit-detail?business_id=${businessId}&action=create`}>
  대기필증 등록하기
</a>
```
- business_id를 전달하여 사업장 자동 선택
- action=create로 바로 등록 모드 진입

### 2. 인라인 등록
발주서 모달 내에서 간단한 대기필증 정보 입력 가능:
- 모달 내 폼 추가
- 최소 필수 정보만 입력
- 저장 후 즉시 미리보기 업데이트

### 3. 진행 상태 표시
대기필증 등록 진행도를 표시:
```
대기필증 정보: ⚠️ 일부 정보 누락 (2/5 완료)
- ✅ 기본 정보
- ✅ 배출구 1
- ❌ 배출시설 (0개)
- ❌ 방지시설 (0개)
```

### 4. 실시간 동기화
대기필증 등록 후 발주서 모달 자동 새로고침:
- WebSocket 또는 Polling 사용
- 새 창에서 저장 → 부모 창 자동 업데이트

## 관련 문서
- `claudedocs/purchase-order-air-permit-integration.md` - 초기 대기필증 통합
- `claudedocs/air-permit-pdf-csrf-fix.md` - CSRF 문제 해결
- `types/document-automation.ts:159-181` - air_permit 타입 정의

## 변경 이력
- 2025-11-04: 대기필증 자동 조회 및 빈 상태 UI 추가
