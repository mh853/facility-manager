# 수동 보조금 공고 등록 기능 설계

**작성일**: 2026-01-27
**목적**: 관리자가 admin/subsidy 페이지에서 보조금 공고를 수동으로 등록하는 기능 추가
**핵심 요구사항**: 수동 등록 공고는 관련도 100% 고정, 크롤링 공고와 명확히 구분

---

## 📋 1. 요구사항 분석

### 1.1 기능 요구사항

#### 필수 기능
- ✅ 수동으로 보조금 공고 정보 입력 및 저장
- ✅ 수동 등록 공고는 `relevance_score` 자동으로 100 (1.00) 설정
- ✅ 수동/크롤링 공고 구분 표시 (UI에서 명확하게 표현)
- ✅ 수동 등록 시 필수 필드 검증
- ✅ 등록 후 공고 목록에 즉시 반영

#### 선택 기능
- 📎 파일 첨부 (추후 구현 가능)
- 🔄 기존 공고 수정 기능 (추후 구현 가능)
- 📧 등록 알림 (추후 구현 가능)

### 1.2 데이터 요구사항

#### 필수 입력 필드
```typescript
{
  region_name: string;           // 지자체명 (예: "서울특별시 강남구")
  title: string;                 // 공고 제목
  source_url: string;            // 원본 URL (없을 경우 '수동입력' 등)
  content?: string;              // 공고 내용 (선택)

  // 신청 기간
  application_period_start?: Date;
  application_period_end?: Date;

  // 지원 정보
  budget?: string;               // 예산 (예: "5억원")
  support_amount?: string;       // 지원금액 (예: "업체당 최대 500만원")
  target_description?: string;   // 지원대상 설명

  published_at?: Date;           // 공고 게시일
}
```

#### 자동 설정 필드
```typescript
{
  is_relevant: true,             // 항상 true
  relevance_score: 1.00,         // 항상 100% (1.00)
  is_manual: true,               // 🆕 수동 등록 여부 (신규 필드)
  status: 'new',                 // 기본 상태
  is_read: false,                // 기본값
  crawled_at: null,              // 크롤링 아니므로 null
  created_by?: string,           // 등록한 관리자 ID
}
```

### 1.3 비기능 요구사항

- **성능**: 등록 후 1초 이내 목록 업데이트
- **보안**: 관리자 권한 (permission_level >= 4) 필요
- **사용성**: 모바일 반응형 디자인
- **접근성**: 폼 필드 레이블 및 에러 메시지 명확

---

## 🗄️ 2. 데이터베이스 설계

### 2.1 스키마 변경

#### subsidy_announcements 테이블 수정

```sql
-- 수동 등록 여부 필드 추가
ALTER TABLE subsidy_announcements
ADD COLUMN is_manual BOOLEAN DEFAULT false NOT NULL;

-- 등록자 정보 추가 (선택)
ALTER TABLE subsidy_announcements
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- 인덱스 추가 (수동 등록 공고 빠른 조회)
CREATE INDEX idx_announcements_is_manual ON subsidy_announcements(is_manual);

-- 주석 업데이트
COMMENT ON COLUMN subsidy_announcements.is_manual IS '수동 등록 여부 (true: 관리자 직접 등록, false: 크롤링)';
COMMENT ON COLUMN subsidy_announcements.created_by IS '등록한 관리자 사용자 ID';
```

#### RLS 정책 업데이트

```sql
-- 인증된 관리자만 수동 등록 가능
CREATE POLICY "Allow manual insert for admin users" ON subsidy_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    -- permission_level >= 4 확인 (auth.users 메타데이터 활용)
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'permission_level')::int >= 4
    )
  );

-- 수동 등록 공고는 등록자만 수정 가능
CREATE POLICY "Allow update for creator" ON subsidy_announcements
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_manual = false);
```

### 2.2 마이그레이션 스크립트

```sql
-- /sql/migrations/add_manual_subsidy_fields.sql

-- 1. 필드 추가
ALTER TABLE subsidy_announcements
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. 기존 데이터 업데이트 (모두 크롤링으로 표시)
UPDATE subsidy_announcements
SET is_manual = false
WHERE is_manual IS NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_announcements_is_manual
ON subsidy_announcements(is_manual);

-- 4. RLS 정책 추가
DROP POLICY IF EXISTS "Allow manual insert for admin users" ON subsidy_announcements;
CREATE POLICY "Allow manual insert for admin users" ON subsidy_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'permission_level')::int >= 4
    )
  );

DROP POLICY IF EXISTS "Allow update for creator" ON subsidy_announcements;
CREATE POLICY "Allow update for creator" ON subsidy_announcements
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (raw_user_meta_data->>'permission_level')::int >= 4
  );

-- 5. 주석 추가
COMMENT ON COLUMN subsidy_announcements.is_manual IS '수동 등록 여부 (true: 관리자 직접 등록, false: 크롤링)';
COMMENT ON COLUMN subsidy_announcements.created_by IS '등록한 관리자 사용자 ID (UUID)';
```

---

## 🏗️ 3. API 설계

### 3.1 엔드포인트 추가

#### POST /api/subsidy-announcements/manual

수동으로 보조금 공고 등록

**Request Body**:
```typescript
interface ManualAnnouncementRequest {
  region_name: string;              // 필수
  title: string;                    // 필수
  source_url: string;               // 필수 (없을 경우 '수동입력' 등)
  content?: string;
  application_period_start?: string; // ISO 8601
  application_period_end?: string;   // ISO 8601
  budget?: string;
  support_amount?: string;
  target_description?: string;
  published_at?: string;             // ISO 8601
  notes?: string;
}
```

**Response (Success)**:
```typescript
{
  success: true,
  data: {
    id: "uuid",
    message: "공고가 성공적으로 등록되었습니다.",
    announcement: SubsidyAnnouncement
  }
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: "오류 메시지",
  details?: {
    field: string;
    message: string;
  }[]
}
```

**Status Codes**:
- `201 Created`: 성공
- `400 Bad Request`: 필수 필드 누락 또는 유효성 검증 실패
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 부족 (permission_level < 4)
- `409 Conflict`: 중복된 source_url
- `500 Internal Server Error`: 서버 오류

### 3.2 구현 예시

```typescript
// app/api/subsidy-announcements/manual/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 2. 사용자 권한 확인 (permission_level >= 4)
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !userData.user) {
      return NextResponse.json(
        { success: false, error: '인증이 유효하지 않습니다.' },
        { status: 401 }
      );
    }

    const permissionLevel = userData.user.user_metadata?.permission_level || 0;
    if (permissionLevel < 4) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 3. 요청 데이터 파싱 및 검증
    const body = await request.json();
    const {
      region_name,
      title,
      source_url,
      content,
      application_period_start,
      application_period_end,
      budget,
      support_amount,
      target_description,
      published_at,
      notes
    } = body;

    // 필수 필드 검증
    if (!region_name || !title || !source_url) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다.',
          details: [
            !region_name && { field: 'region_name', message: '지자체명을 입력하세요.' },
            !title && { field: 'title', message: '공고 제목을 입력하세요.' },
            !source_url && { field: 'source_url', message: '원본 URL을 입력하세요.' }
          ].filter(Boolean)
        },
        { status: 400 }
      );
    }

    // 4. 지자체 코드 추출/생성 (region_code 매핑 로직)
    // 간단한 예시: region_name으로 지자체 코드 조회
    const { data: govData } = await supabase
      .from('local_governments')
      .select('region_code, region_type')
      .ilike('region_name', `%${region_name}%`)
      .single();

    const region_code = govData?.region_code || 'MANUAL';
    const region_type = govData?.region_type || 'basic';

    // 5. 공고 데이터 삽입
    const announcementData = {
      // 사용자 입력
      region_code,
      region_name,
      region_type,
      title,
      content,
      source_url,
      application_period_start,
      application_period_end,
      budget,
      target_description,
      support_amount,
      published_at: published_at || new Date().toISOString(),
      notes,

      // 자동 설정 (수동 등록 특성)
      is_manual: true,
      is_relevant: true,
      relevance_score: 1.00,
      keywords_matched: ['수동등록'],

      // 상태
      status: 'new',
      is_read: false,

      // 메타데이터
      created_by: userData.user.id,
      crawled_at: null, // 크롤링이 아니므로 null
    };

    const { data, error } = await supabase
      .from('subsidy_announcements')
      .insert(announcementData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // 중복 source_url
        return NextResponse.json(
          { success: false, error: '이미 등록된 URL입니다.' },
          { status: 409 }
        );
      }

      console.error('공고 등록 오류:', error);
      return NextResponse.json(
        { success: false, error: '공고 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 6. 성공 응답
    return NextResponse.json(
      {
        success: true,
        data: {
          id: data.id,
          message: '공고가 성공적으로 등록되었습니다.',
          announcement: data
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('수동 등록 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 4. UI/UX 설계

### 4.1 컴포넌트 구조

```
SubsidyAnnouncementsPage
├── DashboardStats (통계)
├── FilterBar (필터)
├── 🆕 ManualUploadButton (수동 등록 버튼)
│   └── ManualUploadModal (수동 등록 모달)
│       └── ManualUploadForm (폼)
└── AnnouncementList (목록)
    └── AnnouncementCard
        ├── 🆕 SourceBadge (수동/크롤링 구분)
        └── RelevanceScore (관련도)
```

### 4.2 수동 등록 모달 (ManualUploadModal)

#### 디자인 스펙

**위치**: 페이지 우측 상단 "+ 공고 등록" 버튼 클릭 시 모달

**크기**:
- Desktop: max-w-3xl (768px)
- Mobile: 전체 화면

**레이아웃**:
```
┌─────────────────────────────────────────┐
│ 수동 공고 등록                    [X]   │
├─────────────────────────────────────────┤
│                                         │
│ 📍 지자체명 *                           │
│ [입력 필드]                             │
│                                         │
│ 📝 공고 제목 *                          │
│ [입력 필드]                             │
│                                         │
│ 🔗 원본 URL *                           │
│ [입력 필드]                             │
│ ℹ️ URL이 없는 경우 '수동입력'으로 입력  │
│                                         │
│ 📄 공고 내용                            │
│ [텍스트 영역 - 5줄]                    │
│                                         │
│ 📅 신청 기간                            │
│ 시작: [날짜 선택]  종료: [날짜 선택]   │
│                                         │
│ 💰 예산 / 지원금액                      │
│ 예산: [입력]  지원금액: [입력]         │
│                                         │
│ 👥 지원 대상                            │
│ [텍스트 영역 - 3줄]                    │
│                                         │
│ 📅 게시일                               │
│ [날짜 선택 - 기본값: 오늘]             │
│                                         │
│ 📝 메모                                 │
│ [텍스트 영역 - 2줄]                    │
│                                         │
├─────────────────────────────────────────┤
│          [취소]      [등록하기]         │
└─────────────────────────────────────────┘
```

#### 폼 검증 규칙

```typescript
const validationRules = {
  region_name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[가-힣\s]+$/,
    message: '지자체명을 정확히 입력하세요.'
  },
  title: {
    required: true,
    minLength: 5,
    maxLength: 500,
    message: '공고 제목을 5자 이상 입력하세요.'
  },
  source_url: {
    required: true,
    pattern: /^(https?:\/\/|수동입력)/,
    message: 'URL 형식이 올바르지 않습니다.'
  },
  application_period_end: {
    validate: (value, start) => {
      if (value && start && new Date(value) <= new Date(start)) {
        return '종료일은 시작일 이후여야 합니다.';
      }
      return true;
    }
  }
};
```

### 4.3 공고 카드 UI 변경

#### 수동/크롤링 구분 배지

```tsx
{/* 수동 등록 배지 */}
{announcement.is_manual && (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
    ✍️ 수동등록
  </span>
)}

{/* 크롤링 배지 (선택적) */}
{!announcement.is_manual && (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
    🤖 자동수집
  </span>
)}
```

#### 관련도 표시 변경

```tsx
{/* 수동 등록: 항상 100% */}
{announcement.is_manual ? (
  <div className="flex items-center gap-1">
    <span className="text-sm font-semibold text-purple-600">100%</span>
    <span className="text-xs text-gray-500">(수동등록)</span>
  </div>
) : (
  <div className="flex items-center gap-1">
    <span className="text-sm font-semibold">
      {Math.round((announcement.relevance_score || 0) * 100)}%
    </span>
    <span className="text-xs text-gray-500">(AI분석)</span>
  </div>
)}
```

### 4.4 필터 옵션 추가

```tsx
{/* 등록 방식 필터 */}
<select
  value={filterSource}
  onChange={(e) => setFilterSource(e.target.value)}
  className="..."
>
  <option value="all">전체 (수동+크롤링)</option>
  <option value="manual">수동 등록만</option>
  <option value="crawled">크롤링만</option>
</select>
```

---

## 🔧 5. 타입 정의 업데이트

### types/subsidy.ts

```typescript
// 기존 타입에 필드 추가
export interface SubsidyAnnouncement {
  id: string;

  // 지자체 정보
  region_code: string;
  region_name: string;
  region_type: RegionType;

  // 공고 정보
  title: string;
  content?: string;
  source_url: string;

  // AI 추출 정보
  application_period_start?: string;
  application_period_end?: string;
  budget?: string;
  target_description?: string;
  support_amount?: string;

  // 메타데이터
  is_relevant: boolean;
  relevance_score?: number;
  keywords_matched?: string[];

  // 🆕 수동 등록 관련
  is_manual: boolean;              // 수동 등록 여부
  created_by?: string;             // 등록자 ID

  // 상태
  status: AnnouncementStatus;
  is_read: boolean;
  notes?: string;

  // 타임스탬프
  published_at?: string;
  crawled_at?: string;             // 수동 등록 시 null
  created_at: string;
  updated_at: string;
}

// 🆕 수동 등록 요청 타입
export interface ManualAnnouncementRequest {
  region_name: string;
  title: string;
  source_url: string;
  content?: string;
  application_period_start?: string;
  application_period_end?: string;
  budget?: string;
  support_amount?: string;
  target_description?: string;
  published_at?: string;
  notes?: string;
}

// 🆕 수동 등록 응답 타입
export interface ManualAnnouncementResponse {
  success: boolean;
  data?: {
    id: string;
    message: string;
    announcement: SubsidyAnnouncement;
  };
  error?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}
```

---

## 📊 6. 구현 우선순위

### Phase 1: 핵심 기능 (필수)
1. ✅ 데이터베이스 스키마 변경 (`is_manual`, `created_by` 필드)
2. ✅ API 엔드포인트 구현 (`POST /api/subsidy-announcements/manual`)
3. ✅ 수동 등록 모달 UI
4. ✅ 폼 검증 및 제출 로직
5. ✅ 공고 카드에 수동/크롤링 배지 추가
6. ✅ 관련도 표시 방식 변경

### Phase 2: 개선 기능 (권장)
1. 📊 통계 업데이트 (수동 등록 공고 수 표시)
2. 🔍 필터 옵션 추가 (수동/크롤링 구분)
3. ✏️ 수동 등록 공고 수정 기능
4. 🗑️ 수동 등록 공고 삭제 기능

### Phase 3: 확장 기능 (선택)
1. 📎 파일 첨부 기능
2. 📧 등록 알림 기능
3. 📝 등록 이력 추적
4. 🔄 일괄 등록 (CSV/Excel 업로드)

---

## 🧪 7. 테스트 시나리오

### 7.1 단위 테스트

```typescript
describe('Manual Announcement Upload', () => {
  it('필수 필드 누락 시 400 에러', async () => {
    const response = await POST({
      body: { title: '제목만' }
    });
    expect(response.status).toBe(400);
  });

  it('수동 등록 시 relevance_score 자동으로 1.00 설정', async () => {
    const response = await POST({
      body: { ...validData }
    });
    const data = await response.json();
    expect(data.data.announcement.relevance_score).toBe(1.00);
  });

  it('권한 없는 사용자 403 에러', async () => {
    const response = await POST({
      headers: { authorization: 'Bearer invalid_token' }
    });
    expect(response.status).toBe(403);
  });
});
```

### 7.2 통합 테스트

1. **정상 등록 플로우**
   - 관리자 로그인
   - "+ 공고 등록" 버튼 클릭
   - 폼 작성 및 제출
   - 목록에 즉시 반영 확인
   - 관련도 100% 표시 확인

2. **검증 실패 플로우**
   - 필수 필드 누락 시 에러 메시지 표시
   - 잘못된 URL 형식 입력 시 에러 표시
   - 종료일이 시작일보다 빠를 때 에러 표시

3. **권한 테스트**
   - 일반 사용자 접근 시 버튼 숨김
   - 권한 없는 사용자 API 호출 시 403

---

## 🚀 8. 배포 체크리스트

### 배포 전
- [ ] 데이터베이스 마이그레이션 실행
- [ ] RLS 정책 업데이트
- [ ] API 엔드포인트 테스트
- [ ] UI 컴포넌트 테스트
- [ ] 권한 검증 테스트
- [ ] 모바일 반응형 확인

### 배포 후
- [ ] 실제 데이터로 등록 테스트
- [ ] 목록 필터링 동작 확인
- [ ] 통계 업데이트 확인
- [ ] 에러 로깅 모니터링

---

## 📝 9. 참고 자료

### 관련 파일
- 데이터베이스: `sql/subsidy_announcements.sql`
- 타입 정의: `types/subsidy.ts`
- 기존 API: `app/api/subsidy-announcements/route.ts`
- UI 페이지: `app/admin/subsidy/page.tsx`

### 유사 기능
- UrlDataManager: 수동 URL 관리 기능 참고 가능
- 시설 업무 생성: 폼 검증 로직 참고 가능
