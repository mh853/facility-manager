# 사진 수량 즉시 반영 문제 해결 - 배포 가이드

## 문제 요약

**증상**: 사업장 상세 페이지에서 사진을 삭제해도 facility 리스트 페이지의 사진 수량이 즉시 반영되지 않고 수십 초 후에 업데이트됨.

**근본 원인**: Supabase Read Replica Lag
- Supabase Postgrest는 SELECT 쿼리를 **Read Replica(읽기 전용 복제본)** 에서 실행
- Read Replica는 Primary DB와 **수십 초의 복제 지연(replication lag)** 이 발생
- 사진 삭제는 Primary DB에서 즉시 수행되지만, 조회는 지연된 Replica에서 이루어짐

## 해결 방법

**PostgreSQL RPC 함수 사용**
- RPC(Remote Procedure Call) 함수는 **항상 Primary DB에서 실행**됨
- Read-after-write consistency 보장
- 사진 삭제 후 즉시 최신 데이터 조회 가능

## 배포 순서

### 1단계: PostgreSQL 함수 배포 (Supabase Dashboard)

1. **Supabase Dashboard 접속**
   - URL: https://app.supabase.com/project/[your-project-id]/sql/new

2. **SQL 함수 생성**
   - `/sql/create_get_photo_counts_function.sql` 파일 내용 복사
   - Supabase SQL Editor에 붙여넣기
   - "Run" 버튼 클릭하여 실행

3. **함수 생성 확인**
   ```sql
   -- SQL Editor에서 테스트
   SELECT * FROM get_photo_counts(ARRAY[
     'uuid1',  -- 실제 business_id로 교체
     'uuid2'
   ]::uuid[]);
   ```

4. **예상 결과**
   ```
   business_id               | photo_count
   --------------------------|------------
   uuid1                     | 5
   uuid2                     | 12
   ```

### 2단계: 애플리케이션 코드 배포

**변경된 파일:**
- ✅ `/app/api/business-list/route.ts` (2군데 수정)
- ✅ `/lib/supabase.ts` (헤더 추가)
- ✅ `/sql/create_get_photo_counts_function.sql` (신규)

**배포 방법:**

```bash
# Git 커밋 및 푸시
git add .
git commit -m "fix: Read Replica Lag 문제 해결 - RPC 함수로 Primary DB 강제 사용"
git push origin main

# Vercel 자동 배포 대기 (2-3분)
# 또는 수동 배포:
npm run build
vercel --prod
```

### 3단계: 배포 후 검증

1. **기능 테스트**
   ```
   1. /facility 페이지 접속
   2. 사진이 있는 사업장 클릭
   3. 사진 삭제 수행
   4. 브라우저 뒤로가기 (또는 /facility 재접속)
   5. 사진 수량이 즉시 업데이트되는지 확인
   ```

2. **로그 확인 (브라우저 개발자 도구 → Network → business-list)**
   ```
   예상 로그:
   🔍 [BUSINESS-LIST] 사진 개수 조회 시작 (RPC 함수 사용)
   ✅ [BUSINESS-LIST] RPC 함수로 사진 개수 조회 완료 (Primary DB): {
     businesses_with_photos: 45,
     total_photos: 312,
     sample: ["a1b2c3d4: 7", "e5f6g7h8: 5", ...]
   }
   ```

3. **에러 확인**
   - RPC 함수 호출 실패 시:
     ```
     ❌ [BUSINESS-LIST] RPC 함수 호출 실패 (Primary DB): {
       message: "function get_photo_counts does not exist"
     }
     ```
   - 해결: 1단계 다시 확인 (SQL 함수 배포)

### 4단계: 롤백 계획 (문제 발생 시)

**RPC 함수 제거 (Supabase SQL Editor)**
```sql
DROP FUNCTION IF EXISTS get_photo_counts(uuid[]);
```

**코드 롤백**
```bash
git revert HEAD
git push origin main
```

## 성능 비교

### 기존 방식 (Read Replica)
```
사진 삭제 → Primary DB 반영 → Replica 복제 (10-60초) → 사용자 조회
결과: 수십 초 지연
```

### 개선 방식 (RPC Primary DB)
```
사진 삭제 → Primary DB 반영 → RPC 함수 조회 (Primary DB)
결과: 즉시 반영 (0.1-0.5초)
```

## 기술적 세부사항

### RPC 함수 장점
1. **Primary DB 강제 실행**: Read Replica 우회
2. **효율적인 집계**: DB 내에서 COUNT 수행 (네트워크 전송 최소화)
3. **일관성 보장**: Read-after-write consistency
4. **성능**: 단일 쿼리로 모든 사업장 집계

### Supabase 헤더 개선
```typescript
'Prefer': 'return=representation'  // Write 작업 시 응답 즉시 반환
```

## 예상 질문 & 답변

**Q: RPC 함수가 느리지 않나요?**
A: 오히려 더 빠릅니다. DB 내에서 집계하므로 네트워크 전송량이 줄어듭니다.

**Q: 모든 SELECT 쿼리를 RPC로 바꿔야 하나요?**
A: 아닙니다. Read-after-write consistency가 필요한 경우에만 사용합니다.

**Q: Primary DB에 부하가 집중되지 않나요?**
A: 사진 개수 조회는 경량 쿼리이며, 빈도가 높지 않아 부하는 미미합니다.

**Q: 다른 곳에서도 같은 문제가 있을 수 있나요?**
A: 네. DELETE/UPDATE 후 즉시 조회가 필요한 모든 곳에서 발생 가능합니다.

## 모니터링

**확인할 지표:**
- RPC 함수 응답 시간 (< 500ms 권장)
- Primary DB CPU 사용률 (< 70% 권장)
- 사진 삭제 후 리스트 업데이트 지연 시간 (< 1초 목표)

**Supabase Dashboard → Database → Query Performance**
```sql
-- RPC 함수 실행 통계 확인
SELECT * FROM pg_stat_user_functions
WHERE funcname = 'get_photo_counts';
```

## 추가 개선 사항

**향후 고려사항:**
1. **캐시 무효화**: Redis 캐시 사용 시 삭제 후 캐시 무효화
2. **Realtime 알림**: Supabase Realtime으로 삭제 이벤트 전파
3. **낙관적 업데이트**: 클라이언트 UI 즉시 업데이트 후 서버 동기화

## 연관 문서
- [Supabase Read Replicas 문서](https://supabase.com/docs/guides/platform/read-replicas)
- [PostgreSQL RPC Functions 가이드](https://postgrest.org/en/stable/references/api/stored_procedures.html)
- `/claudedocs/` 디렉토리 내 기타 기술 문서
