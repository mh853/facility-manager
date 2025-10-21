# SQL 오류 수정 완료

## 문제 상황
```
ERROR: 42703: column "permission_level" does not exist
```

## 원인 분석

`dealer_pricing_system.sql` 파일의 RLS 정책에서 잘못된 컬럼명을 사용했습니다.

### 잘못된 코드
```sql
WHERE permission_level >= 3  -- ❌ 존재하지 않는 컬럼
```

### 실제 테이블 구조
`users` 테이블 (`sql/01_users_schema.sql` 참조):
```sql
CREATE TABLE public.users (
    id UUID,
    email VARCHAR(255),
    name VARCHAR(100),
    role INTEGER NOT NULL DEFAULT 1,  -- ✅ 실제 컬럼명
    ...
);
```

**역할 정의**:
- `role = 1`: 일반 사용자
- `role = 2`: 매니저
- `role = 3`: 관리자 (슈퍼 관리자)

## 수정 내용

**파일**: `sql/dealer_pricing_system.sql` (lines 70, 81)

**변경사항**:
```sql
-- BEFORE
WHERE permission_level >= 3

-- AFTER
WHERE role >= 3
```

## 수정된 RLS 정책

```sql
-- 슈퍼 관리자만 조회 가능
CREATE POLICY "Super admins can view dealer pricing" ON dealer_pricing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::text = auth.uid()::text
            AND role >= 3          -- ✅ 수정됨
            AND is_active = true
        )
    );

-- 슈퍼 관리자만 수정 가능
CREATE POLICY "Super admins can manage dealer pricing" ON dealer_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::text = auth.uid()::text
            AND role >= 3          -- ✅ 수정됨
            AND is_active = true
        )
    );
```

## 다음 단계

1. **SQL 파일 재실행**:
   ```sql
   -- Supabase SQL 에디터에서 실행
   -- 파일: sql/dealer_pricing_system.sql (수정된 버전)
   ```

2. **예상 결과**:
   - ✅ 테이블 생성 완료
   - ✅ RLS 정책 생성 완료
   - ✅ 샘플 데이터 3개 삽입 완료
   - ✅ 확인 쿼리 실행 성공

3. **테스트**:
   - 관리자 계정으로 로그인 (`munong2@gmail.com`, role=3)
   - `/admin/revenue/pricing` 접속
   - "대리점 가격" 탭에서 샘플 데이터 확인

## 참고: 프로젝트 전체 권한 체계

이 프로젝트는 `role` 컬럼을 사용하여 권한을 관리합니다:

| Role | 이름 | 권한 |
|------|------|------|
| 1 | 일반 사용자 | 기본 읽기/쓰기 |
| 2 | 매니저 | 부서/팀 관리 |
| 3 | 관리자 | 전체 시스템 관리 |

**다른 SQL 파일에서도 동일한 패턴 사용**:
- `sql/01_users_schema.sql` (line 9): `role INTEGER NOT NULL DEFAULT 1`
- RLS 정책: `WHERE role = 3` (관리자 체크)

## 완료 체크리스트

- [x] 오류 원인 분석
- [x] SQL 파일 수정 (`permission_level` → `role`)
- [ ] SQL 파일 재실행
- [ ] 샘플 데이터 확인
- [ ] UI 테스트
