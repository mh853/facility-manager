# 사용자 권한 수정 시스템 설계 개선안

## 문제 요약

### 1. 권한 수정이 데이터베이스에 반영 안 됨
**원인**:
- 프론트엔드에서 `permission_level`을 폼 데이터로 전송하지만, API에서 `permission_level !== undefined` 체크가 실패함
- `permission_level = 0`일 때도 `0 !== undefined`는 `true`이지만, 폼 전송 시 값이 제대로 전달되지 않는 경우 발생

**현재 코드 문제점** ([app/api/admin/employees/[id]/route.ts](app/api/admin/employees/[id]/route.ts:213-217)):
```typescript
// 권한 레벨은 명시적으로 전달된 경우에만 업데이트
if (permission_level !== undefined && permissionLevel >= 3 && !isSelfUpdate) {
  updateFields.push(`permission_level = $${paramIndex}`);
  updateValues.push(permission_level);
  paramIndex++;
}
```

### 2. 시스템 권한(4) 제한 없음
**문제**:
- 권한 레벨 3(관리자)도 레벨 4(시스템)를 설정할 수 있음
- 레벨 4는 최고 권한이므로 레벨 4를 가진 사용자만 설정 가능해야 함

**요구사항**:
1. 시스템 권한(4) 설정은 권한 레벨 4를 가진 사용자만 가능
2. 권한 레벨 3(관리자)는 시스템 권한(4) 옵션을 UI에서 볼 수 없어야 함

---

## 권한 레벨 구조

```yaml
permission_levels:
  GUEST: 0           # 게스트 - 읽기 전용
  AUTHENTICATED: 1   # 일반 - 기본 업무
  MANAGER: 2         # 매니저 - 매출관리, 시스템 설정
  ADMIN: 3           # 관리자 - 사용자 관리, 시스템 설정
  SYSTEM_ADMIN: 4    # 시스템 - 최고 권한, 시스템 권한 부여
```

## 권한 수정 규칙

### 기본 규칙
1. **자신의 권한은 수정 불가** (`isSelfUpdate = true`)
2. **권한 3(관리자) 이상만** 다른 사용자 권한 수정 가능
3. **시스템 권한(4) 설정은 권한 4 사용자만** 가능

### 권한별 제한
| 사용자 권한 | 설정 가능한 권한 레벨 | 시스템 권한(4) 옵션 표시 |
|------------|---------------------|----------------------|
| 레벨 0-2   | 없음 (권한 없음)      | ❌ 없음              |
| 레벨 3     | 0, 1, 2, 3          | ❌ 숨김              |
| 레벨 4     | 0, 1, 2, 3, 4       | ✅ 표시              |

---

## 구현 계획

### Phase 1: 백엔드 API 수정

#### 1.1 권한 수정 로직 개선 ([app/api/admin/employees/[id]/route.ts](app/api/admin/employees/[id]/route.ts))

**수정 전** (lines 213-217):
```typescript
if (permission_level !== undefined && permissionLevel >= 3 && !isSelfUpdate) {
  updateFields.push(`permission_level = $${paramIndex}`);
  updateValues.push(permission_level);
  paramIndex++;
}
```

**수정 후**:
```typescript
// 권한 레벨 수정 요청이 있는지 확인 (0도 유효한 값)
if (permission_level !== undefined && permission_level !== null) {
  // 자신의 권한은 수정 불가
  if (isSelfUpdate) {
    return NextResponse.json(
      { success: false, message: '자신의 권한 레벨은 변경할 수 없습니다.' },
      { status: 403 }
    );
  }

  // 권한 수정 권한 확인 (레벨 3 이상 필요)
  if (permissionLevel < 3) {
    return NextResponse.json(
      { success: false, message: '권한 수정 권한이 없습니다. 관리자 이상만 가능합니다.' },
      { status: 403 }
    );
  }

  // 시스템 권한(4) 설정은 시스템 권한자만 가능
  if (permission_level === 4 && permissionLevel < 4) {
    return NextResponse.json(
      {
        success: false,
        message: '시스템 권한(레벨 4)은 시스템 관리자만 설정할 수 있습니다.'
      },
      { status: 403 }
    );
  }

  // 유효한 권한 레벨 범위 확인 (0-4)
  if (permission_level < 0 || permission_level > 4) {
    return NextResponse.json(
      { success: false, message: '유효하지 않은 권한 레벨입니다 (0-4).' },
      { status: 400 }
    );
  }

  // 권한 레벨 업데이트
  updateFields.push(`permission_level = $${paramIndex}`);
  updateValues.push(permission_level);
  paramIndex++;

  console.log('🔐 [PERMISSION-UPDATE]', {
    targetUserId: params.id,
    requestedBy: userId,
    requestedByLevel: permissionLevel,
    newPermissionLevel: permission_level
  });
}
```

#### 1.2 로깅 개선

권한 수정 성공 시 자세한 로그 추가:
```typescript
console.log('✅ [USER-UPDATE] 업데이트 성공:', {
  userId: params.id,
  updatedFields: updateFields,
  permissionLevelChanged: permission_level !== undefined
});
```

### Phase 2: 프론트엔드 UI 수정

#### 2.1 권한 선택 UI 조건부 렌더링 ([app/admin/users/page.tsx](app/admin/users/page.tsx:1290-1302))

**수정 전** (lines 1290-1302):
```tsx
<div>
  <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1">권한 레벨</label>
  <select
    name="permission_level"
    defaultValue={editingUser.permission_level}
    className="w-full border border-gray-300 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs md:text-sm"
  >
    <option value={0}>게스트</option>
    <option value={1}>일반</option>
    <option value={2}>매니저</option>
    <option value={3}>관리자</option>
    <option value={4}>시스템</option>
  </select>
</div>
```

**수정 후**:
```tsx
<div>
  <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 mb-1">권한 레벨</label>
  <select
    name="permission_level"
    defaultValue={editingUser.permission_level}
    className="w-full border border-gray-300 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs md:text-sm"
  >
    <option value={0}>게스트 (읽기 전용)</option>
    <option value={1}>일반 (기본 업무)</option>
    <option value={2}>매니저 (매출관리)</option>
    <option value={3}>관리자 (사용자 관리)</option>
    {/* 시스템 권한(4)은 시스템 관리자만 볼 수 있음 */}
    {user?.permission_level === 4 && (
      <option value={4}>시스템 (최고 권한)</option>
    )}
  </select>

  {/* 권한 설명 추가 */}
  <p className="text-[8px] sm:text-[9px] md:text-xs text-gray-500 mt-1">
    {user?.permission_level === 4
      ? '시스템 권한은 최고 권한자만 설정 가능합니다.'
      : '관리자 권한까지 설정할 수 있습니다.'}
  </p>
</div>
```

#### 2.2 권한 필터 UI 조건부 렌더링 ([app/admin/users/page.tsx](app/admin/users/page.tsx:978-989))

**수정 전** (lines 978-989):
```tsx
<select
  value={permissionFilter}
  onChange={(e) => setPermissionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
  className="border border-gray-300 rounded-md px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs md:text-sm"
>
  <option value="all">모든 권한</option>
  <option value={4}>시스템</option>
  <option value={3}>관리자</option>
  <option value={2}>매니저</option>
  <option value={1}>일반</option>
  <option value={0}>게스트</option>
</select>
```

**수정 후**:
```tsx
<select
  value={permissionFilter}
  onChange={(e) => setPermissionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
  className="border border-gray-300 rounded-md px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs md:text-sm"
>
  <option value="all">모든 권한</option>
  {/* 시스템 권한은 시스템 관리자만 필터링 가능 */}
  {user?.permission_level === 4 && <option value={4}>시스템</option>}
  <option value={3}>관리자</option>
  <option value={2}>매니저</option>
  <option value={1}>일반</option>
  <option value={0}>게스트</option>
</select>
```

### Phase 3: 에러 처리 개선

#### 3.1 프론트엔드 에러 메시지 개선 ([app/admin/users/page.tsx](app/admin/users/page.tsx:484-524))

**수정 전** (lines 516-522):
```typescript
} else {
  const errorData = await response.json();
  throw new Error(errorData.message || '사용자 업데이트 실패');
}
} catch (error) {
  console.error('사용자 업데이트 오류:', error);
  const errorMessage = error instanceof Error ? error.message : '사용자 업데이트 중 오류가 발생했습니다.';
  alert(`사용자 업데이트 실패: ${errorMessage}`);
}
```

**수정 후**:
```typescript
} else {
  const errorData = await response.json();

  // 권한 관련 에러 메시지 강조
  if (response.status === 403) {
    alert(`⚠️ 권한 부족\n\n${errorData.message}`);
  } else {
    alert(`❌ 업데이트 실패\n\n${errorData.message || '사용자 업데이트 중 오류가 발생했습니다.'}`);
  }
  return;
}
} catch (error) {
  console.error('❌ [USER-EDIT] 사용자 업데이트 오류:', error);
  const errorMessage = error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.';
  alert(`❌ 시스템 오류\n\n${errorMessage}`);
}
```

---

## 테스트 시나리오

### 테스트 1: 게스트(0) 권한 설정
**전제**: 관리자(레벨 3) 또는 시스템(레벨 4)로 로그인
1. 사용자 편집 모달 열기
2. 권한 레벨을 "게스트 (읽기 전용)" 선택
3. 저장 버튼 클릭
4. **예상 결과**: ✅ 데이터베이스에 `permission_level = 0` 반영

### 테스트 2: 시스템 권한(4) 설정 - 권한 3 사용자
**전제**: 관리자(레벨 3)로 로그인
1. 사용자 편집 모달 열기
2. **예상 UI**: "시스템" 옵션이 **숨김** 처리됨
3. 권한 필터에서도 "시스템" 옵션 **숨김**

### 테스트 3: 시스템 권한(4) 설정 - 권한 4 사용자
**전제**: 시스템(레벨 4)로 로그인
1. 사용자 편집 모달 열기
2. **예상 UI**: "시스템 (최고 권한)" 옵션 **표시**됨
3. 권한 레벨을 "시스템" 선택
4. 저장 버튼 클릭
5. **예상 결과**: ✅ 데이터베이스에 `permission_level = 4` 반영

### 테스트 4: 자신의 권한 수정 시도
**전제**: 임의의 사용자로 로그인
1. 자신의 계정 편집 시도
2. 권한 레벨 변경 시도
3. 저장 버튼 클릭
4. **예상 결과**: ❌ "자신의 권한 레벨은 변경할 수 없습니다." 에러

### 테스트 5: 일반 사용자 권한 수정 시도
**전제**: 일반 사용자(레벨 1)로 로그인
1. 다른 사용자 편집 시도
2. **예상 결과**: ❌ "관리자 권한이 필요합니다." 에러 또는 UI 접근 차단

---

## 데이터베이스 확인 쿼리

### 권한 수정 확인
```sql
-- 특정 사용자의 권한 레벨 확인
SELECT id, name, email, permission_level, updated_at
FROM employees
WHERE email = 'user@example.com';

-- 최근 권한 수정 이력 확인 (updated_at 기준)
SELECT id, name, email, permission_level, updated_at
FROM employees
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- 시스템 권한(4) 사용자 목록
SELECT id, name, email, permission_level
FROM employees
WHERE permission_level = 4
  AND is_active = true
  AND is_deleted = false;
```

---

## 보안 고려사항

### 1. 권한 상승 공격 방지
- ✅ 자신의 권한 수정 차단
- ✅ 시스템 권한(4) 설정은 레벨 4만 가능
- ✅ API 레벨에서 권한 검증 (프론트엔드 우회 방지)

### 2. 권한 레벨 검증
- ✅ 유효 범위 검증 (0-4)
- ✅ 타입 검증 (숫자형)
- ✅ NULL/undefined 처리

### 3. 감사 로그
- ✅ 권한 변경 시 콘솔 로그 기록
- 🔄 향후: 데이터베이스 감사 테이블 추가 고려

---

## 참고 파일

- **권한 레벨 정의**: [lib/auth/AuthLevels.ts](lib/auth/AuthLevels.ts)
- **페이지 권한 매핑**: [lib/auth/PagePermissions.ts](lib/auth/PagePermissions.ts)
- **사용자 편집 API**: [app/api/admin/employees/[id]/route.ts](app/api/admin/employees/[id]/route.ts)
- **사용자 관리 페이지**: [app/admin/users/page.tsx](app/admin/users/page.tsx)

---

## 구현 우선순위

### 🔴 Critical (즉시 수정 필요)
1. **권한 수정 API 로직 개선** - 데이터베이스 반영 문제 해결
2. **시스템 권한(4) 제한** - 보안 이슈

### 🟡 High (우선 수정 권장)
3. **UI 조건부 렌더링** - 시스템 권한 옵션 숨김
4. **에러 메시지 개선** - 사용자 경험 향상

### 🟢 Medium (개선 사항)
5. **권한 변경 감사 로그** - 향후 추적성 확보
6. **테스트 자동화** - 권한 시스템 안정성 확보
