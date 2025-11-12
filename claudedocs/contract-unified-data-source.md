# 계약서 관리 - 통합 데이터 소스 구현

## 문제 상황

실행 이력 탭에서 계약서를 3개만 남기고 삭제했는데, 계약서 관리 탭에는 30개가 계속 표시되는 문제 발생.

### 근본 원인

두 탭이 **서로 다른 데이터 소스**를 사용:
- **실행 이력 탭**: `document_history` 테이블 조회
- **계약서 관리 탭**: `contract_history` 테이블 조회

실행 이력에서 삭제 시 `contract_history` 동기화 삭제를 구현했지만:
- 기존 계약서들은 `document_data`에 `contract_id` 연결 정보가 없음
- 따라서 동기화 삭제가 실패하여 `contract_history`에 계속 남아있음

## 해결 방안

**계약서 관리 탭도 `document_history`를 조회하도록 변경**
- 실행 이력과 동일한 데이터 소스 사용
- 완전한 동기화 보장
- `contract_history`는 백업/참조 용도로만 사용

## 구현 내용

### 1. 계약서 조회 API 변경

**파일**: `app/admin/document-automation/components/ContractManagement.tsx`

**이전 방식** (contract_history 조회):
```typescript
const url = businessId
  ? `/api/document-automation/contract?business_id=${businessId}`
  : '/api/document-automation/contract'
```

**변경 방식** (document_history 조회):
```typescript
// line 174-177
const url = businessId
  ? `/api/document-automation/history?business_id=${businessId}&document_type=contract`
  : '/api/document-automation/history?document_type=contract'
```

### 2. 데이터 형식 변환

`document_history` 응답을 `Contract` 인터페이스 형식으로 변환:

```typescript
// line 184-219
if (result.success && result.data) {
  const contracts = result.data.documents.map((doc: any) => {
    const contractData = typeof doc.document_data === 'string'
      ? JSON.parse(doc.document_data)
      : doc.document_data

    return {
      id: doc.id,  // document_history의 ID 사용
      business_id: doc.business_id,
      business_name: doc.business_name || contractData.business_name,
      contract_type: contractData.contract_type,
      contract_number: contractData.contract_number,
      contract_date: contractData.contract_date,
      total_amount: contractData.total_amount,
      base_revenue: contractData.base_revenue,
      final_amount: contractData.final_amount,
      // ... 기타 필드들
      created_at: doc.created_at,
      pdf_file_url: doc.file_path
    }
  })

  setContracts(contracts)
}
```

### 3. 삭제 API 변경

**이전** (contract_history 삭제):
```typescript
const response = await fetch(`/api/document-automation/contract?id=${contractId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
})
```

**변경** (document_history 삭제):
```typescript
// line 404-407
const response = await fetch(`/api/document-automation/history/${contractId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### 4. 계약서 생성 후 새로고침

계약서 생성 후 `document_history`에서 최신 데이터를 가져오도록 변경:

```typescript
// line 256-272
if (data.success) {
  alert('계약서가 생성되었습니다.')

  // document_history에서 최신 데이터 로드
  loadContracts(selectedBusiness ? selectedBusiness.id : undefined)

  // PDF 저장 후 다시 로드
  const createdContract = data.data.contract
  savePDFAfterCreation(createdContract)
    .then(() => {
      console.log('PDF 자동 저장 완료')
      loadContracts(selectedBusiness ? selectedBusiness.id : undefined)
    })
    .catch(err => {
      console.error('PDF 자동 저장 실패:', err)
    })
}
```

## 데이터 흐름

### 계약서 생성
```
사용자 → 계약서 생성 버튼 클릭
  ↓
POST /api/document-automation/contract
  ↓
contract_history 테이블에 저장 (백업용)
  ↓
document_history 테이블에 저장 (주 데이터 소스)
  - document_data.contract_id 포함
  ↓
계약서 관리 탭: document_history에서 조회 ✅
실행 이력 탭: document_history에서 조회 ✅
  ↓
두 탭이 동일한 데이터 표시
```

### 계약서 삭제 (어느 탭에서든)
```
사용자 → 계약서 삭제 버튼 클릭
  ↓
DELETE /api/document-automation/history/{id}
  ↓
contract_history에서 삭제 (동기화)
  ↓
document_history에서 삭제
  ↓
계약서 관리 탭: 목록에서 사라짐 ✅
실행 이력 탭: 목록에서 사라짐 ✅
```

## 변경 사항 요약

| 항목 | 이전 | 변경 후 |
|------|------|---------|
| **계약서 조회** | contract_history | document_history |
| **계약서 삭제** | contract DELETE API | document_history DELETE API |
| **데이터 소스** | 두 탭이 서로 다른 테이블 | 두 탭이 동일한 테이블 |
| **동기화** | 삭제 시 양방향 동기화 필요 | 단일 소스로 자동 동기화 |
| **일관성** | 동기화 실패 가능성 있음 | 항상 일관성 보장 |

## 기술적 특징

1. **단일 진실 공급원 (Single Source of Truth)**
   - `document_history`가 주 데이터 소스
   - `contract_history`는 백업 및 참조용

2. **자동 동기화**
   - 어느 탭에서 삭제하든 즉시 반영
   - 동기화 실패 가능성 제거

3. **API 재사용**
   - 실행 이력과 동일한 API 사용
   - 중복 코드 제거

4. **데이터 무결성**
   - 두 탭이 항상 동일한 개수의 계약서 표시
   - 사용자 혼란 방지

## 테스트 시나리오

### 시나리오 1: 계약서 생성
1. 계약서 관리 탭에서 계약서 생성
2. 계약서 관리 탭 확인 → 새 계약서 표시됨
3. 실행 이력 탭 확인 → 새 계약서 표시됨
4. **두 탭의 계약서 개수 동일** ✅

### 시나리오 2: 계약서 관리 탭에서 삭제
1. 계약서 관리 탭에서 계약서 삭제
2. 계약서 관리 탭 확인 → 삭제됨
3. 실행 이력 탭 확인 → 삭제됨
4. **두 탭의 계약서 개수 동일** ✅

### 시나리오 3: 실행 이력 탭에서 삭제
1. 실행 이력 탭에서 계약서 삭제
2. 실행 이력 탭 확인 → 삭제됨
3. 계약서 관리 탭 확인 → 삭제됨
4. **두 탭의 계약서 개수 동일** ✅

### 시나리오 4: 사업장 필터링
1. 계약서 관리 탭에서 특정 사업장 선택
2. 해당 사업장의 계약서만 표시됨
3. 실행 이력 탭에서 동일 사업장 필터링
4. **두 탭이 동일한 계약서 목록 표시** ✅

## 이점

1. **사용자 경험 개선**
   - 두 탭이 항상 일관된 데이터 표시
   - 삭제 후 즉시 반영
   - 혼란 제거

2. **유지보수성 향상**
   - 단일 데이터 소스로 복잡도 감소
   - 동기화 로직 단순화
   - 버그 발생 가능성 감소

3. **확장성**
   - 새로운 기능 추가 시 단일 API만 수정
   - 일관된 데이터 모델 유지
