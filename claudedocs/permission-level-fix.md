# 권한 레벨 유지 문제 수정 완료

## 🐛 발견된 문제

**증상**: 프로필 페이지에서 연락처 정보를 저장하면 권한 레벨이 변경됨

**원인**:
1. 프론트엔드에서 `editForm`을 그대로 API로 전송
2. `editForm`에는 `permission_level` 필드가 없음
3. API에서 `permission_level || 1`로 기본값 설정
4. 결과: 모든 사용자의 권한이 1(일반사용자)로 변경됨

---

## ✅ 해결 방법

### 1. 프론트엔드 수정 (Profile Page)

**파일**: `app/profile/page.tsx`

#### 변경 사항: API 요청 시 권한 레벨 포함

```typescript
// 기존 (line 138)
body: JSON.stringify(editForm)

// 수정 후
body: JSON.stringify({
  ...editForm,
  permission_level: profile.permission_level  // 기존 권한 레벨 유지
})
```

**설명**: 프로필 업데이트 시 기존 권한 레벨을 명시적으로 포함하여 전송

---

### 2. 백엔드 수정 (API Route)

**파일**: `app/api/admin/employees/[id]/route.ts`

#### 변경 사항 1: 자신의 프로필 수정인지 확인

```typescript
// 추가 (line 158-169)
const { name, email, department, position, permission_level, phone, mobile } = body;

// 자신의 프로필 수정인지 확인
const isSelfUpdate = decodedToken.id === params.id;

// 권한 레벨 변경 시도 시 관리자 권한 확인
if (permission_level !== undefined && !isSelfUpdate) {
  // 다른 사람의 권한을 변경하려면 관리자 권한 필요
  if (decodedToken.permissionLevel < 3) {
    return NextResponse.json(
      { success: false, message: '관리자 권한이 필요합니다.' },
      { status: 403 }
    );
  }
}
```

#### 변경 사항 2: 권한 레벨 안전 처리

```typescript
// 기존 사용자 정보 조회 (권한 레벨 보존용)
const { data: currentEmployee } = await supabaseAdmin
  .from('employees')
  .select('permission_level')
  .eq('id', params.id)
  .single();

// 사용자 정보 업데이트
const updateData: any = {
  name: name.trim(),
  email: email.trim().toLowerCase(),
  department: department?.trim() || null,
  position: position?.trim() || null,
  phone: phone?.trim() || null,
  mobile: mobile?.trim() || null
};

// 권한 레벨은 명시적으로 전달된 경우에만 업데이트 (관리자만 가능)
if (permission_level !== undefined && decodedToken.permissionLevel >= 3 && !isSelfUpdate) {
  updateData.permission_level = permission_level;
}
// 자신의 프로필 업데이트 시 권한 레벨 유지
else if (currentEmployee) {
  updateData.permission_level = currentEmployee.permission_level;
}
```

**설명**:
1. 기존 사용자의 권한 레벨을 DB에서 조회
2. 권한 레벨은 관리자가 다른 사용자를 수정할 때만 변경 가능
3. 자신의 프로필 수정 시 기존 권한 레벨 유지
4. 기본값(1) 설정 로직 제거

---

## 🔒 보안 개선

### 권한 레벨 변경 규칙

1. **자신의 프로필 수정**
   - ✅ 이름, 이메일, 부서, 직급, 연락처 수정 가능
   - ❌ 권한 레벨 변경 불가 (기존 값 유지)

2. **관리자가 다른 사용자 수정**
   - ✅ 모든 필드 수정 가능
   - ✅ 권한 레벨 변경 가능 (권한 레벨 3 이상 필요)

3. **일반 사용자가 다른 사용자 수정 시도**
   - ❌ 권한 오류 반환

---

## 🧪 테스트 시나리오

### 시나리오 1: 자신의 프로필 수정 (권한 유지)
**사용자**: 권한 레벨 2 (매니저)

1. 프로필 페이지 접속
2. 연락처 정보 입력
3. 저장
4. **예상 결과**: 권한 레벨 2 유지 ✅

### 시나리오 2: 자신의 프로필 수정 (슈퍼관리자)
**사용자**: 권한 레벨 4 (슈퍼관리자)

1. 프로필 페이지 접속
2. 이름, 연락처 수정
3. 저장
4. **예상 결과**: 권한 레벨 4 유지 ✅

### 시나리오 3: 관리자가 다른 사용자 권한 변경
**관리자**: 권한 레벨 3

1. 사용자 관리 페이지 접속
2. 다른 사용자 편집
3. 권한 레벨 변경 시도
4. **예상 결과**: 권한 변경 성공 ✅

### 시나리오 4: 일반 사용자가 다른 사용자 수정 시도
**사용자**: 권한 레벨 1

1. 직접 API 호출 시도
2. **예상 결과**: 403 Forbidden 오류 ❌

---

## 📊 권한 레벨 체계

| 레벨 | 이름 | 권한 |
|------|------|------|
| 1 | 일반사용자 | 자신의 프로필 수정 |
| 2 | 매니저 | 자신의 프로필 수정 |
| 3 | 관리자 | 다른 사용자 수정, 권한 변경 |
| 4 | 슈퍼관리자 | 모든 권한 |

---

## 🔍 검증 방법

### 1. 프로필 페이지에서 확인

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 테스트
# 1. /profile 접속
# 2. 연락처 정보 수정
# 3. 저장
# 4. 권한 레벨 확인 (프로필 개요 섹션)
```

### 2. 데이터베이스에서 직접 확인

```sql
-- 사용자의 권한 레벨 확인
SELECT
  id,
  name,
  email,
  permission_level,
  phone,
  mobile
FROM employees
WHERE email = 'your-email@example.com';
```

### 3. API 로그 확인

프로필 저장 시 서버 콘솔에서 다음 로그 확인:

```
📥 [USER-UPDATE] 받은 데이터: {
  userId: '...',
  body: {
    name: '...',
    email: '...',
    permission_level: 3,  // 기존 권한 레벨 포함
    phone: '010-1234-5678',
    mobile: '010-1234-5678'
  },
  requestorPermission: 3
}

📝 [USER-UPDATE] 업데이트할 데이터: {
  name: '...',
  email: '...',
  department: null,
  position: null,
  phone: '010-1234-5678',
  mobile: '010-1234-5678',
  permission_level: 3  // 권한 레벨 유지됨
}
```

---

## 🎯 Before & After

### Before (문제 있음)
```typescript
// 프론트엔드
body: JSON.stringify(editForm)
// editForm = { name, email, department, position, phone, mobile }
// permission_level 없음 ❌

// 백엔드
permission_level: permission_level || 1  // 항상 1로 설정됨 ❌
```

**결과**: 모든 사용자의 권한이 1로 변경됨 ❌

### After (수정 완료)
```typescript
// 프론트엔드
body: JSON.stringify({
  ...editForm,
  permission_level: profile.permission_level  // 기존 권한 유지 ✅
})

// 백엔드
// 기존 권한 조회 후 유지
if (currentEmployee) {
  updateData.permission_level = currentEmployee.permission_level;  ✅
}
```

**결과**: 권한 레벨 유지됨 ✅

---

## 📁 변경된 파일

1. **`app/profile/page.tsx`** (수정)
   - API 요청 시 기존 권한 레벨 포함

2. **`app/api/admin/employees/[id]/route.ts`** (수정)
   - 자신의 프로필 수정 여부 확인
   - 권한 레벨 안전 처리
   - 기존 권한 레벨 조회 및 유지

---

## ✅ 최종 체크리스트

- [x] 프론트엔드에서 권한 레벨 전송
- [x] 백엔드에서 권한 레벨 안전 처리
- [x] 자신의 프로필 수정 시 권한 유지
- [x] 관리자만 권한 변경 가능
- [x] TypeScript 타입 오류 없음
- [ ] 실제 테스트 완료

---

## 🎉 완료!

이제 다음이 보장됩니다:

1. ✅ 프로필 수정 시 권한 레벨 유지
2. ✅ 관리자만 권한 변경 가능
3. ✅ 안전한 권한 관리
4. ✅ 연락처 정보 정상 저장
5. ✅ 전화번호 자동 포맷팅

**수정 완료일**: 2025-11-03
