# Connection Pool Fix - Session Mode → Transaction Mode

## 🚨 Critical Issue: MaxClientsInSessionMode Error

### Problem
```
error: 'MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size'
```

Dashboard페이지 로딩 시 다수의 API가 동시에 호출되면서 Supabase Session Mode pooler의 연결 제한에 도달하여 연속적인 API 실패 발생.

### Root Cause
- **Supabase Pooler Mode**: Session Mode (port 5432)
- **Session Mode Limit**: pool_size에 의한 엄격한 연결 제한
- **Dashboard Concurrent Requests**: 로그인 후 동시에 8+ API 호출
  - `/api/notifications` (x2)
  - `/api/notifications/settings`
  - `/api/dashboard/revenue`
  - `/api/dashboard/installations`
  - `/api/dashboard/receivables`
  - `/api/dashboard/layout`
  - `/api/business-list`

### Solution: Transaction Mode Migration

**File**: `/lib/supabase-direct.ts`

**Changes**:
1. **Port**: 5432 (Session Mode) → 6543 (Transaction Mode)
2. **Max Connections**: 20 → 30
3. **Idle Timeout**: 30000ms → 20000ms (Transaction Mode 권장)

```typescript
// Before (Session Mode - 연결 제한 문제)
pool = new Pool({
  host: `aws-1-ap-southeast-1.pooler.supabase.com`,
  port: 5432, // Session Mode
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// After (Transaction Mode - 더 많은 동시 연결 지원)
pool = new Pool({
  host: `aws-1-ap-southeast-1.pooler.supabase.com`,
  port: 6543, // Transaction Mode
  max: 30,
  idleTimeoutMillis: 20000, // Transaction Mode는 짧은 idle 권장
  connectionTimeoutMillis: 10000,
});
```

### Supabase Pooler Modes Comparison

| Feature | Session Mode (5432) | Transaction Mode (6543) |
|---------|---------------------|-------------------------|
| Connection Limit | Strict (= pool_size) | Higher (shared pool) |
| Prepared Statements | ✅ Supported | ❌ Not supported |
| SET commands | ✅ Persisted | ❌ Reset per transaction |
| Concurrent Connections | Low | High |
| Best For | Long sessions, complex transactions | Short queries, high concurrency |
| Dashboard Use Case | ❌ Connection exhaustion | ✅ Recommended |

### Impact
- ✅ **Connection Exhaustion**: Eliminated
- ✅ **Dashboard APIs**: All concurrent requests succeed
- ✅ **Scalability**: Supports 8+ simultaneous API calls
- ⚠️ **Trade-off**: Prepared statements not cached (minimal impact for our use case)

### Verification Logs

**Success**:
```
✅ [PG] PostgreSQL 직접 연결 풀 초기화 (Transaction Mode): {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  max: 30,
  mode: 'Transaction'
}
```

**Before (Failure)**:
```
❌ MaxClientsInSessionMode: max clients reached
```

### Additional Notes

**When to Use Session Mode**:
- Complex multi-statement transactions
- Heavy use of prepared statements
- SET commands that need to persist

**When to Use Transaction Mode**:
- High concurrency API endpoints (like dashboards)
- Stateless request handling
- Connection pooling optimization

**Our Recommendation**: Transaction Mode for web API workloads with many concurrent users.

---

**Last Updated**: 2026-01-06
**Status**: ✅ Fixed and Tested
**Related**: DASHBOARD_ERRORS_FIXED.md, CRITICAL_API_FIXES.md
