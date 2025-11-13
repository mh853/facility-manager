# business/[사업장명] 업로드 파일 표시 문제 분석
**날짜**: 2025-11-12
**현상**: business/[사업장명] 페이지에서 업로드한 파일이 표시되지 않음

---

## 🔍 문제 원인 분석

### API 호출 체인

```
1. ImprovedFacilityPhotoSection.tsx (Line 280)
   ↓ fetch(`/api/facility-photos?businessName=${businessName}&phase=${currentPhase}`)

2. app/api/facility-photos/route.ts
   ↓ GET handler

3. 사업장 조회 (Line 80-84)
   ❌ FROM 'businesses' 테이블 사용
   ❌ WHERE name = businessName
```

### 🚨 핵심 문제

**`/api/facility-photos` API가 여전히 `businesses` 테이블을 사용**

```typescript
// app/api/facility-photos/route.ts:80-84 ❌
async function getOrCreateBusiness(businessName: string): Promise<string> {
  const { data: existingBusiness } = await supabaseAdmin
    .from('businesses')  // ❌ 구 테이블
    .select('id')
    .eq('name', businessName)  // ❌ 구 필드명
    .single();
```

### 데이터베이스 현황

```
테이블: businesses (구 시스템)
- ID: 5d5dd25c-76ab-4861-b284-0886ab1251a8
- 파일: 0개 (마이그레이션으로 제거됨)

테이블: business_info (신규 시스템)
- ID: 727c5a4d-5d46-46a7-95ec-eab2d80992c6
- 파일: 4개 (마이그레이션 완료)
```

### 호출 흐름 다이어그램

```
[사용자] → [business/[사업장명] 페이지]
           ↓
        [ImprovedFacilityPhotoSection]
           ↓
        GET /api/facility-photos?businessName=(유)태현환경
           ↓
        [getOrCreateBusiness()]
           ↓ businesses 테이블에서 (유)태현환경 조회
           ↓ ID: 5d5dd25c-76ab-4861-b284-0886ab1251a8 반환
           ↓
        SELECT * FROM uploaded_files
        WHERE business_id = '5d5dd25c-76ab-4861-b284-0886ab1251a8'
           ↓
        🔴 결과: 0개 파일 (마이그레이션으로 비어있음)
           ↓
        [UI] "사진 없음" 표시
```

---

## 📊 API 비교 분석

| API 엔드포인트 | 테이블 사용 | 필드명 | 상태 |
|---------------|-------------|--------|------|
| `/api/upload-metadata` | business_info ✅ | business_name ✅ | 수정 완료 |
| `/api/uploaded-files-supabase` | business_info ✅ | business_name ✅ | 수정 완료 |
| `/api/business-list` | business_info ✅ | business_name ✅ | 원래 정상 |
| **`/api/facility-photos`** | **businesses ❌** | **name ❌** | **수정 필요** |

---

## 🛠️ 해결 방안

### 1단계: `/api/facility-photos/route.ts` 수정

#### 수정 위치
- **파일**: `app/api/facility-photos/route.ts`
- **함수**: `getOrCreateBusiness()` (Line 79-108)
- **핵심 변경**: `businesses` → `business_info` 테이블

#### 수정 코드

```typescript
// 수정 전 (Line 80-84) ❌
async function getOrCreateBusiness(businessName: string): Promise<string> {
  const { data: existingBusiness, error: selectError } = await supabaseAdmin
    .from('businesses')  // ❌
    .select('id')
    .eq('name', businessName)  // ❌
    .single();
```

```typescript
// 수정 후 ✅
async function getOrCreateBusiness(businessName: string): Promise<string> {
  const { data: existingBusiness, error: selectError } = await supabaseAdmin
    .from('business_info')  // ✅ 신규 테이블
    .select('id')
    .eq('business_name', businessName)  // ✅ 신규 필드명
    .eq('is_deleted', false)  // ✅ 필터 추가
    .single();

  if (existingBusiness) {
    return existingBusiness.id;
  }

  if (selectError?.code !== 'PGRST116') {
    throw selectError;
  }

  // 새 사업장 생성 (중복 방지)
  const { data: newBusiness, error: insertError } = await supabaseAdmin
    .from('business_info')  // ✅ 신규 테이블
    .insert({
      business_name: businessName,  // ✅ 신규 필드명
      is_deleted: false,  // ✅ 추가
      is_active: true  // ✅ 추가
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return newBusiness.id;
}
```

---

## ✅ 예상 결과

수정 후:
1. `/api/facility-photos` API가 올바른 business_info ID 조회
2. `uploaded_files` 테이블에서 마이그레이션된 4개 파일 조회 성공
3. `ImprovedFacilityPhotoSection` 컴포넌트에 4개 사진 표시
4. 새로운 사진 업로드도 올바른 business_info ID로 저장

---

## 🎯 테스트 시나리오

### 1. 기존 사진 표시 테스트
```
1. http://localhost:3000/business/(유)태현환경 접속
2. 사진 섹션 확인
3. 예상 결과: 4개 사진 표시 (3개 마이그레이션 + 1개 신규)
```

### 2. 새 사진 업로드 테스트
```
1. business/(유)태현환경 페이지에서 사진 업로드
2. 업로드 완료 확인
3. 페이지 새로고침
4. 예상 결과: 업로드한 사진 즉시 표시
```

### 3. API 응답 검증
```javascript
// 실행: node scripts/verify-api-responses.js
// 예상 결과:
// ✅ business-list API: photo_count=4
// ✅ uploaded-files API: 4개 파일
// ✅ facility-photos API: 4개 사진 (수정 후)
```

---

## 📝 영향 범위

### 수정 필요 파일
1. ✅ `app/api/upload-metadata/route.ts` - 수정 완료
2. ✅ `app/api/uploaded-files-supabase/route.ts` - 수정 완료
3. ❌ `app/api/facility-photos/route.ts` - **수정 필요**

### 영향받는 기능
- ❌ `business/[사업장명]` 페이지 사진 표시
- ❌ `business/[사업장명]` 페이지 사진 업로드
- ✅ `/facility` 페이지 리스트 (정상 작동)
- ✅ `/api/business-list` 응답 (정상 작동)

---

## 🔧 추가 작업

### 테이블 일관성 검증
마이그레이션 후 `businesses` 테이블을 참조하는 다른 API가 있는지 확인 필요:

```bash
# businesses 테이블 사용처 검색
grep -r "from('businesses')" app/api/
grep -r "\.eq('name'" app/api/
```

### 예상 발견 파일
- `app/api/facility-photos/route.ts` ✅ (발견)
- 기타 API 확인 필요

---

## 📚 참고 문서

- [migration-summary-2025-11-12.md](./migration-summary-2025-11-12.md) - 이전 마이그레이션 작업
- 관련 커밋:
  - `3b53dc7` - upload-metadata API 수정
  - `4529fb1` - uploaded-files-supabase API 수정
  - 다음: facility-photos API 수정 예정

---

**작성자**: Claude Code
**우선순위**: 🔴 긴급 (사진 업로드/표시 기능 완전 중단)
