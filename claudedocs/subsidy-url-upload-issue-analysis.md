# 보조금 URL 업로드 문제 분석

## 🔍 문제 상황

**증상**: CSV 파일로 224개 URL을 업로드했고 성공 메시지가 표시되었지만, "현재 등록: 0개 URL"로 표시됨

**스크린샷 확인사항**:
- 상단 통계: 전체 공고 245개, 관련 공고 7개, 읽지 않음 0개
- URL 데이터 관리 섹션: "현재 등록: 0개 URL"
- CSV 템플릿 다운로드: "17개 샘플 URL 포함"
- CSV 파일 선택 영역: "CSV 파일을 여기에 드래그하거나 위의 'CSV 파일 선택' 버튼을 클릭하세요"

## 📊 코드 분석

### 1. URL 개수 조회 로직

**파일**: `components/admin/UrlDataManager.tsx` (line 48-99)

```typescript
const loadUrlCount = async () => {
  // API 호출: /api/subsidy-crawler/direct?limit=1000
  const response = await fetch('/api/subsidy-crawler/direct?limit=1000', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  const data = await response.json();

  if (data.success) {
    setUrlCount(data.total_urls || 0);  // ← 여기서 0이 설정됨
  }
}
```

### 2. API 엔드포인트 (GET)

**파일**: `app/api/subsidy-crawler/direct/route.ts` (line 394-505)

```typescript
export async function GET(request: NextRequest) {
  // 인증 확인 로직 (line 395-483)

  const { data: urls, error } = await supabase.rpc('get_urls_for_crawling', {
    p_limit: limit,  // limit = 1000
  });

  return NextResponse.json({
    success: true,
    total_urls: urls?.length || 0,  // ← 0이 반환되고 있음
    urls: urls || [],
  });
}
```

### 3. RPC 함수 정의

**파일**: `sql/create_direct_url_sources.sql` (line 184-205)

```sql
CREATE OR REPLACE FUNCTION get_urls_for_crawling(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  url TEXT,
  region_name VARCHAR,
  category VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dus.id,
    dus.url,
    dus.region_name,
    dus.category
  FROM direct_url_sources dus
  WHERE dus.is_active = true  -- ← 이 조건이 중요
  ORDER BY
    dus.last_crawled_at NULLS FIRST,
    dus.consecutive_failures ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### 4. CSV 업로드 저장 로직

**파일**: `app/api/subsidy-crawler/direct-urls/upload/route.ts` (line 456-478)

```typescript
// 새 URL 삽입
const { error: insertError } = await supabase
  .from('direct_url_sources')
  .insert({
    url: row.url,
    region_code: row.region_code,
    region_name: row.region_name,
    category: row.category,
    notes: row.notes,
    is_active: true,  // ← TRUE로 설정됨
    consecutive_failures: 0,
    total_attempts: 0,
    total_successes: 0,
    error_count: 0,
  });

if (insertError) {
  console.error('Insert error:', insertError);
  skipped++;
} else {
  inserted++;  // ← 성공 시 카운트 증가
}
```

## 🎯 가능한 원인

### 원인 1: 실제로 데이터가 저장되지 않음 ⭐ **가장 가능성 높음**
- **증상**: `inserted: 224` 응답을 받았지만 실제 DB에는 저장되지 않음
- **원인**: RLS(Row Level Security) 정책 또는 트랜잭션 롤백
- **검증**: Supabase 대시보드에서 `direct_url_sources` 테이블 직접 확인 필요

### 원인 2: 저장은 되었지만 `is_active = false`로 설정됨
- **증상**: 데이터는 있지만 조회되지 않음
- **원인**: 업로드 후 다른 프로세스에서 `is_active`를 false로 변경
- **가능성**: 낮음 (코드에서 `is_active: true`로 명시적 설정)

### 원인 3: Service Role Key 권한 문제
- **증상**: INSERT는 성공했지만 SELECT에서 권한 오류
- **원인**: RLS 정책 불일치
- **검증**: API 응답 로그 확인 필요

### 원인 4: 다른 테이블에 저장됨
- **증상**: 잘못된 테이블에 저장
- **가능성**: 매우 낮음 (코드 명확함)

## 🔧 디버깅 단계

### Step 1: Supabase 대시보드에서 직접 확인

```sql
-- direct_url_sources 테이블 전체 행 수 확인
SELECT COUNT(*) FROM direct_url_sources;

-- is_active별 분포 확인
SELECT
  is_active,
  COUNT(*) as count
FROM direct_url_sources
GROUP BY is_active;

-- 최근 생성된 행 확인 (created_at 기준)
SELECT *
FROM direct_url_sources
ORDER BY created_at DESC
LIMIT 10;
```

### Step 2: RPC 함수 직접 테스트

```sql
-- RPC 함수 직접 실행
SELECT * FROM get_urls_for_crawling(10);

-- is_active = true인 행만 조회
SELECT COUNT(*)
FROM direct_url_sources
WHERE is_active = true;
```

### Step 3: RLS 정책 확인

```sql
-- RLS 정책 상태 확인
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'direct_url_sources';

-- RLS 활성화 여부 확인
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'direct_url_sources';
```

### Step 4: 브라우저 콘솔 로그 확인

**확인할 로그**:
```
[UrlDataManager] API 응답 상태: 200 OK
[UrlDataManager] API 응답 데이터: { success: true, total_urls: 0, urls: [] }
[UrlDataManager] URL 개수 설정: 0
```

**기대되는 로그 (정상)**:
```
[UrlDataManager] API 응답 데이터: { success: true, total_urls: 224, urls: [...] }
```

### Step 5: 업로드 API 응답 확인

**CSV 업로드 시 응답 구조**:
```json
{
  "success": true,
  "summary": {
    "total_rows": 224,
    "valid_rows": 224,
    "error_rows": 0,
    "inserted_rows": 224,  // ← 이 값 확인
    "updated_rows": 0,
    "skipped_rows": 0
  },
  "errors": [],
  "duplicate_urls": []
}
```

## 💡 즉시 확인 가능한 방법

### 방법 1: 브라우저 개발자 도구 → Network 탭
1. CSV 파일 다시 업로드
2. `/api/subsidy-crawler/direct-urls/upload` 요청 확인
3. Response 탭에서 `inserted_rows` 값 확인

### 방법 2: 브라우저 개발자 도구 → Console 탭
1. 페이지 새로고침
2. `[UrlDataManager]` 로그 확인
3. `total_urls` 값 확인

### 방법 3: Supabase Dashboard
1. Supabase Dashboard → Table Editor
2. `direct_url_sources` 테이블 열기
3. 행 개수 확인

## 🎯 해결 방안

### 해결안 1: 데이터가 없는 경우
- CSV 파일을 다시 업로드
- Supabase Dashboard에서 직접 데이터 확인
- RLS 정책 수정 필요 시 `sql/create_direct_url_sources.sql` 재실행

### 해결안 2: 데이터는 있지만 조회되지 않는 경우
```sql
-- is_active를 모두 true로 변경
UPDATE direct_url_sources
SET is_active = true
WHERE is_active = false;
```

### 해결안 3: RLS 정책 문제
```sql
-- Service Role 정책 재생성
DROP POLICY IF EXISTS "Service role full access" ON direct_url_sources;

CREATE POLICY "Service role full access" ON direct_url_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## 📋 체크리스트

- [ ] Supabase Dashboard에서 `direct_url_sources` 테이블 행 개수 확인
- [ ] `SELECT COUNT(*) FROM direct_url_sources WHERE is_active = true;` 실행
- [ ] `SELECT * FROM get_urls_for_crawling(10);` 실행
- [ ] 브라우저 콘솔에서 `[UrlDataManager]` 로그 확인
- [ ] Network 탭에서 API 응답 상세 확인
- [ ] CSV 파일 재업로드 후 결과 확인

## 🚀 다음 단계

1. **즉시 확인**: Supabase Dashboard → `direct_url_sources` 테이블 열기
2. **데이터 없으면**: CSV 파일 재업로드 + RLS 정책 확인
3. **데이터 있으면**: RPC 함수 테스트 + is_active 상태 확인
4. **문제 지속 시**: 상세 로그 수집 후 추가 분석
