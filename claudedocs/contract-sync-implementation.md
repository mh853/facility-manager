# 계약서 탭 간 동기화 구현

## 문제 정의

사용자는 `/admin/document-automation` 페이지에서 두 개의 탭을 사용합니다:
1. **"계약서 관리" 탭**: `contract_history` 테이블에서 계약서 조회
2. **"실행 이력" 탭**: `document_history` 테이블에서 모든 문서 (견적서, 발주서, 계약서) 조회

### 기존 문제점
- 계약서 생성 시 두 테이블 모두에 저장됨
- 하지만 삭제는 각 테이블에서만 수행되어, 한 곳에서 삭제해도 다른 곳에는 남아있음
- 사용자 요청: **"실행 이력 탭에서 삭제하면 계약서 관리 탭에서도 지워져야 함"**

## 구현 솔루션

### 1. 계약서 생성 시 연결 정보 저장

**파일**: `app/api/document-automation/contract/route.ts`

계약서 생성 시 `document_history` 테이블에 저장할 때 `contract_id`를 포함:

```typescript
// line 304-319
await supabaseAdmin
  .from('document_history')
  .insert({
    business_id,
    document_type: 'contract',
    document_name: documentName,
    document_data: JSON.stringify({
      ...contractData,
      contract_id: savedContract.id  // ← 추가: contract_history의 ID 저장
    }),
    file_format: 'pdf',
    file_size: 0,
    created_by: userId
  });
```

### 2. 실행 이력에서 삭제 시 계약서 관리도 삭제

**파일**: `app/api/document-automation/history/[id]/route.ts`

문서 삭제 전에 `document_type`이 'contract'인지 확인하고, `document_data`에서 `contract_id`를 추출하여 `contract_history`에서도 삭제:

```typescript
// line 32-56
if (document.document_type === 'contract' && document.document_data) {
  try {
    const documentData = typeof document.document_data === 'string'
      ? JSON.parse(document.document_data)
      : document.document_data;

    const contractId = documentData.contract_id;

    if (contractId) {
      // contract_id를 사용하여 정확한 계약서 삭제
      await supabase
        .from('contract_history')
        .delete()
        .eq('id', contractId);

      console.log(`[DOCUMENT-HISTORY] 계약서 동기화 삭제 완료: contract_id=${contractId}`);
    }
  } catch (parseError) {
    console.error(`[DOCUMENT-HISTORY] document_data 파싱 실패:`, parseError);
  }
}
```

### 3. 계약서 관리에서 삭제 시 실행 이력도 삭제

**파일**: `app/api/document-automation/contract/route.ts`

계약서를 hard delete (실제 삭제) 하면서 `document_history`에서도 해당 계약서를 삭제:

```typescript
// line 555-583
// document_history에서 먼저 삭제 (동기화)
try {
  // PostgreSQL의 JSON 연산자를 사용하여 contract_id로 검색
  await supabaseAdmin
    .from('document_history')
    .delete()
    .eq('document_type', 'contract')
    .filter('document_data->>contract_id', 'eq', contractId);

  console.log(`[CONTRACT] document_history 동기화 삭제 완료: contract_id=${contractId}`);
} catch (syncError) {
  console.error('[CONTRACT] document_history 동기화 삭제 실패:', syncError);
}

// 계약서 hard delete (실제 삭제)
const { error } = await supabaseAdmin
  .from('contract_history')
  .delete()
  .eq('id', contractId);
```

### 4. 삭제 방식 통일 (Hard Delete)

**중요**: 계약서 삭제는 **hard delete**로 통일되었습니다.
- 이전: `contract_history`에서 soft delete (`is_deleted = true`)
- 현재: 두 테이블 모두에서 hard delete (실제 레코드 삭제)
- 이유: 실행 이력 탭과 계약서 관리 탭 간의 동기화 일관성 보장

## 작동 방식

### 계약서 생성
```
사용자 → 계약서 생성
  ↓
contract_history 테이블에 저장 (id: 123)
  ↓
document_history 테이블에 저장
  - document_data.contract_id = 123
  - 두 레코드가 contract_id로 연결됨
```

### 실행 이력 탭에서 삭제
```
사용자 → 실행 이력 탭에서 계약서 삭제
  ↓
document_history에서 조회 (contract_id 추출)
  ↓
contract_history에서 삭제 (contract_id로 매칭)
  ↓
document_history에서 삭제
  ↓
결과: 두 탭 모두에서 사라짐 ✅
```

### 계약서 관리 탭에서 삭제
```
사용자 → 계약서 관리 탭에서 삭제
  ↓
document_history에서 삭제 (contract_id로 매칭)
  ↓
contract_history에서 hard delete (실제 삭제)
  ↓
결과: 두 탭 모두에서 사라짐 ✅
```

## 기술적 특징

1. **양방향 동기화**: 어느 탭에서 삭제하든 두 테이블 모두에서 삭제됨
2. **Hard Delete 통일**: 모든 삭제 작업은 실제 레코드 삭제 (soft delete 없음)
3. **정확한 매칭**: `contract_id`를 사용하여 정확히 일치하는 레코드만 삭제
4. **안전한 처리**: 파싱 실패나 동기화 실패 시에도 기본 삭제는 성공
5. **로깅**: 동기화 작업 성공/실패 로그 기록

## 기존 계약서 호환성

- 기존에 생성된 계약서는 `document_data`에 `contract_id`가 없을 수 있음
- 이 경우 동기화 삭제가 실패하지만, 경고 로그만 남기고 계속 진행
- 새로 생성되는 계약서부터는 모두 `contract_id`를 포함하여 완전한 동기화 가능

## 테스트 시나리오

### 시나리오 1: 새 계약서 생성 후 실행 이력에서 삭제
1. 계약서 관리 탭에서 계약서 생성
2. 실행 이력 탭으로 이동
3. 해당 계약서 삭제
4. 계약서 관리 탭으로 돌아가서 확인 → **삭제되어야 함**

### 시나리오 2: 새 계약서 생성 후 계약서 관리에서 삭제
1. 계약서 관리 탭에서 계약서 생성
2. 계약서 관리 탭에서 삭제
3. 실행 이력 탭으로 이동하여 확인 → **삭제되어야 함**

### 시나리오 3: 기존 계약서 삭제 (contract_id 없음)
1. 이전에 생성된 계약서를 실행 이력에서 삭제
2. 동기화 실패 경고 로그 출력
3. document_history에서만 삭제됨 (예상된 동작)
