# Manual Upload Fixes - 2026-01-27

## Issues Fixed

### 1. 천 단위 콤마 자동 입력 (Budget & Support Amount)

**Problem**: 예산규모와 지원금액 필드에서 숫자 입력 시 천 단위 콤마가 자동으로 추가되지 않음

**Solution**:
- `formatNumberWithCommas()` 함수 추가: 숫자를 입력하면 자동으로 천 단위 콤마 포맷 적용
- `removeCommas()` 함수 추가: API 전송 시 콤마 제거하여 순수 숫자만 전송
- `handleNumberChange()` 핸들러 추가: 예산/지원금액 필드 전용 변경 핸들러

**Changes**:
```typescript
// 숫자에 천 단위 콤마 추가
const formatNumberWithCommas = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 예산/지원금액 필드 전용 핸들러
const handleNumberChange = (field: 'budget' | 'support_amount', value: string) => {
  const formatted = formatNumberWithCommas(value);
  setFormData(prev => ({ ...prev, [field]: formatted }));
};
```

**UI Updates**:
- Placeholder 변경: `예: 10억원` → `예: 10,000,000`
- 안내 문구 추가: "숫자만 입력하세요 (천 단위 콤마 자동)"

**Example**:
- 입력: `10000000` → 화면 표시: `10,000,000`
- 전송: `10,000,000` → API: `10000000` (콤마 제거)

---

### 2. 공고 등록 실패 문제 (인증 세션 오류)

**Problem**: "인증 세션이 만료되었습니다" 오류 발생하며 공고 등록 실패

**Root Cause Analysis**:
1. Supabase 환경 변수가 클라이언트에서 제대로 로드되지 않음
2. 세션 오류 시 상세 정보가 출력되지 않아 디버깅 어려움
3. API 서버에서도 로그가 없어 문제 파악 불가

**Solution**:

#### Frontend (ManualUploadModal.tsx)
1. **환경 변수 검증 추가**:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  setError('Supabase 설정이 올바르지 않습니다. 관리자에게 문의하세요.');
  console.error('Missing Supabase environment variables');
  return;
}
```

2. **세션 오류 처리 개선**:
```typescript
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (sessionError) {
  console.error('Session error:', sessionError);
  setError(`세션 오류: ${sessionError.message}`);
  return;
}

if (!session) {
  setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
  console.error('No active session found');
  return;
}
```

3. **디버깅 로그 추가**:
```typescript
console.log('Session found, user:', session.user.id);
console.log('Sending request body:', requestBody);
console.log('Response status:', response.status);
console.log('Response data:', result);
```

#### Backend (route.ts)
1. **상세 로깅 추가**:
```typescript
console.log('[Manual Upload API] Request received');
console.log('[Manual Upload API] Auth header present:', !!authHeader);
console.log('[Manual Upload API] User authenticated:', user.id);
console.log('[Manual Upload API] User permission level:', userData.permission_level);
console.log('[Manual Upload API] Request body:', JSON.stringify(body, null, 2));
console.log('[Manual Upload API] Announcement created successfully:', announcement.id);
```

2. **오류 응답 개선**:
```typescript
return NextResponse.json(
  {
    success: false,
    error: 'Invalid authentication token',
    details: authError?.message  // 상세 오류 메시지 추가
  },
  { status: 401 }
);
```

---

## Testing Checklist

### 천 단위 콤마 기능
- [ ] 예산규모 필드에 `10000000` 입력 → `10,000,000` 표시 확인
- [ ] 지원금액 필드에 `1000000` 입력 → `1,000,000` 표시 확인
- [ ] 숫자가 아닌 문자 입력 시 무시되는지 확인
- [ ] API 전송 시 콤마가 제거되는지 확인 (개발자 도구 Network 탭)
- [ ] DB에 콤마 없이 순수 숫자로 저장되는지 확인

### 공고 등록 기능
- [ ] 브라우저 콘솔에서 세션 확인 로그 출력 확인
- [ ] 서버 터미널에서 API 요청 로그 확인
- [ ] 필수 필드 입력 후 등록 성공 확인
- [ ] 등록 성공 시 모달 닫히고 목록 새로고침 확인
- [ ] 새로 등록된 공고에 ✍️ 수동등록 뱃지 표시 확인
- [ ] 관련도 100% 표시 확인

### 오류 처리
- [ ] 로그아웃 후 등록 시도 → "인증 세션이 만료되었습니다" 메시지 확인
- [ ] 비관리자 계정으로 시도 → "권한 부족" 메시지 확인 (API 테스트)
- [ ] 필수 필드 미입력 시 → 각 필드별 검증 오류 메시지 확인
- [ ] 중복 URL 등록 시도 → "이미 존재하는 URL" 오류 메시지 확인

---

## Debugging Guide

### 프론트엔드 디버깅

1. **환경 변수 확인**:
```javascript
// 브라우저 콘솔에서 실행
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
```

2. **세션 상태 확인**:
```javascript
// 브라우저 콘솔에서 실행 (Supabase 클라이언트 생성 후)
const { data } = await supabase.auth.getSession();
console.log('Current session:', data.session);
```

3. **Network 탭 확인**:
   - `/api/subsidy-announcements/manual` POST 요청 확인
   - Request Headers에 Authorization 토큰 포함 확인
   - Request Body에 콤마 제거된 숫자 확인
   - Response에서 오류 메시지 확인

### 백엔드 디버깅

1. **터미널 로그 확인**:
```bash
npm run dev
# 공고 등록 시도 후 다음 로그 확인:
# [Manual Upload API] Request received
# [Manual Upload API] Auth header present: true
# [Manual Upload API] User authenticated: <user-id>
# [Manual Upload API] User permission level: 4
# [Manual Upload API] Inserting announcement into database...
# [Manual Upload API] Announcement created successfully: <announcement-id>
```

2. **Supabase Dashboard 확인**:
   - Table Editor → `subsidy_announcements` 테이블
   - 새로 생성된 레코드 확인
   - `is_manual: true`, `relevance_score: 1.00` 확인

---

## Common Issues & Solutions

### Issue: "인증 세션이 만료되었습니다"
**Solution**:
1. 로그아웃 후 다시 로그인
2. 브라우저 쿠키/로컬 스토리지 확인
3. `.env.local` 파일에 올바른 Supabase 키 설정 확인

### Issue: "Supabase 설정이 올바르지 않습니다"
**Solution**:
1. `.env.local` 파일 확인:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```
2. 개발 서버 재시작: `npm run dev`

### Issue: "권한 부족" 오류
**Solution**:
1. 사용자 permission_level 확인 (4 이상 필요)
2. Supabase → `users` 테이블 → 해당 사용자의 `permission_level` 업데이트

### Issue: 콤마가 API에 전송됨
**Solution**:
- 이미 수정됨 (`removeCommas()` 함수 적용)
- Request Body 확인하여 숫자만 전송되는지 검증

---

## Files Modified

1. **[components/subsidy/ManualUploadModal.tsx](../components/subsidy/ManualUploadModal.tsx)**
   - 천 단위 콤마 포맷 함수 추가
   - 환경 변수 검증 추가
   - 세션 오류 처리 개선
   - 디버깅 로그 추가
   - 예산/지원금액 필드 핸들러 변경

2. **[app/api/subsidy-announcements/manual/route.ts](../app/api/subsidy-announcements/manual/route.ts)**
   - 상세 로깅 추가 (모든 주요 단계)
   - 오류 응답에 details 필드 추가
   - 각 검증 단계별 로그 출력

---

## Next Steps

1. **기능 테스트**:
   - 개발 환경에서 공고 등록 테스트
   - 천 단위 콤마 기능 동작 확인
   - 오류 시나리오 테스트 (세션 만료, 권한 부족 등)

2. **로그 정리**:
   - 프로덕션 배포 전 디버깅 로그 제거/조정
   - 민감한 정보(토큰, 사용자 ID 등) 로깅 제한

3. **추가 개선사항**:
   - 예산/지원금액 필드에 단위 선택 옵션 추가 (억원, 만원 등)
   - 금액 입력 시 최대값 제한 추가
   - 복사/붙여넣기 시에도 콤마 포맷 적용

---

## Deployment

배포 전 확인사항:
- [ ] `.env.local` 환경 변수 설정 확인
- [ ] Supabase RLS 정책 적용 확인
- [ ] 개발 환경에서 모든 기능 테스트 완료
- [ ] 디버깅 로그 레벨 조정 (프로덕션용)
- [ ] 빌드 오류 없음 확인: `npm run build`

배포 후 확인:
- [ ] 프로덕션에서 공고 등록 테스트
- [ ] 서버 로그 확인 (Vercel/배포 플랫폼)
- [ ] 사용자 피드백 수집
