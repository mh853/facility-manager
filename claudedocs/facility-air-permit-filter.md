# 실사관리 대기필증 필터링 적용

## 📋 문제 요약

실사관리 페이지(`/facility`)에서 모든 사업장(1000개)이 표시되는 문제
- **원인**: `business_info` 테이블의 전체 사업장 조회
- **요구사항**: 대기필증이 등록된 사업장만 표시

## 🔧 해결 방법

### 변경된 파일
- `app/api/business-list/route.ts` - API 필터링 로직 개선

### 변경 내용

#### Before (수정 전)
```typescript
// business_info 테이블에서 모든 사업장 조회
const { data: businessWithPermits } = await supabaseAdmin
  .from('business_info')
  .select('...')
  .eq('is_active', true)
  .eq('is_deleted', false)
  .order('business_name');
```

**문제점**:
- ❌ 모든 사업장 조회 (1000개)
- ❌ 대기필증 등록 여부 확인 안함
- ❌ 불필요한 데이터 전송

#### After (수정 후)
```typescript
// 1. 대기필증이 있는 business_id만 먼저 조회
const { data: businessIdsWithPermits } = await supabaseAdmin
  .from('air_permit_info')
  .select('business_id')
  .not('business_id', 'is', null);

// 2. 중복 제거
const businessIds = Array.from(new Set(
  (businessIdsWithPermits || []).map(p => p.business_id)
));

// 3. 대기필증이 있는 사업장만 business_info에서 조회
const { data: businessWithPermits } = await supabaseAdmin
  .from('business_info')
  .select('...')
  .in('id', businessIds)  // 대기필증 보유 사업장만
  .eq('is_active', true)
  .eq('is_deleted', false)
  .order('business_name');
```

**개선 효과**:
- ✅ 대기필증 등록 사업장만 조회
- ✅ 불필요한 데이터 제거
- ✅ 로딩 속도 향상
- ✅ 명확한 필터링 로직

## 📊 데이터 흐름

```
실사관리 페이지 (/facility)
    ↓
API: /api/business-list (GET)
    ↓
[1단계] air_permit_info 테이블
    └─ SELECT business_id
    └─ 대기필증 등록 사업장 ID 목록
    ↓
[2단계] business_info 테이블
    └─ SELECT * WHERE id IN (대기필증 보유 ID)
    └─ 사업장 상세 정보 조회
    ↓
프론트엔드
    └─ 대기필증 보유 사업장만 표시
```

## 🎯 영향 범위

### 수정된 파일
- `app/api/business-list/route.ts` (17-85줄)

### 영향받는 페이지
- `/facility` - 실사관리 페이지

### 데이터베이스
- `air_permit_info` - 대기필증 정보 조회 (신규 추가)
- `business_info` - 사업장 정보 조회 (필터링 강화)

## 🔍 로그 메시지 변경

### Before
```
🏢 [BUSINESS-LIST] business_info에서 전체 사업장 목록 조회 (대기필증 여부 무관)
📋 [BUSINESS-LIST] 사업장 객체 반환: 1000개
```

### After
```
🏢 [BUSINESS-LIST] 대기필증이 등록된 사업장 목록 조회
🏢 [BUSINESS-LIST] 대기필증 보유 사업장 수: 50개
📋 [BUSINESS-LIST] 대기필증 보유 사업장 객체 반환: 50개
```

## ✅ 테스트 체크리스트

- [ ] 실사관리 페이지 접속
- [ ] 대기필증 등록 사업장만 표시되는지 확인
- [ ] 사업장 개수가 감소했는지 확인 (1000개 → 대기필증 보유 개수)
- [ ] 검색 기능 정상 동작 확인
- [ ] 사업장 클릭 시 상세 페이지 이동 확인
- [ ] 로딩 속도 개선 확인

## 📝 API 응답 예시

### 성공 응답
```json
{
  "success": true,
  "data": {
    "businesses": [
      {
        "id": "uuid-1",
        "business_name": "사업장A",
        "address": "주소",
        ...
      }
    ],
    "count": 50,
    "metadata": {
      "source": "business_info_with_air_permits",
      "totalCount": 50,
      "airPermitBusinessCount": 50,
      "hasPhotoData": true,
      "criteriaUsed": "air_permit_required"
    }
  }
}
```

### 대기필증 없는 경우
```json
{
  "success": true,
  "data": {
    "businesses": [],
    "count": 0,
    "metadata": {
      "message": "대기필증 정보가 등록된 사업장이 없습니다",
      "source": "air_permit_info",
      "criteriaUsed": "air_permit_required"
    }
  }
}
```

## 🛡️ 안전장치

### 1. Fallback 로직
대기필증 조회 실패 시 기존 `air_permit_management` 테이블로 폴백

### 2. 빈 결과 처리
대기필증 보유 사업장이 없는 경우 명확한 메시지 반환

### 3. 에러 핸들링
```typescript
try {
  // 대기필증 조회
} catch (error) {
  // 빈 목록 반환 (fallback)
  return createSuccessResponse({
    businesses: [],
    count: 0,
    metadata: { error: 'DATABASE_ERROR' }
  });
}
```

## 💡 추가 개선 사항 (선택)

### 1. 대기필증 개수 표시
```typescript
// 각 사업장의 대기필증 개수 추가
air_permit_count: number
```

### 2. 대기필증 만료일 표시
```typescript
// 만료 예정 대기필증 경고
permit_expiry_date: Date
days_until_expiry: number
```

### 3. 캐싱 최적화
```typescript
// 대기필증 목록은 자주 변하지 않으므로 캐싱 추가
headers: {
  'Cache-Control': 'max-age=3600' // 1시간 캐시
}
```

## 🔗 관련 파일

- `app/facility/page.tsx` - 실사관리 프론트엔드
- `app/api/business-list/route.ts` - 사업장 목록 API
- `sql/02_business_schema.sql` - 데이터베이스 스키마
- `claudedocs/facility-air-permit-filter.md` - 이 문서

## 📚 참고

- `air_permit_info` 테이블: 대기필증 정보 저장
- `business_info` 테이블: 사업장 기본 정보 저장
- Foreign Key: `air_permit_info.business_id` → `business_info.id`

---

**작성일**: 2025-10-31
**작성자**: Claude Code
**버전**: 1.0
