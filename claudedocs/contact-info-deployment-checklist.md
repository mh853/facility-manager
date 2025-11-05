# 연락처 정보 관리 기능 - 프로덕션 배포 체크리스트

## 🎯 배포 준비 상태

**기능명**: 연락처 정보 관리 (사무실 전화, 휴대전화)
**구현 완료일**: 2025-11-03
**배포 예정**: TBD

---

## ✅ 배포 전 필수 체크리스트

### 1. 데이터베이스 (Database)

#### 1.1 로컬/개발 환경
- [x] SQL 마이그레이션 실행 완료
- [x] 컬럼 생성 확인 (`phone`, `mobile`)
- [x] 인덱스 생성 확인 (`idx_employees_phone`, `idx_employees_mobile`)
- [ ] 샘플 데이터로 테스트 완료

#### 1.2 프로덕션 환경
- [ ] 데이터베이스 백업 완료
- [ ] SQL 마이그레이션 스크립트 준비
- [ ] 롤백 스크립트 준비
- [ ] 마이그레이션 실행 시간 확인 (예상: <1분)

**마이그레이션 SQL**:
```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile);
COMMENT ON COLUMN employees.phone IS '일반 전화번호 (사무실)';
COMMENT ON COLUMN employees.mobile IS '휴대전화번호';
```

---

### 2. 코드 품질 (Code Quality)

#### 2.1 TypeScript
- [x] 타입 정의 업데이트 (`UserProfile` 인터페이스)
- [ ] 타입 체크 통과 (`npx tsc --noEmit`)
- [x] 연락처 관련 타입 오류 없음

#### 2.2 코드 스타일
- [ ] ESLint 경고 없음 (`npm run lint`)
- [x] 코드 포맷팅 일관성 유지
- [x] 주석 및 문서화 적절

#### 2.3 빌드
- [ ] 프로덕션 빌드 성공 (`npm run build`)
- [ ] 빌드 경고 확인 및 해결
- [ ] 번들 사이즈 확인

```bash
npm run build
# Build 성공 확인
# Warning 없는지 확인
```

---

### 3. 기능 테스트 (Functionality)

#### 3.1 정상 시나리오
- [ ] 연락처 정보 입력 및 저장
- [ ] 연락처 정보 조회 및 표시
- [ ] 연락처 정보 수정
- [ ] 부분 업데이트 (일부 필드만 입력)

#### 3.2 예외 시나리오
- [ ] 빈 값 저장 (NULL 처리)
- [ ] 긴 전화번호 입력 (VARCHAR(20) 제한)
- [ ] 특수문자 입력 테스트
- [ ] 네트워크 오류 시 동작

#### 3.3 권한 테스트
- [ ] 본인만 수정 가능 확인 (JWT 인증)
- [ ] 다른 사용자 프로필 수정 시도 차단
- [ ] 로그아웃 상태에서 접근 차단

---

### 4. UI/UX 테스트

#### 4.1 반응형 디자인
- [ ] 데스크톱 (1920px 이상)
- [ ] 태블릿 (768px - 1024px)
- [ ] 모바일 (375px - 767px)

#### 4.2 브라우저 호환성
- [ ] Chrome (최신 버전)
- [ ] Firefox (최신 버전)
- [ ] Safari (최신 버전)
- [ ] Edge (최신 버전)

#### 4.3 접근성
- [ ] 키보드 네비게이션 (Tab, Enter)
- [ ] 스크린 리더 호환성
- [ ] Focus 스타일 명확함
- [ ] Label 및 Placeholder 적절

---

### 5. 보안 (Security)

#### 5.1 인증 및 권한
- [x] JWT 토큰 검증
- [x] 본인만 수정 가능
- [ ] 세션 만료 시 처리

#### 5.2 입력 검증
- [x] XSS 방어 (입력값 trim)
- [x] SQL Injection 방어 (Supabase ORM)
- [ ] CSRF 토큰 (필요 시)

#### 5.3 데이터 보호
- [ ] 연락처 정보 암호화 (선택사항)
- [ ] 감사 로그 (선택사항)
- [ ] HTTPS 사용 확인

---

### 6. 성능 (Performance)

#### 6.1 API 응답 시간
- [ ] 프로필 조회: < 200ms
- [ ] 프로필 업데이트: < 300ms
- [ ] 데이터베이스 쿼리: < 50ms

#### 6.2 데이터베이스 최적화
- [x] 인덱스 생성 (`phone`, `mobile`)
- [ ] 쿼리 실행 계획 확인 (EXPLAIN ANALYZE)

```sql
EXPLAIN ANALYZE
SELECT * FROM employees WHERE phone = '02-1234-5678';
-- Index Scan 확인
```

---

### 7. 문서화 (Documentation)

#### 7.1 기술 문서
- [x] 구현 상세 문서 (`contact-info-implementation.md`)
- [x] 마이그레이션 가이드 (`migration-guide.md`)
- [x] 최종 검증 가이드 (`contact-info-final-verification.md`)
- [x] 배포 체크리스트 (이 문서)

#### 7.2 사용자 문서
- [ ] 사용자 가이드 (선택사항)
- [ ] FAQ (선택사항)
- [ ] 릴리즈 노트

---

## 🚀 배포 절차

### Phase 1: 준비 (Pre-Deployment)

1. **코드 리뷰 완료**
   - [ ] 동료 개발자 리뷰 완료
   - [ ] 코드 변경사항 승인

2. **테스트 완료**
   - [ ] 모든 테스트 시나리오 통과
   - [ ] QA 팀 검증 완료 (해당 시)

3. **백업**
   - [ ] 프로덕션 데이터베이스 백업
   - [ ] 현재 코드 버전 태깅 (`git tag`)

```bash
# Git 태그 생성
git tag -a v1.0.0-contact-info -m "Add contact info management feature"
git push origin v1.0.0-contact-info
```

---

### Phase 2: 배포 (Deployment)

#### Step 1: 데이터베이스 마이그레이션
```sql
-- Supabase SQL Editor에서 실행
-- (위의 마이그레이션 SQL 실행)
```

#### Step 2: 코드 배포
```bash
# 빌드
npm run build

# 배포 (Vercel 예시)
vercel --prod

# 또는 다른 배포 플랫폼 사용
```

#### Step 3: 검증
- [ ] 프로덕션 환경에서 데이터베이스 컬럼 확인
- [ ] 프로덕션 사이트 접속 확인
- [ ] 프로필 페이지 정상 작동 확인

---

### Phase 3: 모니터링 (Post-Deployment)

#### 즉시 (0-1시간)
- [ ] 프로덕션 에러 로그 확인
- [ ] API 응답 시간 모니터링
- [ ] 사용자 피드백 수집

#### 단기 (1-24시간)
- [ ] 데이터베이스 성능 확인
- [ ] 인덱스 사용률 확인
- [ ] 사용자 사용 패턴 분석

#### 중기 (1-7일)
- [ ] 버그 리포트 수집
- [ ] 성능 최적화 필요 여부 검토
- [ ] 사용자 만족도 확인

---

## 🔄 롤백 계획

### 롤백 트리거
다음 상황 발생 시 롤백 고려:
- 치명적인 버그 발견
- 데이터 손실 발생
- 성능 심각한 저하 (>50%)
- 사용자 불만 급증

### 롤백 절차

#### Step 1: 코드 롤백
```bash
# 이전 버전으로 배포
git checkout <previous-commit>
npm run build
vercel --prod
```

#### Step 2: 데이터베이스 롤백
```sql
-- 인덱스 제거
DROP INDEX IF EXISTS idx_employees_phone;
DROP INDEX IF EXISTS idx_employees_mobile;

-- 컬럼 제거
ALTER TABLE employees DROP COLUMN IF EXISTS phone;
ALTER TABLE employees DROP COLUMN IF EXISTS mobile;
```

**⚠️ 주의**: 롤백 시 입력된 연락처 데이터가 모두 삭제됩니다.

---

## 📊 성공 지표 (Success Metrics)

### 기술 지표
- [ ] 에러율: < 0.1%
- [ ] API 응답 시간: < 300ms
- [ ] 페이지 로드 시간: < 2초
- [ ] 데이터베이스 쿼리 시간: < 50ms

### 비즈니스 지표
- [ ] 사용자 채택률: >50% (1주일 내)
- [ ] 연락처 정보 입력률
- [ ] 사용자 만족도: >4/5
- [ ] 버그 리포트: <5건/주

---

## 🎯 배포 타임라인

### 권장 배포 시간
- **평일**: 오전 10시 - 오후 3시 (점심시간 피하기)
- **피해야 할 시간**: 금요일 오후, 주말, 공휴일 전날

### 예상 소요 시간
- 데이터베이스 마이그레이션: 1분
- 코드 배포: 5-10분
- 검증: 10-15분
- **총 예상 시간**: 20-30분

---

## ✅ 최종 승인

### 기술 책임자
- [ ] 코드 리뷰 완료
- [ ] 보안 검토 완료
- [ ] 성능 검토 완료
- [ ] 배포 승인

서명: _________________ 날짜: _________

### 프로젝트 관리자
- [ ] 기능 요구사항 충족
- [ ] 문서화 완료
- [ ] 일정 확인
- [ ] 배포 승인

서명: _________________ 날짜: _________

---

## 📝 배포 후 TODO

### 즉시
- [ ] 릴리즈 노트 작성
- [ ] 팀에 배포 완료 공지
- [ ] 사용자에게 새 기능 안내

### 1주일 내
- [ ] 사용자 피드백 수집 및 분석
- [ ] 버그 리포트 대응
- [ ] 성능 데이터 분석

### 1개월 내
- [ ] 기능 개선 사항 검토
- [ ] 추가 요구사항 수집
- [ ] 다음 단계 계획

---

## 📞 긴급 연락처

**배포 담당자**: [이름]
**전화**: [번호]
**이메일**: [이메일]

**기술 지원**: [팀명]
**긴급 연락처**: [번호]

---

**체크리스트 작성일**: 2025-11-03
**배포 예정일**: TBD
**배포 완료일**: _________
