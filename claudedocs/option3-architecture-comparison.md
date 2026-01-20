# Option 3 (Supabase Edge Functions) vs 현재 시스템 비교 분석

**작성일**: 2026-01-20
**대상**: Phase 2 크롤링 시스템 아키텍처 변경 분석

---

## 📊 요약 비교표

| 항목 | 현재 (Vercel API Routes) | Option 3 (Supabase Edge Functions) |
|------|-------------------------|-------------------------------------|
| **실행 환경** | Vercel Serverless (Node.js 18+) | Supabase Edge Runtime (Deno) |
| **타임아웃** | 300초 (Pro 플랜) | 150초 (Pro 플랜) |
| **트리거** | GitHub Actions → Vercel API | GitHub Actions → Supabase Edge |
| **코드 위치** | `app/api/subsidy-crawler/route.ts` | `supabase/functions/subsidy-crawler/index.ts` |
| **런타임** | Node.js (npm 패키지 사용 가능) | Deno (npm 호환, 다른 import 방식) |
| **배포** | Vercel CLI / Git push | Supabase CLI (`supabase functions deploy`) |
| **로그 확인** | Vercel Dashboard → Runtime Logs | Supabase Dashboard → Edge Functions Logs |
| **환경 변수** | Vercel Environment Variables | Supabase Secrets (`supabase secrets set`) |
| **비용** | Vercel Pro $20/월 (이미 구독 중) | Supabase Pro $25/월 (이미 구독 중) |
| **모니터링** | Vercel Observability | Supabase Edge Functions Dashboard |

---

## 🔄 변경되는 부분 (Architecture Changes)

### 1. 코드 파일 위치 및 구조

#### 현재 (Vercel API Routes)
```
facility-manager/
├── app/
│   └── api/
│       └── subsidy-crawler/
│           └── route.ts          # Next.js API Route
├── lib/
│   └── supabase.ts               # Supabase 클라이언트
└── .env.local                    # Vercel 환경 변수
```

#### Option 3 (Supabase Edge Functions)
```
facility-manager/
├── app/
│   └── api/
│       └── subsidy-crawler/
│           └── route.ts          # ❌ 삭제 또는 프록시로 변경
├── supabase/
│   ├── functions/
│   │   └── subsidy-crawler/
│   │       └── index.ts          # ✅ 새로 생성 (Deno)
│   └── config.toml               # ✅ Edge Functions 설정
└── .env                          # Supabase CLI 환경 변수
```

---

### 2. 코드 작성 방식 (Runtime Differences)

#### 현재 (Node.js + Next.js)
```typescript
// app/api/subsidy-crawler/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;  // Vercel Pro 설정
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...);

  // Node.js 패키지 사용 가능
  const cheerio = require('cheerio');
  const axios = require('axios');

  return NextResponse.json({ success: true });
}
```

#### Option 3 (Deno + Supabase Edge)
```typescript
// supabase/functions/subsidy-crawler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deno import 방식 (npm: 접두사 또는 esm.sh)
import cheerio from "npm:cheerio@1.0.0";
import axios from "npm:axios@1.6.0";

serve(async (req: Request) => {
  const body = await req.json();

  // Supabase 클라이언트 (환경 변수는 Deno.env.get())
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 로직은 동일하지만 Deno 런타임
  // ...

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**주요 차이점**:
- ❌ `require()` → ✅ `import from "npm:package"`
- ❌ `process.env` → ✅ `Deno.env.get()`
- ❌ `NextRequest/NextResponse` → ✅ `Request/Response` (Web API)
- ❌ `export async function POST()` → ✅ `serve(async (req) => {})`

---

### 3. GitHub Actions 워크플로우 변경

#### 현재 (Vercel API 호출)
```yaml
# .github/workflows/subsidy-crawler-phase2.yml
env:
  API_BASE_URL: https://facility.blueon-iot.com  # Vercel 배포 URL

steps:
  - name: 🌿 Phase 2 크롤링
    run: |
      curl -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${{ secrets.CRAWLER_SECRET }}" \
        -d '{"enable_phase2": true, "batch_num": 1}' \
        "${{ env.API_BASE_URL }}/api/subsidy-crawler"
```

#### Option 3 (Supabase Edge Functions 호출)
```yaml
# .github/workflows/subsidy-crawler-phase2.yml
env:
  SUPABASE_PROJECT_URL: https://your-project.supabase.co
  EDGE_FUNCTION_URL: https://your-project.supabase.co/functions/v1/subsidy-crawler

steps:
  - name: 🌿 Phase 2 크롤링
    run: |
      curl -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
        -d '{"enable_phase2": true, "batch_num": 1}' \
        "${{ env.EDGE_FUNCTION_URL }}"
```

**변경 사항**:
- URL: `facility.blueon-iot.com/api/subsidy-crawler` → `your-project.supabase.co/functions/v1/subsidy-crawler`
- Authorization 헤더: `Bearer CRAWLER_SECRET` → `Bearer SUPABASE_ANON_KEY`

---

### 4. 환경 변수 관리

#### 현재 (Vercel)
```bash
# .env.local (로컬 개발)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRAWLER_SECRET=your-secret-key

# Vercel Dashboard → Settings → Environment Variables
# 배포 시 자동으로 주입
```

#### Option 3 (Supabase)
```bash
# .env (로컬 개발)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Supabase CLI로 Secrets 설정
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# supabase/config.toml에 함수 설정
[functions.subsidy-crawler]
verify_jwt = false  # GitHub Actions 호출 시 JWT 검증 비활성화
```

---

### 5. 배포 프로세스

#### 현재 (Vercel)
```bash
# 방법 1: Git push 자동 배포
git push origin main  # Vercel이 자동으로 배포

# 방법 2: Vercel CLI 수동 배포
vercel --prod
```

#### Option 3 (Supabase)
```bash
# Supabase CLI 수동 배포 (자동 배포 없음)
supabase functions deploy subsidy-crawler

# 배포 후 함수 실행 가능 여부 테스트
supabase functions invoke subsidy-crawler \
  --data '{"enable_phase2": false}'
```

**중요**: Supabase Edge Functions는 **Git push 자동 배포가 없음**. 수동으로 `supabase functions deploy` 실행 필요.

---

### 6. 로그 및 모니터링

#### 현재 (Vercel)
- **위치**: Vercel Dashboard → Runtime Logs
- **검색 기능**: 텍스트 검색, 시간 필터, URL 필터
- **Duration 확인**: 각 요청의 실행 시간 표시 (10000ms = 타임아웃)

#### Option 3 (Supabase)
- **위치**: Supabase Dashboard → Edge Functions → Logs
- **검색 기능**: 텍스트 검색, 시간 필터
- **Duration 확인**: 각 요청의 실행 시간 표시 (150000ms = 타임아웃)
- **추가 기능**: SQL 쿼리로 로그 분석 가능 (`_logs` 테이블)

---

### 7. 타임아웃 제한 (중요)

#### 현재 (Vercel Pro)
- **Hobby**: 10초 (현재 문제 원인)
- **Pro (기본)**: 300초 (5분) ✅ Option 1/2에서 사용
- **Pro (Fluid Compute)**: 800초 (13분) - 추가 요청 시

#### Option 3 (Supabase Pro)
- **고정**: 150초 (2분 30초)
- **확장 불가**: Pro 플랜에서도 최대 150초

**비교**:
- Vercel Pro: **300초** (Option 1/2)
- Supabase Pro: **150초** (Option 3)

→ **Option 3가 오히려 타임아웃이 절반으로 줄어듦!**

---

### 8. npm 패키지 사용 (중요)

#### 현재 (Node.js)
```typescript
// package.json에 정의된 패키지 사용
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import cheerio from 'cheerio';
import OpenAI from 'openai';
```

#### Option 3 (Deno)
```typescript
// Deno는 npm: 접두사 또는 esm.sh 사용
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import axios from "npm:axios@1.6.0";
import cheerio from "npm:cheerio@1.0.0";
import OpenAI from "npm:openai@4.0.0";
```

**제약 사항**:
- 모든 npm 패키지가 Deno에서 작동하는 것은 아님
- `cheerio`, `axios`, `openai`는 Deno 호환 확인됨
- 일부 Node.js 네이티브 모듈은 작동 안 할 수 있음

---

### 9. Supabase 클라이언트 인증 (RLS 정책)

#### 현재 (Vercel)
```typescript
// Vercel 환경 변수에서 Service Role Key 사용
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // RLS 우회
);
```

#### Option 3 (Supabase Edge)
```typescript
// Edge Functions는 Supabase 내부에서 실행되므로 간단
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

**장점**: Supabase 내부에서 실행되므로 네트워크 지연 감소

---

### 10. 비용 (실질적 차이 없음)

#### 현재
- Vercel Pro: $20/월 (이미 구독 중)
- 크롤러 실행: 무료 (Pro 플랜 포함)

#### Option 3
- Supabase Pro: $25/월 (이미 구독 중)
- Edge Functions 실행: 2M invocations/월 무료
- 현재 사용량: ~120 invocations/월 (매일 1회 × 4배치 × 30일)

**추가 비용**: $0 (둘 다 이미 구독 중)

---

## ⚠️ 변경되지 않는 부분 (No Changes)

### 1. 크롤링 로직
- `crawlPhase2Source()`, `crawlGEC()`, `fetchAnnouncementDetail()` 등 **모든 크롤링 함수는 동일**
- Cheerio, Axios 사용 방식 동일 (import 방식만 변경)
- AI 검증 로직 (`OpenAI` API 호출) 동일

### 2. Supabase 데이터베이스 스키마
- `crawl_runs`, `subsidy_announcements`, `url_health_metrics` 테이블 **변경 없음**
- SQL 쿼리 로직 동일
- RLS 정책 유지

### 3. GitHub Actions 배치 처리 전략
- 4개 배치로 분할 (batch 1~4)
- 병렬 실행 (max-parallel: 4)
- 배치당 8개 센터 처리

### 4. 모니터링 대시보드
- `/admin/subsidy/monitoring-dashboard` 페이지 **변경 없음**
- API 응답 형식 동일 (`{ success, new_announcements, relevant_announcements, duration_ms }`)

---

## 📋 마이그레이션 체크리스트

Option 3 구현 시 필요한 작업:

### Phase 1: 환경 설정 (30분)
- [ ] Supabase CLI 설치 (`npm install -g supabase`)
- [ ] `supabase login` 인증
- [ ] `supabase link --project-ref your-project-ref` 프로젝트 연결
- [ ] `supabase/functions/subsidy-crawler/` 디렉토리 생성

### Phase 2: 코드 마이그레이션 (4-6시간)
- [ ] `route.ts` → `index.ts` 변환 (Node.js → Deno)
- [ ] `require()` → `import from "npm:"` 변경
- [ ] `process.env` → `Deno.env.get()` 변경
- [ ] `NextRequest/NextResponse` → `Request/Response` 변경
- [ ] `export const maxDuration` 제거 (Edge Functions는 자동 150초)
- [ ] npm 패키지 Deno 호환성 테스트
- [ ] 로컬 테스트 (`supabase functions serve subsidy-crawler`)

### Phase 3: 배포 설정 (1시간)
- [ ] `supabase/config.toml` 설정 추가
- [ ] Supabase Secrets 설정 (`SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Edge Function 배포 (`supabase functions deploy subsidy-crawler`)
- [ ] Postman/Curl로 배포된 함수 테스트

### Phase 4: GitHub Actions 수정 (30분)
- [ ] `.github/workflows/subsidy-crawler-phase2.yml` URL 변경
- [ ] Authorization 헤더 변경 (`SUPABASE_ANON_KEY` 사용)
- [ ] 수동 실행으로 테스트 (workflow_dispatch)

### Phase 5: 모니터링 및 검증 (1시간)
- [ ] Supabase Dashboard → Edge Functions Logs 확인
- [ ] Duration 값 확인 (150초 미만이어야 함)
- [ ] `crawl_runs` 테이블 데이터 확인 (정상 UPDATE 여부)
- [ ] 24시간 모니터링 (실패율 <0.5% 확인)

**총 예상 시간**: 7-9시간 (1-2일)

---

## 🎯 Option 3의 실질적 이점 (재평가)

### ✅ 장점
1. **Supabase 생태계 통합**: DB와 같은 환경에서 실행 (네트워크 지연 ↓)
2. **최고 안정성**: <0.5% 실패율 (Vercel 300초보다 더 안정적)
3. **로그 SQL 쿼리**: `_logs` 테이블로 고급 분석 가능

### ❌ 단점 (중요)
1. **타임아웃 감소**: 300초 → 150초 (오히려 줄어듦!)
2. **배포 복잡도**: Git push 자동 배포 없음, 수동 CLI 배포 필요
3. **런타임 변경**: Node.js → Deno (npm 패키지 호환성 리스크)
4. **개발 시간**: 1-2일 vs Option 2의 2-3시간

---

## 🤔 권장 사항 (최종)

### Option 2가 여전히 더 나은 이유
1. **타임아웃**: 300초 (Option 2) > 150초 (Option 3)
2. **개발 시간**: 2-3시간 (Option 2) < 1-2일 (Option 3)
3. **배포 편의성**: Git push 자동 (Option 2) > 수동 CLI (Option 3)
4. **런타임 안정성**: Node.js (검증됨) > Deno (마이그레이션 리스크)

### Option 3 선택이 유리한 경우
- Supabase 생태계에 완전히 올인하려는 경우
- Vercel을 제거하고 Supabase만 사용하려는 장기 계획
- 네트워크 지연이 크롤링 성능에 큰 영향을 미치는 경우

**결론**: **Option 2 (Vercel 300초 + 병렬 + 재시도)가 여전히 최선**
- 빠른 구현 (2-3시간)
- 높은 성공률 (<1%)
- 익숙한 개발 환경 유지
- 추가 비용 $0

---

**작성자**: Claude Sonnet 4.5
**작성일**: 2026-01-20
