# 스토리지-데이터베이스 동기화 문제 해결 가이드

## 📋 문제 개요

Supabase Storage에서 파일을 삭제했지만 API가 여전히 파일이 존재한다고 반환하는 문제

**발생 날짜**: 2025-11-05
**해결 시간**: 약 2시간
**영향 범위**: 사진 표시 기능

---

## 🚨 증상

### 1. 사용자 관점
- 사진을 Supabase Storage에서 직접 삭제했지만 UI에 여전히 표시됨
- API 응답: `"2장의 사진을 조회했습니다."`
- 실제 파일: 없음 (Storage에서 삭제됨)

### 2. 서버 로그
```
✅ [FACILITY-PHOTOS-GET] 조회 완료: 2장
GET /api/facility-photos?businessName=(주)휴비스트제약&refresh=true&phase=presurvey 200 in 127ms
```

### 3. 데이터베이스 상태
- `uploaded_files` 테이블에 레코드 **존재**
- Supabase Storage에 실제 파일 **없음**
- 동기화 불일치 발생

---

## 🔍 근본 원인

### Supabase 아키텍처의 특성
Supabase는 **Storage(파일)**와 **Database(메타데이터)**가 **완전히 분리된 시스템**입니다:

```
┌─────────────────┐     ┌──────────────────┐
│ Supabase        │     │ PostgreSQL       │
│ Storage         │ ✗   │ Database         │
│ (실제 파일)     │     │ (메타데이터)     │
└─────────────────┘     └──────────────────┘
     독립적 삭제              독립적 관리
```

### 문제 발생 과정
1. **Storage에서만 파일 삭제** (Supabase UI에서 직접 삭제)
2. **Database 레코드는 남아있음** (`uploaded_files` 테이블)
3. **API는 Database를 조회** → "2장 존재"
4. **프론트엔드가 파일 URL 로드 시도** → 404 에러 (파일 없음)

---

## 🛠️ 진단 방법

### Step 1: API 응답 확인
브라우저 개발자 도구 (F12) → Network 탭에서 API 응답 확인:

```javascript
fetch('http://localhost:3000/api/facility-photos?businessName=(주)휴비스트제약&refresh=true&phase=presurvey')
  .then(r => r.json())
  .then(d => console.log(d));
```

**확인 사항**:
- `data.files` 배열 길이
- 각 파일의 `facilityInfo` 값
- 각 파일의 `filePath` 값

### Step 2: 데이터베이스 레코드 확인
Supabase SQL Editor에서 실행:

```sql
-- 모든 사업장의 파일 레코드 확인
SELECT
  id,
  filename,
  facility_info,
  file_path,
  business_id,
  created_at
FROM uploaded_files
WHERE business_id = '9c9699cb-e2ba-4c44-a40e-99e5446140ab'
ORDER BY created_at DESC;
```

### Step 3: 특정 facilityInfo로 필터링
```sql
-- 문제가 되는 특정 시설 사진 확인
SELECT
  id,
  filename,
  facility_info,
  file_path,
  business_id
FROM uploaded_files
WHERE facility_info = 'prevention_2_2';
```

**결과 해석**:
- **"No rows returned"** → 정상 (레코드 없음)
- **행이 반환됨** → 문제 있음 (Database 레코드가 남아있음)

---

## ✅ 해결 방법

### 방법 1: facilityInfo 기반 삭제 (권장)

**사용 시기**: `facilityInfo` 값을 정확히 알고 있을 때

```sql
-- 1. 먼저 확인 (삭제할 레코드 조회)
SELECT
  id,
  filename,
  facility_info,
  file_path,
  business_id
FROM uploaded_files
WHERE facility_info = 'prevention_2_2';

-- 2. 삭제 실행
DELETE FROM uploaded_files
WHERE facility_info = 'prevention_2_2';

-- 3. 검증 (결과가 없어야 함)
SELECT * FROM uploaded_files
WHERE facility_info = 'prevention_2_2';
```

### 방법 2: business_name 기반 삭제

**주의**: `business_info` 테이블과 JOIN 필요 (실패한 이유 - 테이블이 다름)

```sql
-- ❌ 잘못된 방법 (business_info 테이블 사용)
DELETE FROM uploaded_files uf
USING business_info bi
WHERE uf.business_id = bi.id
  AND bi.business_name = '(주)휴비스트제약';
```

**문제점**:
- `uploaded_files.business_id`는 `businesses` 테이블의 ID를 참조
- `business_info` 테이블과는 별도 시스템

### 방법 3: 파일 ID 기반 삭제

**사용 시기**: 특정 파일 몇 개만 삭제할 때

```sql
DELETE FROM uploaded_files
WHERE id IN (
  '0c332e47-4815-43ef-af7b-1fb7df39340d',
  'a00e8f69-872c-49c5-a139-bd87d1e56376'
);
```

---

## 🔄 올바른 삭제 프로세스

앞으로는 **API를 통해 삭제**하여 Storage와 Database가 자동으로 동기화되도록 해야 합니다:

### API DELETE 엔드포인트 사용
```typescript
// 프론트엔드에서 삭제 API 호출
const response = await fetch('/api/facility-photos', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    photoId: '0c332e47-4815-43ef-af7b-1fb7df39340d',
    businessName: '(주)휴비스트제약'
  })
});
```

### API DELETE 동작 방식 (route.ts:584-656)
1. **Database에서 파일 정보 조회**
2. **Storage에서 파일 삭제** (`supabaseAdmin.storage.remove()`)
3. **Database 레코드 삭제** (`DELETE FROM uploaded_files`)
4. **캐시 무효화** (`memoryCache.delete()`)

→ **Storage와 Database가 자동으로 동기화됨** ✅

---

## 🚫 예방 조치

### 1. Supabase UI에서 직접 삭제 금지
- ❌ Supabase Dashboard에서 Storage 파일 직접 삭제
- ✅ 애플리케이션 UI에서 삭제 버튼 사용

### 2. 삭제 API 테스트
```bash
# API 삭제 테스트
curl -X DELETE http://localhost:3000/api/facility-photos \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test-id","businessName":"테스트사업장"}'
```

### 3. 정기적인 동기화 검증
```sql
-- Storage에는 없지만 Database에는 있는 orphan 레코드 확인
-- (수동으로 확인 필요)
SELECT
  id,
  filename,
  file_path,
  created_at
FROM uploaded_files
ORDER BY created_at DESC
LIMIT 100;
```

---

## 📊 관련 파일

### API 코드
- `/app/api/facility-photos/route.ts` (line 584-656: DELETE 엔드포인트)
- `/utils/facility-photo-tracker.ts` (line 234-253: removePhoto 메서드)

### SQL 스크립트
- `/scripts/delete-prevention2-photos-correct.sql` (최종 성공한 스크립트)
- `/scripts/fix-prevention2-photo.sql` (facilityInfo 수정용)

---

## 🎓 핵심 교훈

### 1. Supabase 아키텍처 이해
- Storage와 Database는 **독립적인 시스템**
- 한쪽만 수정하면 **동기화 불일치** 발생

### 2. 올바른 삭제 방법
- **항상 API를 통해 삭제** (자동 동기화)
- Supabase UI 직접 조작은 **긴급 상황에만**

### 3. 진단 프로세스
1. API 응답 확인 (Network 탭)
2. Database 레코드 확인 (SQL 쿼리)
3. facilityInfo 기반으로 정확한 레코드 식별
4. DELETE 실행 및 검증

### 4. SQL 쿼리 작성 시 주의사항
- 테이블 관계 정확히 파악 (`business_info` ≠ `businesses`)
- `facilityInfo` 같은 명확한 식별자 활용
- **항상 SELECT로 먼저 확인 → DELETE 실행**

---

## 📞 추가 도움이 필요한 경우

### 관련 문서
- `air-permit-db-verification-guide.md` - 대기필증 DB 검증
- `fix-null-business-id-guide.md` - business_id 관련 문제

### 디버깅 체크리스트
- [ ] API 응답에 파일이 포함되어 있는가?
- [ ] Database에 레코드가 존재하는가?
- [ ] Storage에 실제 파일이 존재하는가?
- [ ] facilityInfo 값이 정확한가?
- [ ] business_id가 올바른 테이블을 참조하는가?

---

**작성일**: 2025-11-05
**작성자**: Claude (문제 해결 과정 문서화)
**최종 업데이트**: 2025-11-05
