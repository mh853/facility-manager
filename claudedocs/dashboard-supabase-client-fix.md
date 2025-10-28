# 대시보드 Supabase 클라이언트 오류 수정

## 🐛 발생한 에러

### 에러 메시지
```
❌ [Dashboard Revenue API Error] Error: supabaseUrl is required.
GET /api/dashboard/revenue?months=12 500 in 29ms
```

### 에러 스택 트레이스
```
at validateSupabaseUrl (webpack-internal:///(rsc)/./node_modules/@supabase/supabase-js/dist/module/lib/helpers.js:59:15)
at new SupabaseClient (webpack-internal:///(rsc)/./node_modules/@supabase/supabase-js/dist/module/SupabaseClient.js:53:90)
at createClient (webpack-internal:///(rsc)/./node_modules/@supabase/supabase-js/dist/module/index.js:63:12)
at GET (webpack-internal:///(rsc)/./app/api/dashboard/revenue/route.ts:22:91)
```

---

## 🔍 원인 분석

### 1. 잘못된 import 사용

**문제 코드**:
```typescript
import { createClient } from '@/lib/supabase'  // ❌ 잘못됨

const supabase = await createClient();  // ❌ 인자 없이 호출
```

### 2. lib/supabase.ts의 export 구조

`lib/supabase.ts` 파일은 두 가지 클라이언트를 제공:

```typescript
// 1. 클라이언트용 (브라우저)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

// 2. 서버용 (관리자 권한)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// 3. 잘못된 export (인자가 필요함)
export { createClient };  // ❌ 이것을 import하면 안됨
```

### 3. 다른 API Route의 올바른 사용 예

**올바른 코드** (다른 API들):
```typescript
import { supabaseAdmin } from '@/lib/supabase'  // ✅ 올바름

// 바로 사용 가능 (이미 초기화됨)
const { data, error } = await supabaseAdmin
  .from('business_info')
  .select('*');
```

---

## ✅ 해결 방법

### 수정된 코드

**Before** (에러 발생):
```typescript
import { createClient } from '@/lib/supabase'  // ❌

export async function GET(request: NextRequest) {
  const supabase = await createClient();  // ❌ supabaseUrl is required
  // ...
}
```

**After** (정상 작동):
```typescript
import { supabaseAdmin } from '@/lib/supabase'  // ✅

export async function GET(request: NextRequest) {
  const supabase = supabaseAdmin;  // ✅ 이미 초기화된 클라이언트 사용
  // ...
}
```

### 변경 사항
1. import 변경: `createClient` → `supabaseAdmin`
2. 할당 변경: `await createClient()` → `supabaseAdmin`

---

## 📊 API Route에서 Supabase 사용 가이드

### 올바른 패턴

```typescript
// ✅ API Route에서 사용
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // 바로 사용 (await 불필요)
  const { data, error } = await supabaseAdmin
    .from('table_name')
    .select('*');

  return NextResponse.json({ data });
}
```

### 잘못된 패턴

```typescript
// ❌ 이렇게 하지 마세요
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = createClient();  // ❌ 인자 없음
  // 또는
  const supabase = await createClient();  // ❌ 여전히 인자 없음
}

// ❌ 이것도 하지 마세요
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabase = createClient(url, key);  // ❌ 환경변수 직접 처리 필요
}
```

---

## 🔧 왜 supabaseAdmin을 사용해야 하는가?

### 1. 이미 초기화됨
- `supabaseAdmin`은 `lib/supabase.ts`에서 환경변수와 함께 이미 생성됨
- URL, 서비스 키, 설정이 모두 포함되어 있음

### 2. 서버 권한
- `SUPABASE_SERVICE_ROLE_KEY` 사용
- Row Level Security (RLS) 우회 가능
- 모든 테이블 접근 권한

### 3. 일관성
- 프로젝트 전체에서 동일한 클라이언트 사용
- 설정 중앙 관리

### 4. 타입 안전성
```typescript
export const typedSupabaseAdmin = supabaseAdmin as any;
// 필요시 타입이 지정된 버전 사용 가능
```

---

## 📝 프로젝트 전체 패턴

### Client Component (브라우저)
```typescript
import { supabase } from '@/lib/supabase'

// 브라우저에서 실행되는 코드
const { data } = await supabase
  .from('public_table')
  .select('*');
```

### API Route (서버)
```typescript
import { supabaseAdmin } from '@/lib/supabase'

// 서버에서 실행되는 코드
const { data } = await supabaseAdmin
  .from('any_table')
  .select('*');
```

### Server Action (서버)
```typescript
'use server'

import { supabaseAdmin } from '@/lib/supabase'

export async function myServerAction() {
  const { data } = await supabaseAdmin
    .from('any_table')
    .select('*');
}
```

---

## 🧪 테스트 결과

### Before (에러)
```bash
GET /api/dashboard/revenue?months=12 500 in 29ms
❌ Error: supabaseUrl is required
```

### After (정상)
```bash
GET /api/dashboard/revenue?months=12 200 in 150ms
✅ 데이터 정상 반환
```

---

## 📚 참고: lib/supabase.ts 구조

```typescript
// 환경변수
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 클라이언트용 (익명 키 사용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
});

// 서버용 (서비스 키 사용)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// ❌ 이것을 import하지 마세요 (인자가 필요함)
export { createClient };
```

---

## ⚠️ 주의사항

### 1. 환경변수 필수
API Route가 작동하려면 `.env.local`에 다음이 필요:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. 서비스 키 보안
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출하지 말 것
- API Route에서만 사용 (서버 사이드)
- Git에 커밋하지 말 것 (`.env.local`은 `.gitignore`에 포함)

### 3. RLS 우회
- `supabaseAdmin`은 Row Level Security를 우회
- 권한 체크는 직접 구현 필요
- 민감한 작업은 추가 검증 필요

---

## 🔄 다른 API들도 확인

### 이미 올바르게 사용 중인 API들
```
✅ app/api/business-info/route.ts
✅ app/api/auth/set-password/route.ts
✅ app/api/business-equipment-counts/route.ts
✅ app/api/auth/verify/route.ts
✅ app/api/business-id/route.ts
✅ app/api/business-contacts/route.ts
✅ app/api/revenue/business-summary/route.ts
```

모두 `import { supabaseAdmin } from '@/lib/supabase'` 패턴 사용

---

## 🎯 핵심 요약

| 항목 | 올바른 방법 | 잘못된 방법 |
|------|------------|-----------|
| **Import** | `import { supabaseAdmin } from '@/lib/supabase'` | `import { createClient } from '@/lib/supabase'` |
| **사용** | `const supabase = supabaseAdmin` | `const supabase = createClient()` |
| **초기화** | 이미 초기화됨, 바로 사용 | 인자 필요, 환경변수 처리 필요 |
| **권한** | 서비스 키 (전체 권한) | 익명 키 또는 에러 |

---

## ✅ 수정 완료

- ✅ Revenue API import 수정 (`createClient` → `supabaseAdmin`)
- ✅ Supabase 클라이언트 초기화 오류 해결
- ✅ API 정상 작동 확인
- ✅ 문서화 완료

**다음 단계**: 브라우저에서 대시보드 새로고침하여 데이터 표시 확인

---

**작성일**: 2025-10-28
**작성자**: Claude Code
**버전**: v1.2.1 (Hotfix)
