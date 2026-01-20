# Option 2 구현 완료 요약

**구현일**: 2026-01-20
**대상**: Phase 2 크롤링 시스템 최적화 (Vercel Pro 활용)

---

## ✅ 구현 완료 사항

### 1. **maxDuration 확장** (10초 → 300초)
```typescript
// 변경 전
export const maxDuration = 10; // Vercel Hobby

// 변경 후
export const maxDuration = 300; // Vercel Pro: 300초 (5분)
```

**위치**: `app/api/subsidy-crawler/route.ts:9`

---

### 2. **병렬 처리 로직** (Promise.allSettled)
```typescript
// 변경 전: 순차 처리
for (const source of batchSources) {
  await crawlPhase2Source(source);
}

// 변경 후: 병렬 처리
const crawlResults = await Promise.allSettled(
  batchSources.map(source => crawlPhase2SourceWithRetry(source, supabase, force, 3))
);
```

**효과**:
- 8개 센터 순차 처리 (160초) → 병렬 처리 (최대 20초)
- 실행 시간 **87.5% 단축** (160초 → 20초)

---

### 3. **재시도 로직** (Exponential Backoff)
```typescript
async function crawlPhase2SourceWithRetry(
  source: Phase2Source,
  supabase: ReturnType<typeof createClient>,
  force: boolean,
  maxRetries = 3
): Promise<{ success: boolean; announcements: number; savedCount: number }>
```

**재시도 전략**:
- 1차 실패 → 2초 대기 후 재시도
- 2차 실패 → 4초 대기 후 재시도
- 3차 실패 → 8초 대기 후 재시도
- 최종 실패 → 다음 센터 계속 진행

**효과**:
- 일시적 네트워크 오류 자동 복구
- 개별 센터 실패가 전체 배치 실패로 이어지지 않음

---

### 4. **에러 핸들링 강화**
```typescript
// DB UPDATE 에러 핸들링
const { error: updateError } = await supabase
  .from('crawl_runs')
  .update(updateData)
  .eq('run_id', runId);

if (updateError) {
  console.error(`[CRAWLER] ❌ crawl_runs UPDATE 실패:`, updateError);
  // UPDATE 실패해도 크롤링 결과는 반환 (GitHub Actions 성공 처리)
} else {
  console.log(`[CRAWLER] ✅ crawl_runs UPDATE 성공`);
}
```

**효과**:
- DB UPDATE 실패해도 크롤링 결과는 GitHub Actions에 전달
- Vercel 타임아웃 전에 DB UPDATE 완료 여부 확인

---

### 5. **로깅 개선**
```typescript
// 타임아웃 근접 경고
if (durationSeconds > 240) {  // 80% (240초) 이상
  console.warn(`[CRAWLER] ⚠️ 타임아웃 근접 경고: ${durationSeconds}초 (한계: 300초)`);
}

// 상세 완료 로그
console.log(`[CRAWLER] 전체 크롤링 완료 (${runId}):`, {
  새공고: results.new_announcements,
  관련공고: results.relevant_announcements,
  성공지역: results.successful_regions,
  실패지역: results.failed_regions,
  실행시간: `${durationSeconds}초`,
  상태: finalStatus,
});
```

---

## 📊 예상 효과

### Before (현재)
- **타임아웃**: 10초 (Vercel Hobby)
- **처리 방식**: 순차 처리 (8개 × 20초 = 160초)
- **실패율**: 100% (10초 초과로 모두 실패)
- **성공 배치**: 0/4 (0%)

### After (Option 2)
- **타임아웃**: 300초 (Vercel Pro)
- **처리 방식**: 병렬 처리 (8개 × 최대 20초 = 20초)
- **실패율**: <1% (재시도 3회 + 300초 여유)
- **성공 배치**: 4/4 (100%)

### 성능 지표
| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| 타임아웃 한계 | 10초 | 300초 | **+2900%** |
| 배치 실행 시간 | 160초 (실패) | 20-60초 | **87.5%↓** |
| 배치 성공률 | 0% | >99% | **+99%p** |
| 센터별 재시도 | 0회 | 최대 3회 | **안정성 ↑** |

---

## 🔧 변경된 코드

### 파일: `app/api/subsidy-crawler/route.ts`

**수정된 라인**:
- Line 9: `maxDuration = 10` → `maxDuration = 300`
- Line 381-500: `crawlPhase2SourceWithRetry()` 함수 추가 (120 lines)
- Line 572-607: 순차 `for` 루프 → 병렬 `Promise.allSettled()` (35 lines)
- Line 738-783: DB UPDATE 에러 핸들링 + 타임아웃 경고 로그 추가 (45 lines)

**총 변경 규모**:
- 추가: ~200 lines
- 삭제: ~85 lines
- 순증: ~115 lines

---

## 🚀 배포 및 검증

### 1. Git Commit
```bash
git add app/api/subsidy-crawler/route.ts
git commit -m "feat: Phase 2 크롤링 최적화 (Option 2 구현)

- maxDuration: 10초 → 300초 (Vercel Pro)
- 병렬 처리: Promise.allSettled로 8개 센터 동시 크롤링
- 재시도 로직: Exponential Backoff (최대 3회)
- 에러 핸들링 강화: DB UPDATE 실패 시에도 결과 반환
- 타임아웃 근접 경고: 240초 이상 시 경고 로그

예상 효과:
- 배치 성공률: 0% → 99%+
- 실행 시간: 160초 → 20-60초
- 실패율: <1%
"
```

### 2. Vercel 배포
```bash
git push origin main

# Vercel 자동 배포 (1-2분)
# → https://facility.blueon-iot.com/api/subsidy-crawler 업데이트
```

### 3. 수동 테스트
```bash
# Postman 또는 Curl
curl -X POST https://facility.blueon-iot.com/api/subsidy-crawler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRAWLER_SECRET" \
  -d '{"enable_phase2": true, "batch_num": 1, "batch_size": 8}'
```

**확인 사항**:
- HTTP 200 응답
- `duration_ms` < 300000 (300초 이내)
- `success: true`
- `successful_regions > 0`

### 4. GitHub Actions 자동 실행 대기
```bash
# 내일 오전 10시 (KST) 자동 실행
# → .github/workflows/subsidy-crawler-phase2.yml
# → cron: '0 1 * * *' (매일 01:00 UTC)
```

### 5. Vercel Runtime Logs 확인
```
Vercel Dashboard → Runtime Logs:
1. Duration 값 확인 (20-60초 예상)
2. "[CRAWLER-P2]" 로그 검색
3. "✅ 저장 완료" 개수 확인
4. "⚠️ 타임아웃 근접 경고" 없는지 확인
```

### 6. Supabase `crawl_runs` 테이블 확인
```sql
SELECT
  run_id,
  status,
  completed_batches,
  total_urls_crawled,
  successful_urls,
  failed_urls,
  new_announcements,
  total_processing_time_seconds,
  completed_at
FROM crawl_runs
WHERE run_id LIKE 'run_phase2_%'
ORDER BY created_at DESC
LIMIT 10;
```

**확인 사항**:
- `status = 'completed'` (모든 센터 성공)
- `successful_urls = 8` (배치 1개 기준)
- `total_processing_time_seconds < 300`
- `completed_at IS NOT NULL` (DB UPDATE 성공)

---

## 📈 모니터링 계획

### 1일차 (배포 직후)
- ✅ Vercel Runtime Logs 확인 (Duration, 에러 메시지)
- ✅ `crawl_runs` 테이블 확인 (status, completed_at)
- ✅ `subsidy_announcements` 테이블 확인 (new_announcements)

### 1주일 (안정화 기간)
- ✅ 모니터링 대시보드에서 Phase 2 성공률 확인 (목표: >99%)
- ✅ 실행 시간 추이 확인 (평균 20-60초)
- ✅ 타임아웃 경고 발생 여부 확인 (240초 이상)

### 장기 (1개월+)
- ✅ 실패율 <1% 유지 확인
- ✅ 배치 크기 조정 필요성 검토 (8개 → 10개?)
- ✅ Vercel Pro 사용량 확인 (300초 초과 여부)

---

## 🎯 성공 기준

### ✅ 필수 (배포 24시간 이내)
- [ ] HTTP 200 응답 (GitHub Actions 성공)
- [ ] `crawl_runs.status = 'completed'`
- [ ] `crawl_runs.completed_at IS NOT NULL`
- [ ] `duration_ms < 300000` (300초 이내)

### ✅ 목표 (1주일 이내)
- [ ] Phase 2 배치 성공률 >99%
- [ ] 평균 실행 시간 <60초
- [ ] 타임아웃 경고 0건
- [ ] 센터별 재시도 성공 사례 확인

### ✅ 최적 (1개월 이내)
- [ ] Phase 2 배치 성공률 100%
- [ ] 평균 실행 시간 20-40초
- [ ] 실패 센터 0개 (또는 재시도로 모두 복구)
- [ ] 추가 비용 $0 (Vercel Pro 범위 내)

---

## 🔄 롤백 계획 (문제 발생 시)

### 롤백 트리거
- Phase 2 성공률 <90% (3일 연속)
- Vercel 타임아웃 초과 (300초 이상)
- DB UPDATE 실패율 >10%

### 롤백 방법
```bash
# Git revert
git revert HEAD
git push origin main

# 또는 이전 커밋으로 hard reset
git reset --hard <previous-commit-hash>
git push --force origin main
```

### 대체 방안
- **Plan B**: Option 1 (maxDuration만 300초, 병렬 처리 없음)
- **Plan C**: 배치 크기 축소 (8 → 4개)

---

## 📝 추가 개선 가능 사항 (Optional)

### 1. Vercel Fluid Compute (800초)
- 현재: 300초 (Pro 기본)
- 업그레이드 시: 800초 (Pro + Fluid Compute)
- 비용: 추가 요금 발생 가능
- 필요성: 300초로 충분하면 불필요

### 2. 배치 크기 확대
- 현재: 8개 센터/배치
- 확대 시: 10-12개 센터/배치
- 조건: 평균 실행 시간 <30초 유지 시
- 효과: GitHub Actions 실행 횟수 감소 (4 → 3배치)

### 3. Supabase Edge Functions 마이그레이션
- 장기 계획: Option 3 고려
- 조건: Vercel 300초로도 불충분한 경우
- 예상 시간: 1-2일
- 예상 효과: 150초 타임아웃 (오히려 감소)

---

**구현자**: Claude Sonnet 4.5
**구현일**: 2026-01-20
**예상 배포일**: 2026-01-20
**검증 완료 예정**: 2026-01-21 (내일 오전 10시 자동 실행 후)
