# 사진 업로드 시스템 마이그레이션 완료 보고서
**날짜**: 2025-11-12
**작업**: (유)태현환경 사진 표시 문제 해결

---

## 🎯 문제 요약

(유)태현환경 사업장에 사진을 업로드했으나 `/facility` 페이지 리스트에서 "사진없음"으로 표시되는 문제

---

## 🔍 근본 원인 분석

### 이중 테이블 구조 문제
시스템에 두 개의 사업장 테이블이 존재:
- **`businesses`** (구 시스템) - ID: `5d5dd25c-76ab-4861-b284-0886ab1251a8`
- **`business_info`** (신규 시스템) - ID: `727c5a4d-5d46-46a7-95ec-eab2d80992c6`

### API 불일치
```
1. /api/upload-metadata        → businesses 테이블 사용 ❌
2. /api/uploaded-files-supabase → businesses 테이블 사용 ❌
3. /api/business-list           → business_info 테이블 사용 ✅
```

**결과**: 파일은 구 테이블 ID로 저장되지만, 리스트는 신규 테이블 ID로 조회 → 미스매치

---

## 🛠️ 해결 과정

### 1단계: 데이터베이스 마이그레이션

#### 외래키 제약 조건 제거
```sql
ALTER TABLE uploaded_files
DROP CONSTRAINT IF EXISTS uploaded_files_business_id_fkey;
```

#### business_id 업데이트
```sql
UPDATE uploaded_files
SET business_id = '727c5a4d-5d46-46a7-95ec-eab2d80992c6'
WHERE business_id = '5d5dd25c-76ab-4861-b284-0886ab1251a8';
```

**결과**: 3개 파일 마이그레이션 성공

---

### 2단계: API 코드 수정

#### `/app/api/upload-metadata/route.ts` 수정
```typescript
// 변경 전
async function getOrCreateBusiness(businessName: string) {
  const { data } = await supabaseAdmin
    .from('businesses')  // ❌
    .select('id')
    .eq('name', businessName)
    .single();
}

// 변경 후
async function getOrCreateBusiness(businessName: string) {
  const { data } = await supabaseAdmin
    .from('business_info')  // ✅
    .select('id')
    .eq('business_name', businessName)
    .eq('is_deleted', false)
    .single();
}
```

**커밋**: `3b53dc7` - "fix: upload-metadata API가 business_info 테이블 사용하도록 수정"

---

#### `/app/api/uploaded-files-supabase/route.ts` 수정
```typescript
// 변경 전
const { data: business } = await supabaseAdmin
  .from('businesses')  // ❌
  .select('id')
  .eq('name', businessName)
  .single();

// 변경 후
const { data: business } = await supabaseAdmin
  .from('business_info')  // ✅
  .select('id')
  .eq('business_name', businessName)
  .eq('is_deleted', false)
  .single();
```

**커밋**: `4529fb1` - "fix: uploaded-files-supabase API가 business_info 테이블 사용하도록 수정"

---

## ✅ 검증 결과

### 데이터베이스 상태
```javascript
// scripts/check-taehyun-photos.js 실행 결과
✅ business_info ID: 727c5a4d-5d46-46a7-95ec-eab2d80992c6
📷 업로드된 파일: 4개
   - 마이그레이션된 파일 3개
   - 신규 업로드 파일 1개
```

### API 응답 테스트
```javascript
// scripts/verify-api-responses.js 실행 결과
✅ /api/business-list
   - photo_count: 4
   - has_photos: true

✅ /api/uploaded-files-supabase
   - 파일 개수: 4개
   - 모든 파일 URL 생성 성공
```

---

## 📊 최종 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 마이그레이션 | ✅ 완료 | 4개 파일 (마이그레이션 3 + 신규 1) |
| upload-metadata API | ✅ 수정 완료 | business_info 테이블 사용 |
| uploaded-files API | ✅ 수정 완료 | business_info 테이블 사용 |
| business-list API | ✅ 정상 | 이미 business_info 사용 중 |
| API 응답 검증 | ✅ 성공 | photo_count: 4, files: 4 |

---

## 🎉 해결 완료

### 작동 확인 방법
1. 브라우저에서 `/facility` 페이지 접속
2. **강제 새로고침**: `Cmd + Shift + R` (Mac) / `Ctrl + Shift + R` (Windows)
3. (유)태현환경 사업장에 사진 4개 표시 확인

### 향후 업로드
- 새로운 사진 업로드 시 자동으로 올바른 business_info ID로 저장됨
- `/facility` 페이지에서 즉시 확인 가능

---

## 📝 학습 포인트

1. **테이블 마이그레이션 시 API 동기화 필수**
   - 한 테이블만 변경하면 불일치 발생

2. **외래키 제약 조건 주의**
   - 마이그레이션 전 FK 제거 필요
   - 데이터 무결성 재고려

3. **캐시 무효화 전략**
   - 브라우저 강제 새로고침 필요
   - API 레벨 캐시 무효화 고려

4. **진단 스크립트의 중요성**
   - 실시간 DB 상태 확인
   - API 응답 검증 자동화

---

## 🗂️ 생성된 파일

### 진단 스크립트 (삭제됨)
- ~~`scripts/check-tables.js`~~ - 테이블 존재 여부 확인
- ~~`scripts/auto-migrate-taehyun.js`~~ - 자동 마이그레이션 시도
- ~~`scripts/fix-foreign-key-and-migrate.js`~~ - SQL 명령 생성
- ~~`scripts/migrate-taehyun-files.js`~~ - 마이그레이션 실행

### 유지되는 스크립트
- `scripts/check-taehyun-photos.js` - DB 상태 확인 (유지)
- `scripts/check-all-businesses.js` - 전체 사업장 스캔 (유지)
- `scripts/verify-api-responses.js` - API 응답 테스트 (신규)

---

**작성자**: Claude Code
**배포**: GitHub main 브랜치에 푸시 완료
