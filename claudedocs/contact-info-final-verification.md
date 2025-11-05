# 연락처 정보 관리 기능 - 최종 검증 가이드

## ✅ 데이터베이스 마이그레이션 성공!

SQL 마이그레이션이 성공적으로 완료되었습니다. 이제 전체 시스템을 검증하겠습니다.

---

## 📋 검증 단계

### 1단계: 데이터베이스 검증 ✅

다음 쿼리들을 Supabase SQL Editor에서 실행하여 마이그레이션을 확인하세요:

#### 1.1 컬럼 존재 확인
```sql
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('phone', 'mobile')
ORDER BY column_name;
```

**예상 결과**:
```
 column_name |     data_type     | character_maximum_length | is_nullable
-------------+-------------------+--------------------------+-------------
 mobile      | character varying |                       20 | YES
 phone       | character varying |                       20 | YES
```

#### 1.2 인덱스 생성 확인
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'employees'
AND indexname IN ('idx_employees_phone', 'idx_employees_mobile')
ORDER BY indexname;
```

**예상 결과**:
```
      indexname       | tablename
----------------------+-----------
 idx_employees_mobile | employees
 idx_employees_phone  | employees
```

---

### 2단계: 애플리케이션 테스트 🧪

#### 2.1 개발 서버 실행
```bash
npm run dev
```

서버가 정상적으로 시작되는지 확인하세요.

#### 2.2 프로필 페이지 접속
1. 브라우저에서 `http://localhost:3000/profile` 접속
2. 로그인되어 있지 않다면 로그인

#### 2.3 연락처 정보 입력 테스트

**테스트 시나리오 1: 전체 입력**
1. "프로필 정보 수정" 섹션으로 스크롤
2. "연락처 정보" 섹션 확인
3. 다음 정보 입력:
   - 사무실 전화번호: `02-1234-5678`
   - 휴대전화: `010-1234-5678`
4. "프로필 저장" 버튼 클릭
5. 성공 메시지 확인: "프로필이 성공적으로 업데이트되었습니다."
6. 페이지 새로고침 (F5)
7. 프로필 개요 섹션에서 연락처 정보 표시 확인

**예상 결과**:
- ✅ 프로필 개요 하단에 연락처 섹션 표시
- ✅ 사무실 전화 아이콘과 함께 `02-1234-5678` 표시
- ✅ 휴대전화 아이콘과 함께 `010-1234-5678` 표시

**테스트 시나리오 2: 부분 입력**
1. 사무실 전화번호만 입력, 휴대전화는 비워둠
2. 저장
3. 사무실 전화번호만 표시되는지 확인

**테스트 시나리오 3: 빈 값 처리**
1. 연락처 필드를 모두 비워둠
2. 저장
3. 프로필 개요에서 연락처 섹션이 표시되지 않는지 확인

**테스트 시나리오 4: 데이터 수정**
1. 기존 연락처 정보 수정
2. 저장
3. 변경사항이 반영되는지 확인

---

### 3단계: 브라우저 개발자 도구 확인 🔍

#### 3.1 Network 탭 확인
1. F12로 개발자 도구 열기
2. Network 탭 선택
3. 프로필 저장 시도
4. `/api/admin/employees/[id]` 요청 확인:
   - Status: `200 OK`
   - Response에 `phone`, `mobile` 필드 포함 확인

#### 3.2 Console 탭 확인
- 에러 메시지가 없는지 확인
- 정상적인 로그만 표시되는지 확인

---

### 4단계: 데이터베이스 직접 확인 📊

Supabase SQL Editor에서 실제 데이터 확인:

```sql
SELECT
    id,
    name,
    email,
    phone,
    mobile,
    department,
    position
FROM employees
WHERE email = 'your-email@example.com';  -- 본인 이메일로 변경
```

**확인사항**:
- ✅ `phone` 컬럼에 입력한 전화번호 저장됨
- ✅ `mobile` 컬럼에 입력한 휴대전화 저장됨

---

## 🎯 최종 체크리스트

### 데이터베이스
- [ ] `phone` 컬럼 생성 확인
- [ ] `mobile` 컬럼 생성 확인
- [ ] `idx_employees_phone` 인덱스 생성 확인
- [ ] `idx_employees_mobile` 인덱스 생성 확인

### 프론트엔드
- [ ] 연락처 입력 필드 2개 표시됨
- [ ] Phone, Smartphone 아이콘 표시됨
- [ ] 반응형 레이아웃 동작 (모바일/데스크톱)
- [ ] Placeholder 텍스트 표시됨
- [ ] Focus 스타일 정상 동작

### 백엔드
- [ ] 연락처 정보 저장 성공
- [ ] API 응답에 연락처 정보 포함
- [ ] 부분 업데이트 정상 동작 (일부 필드만 입력)
- [ ] NULL 값 처리 정상 동작

### UI/UX
- [ ] 프로필 개요에 연락처 정보 표시
- [ ] 조건부 렌더링 동작 (연락처 없으면 섹션 숨김)
- [ ] 성공 메시지 표시
- [ ] 데이터 새로고침 후 유지됨

### 기능 테스트
- [ ] 테스트 시나리오 1: 전체 입력 ✅
- [ ] 테스트 시나리오 2: 부분 입력 ✅
- [ ] 테스트 시나리오 3: 빈 값 처리 ✅
- [ ] 테스트 시나리오 4: 데이터 수정 ✅

---

## 🐛 문제 해결

### 문제 1: 연락처 입력 필드가 보이지 않음

**원인**: 캐시 문제
**해결**:
```bash
# 개발 서버 재시작
Ctrl+C
npm run dev
```

또는 브라우저 하드 새로고침:
- Chrome: `Ctrl+Shift+R`
- Firefox: `Ctrl+F5`

### 문제 2: 저장은 되지만 표시가 안 됨

**원인**: API 응답 데이터 확인 필요
**해결**:
1. F12 개발자 도구 열기
2. Network 탭에서 API 응답 확인
3. `phone`, `mobile` 필드가 응답에 포함되는지 확인

### 문제 3: TypeScript 오류

**원인**: 타입 정의 불일치
**해결**:
```bash
npx tsc --noEmit
```
오류 확인 후 타입 정의 수정

### 문제 4: 데이터베이스 저장 실패

**원인**: 컬럼이 실제로 생성되지 않음
**해결**:
```sql
-- 컬럼 존재 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employees' AND column_name IN ('phone', 'mobile');

-- 없다면 수동으로 추가
ALTER TABLE employees ADD COLUMN phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN mobile VARCHAR(20);
```

---

## 📊 성능 확인

### API 응답 시간
- 프로필 조회: < 200ms
- 프로필 업데이트: < 300ms

### 데이터베이스 쿼리
```sql
-- 인덱스 사용 확인
EXPLAIN ANALYZE
SELECT * FROM employees WHERE phone = '02-1234-5678';
```

인덱스가 사용되는지 확인하세요 (`Index Scan` 표시).

---

## 🚀 프로덕션 배포 전 체크리스트

### 코드 품질
- [ ] TypeScript 타입 오류 없음
- [ ] ESLint 경고 없음
- [ ] 프로덕션 빌드 성공

### 테스트
- [ ] 모든 테스트 시나리오 통과
- [ ] 브라우저 호환성 확인 (Chrome, Firefox, Safari)
- [ ] 모바일 반응형 확인

### 보안
- [ ] JWT 인증 정상 동작
- [ ] 본인만 수정 가능 확인
- [ ] XSS 방어 확인 (입력값 trim)

### 문서화
- [ ] 구현 문서 작성 완료
- [ ] 마이그레이션 가이드 작성 완료
- [ ] 롤백 절차 문서화 완료

---

## 🎉 성공 기준

다음이 모두 확인되면 구현 완료:

1. ✅ 데이터베이스에 `phone`, `mobile` 컬럼 존재
2. ✅ 인덱스 2개 생성됨
3. ✅ 프로필 페이지에서 연락처 입력 가능
4. ✅ 연락처 정보 저장 및 조회 정상 동작
5. ✅ 프로필 개요에서 연락처 정보 표시
6. ✅ 모든 테스트 시나리오 통과
7. ✅ TypeScript 타입 오류 없음
8. ✅ 브라우저 콘솔 오류 없음

---

## 📝 다음 단계

### 즉시
- [ ] 모든 검증 항목 체크
- [ ] 테스트 시나리오 실행

### 단기 (이번 주)
- [ ] 팀원들에게 기능 공유
- [ ] 사용자 피드백 수집
- [ ] 프로덕션 배포

### 장기 (향후)
- [ ] 전화번호 형식 검증 추가
- [ ] 자동 포맷팅 기능 추가
- [ ] 연락처 변경 이력 추적

---

## 🎓 학습 내용

이번 구현을 통해 다음을 경험했습니다:

1. **데이터베이스 스키마 확장**: ALTER TABLE, CREATE INDEX
2. **TypeScript 타입 안전성**: Interface 확장
3. **React 상태 관리**: useState로 폼 데이터 관리
4. **Next.js API Routes**: RESTful API 구현
5. **조건부 렌더링**: 데이터 존재 여부에 따른 UI 표시
6. **Supabase 통합**: PostgreSQL 데이터베이스 작업

---

## 📞 문의

검증 과정에서 문제가 발생하면:
1. 위의 "문제 해결" 섹션 참조
2. 개발팀에 문의

**검증 완료일**: 2025-11-03
