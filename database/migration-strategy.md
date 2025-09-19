# 시설 관리 시스템 통합 스키마 마이그레이션 전략

## 📋 마이그레이션 개요

기존 시스템의 `employees` 테이블과 `facility_tasks` 테이블을 기반으로 하여 **점진적 확장 방식**으로 새로운 기능들을 추가하는 전략입니다.

## 🎯 핵심 설계 원칙

### 1. 기존 시스템 호환성
- **employees 테이블 확장**: 새 컬럼 추가로 소셜 로그인 지원
- **facility_tasks 확장**: 협업 기능 컬럼 추가
- **기존 API 유지**: 현재 인증/업무 API는 그대로 동작

### 2. 점진적 마이그레이션
- **Phase 1**: 소셜 로그인 연동 (social_accounts)
- **Phase 2**: 협업 시스템 (task_collaborations)
- **Phase 3**: 보고서 시스템 (weekly_reports)

### 3. 데이터 무결성
- **외래키 제약**: 기존 테이블과의 연결 보장
- **RLS 정책**: Supabase 환경에 최적화된 보안
- **트리거**: 자동 업데이트 및 로깅

## 📊 단계별 마이그레이션 계획

### Phase 1: 기본 인증 확장 (1-2주)

#### 목표
- 기존 employees 테이블에 소셜 로그인 필드 추가
- social_accounts 테이블로 다중 소셜 계정 지원

#### 작업 내용
```sql
-- 1. employees 테이블 확장
ALTER TABLE employees ADD COLUMN provider VARCHAR(20);
ALTER TABLE employees ADD COLUMN provider_id VARCHAR(100);
ALTER TABLE employees ADD COLUMN avatar_url TEXT;

-- 2. social_accounts 테이블 생성
CREATE TABLE social_accounts (...);

-- 3. 기존 데이터 마이그레이션
UPDATE employees SET provider = 'system' WHERE password_hash IS NOT NULL;
```

#### 영향 분석
- **API 변경**: 기존 로그인 API는 그대로 유지
- **새 API 추가**: `/api/auth/social-link`, `/api/auth/social-unlink`
- **UI 변경**: 프로필 페이지에 소셜 계정 연동 섹션 추가

### Phase 2: 협업 시스템 구축 (2-3주)

#### 목표
- facility_tasks에 협업 상태 추가
- task_collaborations 테이블로 협조 요청 관리

#### 작업 내용
```sql
-- 1. facility_tasks 확장
ALTER TABLE facility_tasks ADD COLUMN collaboration_status VARCHAR(20);
ALTER TABLE facility_tasks ADD COLUMN created_by UUID;

-- 2. task_collaborations 테이블 생성
CREATE TABLE task_collaborations (...);

-- 3. 기존 업무에 생성자 정보 추가
UPDATE facility_tasks SET created_by = (SELECT id FROM employees WHERE permission_level = 3 LIMIT 1);
```

#### 영향 분석
- **API 확장**: 기존 facility-tasks API에 협업 기능 추가
- **새 API**: `/api/collaborations` CRUD
- **UI 확장**: 칸반보드에 협조 요청 버튼 및 상태 표시

### Phase 3: 보고서 시스템 (2-3주)

#### 목표
- weekly_reports 테이블로 주간 보고서 관리
- 자동 템플릿 생성 및 승인 워크플로우

#### 작업 내용
```sql
-- 1. weekly_reports 테이블 생성
CREATE TABLE weekly_reports (...);

-- 2. 보고서 자동 생성 함수
CREATE FUNCTION generate_weekly_report_template(...);

-- 3. 대시보드 뷰 생성
CREATE VIEW weekly_reports_summary AS (...);
```

#### 영향 분석
- **새 API**: `/api/weekly-reports` 전체 CRUD
- **새 UI**: 주간 보고서 작성/조회 페이지
- **스케줄링**: 매주 월요일 자동 템플릿 생성

## 🔧 기술적 구현 세부사항

### 1. 기존 시스템과의 통합 방법

#### employees 테이블 확장
```sql
-- 안전한 컬럼 추가 (기존 데이터 영향 없음)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS provider VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS provider_id VARCHAR(100);
```

#### 기존 API 호환성 유지
```typescript
// 기존 로그인 API는 그대로 동작
export async function authenticateUser(email: string, password: string) {
  // 기존 로직 유지
  const user = await findUserByEmail(email);
  const isValid = await verifyPassword(password, user.password_hash);

  // 새 필드는 옵션으로 처리
  return {
    ...user,
    socialAccounts: await getSocialAccounts(user.id) // 새 기능
  };
}
```

### 2. Supabase RLS 정책 설계

#### 권한 기반 접근 제어
```sql
-- 사용자는 자신의 데이터만 접근
CREATE POLICY "users_own_data" ON social_accounts
  FOR ALL USING (user_id::text = auth.uid()::text);

-- 관리자는 모든 데이터 접근
CREATE POLICY "admin_all_access" ON social_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees WHERE id::text = auth.uid()::text AND permission_level = 3)
  );
```

### 3. 성능 최적화 전략

#### 인덱스 전략
```sql
-- 자주 조회되는 컬럼에 인덱스
CREATE INDEX idx_employees_provider ON employees(provider, provider_id);
CREATE INDEX idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX idx_task_collaborations_status ON task_collaborations(status, due_date);
```

#### 뷰 기반 데이터 집계
```sql
-- 복잡한 조인을 뷰로 최적화
CREATE VIEW user_profile_view AS
SELECT e.*, sa.provider as social_provider
FROM employees e
LEFT JOIN social_accounts sa ON e.id = sa.user_id;
```

## 🚀 배포 및 롤백 계획

### 배포 순서
1. **스키마 마이그레이션**: 새 테이블 및 컬럼 추가
2. **데이터 마이그레이션**: 기존 데이터 보정
3. **API 업데이트**: 새 엔드포인트 및 기능 추가
4. **UI 업데이트**: 프런트엔드 컴포넌트 배포

### 롤백 전략
```sql
-- 컬럼 제거 (필요시)
ALTER TABLE employees DROP COLUMN IF EXISTS provider;
ALTER TABLE employees DROP COLUMN IF EXISTS provider_id;

-- 테이블 제거 (필요시)
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS task_collaborations CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;
```

## 📈 성능 모니터링

### 주요 메트릭
- **쿼리 성능**: 새 인덱스 효과 측정
- **RLS 오버헤드**: 보안 정책의 성능 영향
- **테이블 크기**: 데이터 증가 패턴 모니터링

### 모니터링 쿼리
```sql
-- 테이블 크기 확인
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public';

-- 인덱스 사용률 확인
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats WHERE schemaname = 'public';
```

## 🔄 데이터 마이그레이션 체크리스트

### Phase 1 체크리스트
- [ ] employees 테이블 백업
- [ ] 새 컬럼 추가 및 기본값 설정
- [ ] social_accounts 테이블 생성
- [ ] RLS 정책 적용
- [ ] 인덱스 생성 및 성능 테스트
- [ ] 기존 API 동작 확인
- [ ] 새 소셜 로그인 API 테스트

### Phase 2 체크리스트
- [ ] facility_tasks 테이블 백업
- [ ] 협업 관련 컬럼 추가
- [ ] task_collaborations 테이블 생성
- [ ] 기존 업무 데이터 보정
- [ ] 협업 API 구현 및 테스트
- [ ] 칸반보드 UI 업데이트

### Phase 3 체크리스트
- [ ] weekly_reports 테이블 생성
- [ ] 자동 생성 함수 구현
- [ ] 대시보드 뷰 생성
- [ ] 보고서 API 구현
- [ ] 주간 스케줄링 설정
- [ ] 관리자 승인 워크플로우 테스트

## 🎯 예상 효과

### 사용자 경험 개선
- **간편 로그인**: 소셜 계정으로 빠른 접근
- **협업 효율성**: 명확한 협조 요청 및 추적
- **투명한 보고**: 체계적인 주간 업무 보고

### 관리자 관점
- **통합 대시보드**: 모든 업무 현황 한눈에 파악
- **권한 관리**: 세분화된 접근 제어
- **성과 분석**: 주간/월간 업무 성과 데이터

### 시스템 안정성
- **점진적 확장**: 기존 시스템 영향 최소화
- **데이터 무결성**: 외래키 및 제약조건으로 보장
- **확장성**: 향후 기능 추가 용이한 구조