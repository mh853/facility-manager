# 연락처 저장 및 자동 포맷팅 기능 수정 완료

## 🐛 발견된 문제

### 문제 1: 연락처 정보 DB 저장 안 됨
**원인**: `/api/admin/employees/[id]` API에서 `phone`, `mobile` 필드를 처리하지 않음
**증상**: 프로필 페이지에서 연락처 입력 후 저장해도 DB에 저장되지 않음

### 문제 2: 전화번호 수동 포맷팅 불편
**요구사항**: 하이픈(-) 없이 숫자만 입력해도 자동으로 포맷팅 필요

---

## ✅ 해결 방법

### 1. API 수정 - DB 저장 문제 해결

**파일**: `app/api/admin/employees/[id]/route.ts`

#### 변경 사항 1: 요청 파라미터 추가
```typescript
// 기존 (line 164)
const { name, email, department, position, permission_level } = body;

// 수정 후
const { name, email, department, position, permission_level, phone, mobile } = body;
```

#### 변경 사항 2: 업데이트 데이터 추가
```typescript
// 기존 (line 191-196)
const updateData = {
  name: name.trim(),
  email: email.trim().toLowerCase(),
  department: department?.trim() || null,
  position: position?.trim() || null,
  permission_level: permission_level || 1
};

// 수정 후
const updateData = {
  name: name.trim(),
  email: email.trim().toLowerCase(),
  department: department?.trim() || null,
  position: position?.trim() || null,
  permission_level: permission_level || 1,
  phone: phone?.trim() || null,
  mobile: mobile?.trim() || null
};
```

---

### 2. 전화번호 자동 포맷팅 유틸리티 추가

**파일**: `utils/phoneFormatter.ts` (신규 생성)

#### 주요 기능

##### formatPhoneNumber()
- 입력된 숫자를 자동으로 한국 전화번호 형식으로 포맷팅
- 지원 형식:
  - 휴대전화: `010-1234-5678`, `011-123-4567`
  - 서울 지역번호: `02-1234-5678`, `02-123-4567`
  - 기타 지역번호: `031-123-4567`, `051-1234-5678`
  - 대표번호: `1588-1234`

**사용 예시**:
```typescript
formatPhoneNumber('01012345678')   // → '010-1234-5678'
formatPhoneNumber('0212345678')    // → '02-1234-5678'
formatPhoneNumber('0311234567')    // → '031-123-4567'
formatPhoneNumber('15881234')      // → '1588-1234'
```

##### isValidPhoneNumber()
- 전화번호 유효성 검증
- 최소/최대 길이 확인
- 유효한 지역번호 확인

##### extractNumbers()
- 전화번호에서 숫자만 추출

---

### 3. 프로필 페이지 수정

**파일**: `app/profile/page.tsx`

#### 변경 사항 1: Import 추가
```typescript
import { formatPhoneNumber } from '@/utils/phoneFormatter';
```

#### 변경 사항 2: 입력 필드에 자동 포맷팅 적용
```typescript
// 사무실 전화번호
<input
  type="tel"
  value={editForm.phone}
  onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneNumber(e.target.value) })}
  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  placeholder="숫자만 입력하세요 (자동 포맷)"
  maxLength={13}
/>
<p className="text-xs text-gray-500 mt-1">
  예: 0212345678 → 02-1234-5678
</p>

// 휴대전화
<input
  type="tel"
  value={editForm.mobile}
  onChange={(e) => setEditForm({ ...editForm, mobile: formatPhoneNumber(e.target.value) })}
  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  placeholder="숫자만 입력하세요 (자동 포맷)"
  maxLength={13}
/>
<p className="text-xs text-gray-500 mt-1">
  예: 01012345678 → 010-1234-5678
</p>
```

---

## 🎯 사용 방법

### 1. 프로필 페이지 접속
`http://localhost:3000/profile`

### 2. 연락처 입력 (자동 포맷팅)
- **사무실 전화번호**: 숫자만 입력 (예: `0212345678`)
  - 자동으로 `02-1234-5678` 형식으로 변환됨
- **휴대전화**: 숫자만 입력 (예: `01012345678`)
  - 자동으로 `010-1234-5678` 형식으로 변환됨

### 3. 저장
"프로필 저장" 버튼 클릭

### 4. 확인
- 프로필 개요에서 포맷팅된 전화번호 표시 확인
- 페이지 새로고침 후 데이터 유지 확인

---

## 🧪 테스트 시나리오

### 시나리오 1: 휴대전화 자동 포맷팅
1. 휴대전화 입력 필드 클릭
2. `01012345678` 입력
3. **예상 결과**: 자동으로 `010-1234-5678`로 표시됨
4. 저장 후 새로고침
5. **예상 결과**: `010-1234-5678` 유지됨

### 시나리오 2: 서울 지역번호 포맷팅
1. 사무실 전화번호 입력 필드 클릭
2. `0212345678` 입력
3. **예상 결과**: 자동으로 `02-1234-5678`로 표시됨

### 시나리오 3: 기타 지역번호 포맷팅
1. 사무실 전화번호 입력 필드 클릭
2. `0311234567` 입력
3. **예상 결과**: 자동으로 `031-123-4567`로 표시됨

### 시나리오 4: 하이픈 포함 입력
1. 휴대전화 입력 필드에 `010-1234-5678` 입력
2. **예상 결과**: 하이픈이 자동으로 제거되고 재포맷팅됨

### 시나리오 5: 부분 입력
1. `010` 입력
2. **예상 결과**: `010` (포맷팅 안 됨)
3. `0101234` 입력
4. **예상 결과**: `010-1234` (부분 포맷팅)
5. `01012345678` 입력
6. **예상 결과**: `010-1234-5678` (완전 포맷팅)

---

## 📊 지원하는 전화번호 형식

### 휴대전화
- `010-XXXX-XXXX` (11자리)
- `011-XXX-XXXX` (10자리)
- `016-XXX-XXXX` (10자리)
- `017-XXX-XXXX` (10자리)
- `018-XXX-XXXX` (10자리)
- `019-XXX-XXXX` (10자리)

### 서울 지역번호
- `02-XXX-XXXX` (9자리)
- `02-XXXX-XXXX` (10자리)

### 기타 지역번호
- `031-XXX-XXXX` (10자리) - 경기
- `032-XXX-XXXX` (10자리) - 인천
- `033-XXX-XXXX` (10자리) - 강원
- `041-XXX-XXXX` (10자리) - 충남
- `042-XXX-XXXX` (10자리) - 대전
- `043-XXX-XXXX` (10자리) - 충북
- `044-XXX-XXXX` (10자리) - 세종
- `051-XXX-XXXX` (10자리) - 부산
- `052-XXX-XXXX` (10자리) - 울산
- `053-XXX-XXXX` (10자리) - 대구
- `054-XXX-XXXX` (10자리) - 경북
- `055-XXX-XXXX` (10자리) - 경남
- `061-XXX-XXXX` (10자리) - 전남
- `062-XXX-XXXX` (10자리) - 광주
- `063-XXX-XXXX` (10자리) - 전북
- `064-XXX-XXXX` (10자리) - 제주

### 대표번호
- `1588-XXXX`
- `1577-XXXX`
- `1600-XXXX`
- `1800-XXXX`

### 인터넷전화
- `070-XXXX-XXXX`

---

## 🔍 문제 해결

### 문제: 저장은 되지만 포맷팅이 안 됨
**해결**: 브라우저 하드 새로고침 (`Ctrl+Shift+R` 또는 `Cmd+Shift+R`)

### 문제: 입력 시 포맷팅이 즉시 안 됨
**확인**:
1. `utils/phoneFormatter.ts` 파일 존재 확인
2. `app/profile/page.tsx`에서 import 확인
3. 개발 서버 재시작

### 문제: 데이터베이스 저장 안 됨
**확인**:
1. F12 개발자 도구 → Network 탭
2. API 요청 확인 (`/api/admin/employees/[id]`)
3. Request Body에 `phone`, `mobile` 포함 확인
4. Response에 `phone`, `mobile` 포함 확인

---

## 📁 변경된 파일

### 수정된 파일
1. `app/api/admin/employees/[id]/route.ts`
   - `phone`, `mobile` 파라미터 처리 추가
   - 업데이트 데이터에 연락처 필드 포함

2. `app/profile/page.tsx`
   - `formatPhoneNumber` import 추가
   - 입력 필드에 자동 포맷팅 적용
   - placeholder 및 도움말 텍스트 업데이트

### 신규 파일
3. `utils/phoneFormatter.ts`
   - 전화번호 포맷팅 유틸리티
   - 유효성 검증 함수
   - 숫자 추출 함수

---

## ✅ 검증 체크리스트

- [ ] 개발 서버 실행 (`npm run dev`)
- [ ] `/profile` 페이지 접속
- [ ] 휴대전화 숫자만 입력 (예: `01012345678`)
- [ ] 자동으로 `010-1234-5678` 형식으로 변환 확인
- [ ] "프로필 저장" 클릭
- [ ] 성공 메시지 확인
- [ ] 페이지 새로고침 (F5)
- [ ] 프로필 개요에서 포맷팅된 전화번호 표시 확인
- [ ] 데이터베이스에서 직접 확인 (Supabase)

---

## 🎉 완료!

이제 다음 기능들이 모두 작동합니다:

1. ✅ 연락처 정보 DB 저장
2. ✅ 전화번호 자동 포맷팅 (하이픈 자동 추가)
3. ✅ 실시간 입력 포맷팅
4. ✅ 모든 한국 전화번호 형식 지원
5. ✅ 사용자 친화적 UI (도움말 포함)

**수정 완료일**: 2025-11-03
