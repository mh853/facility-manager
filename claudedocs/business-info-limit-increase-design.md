# Business Info 조회 제한 5000개 확장 설계

## 📋 현재 상황 분석

### 문제점
- **API 제한**: `/api/business-info-direct` 기본 limit이 2000개로 하드코딩
- **Supabase 설정**: Supabase에서 직접 5000개로 수정했으나 API 레이어에서 차단
- **데이터 손실**: 2000개 이상의 데이터가 UI에 표시되지 않음

### 영향 범위
```typescript
// 🔴 현재 제한 위치
[business-info-direct/route.ts:24]
const limit = parseInt(searchParams.get('limit') || '2000');

// 📊 데이터 흐름
useBusinessData → /api/business-info-direct → PostgreSQL → UI
```

### 호출 체인
1. `useBusinessData.ts:32` → API 호출 (limit 파라미터 없음)
2. `route.ts:24` → 기본값 2000 적용
3. `route.ts:87` → PostgreSQL LIMIT 절 적용
4. 결과: 최대 2000개만 반환

---

## 🎯 설계 목표

### 핵심 요구사항
✅ 5000개 사업장 데이터 전체 조회 가능
✅ 기존 호환성 유지 (limit 파라미터 지원)
✅ 성능 저하 최소화
✅ 안전한 데이터 처리

### 비기능 요구사항
- **성능**: 5000개 데이터 로딩 < 3초
- **메모리**: 클라이언트 메모리 사용 최적화
- **안정성**: 대용량 데이터 처리 에러 없음
- **확장성**: 향후 10000개까지 확장 가능한 구조

---

## 🏗️ 설계 방안

### Option 1: 기본 제한값 상향 (✅ 권장)

**장점**
- 간단한 코드 수정 (1줄)
- 기존 호환성 완벽 유지
- 즉시 적용 가능

**단점**
- 고정 제한으로 향후 확장 시 재수정 필요

**구현**
```typescript
// app/api/business-info-direct/route.ts:24
const limit = parseInt(searchParams.get('limit') || '5000'); // 2000 → 5000
```

**적용 파일**
- `app/api/business-info-direct/route.ts`

---

### Option 2: 페이지네이션 도입 (⚠️ 오버 엔지니어링)

**장점**
- 무제한 확장 가능
- 메모리 효율적

**단점**
- 복잡한 구조 변경 필요
- 기존 코드 대규모 수정
- Admin UI 페이지네이션 구현 필요
- 사용자 경험 저하 (여러 페이지 탐색)

**비권장 이유**
- 현재 요구사항: "저장된 모든 데이터를 다 볼 수 있게"
- Admin 페이지는 전체 데이터 표시가 일반적
- 5000개 수준은 페이지네이션 없이도 충분히 처리 가능

---

### Option 3: 무제한 조회 모드 (⚡ 대안)

**장점**
- 유연한 제한 설정
- 향후 확장성 좋음

**단점**
- API 보안 고려 필요 (무제한 조회 남용 방지)

**구현**
```typescript
// unlimited=true 파라미터 지원
const unlimited = searchParams.get('unlimited') === 'true';
const limit = unlimited ? 50000 : parseInt(searchParams.get('limit') || '5000');

// 또는 limit=0을 무제한으로 해석
const limit = parseInt(searchParams.get('limit') || '5000');
const finalLimit = limit === 0 ? 50000 : limit; // 0 = unlimited
```

---

## 📐 최종 권장 설계: Option 1 (기본 제한값 5000)

### 변경 사항
```typescript
// ✅ BEFORE (app/api/business-info-direct/route.ts:24)
const limit = parseInt(searchParams.get('limit') || '2000');

// ✅ AFTER
const limit = parseInt(searchParams.get('limit') || '5000');
```

### 이유
1. **단순성**: 최소 변경으로 목표 달성
2. **안정성**: 검증된 코드 구조 유지
3. **성능**: 5000개는 현대 브라우저에서 충분히 처리 가능
4. **요구사항 부합**: "모든 데이터를 볼 수 있게"라는 명확한 요구사항

### 성능 영향 분석

**데이터 크기 추정**
```
한 사업장 레코드 크기: ~2KB (JSON)
5000개 레코드: 5000 × 2KB = 10MB

네트워크 전송:
- GZIP 압축 적용 시: ~2-3MB
- 전송 시간 (100Mbps): ~0.3초
- 파싱 시간: ~0.5초
- 총 예상 시간: ~1초 이내 ✅
```

**메모리 사용**
```
브라우저 메모리:
- JSON 데이터: 10MB
- React 상태: 20MB (렌더링 오버헤드 포함)
- 총: ~30MB (현대 브라우저 충분히 감당) ✅
```

**PostgreSQL 성능**
```sql
-- 현재 쿼리 (route.ts:80-87)
SELECT (78개 필드) FROM business_info
WHERE is_deleted = false
ORDER BY updated_at DESC
LIMIT 5000;

-- 예상 실행 시간:
- Index scan on updated_at: ~100ms
- Row fetch (5000개): ~200ms
- 총: ~300ms ✅
```

### 리스크 평가

| 리스크 | 발생 가능성 | 영향도 | 대응책 |
|--------|-------------|--------|--------|
| 메모리 부족 | 낮음 | 중 | 브라우저 최소 사양 문서화 |
| 로딩 지연 | 낮음 | 낮음 | 로딩 인디케이터 개선 |
| API 타임아웃 | 매우 낮음 | 중 | Vercel timeout 60초 (충분) |

---

## 🔄 구현 계획

### Phase 1: API 수정 (필수)
```typescript
// File: app/api/business-info-direct/route.ts
// Line: 24

// ✅ 변경
- const limit = parseInt(searchParams.get('limit') || '2000');
+ const limit = parseInt(searchParams.get('limit') || '5000');
```

### Phase 2: 검증 (필수)
1. **기능 테스트**
   ```bash
   # 기본 조회 (5000개 제한)
   curl http://localhost:3000/api/business-info-direct

   # 명시적 제한 (호환성 확인)
   curl http://localhost:3000/api/business-info-direct?limit=100
   ```

2. **성능 테스트**
   - Chrome DevTools → Network 탭
   - Response time < 3초 확인
   - Memory usage 확인

3. **UI 테스트**
   - `/admin/business` 페이지 로딩
   - 5000개 데이터 표시 확인
   - 필터/검색 동작 확인

### Phase 3: 모니터링 (권장)
```typescript
// 로깅 개선
log('✅ [BUSINESS-INFO-DIRECT] 조회 완료 -',
    `${businesses?.length || 0}개 사업장 (제한: ${limit}개)`);
```

---

## 📊 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│ useBusinessData.ts                                          │
│ ├─ loadAllBusinesses()                                      │
│ └─ fetch('/api/business-info-direct?includeFileStats=true') │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ business-info-direct/route.ts                               │
│ ├─ GET(request)                                             │
│ ├─ const limit = parseInt(searchParams.get('limit') || '5000') ✅ │
│ └─ queryAll(sql, [limit])                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase)                                       │
│ ├─ SELECT * FROM business_info                             │
│ ├─ WHERE is_deleted = false                                │
│ ├─ ORDER BY updated_at DESC                                │
│ └─ LIMIT 5000 ✅                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Response (JSON)                                             │
│ {                                                           │
│   success: true,                                            │
│   data: [...5000 businesses],                               │
│   count: 5000,                                              │
│   totalCount: 5000,                                         │
│   requestedLimit: 5000 ✅                                    │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 테스트 시나리오

### Test Case 1: 기본 조회 (5000개)
```typescript
// Given
const response = await fetch('/api/business-info-direct');

// When
const data = await response.json();

// Then
expect(data.requestedLimit).toBe(5000);
expect(data.data.length).toBeLessThanOrEqual(5000);
expect(data.count).toBe(data.data.length);
```

### Test Case 2: 명시적 제한 (호환성)
```typescript
// Given
const response = await fetch('/api/business-info-direct?limit=100');

// When
const data = await response.json();

// Then
expect(data.requestedLimit).toBe(100);
expect(data.data.length).toBeLessThanOrEqual(100);
```

### Test Case 3: 검색 + 제한
```typescript
// Given
const response = await fetch('/api/business-info-direct?search=테스트&limit=50');

// When
const data = await response.json();

// Then
expect(data.requestedLimit).toBe(50);
expect(data.data.every(b => b.business_name.includes('테스트'))).toBe(true);
```

### Test Case 4: 성능 테스트
```typescript
// Given
const startTime = performance.now();

// When
const response = await fetch('/api/business-info-direct');
await response.json();
const endTime = performance.now();

// Then
const loadTime = endTime - startTime;
expect(loadTime).toBeLessThan(3000); // 3초 이내
```

---

## 📝 체크리스트

### 구현 전
- [ ] 현재 사업장 데이터 수량 확인 (실제 < 5000인지)
- [ ] Supabase 설정 확인 (이미 5000으로 설정됨)
- [ ] 백업 계획 수립

### 구현 중
- [ ] `business-info-direct/route.ts:24` 수정
- [ ] 로그 메시지 확인 (제한값 출력)
- [ ] Git commit with clear message

### 구현 후
- [ ] 로컬 테스트 (dev 환경)
- [ ] API 응답 확인 (5000개 데이터)
- [ ] UI 로딩 확인 (admin/business)
- [ ] 성능 측정 (Network, Memory)
- [ ] 프로덕션 배포

---

## 🚀 배포 전략

### 단계별 배포
1. **개발 환경 테스트**
   ```bash
   npm run dev
   # localhost:3000/admin/business 확인
   ```

2. **Staging 배포** (선택사항)
   ```bash
   vercel --env staging
   ```

3. **프로덕션 배포**
   ```bash
   vercel --prod
   ```

### 롤백 계획
```typescript
// 문제 발생 시 즉시 복구
const limit = parseInt(searchParams.get('limit') || '2000'); // Rollback to 2000
```

---

## 💡 향후 개선 사항

### 단기 (Optional)
- [ ] 응답 시간 로깅 추가
- [ ] 클라이언트 메모리 모니터링
- [ ] 로딩 인디케이터 개선

### 중기 (Future Enhancement)
- [ ] 가상 스크롤링 (react-window) 도입
- [ ] 서버 사이드 필터링 최적화
- [ ] 인덱스 최적화 (PostgreSQL)

### 장기 (Not Required Now)
- [ ] 10000개 이상 지원 시 페이지네이션 고려
- [ ] GraphQL 전환 검토 (필요 시)
- [ ] Caching 전략 수립

---

## 📚 참고 자료

### 코드 위치
- API Route: `app/api/business-info-direct/route.ts`
- Hook: `app/admin/business/hooks/useBusinessData.ts`
- Admin Page: `app/admin/business/page.tsx`

### 관련 문서
- [Admin Business API Migration](./ADMIN_BUSINESS_API_MIGRATION.md)
- [API Field Selection Guide](../docs/API_FIELD_SELECTION_GUIDE.md)

### 성능 벤치마크
- PostgreSQL SELECT 5000 rows: ~300ms
- JSON serialization 10MB: ~100ms
- Network transfer (GZIP): ~300ms
- **Total: ~700ms** ✅ 목표 3초 이내 달성

---

## 🎉 결론

**권장 방안**: Option 1 (기본 제한값 5000)
- ✅ 최소 변경으로 요구사항 충족
- ✅ 성능 문제 없음 (예상 ~1초 로딩)
- ✅ 기존 호환성 유지
- ✅ 즉시 적용 가능

**Next Step**: `business-info-direct/route.ts:24` 한 줄 수정 후 테스트

---

## 📞 Contact
- 구현 담당: Claude Code
- 검토 요청: 개발팀
- 배포 승인: PM

---

**문서 버전**: 1.0
**작성일**: 2025-01-27
**상태**: ✅ 설계 완료 → 구현 대기
