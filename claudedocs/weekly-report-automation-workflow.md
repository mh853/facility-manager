# 주간 리포트 자동화 및 관리자 대시보드 구현 워크플로우

**날짜**: 2025-10-27
**목적**: 매주 금요일 17시 자동 리포트 생성 및 관리자 전체 확인 시스템 구축

---

## 📋 요구사항

### 1. 자동화 요구사항
- **스케줄**: 매주 금요일 오후 5시 (17:00) 자동 실행
- **대상**: 모든 활성 사용자 (employees 테이블의 is_active=true)
- **저장**: 생성된 리포트를 데이터베이스에 저장

### 2. 관리자 대시보드 요구사항
- **권한**: 권한 3 이상 (SUPER_ADMIN)
- **기능**:
  - 전체 사용자의 주간 리포트 목록 조회
  - 각 사용자별 간략한 통계 확인
  - 본인 업무 리포트도 포함
  - 주간 선택 기능
  - 상세 리포트 보기 (개별 사용자 클릭 시)

### 3. 제거 기능
- ❌ 이메일 발송 기능
- ❌ PDF 다운로드 기능

---

## 🏗️ 시스템 아키텍처

### 1. 데이터베이스 테이블

**새 테이블: `weekly_reports`**
```sql
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,

  -- 업무 통계
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  in_progress_tasks INTEGER NOT NULL DEFAULT 0,
  pending_tasks INTEGER NOT NULL DEFAULT 0,
  completion_rate INTEGER NOT NULL DEFAULT 0,

  -- 업무 타입별
  self_tasks INTEGER NOT NULL DEFAULT 0,
  subsidy_tasks INTEGER NOT NULL DEFAULT 0,

  -- 우선순위별 완료
  high_priority_completed INTEGER NOT NULL DEFAULT 0,
  medium_priority_completed INTEGER NOT NULL DEFAULT 0,
  low_priority_completed INTEGER NOT NULL DEFAULT 0,

  -- 성과 지표
  average_completion_time_days DECIMAL(5,1) DEFAULT 0,
  overdue_tasks INTEGER NOT NULL DEFAULT 0,

  -- 상세 데이터 (JSONB)
  completed_task_details JSONB DEFAULT '[]'::jsonb,
  pending_task_details JSONB DEFAULT '[]'::jsonb,

  -- 메타데이터
  generated_at TIMESTAMP DEFAULT NOW(),
  is_auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_weekly_reports_user_id ON weekly_reports(user_id);
CREATE INDEX idx_weekly_reports_week_start ON weekly_reports(week_start);
CREATE INDEX idx_weekly_reports_generated_at ON weekly_reports(generated_at);
CREATE INDEX idx_weekly_reports_user_week ON weekly_reports(user_id, week_start);

-- RLS 정책
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- 본인 리포트 조회 가능
CREATE POLICY "Users can view own reports"
  ON weekly_reports FOR SELECT
  USING (auth.uid() = user_id);

-- 관리자(권한 3 이상)는 전체 조회 가능
CREATE POLICY "Admins can view all reports"
  ON weekly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.permission_level >= 3
    )
  );

-- 시스템(서버)에서만 생성 가능
CREATE POLICY "System can insert reports"
  ON weekly_reports FOR INSERT
  WITH CHECK (true);
```

### 2. Cron Job 설정

**Vercel Cron 사용** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-reports",
      "schedule": "0 17 * * 5"
    }
  ]
}
```

**스케줄 설명**:
- `0 17 * * 5`: 매주 금요일 17:00 (UTC 기준)
- 한국 시간 고려: UTC+9이므로 `0 8 * * 5` (금요일 17:00 KST)

---

## 📁 구현 파일 구조

```
app/
├── api/
│   ├── cron/
│   │   └── weekly-reports/
│   │       └── route.ts          # 자동 리포트 생성 Cron Job
│   └── weekly-reports/
│       ├── route.ts               # 기존 API (GET/POST) 수정
│       └── admin/
│           └── route.ts           # 관리자용 전체 리포트 조회 API
└── admin/
    └── weekly-reports/
        ├── page.tsx               # 일반 사용자용 (본인 리포트)
        └── admin/
            └── page.tsx           # 관리자용 (전체 리포트 대시보드)

sql/
└── weekly_reports_table.sql       # 테이블 생성 스크립트
```

---

## 🚀 구현 단계

### Phase 1: 데이터베이스 설정 (30분)

**Task 1.1: 테이블 생성 SQL 작성**
- `sql/weekly_reports_table.sql` 파일 생성
- 위 스키마 복사 및 검토

**Task 1.2: Supabase에서 실행**
- Supabase SQL Editor 접속
- 스크립트 실행 및 검증
- RLS 정책 확인

---

### Phase 2: Cron Job 구현 (1시간)

**Task 2.1: Cron API 엔드포인트 생성**

**파일**: `app/api/cron/weekly-reports/route.ts`

```typescript
// app/api/cron/weekly-reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 [CRON] 주간 리포트 자동 생성 시작:', new Date().toISOString());

    // 모든 활성 사용자 조회
    const { data: users, error: usersError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('is_active', true);

    if (usersError) throw usersError;

    // 현재 주간 계산
    const { start, end } = getWeekRange();

    const results = {
      total: users?.length || 0,
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // 각 사용자별 리포트 생성
    for (const user of users || []) {
      try {
        await generateAndSaveReport(user.id, user.name, start, end);
        results.success++;
        console.log(`✅ [CRON] ${user.name} 리포트 생성 완료`);
      } catch (error: any) {
        results.failed++;
        results.errors.push({ userId: user.id, name: user.name, error: error.message });
        console.error(`❌ [CRON] ${user.name} 리포트 생성 실패:`, error);
      }
    }

    console.log('✅ [CRON] 주간 리포트 생성 완료:', results);

    return NextResponse.json({
      success: true,
      message: 'Weekly reports generated',
      results
    });

  } catch (error: any) {
    console.error('❌ [CRON] 리포트 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// 주간 범위 계산
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;

  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    start: weekStart.toISOString(),
    end: weekEnd.toISOString()
  };
}

// 리포트 생성 및 저장
async function generateAndSaveReport(
  userId: string,
  userName: string,
  weekStart: string,
  weekEnd: string
) {
  // 업무 조회
  const { data: tasks } = await supabaseAdmin
    .from('facility_tasks')
    .select('*')
    .eq('assignee', userName)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .or(`created_at.gte.${weekStart},updated_at.gte.${weekStart},completed_at.gte.${weekStart}`)
    .lte('created_at', weekEnd);

  // 통계 계산 (기존 로직 재사용)
  const stats = calculateWeeklyStats(tasks || [], weekStart, weekEnd);

  // 데이터베이스에 저장
  const { error } = await supabaseAdmin
    .from('weekly_reports')
    .insert({
      user_id: userId,
      user_name: userName,
      week_start: weekStart,
      week_end: weekEnd,
      ...stats,
      is_auto_generated: true
    });

  if (error) throw error;
}

// 통계 계산 함수 (기존 API 로직 재사용)
function calculateWeeklyStats(tasks: any[], weekStart: string, weekEnd: string) {
  // ... (기존 /api/weekly-reports의 통계 계산 로직 복사)
}
```

**Task 2.2: vercel.json 설정**

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-reports",
      "schedule": "0 8 * * 5"
    }
  ]
}
```

**Task 2.3: 환경변수 설정**

`.env.local`:
```
CRON_SECRET=your-random-secret-key-here
```

---

### Phase 3: 관리자 대시보드 API (1시간)

**파일**: `app/api/weekly-reports/admin/route.ts`

```typescript
// app/api/weekly-reports/admin/route.ts
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    // JWT 토큰 검증 및 권한 확인
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) token = cookieToken;
    }

    if (!token) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.permissionLevel < 3) {
      return createErrorResponse('권한이 부족합니다 (권한 3 이상 필요)', 403);
    }

    const { searchParams } = new URL(request.url);
    const weekDate = searchParams.get('weekDate');

    // 주간 범위 계산
    const { start, end } = getWeekRange(weekDate || undefined);

    // 모든 사용자의 해당 주간 리포트 조회
    const { data: reports, error } = await supabaseAdmin
      .from('weekly_reports')
      .select('*')
      .gte('week_start', start)
      .lte('week_end', end)
      .order('completion_rate', { ascending: false });

    if (error) throw error;

    // 전체 통계 계산
    const totalStats = {
      total_users: reports?.length || 0,
      total_tasks: reports?.reduce((sum, r) => sum + r.total_tasks, 0) || 0,
      total_completed: reports?.reduce((sum, r) => sum + r.completed_tasks, 0) || 0,
      average_completion_rate: reports?.length
        ? Math.round(reports.reduce((sum, r) => sum + r.completion_rate, 0) / reports.length)
        : 0,
      total_overdue: reports?.reduce((sum, r) => sum + r.overdue_tasks, 0) || 0
    };

    return createSuccessResponse({
      reports: reports || [],
      summary: totalStats,
      week_period: {
        start,
        end,
        display: `${start.split('T')[0]} ~ ${end.split('T')[0]}`
      }
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-REPORTS] 조회 오류:', error);
    return createErrorResponse('리포트 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

function getWeekRange(dateStr?: string) {
  // ... (동일한 로직)
}
```

---

### Phase 4: 관리자 대시보드 UI (2시간)

**파일**: `app/admin/weekly-reports/admin/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/ui/AdminLayout'
import { withAuth, useAuth } from '@/contexts/AuthContext'
import { TokenManager } from '@/lib/api-client'
import {
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  ChevronRight
} from 'lucide-react'

interface WeeklyReport {
  id: string
  user_id: string
  user_name: string
  week_start: string
  week_end: string
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  completion_rate: number
  self_tasks: number
  subsidy_tasks: number
  overdue_tasks: number
  average_completion_time_days: number
  generated_at: string
}

interface AdminSummary {
  total_users: number
  total_tasks: number
  total_completed: number
  average_completion_rate: number
  total_overdue: number
}

function AdminWeeklyReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [selectedUser, setSelectedUser] = useState<WeeklyReport | null>(null)

  // 이번 주 기본값
  useEffect(() => {
    const today = new Date()
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1))
    setSelectedWeek(monday.toISOString().split('T')[0])
  }, [])

  const fetchAdminReports = async () => {
    if (!selectedWeek) return

    setLoading(true)
    try {
      const token = TokenManager.getToken()
      const response = await fetch(
        `/api/weekly-reports/admin?weekDate=${selectedWeek}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      const data = await response.json()

      if (data.success) {
        setReports(data.data.reports)
        setSummary(data.data.summary)
      } else {
        console.error('리포트 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('리포트 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedWeek) {
      fetchAdminReports()
    }
  }, [selectedWeek])

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100'
    if (rate >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <AdminLayout
      title="주간 리포트 관리"
      description="전체 사용자의 주간 업무 성과 확인 (관리자 전용)"
    >
      <div className="space-y-6">
        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">주간 선택:</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={fetchAdminReports}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {loading ? '조회중...' : '리포트 조회'}
            </button>
          </div>
        </div>

        {/* 전체 통계 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_users}</div>
                  <div className="text-sm text-gray-600">전체 사용자</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_tasks}</div>
                  <div className="text-sm text-gray-600">총 업무</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_completed}</div>
                  <div className="text-sm text-gray-600">완료 업무</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-indigo-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.average_completion_rate}%</div>
                  <div className="text-sm text-gray-600">평균 완료율</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">{summary.total_overdue}</div>
                  <div className="text-sm text-gray-600">전체 연체</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용자별 리포트 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">사용자별 주간 성과</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedUser(report)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900">{report.user_name}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(report.completion_rate)}`}>
                        {report.completion_rate}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
                      <span>총 {report.total_tasks}개</span>
                      <span className="text-green-600">완료 {report.completed_tasks}개</span>
                      <span className="text-blue-600">진행 {report.in_progress_tasks}개</span>
                      {report.overdue_tasks > 0 && (
                        <span className="text-red-600">연체 {report.overdue_tasks}개</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}

            {reports.length === 0 && !loading && (
              <div className="p-12 text-center text-gray-500">
                해당 주간의 리포트가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default withAuth(AdminWeeklyReportsPage, undefined, 3) // 권한 3 이상
```

---

### Phase 5: 기존 API 수정 (30분)

**Task 5.1: 리포트 저장 기능 추가**

`app/api/weekly-reports/route.ts`의 GET 메서드에 저장 옵션 추가:

```typescript
// 리포트 생성 후 DB에 저장하는 옵션 추가
const saveToDb = searchParams.get('save') === 'true';

if (saveToDb) {
  await supabaseAdmin.from('weekly_reports').insert({
    user_id: userId,
    user_name: user.name,
    week_start: weekStart,
    week_end: weekEnd,
    ...weeklyReport,
    is_auto_generated: false
  });
}
```

---

## ✅ 완료 체크리스트

### Phase 1: 데이터베이스
- [ ] `weekly_reports` 테이블 생성 SQL 작성
- [ ] Supabase에서 테이블 생성 실행
- [ ] RLS 정책 확인 및 테스트

### Phase 2: Cron Job
- [ ] `/api/cron/weekly-reports/route.ts` 구현
- [ ] `vercel.json` cron 설정 추가
- [ ] 환경변수 `CRON_SECRET` 설정
- [ ] 로컬 테스트 (수동 호출)

### Phase 3: 관리자 API
- [ ] `/api/weekly-reports/admin/route.ts` 구현
- [ ] 권한 검증 로직 추가
- [ ] API 테스트 (Postman/Thunder Client)

### Phase 4: 관리자 UI
- [ ] `/admin/weekly-reports/admin/page.tsx` 구현
- [ ] 권한 3 이상 접근 제한 설정
- [ ] 전체 통계 카드 표시
- [ ] 사용자별 리스트 표시
- [ ] 반응형 디자인 확인

### Phase 5: 통합 테스트
- [ ] Cron Job 수동 실행 테스트
- [ ] 리포트 자동 생성 확인
- [ ] 관리자 대시보드 접근 테스트
- [ ] 권한 3 미만 사용자 차단 확인
- [ ] 본인 업무 리포트 포함 확인

---

## 🚨 주의사항

1. **Vercel Cron 제한사항**:
   - Free tier: 1일 1회 실행 제한
   - Pro tier: 무제한
   - 대안: Supabase Edge Functions + pg_cron

2. **시간대 설정**:
   - Vercel Cron은 UTC 기준
   - 한국 시간 17:00 = UTC 08:00
   - Schedule: `0 8 * * 5`

3. **RLS 정책**:
   - 서버에서 생성할 때 `supabaseAdmin` 사용 (RLS 우회)
   - 클라이언트 조회 시 RLS 정책 적용

4. **성능 최적화**:
   - 사용자 수가 많을 경우 배치 처리
   - JSONB 필드 인덱싱 고려
   - 오래된 리포트 자동 삭제 정책

---

## 📝 예상 소요 시간

- **Phase 1**: 30분 (테이블 생성)
- **Phase 2**: 1시간 (Cron Job)
- **Phase 3**: 1시간 (관리자 API)
- **Phase 4**: 2시간 (관리자 UI)
- **Phase 5**: 30분 (통합 및 테스트)

**총 예상 시간**: 5시간

---

## 🎯 최종 결과물

1. **자동화**:
   - 매주 금요일 17시 자동 리포트 생성
   - 모든 활성 사용자 대상
   - 데이터베이스에 저장

2. **관리자 대시보드** (`/admin/weekly-reports/admin`):
   - 전체 사용자 주간 성과 한눈에 확인
   - 본인 리포트도 포함
   - 주간 선택 가능
   - 사용자별 상세 정보 확인

3. **일반 사용자** (`/weekly-reports`):
   - 본인 리포트만 조회
   - 실시간 생성 또는 저장된 리포트 조회
