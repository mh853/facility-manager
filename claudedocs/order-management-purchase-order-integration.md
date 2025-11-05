# 발주 관리 시스템에 발주서 생성 기능 통합 완료

**작업일**: 2025-11-05
**목적**: 발주 관리 상세 모달에서 직접 발주서를 생성할 수 있도록 문서 자동화 기능 통합

---

## 📊 구현 요약

**추가된 기능**: 발주 관리 상세 모달에 "발주서 생성" 탭 추가
**수정된 파일**: 1개 (`app/admin/order-management/components/OrderDetailModal.tsx`)
**통합 컴포넌트**: `PurchaseOrderModal` (문서 자동화 시스템)
**이력 저장**: 자동 저장 (document_history 테이블)

---

## ✨ 주요 기능

### 1. 새로운 탭 추가: "발주서 생성"
- 기존 2개 탭 (사업장 정보 & 진행 단계, 진행 이력)
- **신규 추가**: 발주서 생성 탭
- 탭 아이콘: FileText (문서 아이콘)

### 2. 발주서 생성 모달 통합
- 문서 자동화 시스템의 `PurchaseOrderModal` 컴포넌트를 그대로 사용
- 발주 관리에서 직접 발주서 생성 가능
- 생성된 발주서는 `document_history` 테이블에 자동 저장

### 3. 사용자 경험
**탭 클릭 → 버튼 표시 → 모달 열기 → 발주서 생성 → 이력 저장**

- "발주서 생성" 탭 클릭 시 안내 메시지와 버튼 표시
- "발주서 생성하기" 버튼 클릭 시 전체 화면 모달 열림
- 문서 자동화와 동일한 UI/UX 경험
- 발주서 다운로드 시 자동으로 이력 저장

---

## 🔧 기술 구현 상세

### 파일 수정: `OrderDetailModal.tsx`

#### 1. Import 추가 (Line 21, 25)
```typescript
import { FileText } from 'lucide-react'  // 발주서 아이콘
import PurchaseOrderModal from '@/app/admin/document-automation/components/PurchaseOrderModal'
```

#### 2. State 관리 업데이트 (Lines 40-41)
```typescript
// 탭 상태에 'purchase_order' 추가
const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'purchase_order'>('info')

// 발주서 모달 표시 상태
const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false)
```

#### 3. 탭 버튼 추가 (Lines 272-284)
```typescript
<button
  onClick={() => setActiveTab('purchase_order')}
  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
    activeTab === 'purchase_order'
      ? 'text-green-600 border-b-2 border-green-600 bg-white'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
  }`}
>
  <div className="flex items-center justify-center gap-2">
    <FileText className="w-4 h-4" />
    발주서 생성
  </div>
</button>
```

#### 4. 탭 콘텐츠 조건부 렌더링 (Lines 417-433)
```typescript
{activeTab === 'info' ? (
  // 사업장 정보 & 진행 단계
  <div>...</div>
) : activeTab === 'timeline' ? (
  // 진행 이력
  <OrderTimeline businessId={businessId} />
) : (
  // 발주서 생성 (신규 추가)
  <div className="flex flex-col items-center justify-center py-12">
    <FileText className="w-16 h-16 text-gray-400 mb-4" />
    <p className="text-gray-600 mb-6 text-center">
      발주서를 생성하려면 아래 버튼을 클릭하세요.
    </p>
    <button
      onClick={() => setShowPurchaseOrderModal(true)}
      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
    >
      <FileText className="w-5 h-5" />
      발주서 생성하기
    </button>
  </div>
)}
```

#### 5. 발주서 모달 렌더링 (Lines 437-444)
```typescript
{/* 발주서 생성 모달 */}
{showPurchaseOrderModal && data && (
  <PurchaseOrderModal
    isOpen={showPurchaseOrderModal}
    onClose={() => setShowPurchaseOrderModal(false)}
    businessId={businessId}
    businessName={data.business.business_name}
  />
)}
```

---

## 📋 데이터 흐름

### 1. 사용자 액션
```
발주 관리 페이지
  → "발주 필요" 탭 클릭
    → 사업장 행 클릭 (상세 모달 열림)
      → "발주서 생성" 탭 클릭
        → "발주서 생성하기" 버튼 클릭
          → PurchaseOrderModal 열림
            → 발주서 데이터 편집
              → "발주서 다운로드" 클릭
                → API 호출 → 이력 저장 → 파일 다운로드
```

### 2. 이력 저장 프로세스
**자동 저장** (사용자가 별도 작업 불필요)

```typescript
// API: /api/document-automation/purchase-order (Lines 448-461)
await supabaseAdmin
  .from('document_history')
  .insert({
    business_id: body.business_id,        // 사업장 ID
    document_type: 'purchase_order',      // 문서 타입
    document_name: displayFileName,       // 파일명
    document_data: body.data,             // 발주서 데이터
    file_path: filePath,                  // 파일 경로
    file_format: body.file_format,        // 파일 형식
    file_size: fileBuffer.length,         // 파일 크기
    created_by: user.id                   // 생성자 ID
  })
```

### 3. 이력 조회
**문서 자동화 → 실행 이력 탭**에서 확인 가능

- 발주 관리에서 생성한 발주서도 동일하게 이력 탭에 표시
- 필터링: 사업장명, 문서 타입, 파일 형식, 날짜
- 다운로드: 이력에서 언제든지 재다운로드 가능

---

## 🎨 UI/UX 특징

### 탭 디자인
- **일관성**: 기존 2개 탭과 동일한 디자인 언어
- **색상**: 활성 탭은 초록색 (`text-green-600`, `border-green-600`)
- **아이콘**: FileText 아이콘으로 문서 기능 명확히 표현
- **호버 효과**: 비활성 탭에 호버 시 배경색 변경

### 발주서 생성 화면
- **중앙 정렬**: 아이콘, 텍스트, 버튼을 수직 중앙 배치
- **안내 메시지**: "발주서를 생성하려면 아래 버튼을 클릭하세요."
- **명확한 버튼**: 초록색 버튼 + 아이콘 + 텍스트로 액션 명확화
- **호버 효과**: 버튼 호버 시 배경색 진하게 변경

### 모달 경험
- **전체 화면**: PurchaseOrderModal은 큰 사이즈 모달 (65vw x 90vh)
- **2단 레이아웃**: 왼쪽 설정 폼 + 오른쪽 미리보기
- **실시간 미리보기**: 설정 변경 시 즉시 발주서 미리보기 업데이트

---

## ✅ 통합 완료 검증

### 기존 기능 유지
- ✅ 문서 자동화 시스템의 발주서 생성 기능은 그대로 유지
- ✅ 문서 자동화 페이지에서도 동일하게 작동
- ✅ 이력 저장 로직은 변경 없음

### 새로운 접근 방식
- ✅ 발주 관리 상세 모달에서 직접 발주서 생성 가능
- ✅ 동일한 PurchaseOrderModal 컴포넌트 재사용
- ✅ 코드 중복 없이 기능 통합

### 이력 저장 확인
- ✅ 발주 관리에서 생성한 발주서도 `document_history` 테이블에 저장
- ✅ `document_history_detail` 뷰에서 조회 가능
- ✅ 문서 자동화 → 실행 이력 탭에서 확인 가능

---

## 🚀 사용 시나리오

### 시나리오 1: 발주 진행 중 발주서 생성
```
1. 발주 관리 페이지 → "발주 필요" 탭
2. 사업장 클릭 → 상세 모달 열림
3. "발주서 생성" 탭 클릭
4. "발주서 생성하기" 버튼 클릭
5. 발주서 데이터 확인 및 수정
6. "발주서 다운로드" 클릭
7. Excel 파일 다운로드 완료
8. 자동으로 이력 저장됨
```

### 시나리오 2: 이력 확인
```
1. 문서 자동화 페이지 이동
2. "실행 이력" 탭 클릭
3. 사업장명으로 검색 또는 필터링
4. 발주 관리에서 생성한 발주서 확인
5. 필요 시 재다운로드 가능
```

---

## 🔍 파일 위치

### 수정된 파일
```
app/admin/order-management/components/OrderDetailModal.tsx
├─ Line 21: FileText 아이콘 import
├─ Line 25: PurchaseOrderModal 컴포넌트 import
├─ Line 40: activeTab 타입에 'purchase_order' 추가
├─ Line 41: showPurchaseOrderModal 상태 추가
├─ Lines 272-284: "발주서 생성" 탭 버튼 추가
├─ Lines 417-433: 발주서 생성 탭 콘텐츠
└─ Lines 437-444: PurchaseOrderModal 렌더링
```

### 연관 파일 (변경 없음)
```
app/admin/document-automation/components/PurchaseOrderModal.tsx
├─ 발주서 생성 UI/UX
├─ 데이터 편집 로직
└─ 발주서 다운로드 로직

app/api/document-automation/purchase-order/route.ts
├─ Lines 448-461: 문서 이력 저장 로직
└─ 발주서 Excel 생성 및 Supabase 업로드

types/document-automation.ts
├─ PurchaseOrderData 타입 정의
└─ 관련 타입 정의
```

---

## 🎯 핵심 장점

### 1. 컴포넌트 재사용
- PurchaseOrderModal을 그대로 사용
- 코드 중복 없음
- 유지보수 비용 감소

### 2. 일관된 사용자 경험
- 문서 자동화와 동일한 UI/UX
- 동일한 기능과 옵션
- 학습 곡선 없음

### 3. 자동 이력 관리
- 별도 작업 없이 자동 저장
- 문서 자동화 이력과 통합
- 언제든지 조회 및 재다운로드 가능

### 4. 효율적인 워크플로우
- 발주 관리에서 모든 작업 완료 가능
- 페이지 전환 불필요
- 빠른 발주서 생성

---

## 📊 영향 범위

### 긍정적 영향
- **사용자 편의성 증대**: 한 화면에서 모든 작업 가능
- **작업 시간 단축**: 페이지 전환 없이 발주서 생성
- **이력 관리 통합**: 모든 발주서가 하나의 시스템에서 관리

### 기존 시스템 영향 없음
- 문서 자동화 시스템은 그대로 유지
- 기존 API 및 데이터베이스 구조 변경 없음
- 이력 조회 로직 변경 없음

---

## 🎊 결론

**발주 관리 시스템에 발주서 생성 기능 통합 완료**

발주 관리 상세 모달에서 직접 발주서를 생성할 수 있는 기능을 추가했습니다. 문서 자동화 시스템의 PurchaseOrderModal 컴포넌트를 재사용하여 코드 중복 없이 깔끔하게 통합했습니다.

**구현된 기능**:
- ✅ "발주서 생성" 탭 추가 (3번째 탭)
- ✅ PurchaseOrderModal 통합 (동일한 UI/UX)
- ✅ 자동 이력 저장 (document_history 테이블)
- ✅ 문서 자동화 이력 탭에서 조회 가능

**테스트 준비**: ✅ 완료
**배포 준비**: ✅ 완료

개발 서버: http://localhost:3004
테스트 경로: /admin/order-management → "발주 필요" 탭 → 사업장 클릭 → "발주서 생성" 탭
