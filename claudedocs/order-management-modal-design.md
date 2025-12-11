# 발주 관리 모달 계층 구조 설계

## 📋 요구사항

발주 필요 탭의 모달(OrderDetailModal)에서 사업장 정보 부분에 버튼을 추가하여:
1. 사업장 관리의 상세 모달(BusinessDetailModal)을 현재 모달 위에 띄움
2. 사업장 정보 확인 및 수정 가능
3. 닫으면 다시 발주 필요 모달이 보이는 단계적 구조

## 🎯 설계 목표

- **모달 계층 관리**: 2단계 모달 스택 구현 (발주 모달 → 사업장 상세 모달)
- **상태 동기화**: 사업장 정보 수정 시 발주 모달에도 즉시 반영
- **UX 일관성**: 기존 사업장 관리의 상세 모달과 동일한 UI/기능 제공
- **코드 재사용**: BusinessDetailModal 컴포넌트 재사용

## 🏗️ 아키텍처 설계

### 1. 모달 계층 구조

```
┌─────────────────────────────────────────────────┐
│ OrderDetailModal (z-index: 50)                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 사업장 정보 영역                             │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ [사업장 상세보기] 버튼 ← NEW!            │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ │                                              │ │
│ │ 발주 진행 단계...                            │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                      ↓ 클릭
┌─────────────────────────────────────────────────┐
│ BusinessDetailModal (z-index: 60) ← 위에 표시   │
│ ┌─────────────────────────────────────────────┐ │
│ │ 사업장 상세 정보 (기존과 동일)               │ │
│ │ - 기본 정보                                  │ │
│ │ - 시설 정보                                  │ │
│ │ - 메모 & 업무                                │ │
│ │ - 매출 정보                                  │ │
│ │                                              │ │
│ │ [수정] [닫기]                                │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                      ↓ 닫기
          다시 OrderDetailModal 활성화
```

### 2. 상태 관리 구조

```typescript
// OrderDetailModal.tsx

interface OrderDetailModalState {
  // 기존 상태
  loading: boolean
  saving: boolean
  data: OrderDetailResponse['data'] | null
  activeTab: 'info' | 'timeline'

  // 새로 추가될 상태
  showBusinessDetailModal: boolean  // BusinessDetailModal 표시 여부
  businessDetailKey: number          // 모달 재렌더링용 키
}
```

### 3. 컴포넌트 인터페이스

#### OrderDetailModal Props (기존 + 확장)

```typescript
interface OrderDetailModalProps {
  businessId: string
  onClose: (shouldRefresh?: boolean) => void
  showPurchaseOrderButton?: boolean

  // 새로 추가: 사업장 정보 변경 시 콜백
  onBusinessInfoUpdate?: (updatedBusiness: UnifiedBusinessInfo) => void
}
```

#### BusinessDetailModal Props (재사용)

```typescript
interface BusinessDetailModalProps {
  isOpen: boolean
  business: UnifiedBusinessInfo
  onClose: () => void
  onEdit: (business: UnifiedBusinessInfo) => void
  // ... 기존 props
}
```

## 🎨 UI/UX 설계

### 1. 사업장 정보 영역에 버튼 추가

**위치**: OrderDetailModal의 "사업장 정보" 섹션 헤더 오른쪽

```tsx
{/* 사업장 정보 */}
<div className="mb-8">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
      <Building2 className="w-5 h-5 text-green-600" />
      사업장 정보
    </h3>

    {/* 새로 추가: 사업장 상세보기 버튼 */}
    <button
      onClick={() => setShowBusinessDetailModal(true)}
      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
    >
      <FileText className="w-4 h-4" />
      상세보기
    </button>
  </div>

  {/* 기존 사업장 정보 그리드... */}
</div>
```

### 2. z-index 계층 설정

```css
/* OrderDetailModal 백드롭 */
z-index: 50

/* OrderDetailModal 컨텐츠 */
z-index: 51

/* BusinessDetailModal 백드롭 (상위에 표시) */
z-index: 60

/* BusinessDetailModal 컨텐츠 */
z-index: 61
```

### 3. 모달 스택 렌더링 구조

```tsx
{/* OrderDetailModal */}
{isModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
    <div className="relative z-51">
      {/* 발주 상세 내용 */}

      {/* BusinessDetailModal (조건부 렌더링) */}
      {showBusinessDetailModal && data?.business && (
        <BusinessDetailModal
          isOpen={showBusinessDetailModal}
          business={convertToUnifiedBusinessInfo(data.business)}
          onClose={handleBusinessModalClose}
          onEdit={handleBusinessEdit}
          // ... 기타 필수 props
        />
      )}
    </div>
  </div>
)}
```

## 🔄 데이터 흐름

### 1. 사업장 정보 조회

```
OrderDetailModal
  → loadOrderDetail()
  → API: /api/order-management/${businessId}
  → data.business (사업장 기본 정보 포함)
```

### 2. 사업장 상세 모달 열기

```
[상세보기] 버튼 클릭
  → setShowBusinessDetailModal(true)
  → convertToUnifiedBusinessInfo(data.business)
  → BusinessDetailModal 렌더링 (z-index: 60)
```

### 3. 사업장 정보 수정 및 동기화

```
BusinessDetailModal
  → [수정] 버튼 클릭
  → 수정 모달 열림 (기존 플로우)
  → 저장 완료
  → onBusinessInfoUpdate() 콜백 호출
  → OrderDetailModal의 loadOrderDetail() 재실행
  → 최신 사업장 정보 반영
```

### 4. 모달 닫기 흐름

```
BusinessDetailModal [닫기]
  → onClose() 호출
  → setShowBusinessDetailModal(false)
  → OrderDetailModal 다시 활성화
  → 필요시 데이터 새로고침
```

## 💾 상태 동기화 전략

### 방법 1: 콜백 기반 동기화 (권장)

```typescript
// OrderDetailModal.tsx
const handleBusinessInfoUpdate = async () => {
  // 사업장 정보 변경 감지 시 발주 정보 재로드
  await loadOrderDetail()
  setBusinessDetailKey(prev => prev + 1) // 강제 리렌더링
}

// BusinessDetailModal에 전달
<BusinessDetailModal
  // ...
  onBusinessInfoUpdate={handleBusinessInfoUpdate}
/>
```

### 방법 2: 모달 닫을 때 자동 새로고침

```typescript
const handleBusinessModalClose = async () => {
  setShowBusinessDetailModal(false)

  // 항상 최신 정보 로드 (간단하지만 불필요한 API 호출 가능)
  await loadOrderDetail()
}
```

## 🛠️ 구현 단계

### Phase 1: 기본 모달 계층 구조 (필수)

1. ✅ OrderDetailModal에 상태 추가
   - `showBusinessDetailModal`
   - `businessDetailKey`

2. ✅ 사업장 정보 영역에 "상세보기" 버튼 추가

3. ✅ BusinessDetailModal 조건부 렌더링
   - z-index 설정
   - 데이터 변환 (convertToUnifiedBusinessInfo)

4. ✅ 모달 열기/닫기 핸들러 구현

### Phase 2: 데이터 동기화 (필수)

1. ✅ 사업장 정보 변환 함수 구현
   ```typescript
   const convertToUnifiedBusinessInfo = (business: OrderBusiness): UnifiedBusinessInfo => {
     return {
       id: business.id,
       사업장명: business.business_name,
       주소: business.address,
       담당자명: business.manager_name,
       // ... 모든 필드 매핑
     }
   }
   ```

2. ✅ 콜백 핸들러 구현
   ```typescript
   const handleBusinessInfoUpdate = async () => {
     await loadOrderDetail()
   }
   ```

### Phase 3: BusinessDetailModal 통합 (도전 과제)

BusinessDetailModal이 필요로 하는 많은 props를 OrderDetailModal 컨텍스트에서 제공해야 함:

**필수 Props**:
- ✅ isOpen, business, onClose, onEdit (기본)
- ⚠️ businessMemos, businessTasks (업무/메모 데이터)
- ⚠️ facilityDeviceCounts, facilityData (시설 데이터)
- ⚠️ airPermitData (대기필증 데이터)
- ⚠️ 각종 핸들러 함수들 (메모 추가/수정/삭제 등)

**해결 방안**:

#### 옵션 A: 읽기 전용 모드 (권장 - 빠른 구현)

```typescript
<BusinessDetailModal
  isOpen={showBusinessDetailModal}
  business={convertedBusiness}
  onClose={handleBusinessModalClose}
  readOnly={true}  // 읽기 전용 모드
  // 필수 props만 전달
/>
```

- **장점**: 구현 빠름, 복잡도 낮음
- **단점**: 메모/업무 기능 사용 불가
- **권장 사용**: MVP 버전

#### 옵션 B: 간소화 버전 컴포넌트 (중간)

새로운 `BusinessInfoQuickView` 컴포넌트 생성:
- 기본 정보만 표시
- 수정 버튼 클릭 시 사업장 관리 페이지로 이동
- BusinessDetailModal보다 가벼움

#### 옵션 C: 완전 통합 (복잡 - 장기)

OrderDetailModal에서 필요한 모든 데이터 로드:
```typescript
const [businessMemos, setBusinessMemos] = useState([])
const [businessTasks, setBusinessTasks] = useState([])
const [facilityData, setFacilityData] = useState(null)

useEffect(() => {
  if (showBusinessDetailModal && data?.business) {
    loadBusinessMemos(data.business.id)
    loadBusinessTasks(data.business.business_name)
    loadBusinessFacilities(data.business.business_name)
  }
}, [showBusinessDetailModal])
```

- **장점**: 완전한 기능 제공
- **단점**: 구현 복잡, 추가 API 호출
- **권장 사용**: 완성도 높은 최종 버전

## 📝 API 엔드포인트

### 기존 활용

- `GET /api/order-management/${businessId}` - 발주 상세 (사업장 정보 포함)
- `GET /api/business-list` - 사업장 목록/상세 (필요시)
- `PUT /api/business/${businessId}` - 사업장 정보 수정

### 필요시 추가 (옵션 C 선택 시)

- `GET /api/businesses/${businessName}/memos` - 사업장 메모
- `GET /api/facility-tasks?businessName=${name}` - 사업장 업무
- `GET /api/facilities/${businessName}` - 시설 정보

## 🎯 추천 구현 경로

### MVP (빠른 검증)

**Phase 1 + Phase 2 + 옵션 A (읽기 전용)**

```typescript
// 최소 구현
<BusinessDetailModal
  isOpen={showBusinessDetailModal}
  business={convertedBusiness}
  onClose={() => setShowBusinessDetailModal(false)}
  readOnly={true}
  // 필수 props만 전달, 나머지는 기본값 사용
/>
```

**예상 구현 시간**: 2-3시간
**장점**: 빠른 기능 제공, 위험도 낮음
**단점**: 메모/업무 기능 미제공

### 완성 버전 (장기)

**Phase 1 + Phase 2 + 옵션 C (완전 통합)**

모든 데이터 로드 및 핸들러 구현

**예상 구현 시간**: 1-2일
**장점**: 완전한 사업장 관리 기능
**단점**: 구현 복잡, 테스트 필요

## 🔍 고려사항

### 1. 성능

- **문제**: BusinessDetailModal은 무거운 컴포넌트
- **해결**:
  - Lazy loading 적용
  - 필요한 데이터만 조건부 로드
  - 메모이제이션 활용

### 2. 사용자 경험

- **백드롭 클릭 동작**: BusinessDetailModal 닫기만, OrderDetailModal은 유지
- **ESC 키 동작**: 최상위 모달(BusinessDetailModal)만 닫기
- **포커스 트랩**: 각 모달 레벨에서 독립적으로 관리

### 3. 접근성

- **aria-modal**: 각 모달에 적절히 설정
- **role="dialog"**: 모든 모달에 명시
- **키보드 내비게이션**: Tab 순환이 현재 활성 모달 내에서만 동작

### 4. 오류 처리

```typescript
const handleBusinessModalError = (error: Error) => {
  console.error('사업장 모달 오류:', error)
  alert('사업장 정보를 불러오는 중 오류가 발생했습니다.')
  setShowBusinessDetailModal(false)
}
```

## 📄 타입 정의

```typescript
// types/order-management.ts (기존 확장)

export interface OrderBusiness {
  id: string
  business_name: string
  address: string
  manager_name: string
  manager_position?: string
  manager_contact: string
  vpn: 'wired' | 'wireless'
  greenlink_id: string
  greenlink_pw: string
  manufacturer: Manufacturer
  // ... 기타 필드
}

// 사업장 정보 변환 함수 타입
export type BusinessInfoConverter = (
  orderBusiness: OrderBusiness
) => UnifiedBusinessInfo

// 모달 스택 상태 타입
export interface ModalStackState {
  primaryModal: boolean      // OrderDetailModal
  secondaryModal: boolean    // BusinessDetailModal
  modalData: {
    business?: UnifiedBusinessInfo
    order?: OrderDetailResponse['data']
  }
}
```

## 🧪 테스트 시나리오

### 1. 기본 흐름

1. ✅ 발주 필요 탭에서 사업장 클릭
2. ✅ OrderDetailModal 표시
3. ✅ "사업장 상세보기" 버튼 클릭
4. ✅ BusinessDetailModal이 위에 표시
5. ✅ 사업장 정보 확인
6. ✅ 닫기 버튼 클릭
7. ✅ OrderDetailModal로 돌아감

### 2. 수정 흐름 (옵션 C)

1. ✅ BusinessDetailModal에서 수정 버튼 클릭
2. ✅ 수정 모달 표시
3. ✅ 정보 수정 후 저장
4. ✅ OrderDetailModal 데이터 자동 새로고침
5. ✅ 변경사항 즉시 반영

### 3. 오류 케이스

1. ❌ 사업장 정보 로드 실패
2. ❌ 수정 중 네트워크 오류
3. ❌ 잘못된 데이터 형식

## 📊 구현 우선순위

| 기능 | 우선순위 | 난이도 | 예상 시간 |
|------|---------|--------|----------|
| 기본 모달 계층 구조 | 🔴 High | 중 | 2h |
| 상세보기 버튼 추가 | 🔴 High | 하 | 30m |
| 읽기 전용 모드 | 🟡 Medium | 중 | 2h |
| 데이터 동기화 | 🔴 High | 중 | 1h |
| 완전 기능 통합 | 🟢 Low | 상 | 8h |

## 🚀 다음 단계

1. **MVP 구현**: 읽기 전용 모드로 빠르게 검증
2. **사용자 피드백**: 실제 사용 패턴 확인
3. **점진적 개선**: 필요한 기능부터 추가
4. **완성 버전**: 모든 기능 통합

---

**작성일**: 2025-12-11
**버전**: 1.0
**상태**: 설계 완료, 구현 대기
