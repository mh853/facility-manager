# 발주 관리 모달에서 대기필증 수정 페이지 연결 버튼 설계

## 1. 요구사항 분석

### 기능 요구사항
- **위치**: `/admin/order-management` → 발주 필요 탭 → 상세 모달
- **동작**: 해당 사업장의 대기필증 수정 페이지로 이동
- **URL 패턴**: `/air-permit-detail?permitId={permitId}&edit=true`
- **예시 URL**: `/air-permit-detail?permitId=797ca313-5a5a-4e89-b6ae-2b7d2fbbb06b&edit=true`

### 기술적 요구사항
1. `business_id` → `permitId` 매핑 필요
2. 대기필증 존재 여부 확인
3. 사용자 권한 확인 (필요시)
4. 대기필증이 없는 경우 처리 방안

## 2. 데이터베이스 구조

### air_permit_info 테이블
```sql
air_permit_info
├── id (UUID, PK) → permitId
├── business_id (UUID, FK → business_info)
├── business_type
├── is_active (boolean)
└── ... (기타 필드)
```

### 관계
- `business_info.id` (1) ←→ (0..n) `air_permit_info.business_id`
- 한 사업장에 여러 대기필증이 있을 수 있음 (is_active로 활성 필증 식별)

## 3. 구현 설계

### 방안 A: API에서 permitId 포함하여 반환 (권장)

#### 장점
- 프론트엔드 로직 단순화
- 중복 API 호출 방지
- 대기필증 존재 여부를 API에서 검증

#### 구현 단계

**Step 1: API 응답에 permitId 추가**

파일: `/app/api/order-management/[businessId]/route.ts`

```typescript
// 1. 사업장 정보 조회 시 대기필증 정보도 함께 조회
const { data: business, error: businessError } = await supabaseAdmin
  .from('business_info')
  .select(`
    id,
    business_name,
    business_management_code,
    address,
    manager_name,
    manager_position,
    manager_contact,
    manufacturer,
    vpn,
    greenlink_id,
    greenlink_pw,
    air_permit_info!inner(
      id,
      is_active
    )
  `)
  .eq('id', businessId)
  .eq('is_deleted', false)
  .eq('air_permit_info.is_active', true)
  .single()

// 2. 응답 데이터에 permitId 추가
const responseData: OrderDetailResponse = {
  success: true,
  data: {
    business: {
      id: business.id,
      business_name: business.business_name,
      business_management_code: business.business_management_code,
      // ... 기타 필드
      air_permit_id: business.air_permit_info?.[0]?.id || null  // 추가
    },
    // ... 나머지
  }
}
```

**Step 2: TypeScript 인터페이스 업데이트**

파일: `/types/order-management.ts`

```typescript
export interface OrderDetailResponse {
  success: boolean
  data: {
    business: {
      id: string
      business_name: string
      business_management_code: string | null
      // ... 기타 필드
      air_permit_id: string | null  // 추가
    }
    // ... 나머지
  }
  message?: string
}
```

**Step 3: UI 컴포넌트에 버튼 추가**

파일: `/app/admin/order-management/components/OrderDetailModal.tsx`

```tsx
// 대기필증 수정 페이지로 이동하는 함수
const goToAirPermitEdit = () => {
  if (!data?.business.air_permit_id) {
    alert('대기필증 정보가 없습니다.')
    return
  }

  const url = `/admin/air-permit-detail?permitId=${data.business.air_permit_id}&edit=true`
  window.open(url, '_blank')
}

// 사업장 정보 섹션에 버튼 추가 (상세보기 버튼 옆)
<div className="flex items-center gap-2">
  <button
    onClick={() => setShowBusinessQuickView(true)}
    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
  >
    <FileText className="w-4 h-4" />
    상세보기
  </button>

  {/* 대기필증 수정 버튼 */}
  <button
    onClick={goToAirPermitEdit}
    disabled={!data?.business.air_permit_id}
    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
      data?.business.air_permit_id
        ? 'bg-green-600 text-white hover:bg-green-700'
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }`}
    title={data?.business.air_permit_id ? '대기필증 수정' : '대기필증 정보 없음'}
  >
    <FileText className="w-4 h-4" />
    대기필증 수정
  </button>
</div>
```

### 방안 B: 프론트엔드에서 별도 API 호출

#### 장점
- API 응답 구조 변경 최소화

#### 단점
- 추가 API 호출 필요
- 로딩 상태 관리 복잡도 증가

#### 구현 (간략)
```tsx
const [permitId, setPermitId] = useState<string | null>(null)

useEffect(() => {
  if (data?.business.id) {
    fetchPermitId(data.business.id)
  }
}, [data])

const fetchPermitId = async (businessId: string) => {
  const response = await fetch(`/api/air-permits?business_id=${businessId}`)
  const result = await response.json()
  if (result.success && result.data.length > 0) {
    setPermitId(result.data[0].id)
  }
}
```

## 4. 권장 구현 방안

### 선택: 방안 A (API에서 permitId 포함)

**이유:**
1. 성능 최적화 - 추가 API 호출 불필요
2. 단순성 - 프론트엔드 로직 간결
3. 일관성 - 사업장 정보와 대기필증 정보를 함께 로드
4. 에러 처리 용이 - 대기필증 없음을 API에서 명확히 처리

### 구현 순서
1. ✅ API 수정: `air_permit_info` JOIN 추가
2. ✅ 타입 수정: `air_permit_id` 필드 추가
3. ✅ UI 수정: 버튼 추가 및 이벤트 핸들러 구현
4. ✅ 테스트: 대기필증 있는 경우 / 없는 경우

## 5. UI/UX 고려사항

### 버튼 위치 옵션

**옵션 1: 상세보기 버튼 옆 (권장)**
```
┌─────────────────────────────────────┐
│ 사업장 정보                          │
│ ┌───────────┐ ┌─────────────────┐  │
│ │ 상세보기  │ │ 대기필증 수정   │  │
│ └───────────┘ └─────────────────┘  │
└─────────────────────────────────────┘
```

**옵션 2: 별도 섹션**
```
┌─────────────────────────────────────┐
│ 사업장 정보                          │
│ ┌───────────┐                        │
│ │ 상세보기  │                        │
│ └───────────┘                        │
│                                      │
│ 관련 문서                            │
│ ┌─────────────────┐                 │
│ │ 대기필증 수정   │                 │
│ └─────────────────┘                 │
└─────────────────────────────────────┘
```

**권장: 옵션 1** - 사용자 접근성이 더 좋음

### 버튼 스타일

- **색상**: Green (#10b981) - 수정/편집 의미
- **크기**: 상세보기 버튼과 동일
- **아이콘**: FileText (문서 아이콘)
- **비활성 상태**: 회색 배경, 툴팁으로 이유 표시

## 6. 에러 처리

### 케이스별 처리

| 케이스 | 상태 | 처리 방법 |
|--------|------|----------|
| 대기필증 있음 | 정상 | 버튼 활성화, 새 탭으로 이동 |
| 대기필증 없음 | 정상 | 버튼 비활성화, 툴팁 표시 |
| API 오류 | 오류 | 버튼 비활성화, 콘솔 로그 |
| 권한 없음 | 오류 | 버튼 숨김 또는 비활성화 |

### 사용자 피드백

```tsx
// 대기필증이 없는 경우
if (!data?.business.air_permit_id) {
  alert('이 사업장의 대기필증 정보가 없습니다.\n대기필증 관리 페이지에서 먼저 생성해주세요.')
  return
}
```

## 7. 테스트 시나리오

### 기능 테스트

1. **정상 케이스**
   - 사업장: (주)은창
   - permitId: 797ca313-5a5a-4e89-b6ae-2b7d2fbbb06b
   - 예상: 버튼 클릭 시 수정 페이지로 이동

2. **대기필증 없는 케이스**
   - 새로 등록된 사업장
   - 예상: 버튼 비활성화, 안내 메시지

3. **여러 대기필증 케이스**
   - is_active=true 인 필증만 선택
   - 예상: 최신 활성 필증으로 이동

### 통합 테스트

1. 발주 관리 → 발주 필요 탭 → 사업장 선택
2. 상세 모달 열림 확인
3. 대기필증 수정 버튼 표시 확인
4. 버튼 클릭 → 새 탭에서 수정 페이지 열림 확인
5. permitId 일치 확인

## 8. 추가 고려사항

### 보안
- 대기필증 수정 권한 확인 (필요시)
- 다른 사업장의 permitId 접근 방지 (API 레벨)

### 성능
- JOIN으로 인한 쿼리 성능 영향 최소 (이미 단일 사업장 조회)
- 인덱스 확인: `air_permit_info(business_id, is_active)`

### 유지보수
- 대기필증 테이블 구조 변경 시 영향 최소화
- TypeScript 타입으로 컴파일 타임 오류 방지

## 9. 구현 파일 목록

### 수정 파일
1. `/app/api/order-management/[businessId]/route.ts` - API 로직
2. `/types/order-management.ts` - 타입 정의
3. `/app/admin/order-management/components/OrderDetailModal.tsx` - UI 컴포넌트

### 변경 라인 수 예상
- API: ~20 lines
- Type: ~2 lines
- UI: ~25 lines
- **총 예상**: ~50 lines

## 10. 다음 단계

1. ✅ 설계 검토 및 승인
2. ⏳ API 수정 구현
3. ⏳ 타입 정의 업데이트
4. ⏳ UI 컴포넌트 구현
5. ⏳ 테스트 및 검증
6. ⏳ 코드 리뷰 및 배포
