# Supabase 마이그레이션 최종 상태 보고서

날짜: 2026-01-06
상태: **부분 성공 (핵심 테이블 완료, 의존 테이블 블로킹됨)**

## 📊 마이그레이션 결과

### ✅ 성공한 항목

| 항목 | OLD | NEW | 상태 |
|------|-----|-----|------|
| **스키마** | 95 테이블 + 7 뷰 | 95 테이블 + 7 뷰 | ✅ 100% |
| **businesses** | 12 | 12 | ✅ 100% |
| **employees** | 9 | 9 | ✅ 100% |
| **users** | 2 | 2 | ✅ 100% |
| **facility_tasks** | 73 | 73 | ✅ 100% |

### ❌ 실패한 항목 (블로킹 문제)

| 항목 | OLD | NEW | 실패 원인 |
|------|-----|-----|-----------|
| **business_info** | 1,567 | 0 | `data_history` 트리거 오류 |
| **discharge_facilities** | 5,407 | 0 | 외래키 의존성 (business_info 필요) |
| **prevention_facilities** | 2,478 | 0 | 외래키 의존성 (business_info 필요) |
| **order_management** | 340 | 0 | 외래키 의존성 (business_info 필요) |
| **revenue_calculations** | 1,573 | 0 | 외래키 의존성 (business_info 필요) |

**총 누락 데이터: 11,365 rows**

## 🚨 핵심 문제

### 문제 1: `data_history` 트리거 권한 오류
```
ERROR: relation "data_history" does not exist
```

**원인**: `business_info` 테이블에 `business_info_history` 트리거가 존재하며, 이 트리거가 `data_history` 테이블을 참조합니다. pg_restore의 `--disable-triggers` 옵션이 Supabase의 시스템 트리거를 비활성화하지 못합니다.

**시도한 해결 방법**:
- ✅ `--disable-triggers` 플래그 사용
- ✅ `ALTER TABLE DISABLE TRIGGER ALL` 실행
- ❌ **모두 실패**: `ERROR: permission denied: "RI_ConstraintTrigger_*" is a system trigger`

### 문제 2: Supabase RLS 시스템 트리거 권한

Supabase는 postgres 사용자로도 시스템 트리거를 비활성화할 수 없습니다. 이는 Supabase의 보안 정책입니다.

**해결책 필요**:
- Supabase Service Role 키를 사용한 API 기반 데이터 삽입
- Supabase CLI의 `db push` 명령 사용
- 트리거를 임시 삭제 후 데이터 삽입 (위험)

## 📁 생성된 파일들

### 스키마 파일
- `backups/actual_old_schema.sql` (399KB) - 기존 DB의 실제 스키마
- `sql/migration/99_COMBINED_FULL_MIGRATION.sql` - 원본 마이그레이션 SQL (사용 안 함)

### 데이터 덤프 파일
- `backups/data_dump_custom.dump` (2.4MB) - Custom format 덤프
- `backups/data_dump_public_only.sql` (38MB) - SQL format 덤프

### 실행 스크립트
- `full-migration-correct.sh` - 올바른 스키마 기반 완전 마이그레이션
- `final-migration-no-constraints.sh` - 제약조건 비활성화 시도
- `retry-failed-tables.sh` - 실패한 테이블 재복원
- `compare-data.sh` - OLD vs NEW 데이터 비교
- `redump-data.sh` - SQL 형식 재덤프

### 로그 파일
- `migration_corrected.log` - 수정된 마이그레이션 로그
- `migration_no_constraints.log` - 제약조건 없는 마이그레이션 로그
- `migration_final.log` - 초기 마이그레이션 로그

## 💡 권장 해결 방안

### Option 1: Supabase CLI 사용 (권장)
```bash
# Supabase CLI로 완전 마이그레이션
supabase db dump --data-only > old_data.sql
supabase db push old_data.sql --project-ref NEW_PROJECT_REF
```

**장점**:
- Supabase의 공식 도구로 RLS/트리거 처리
- 자동 의존성 해결
- 안전한 데이터 이동

**단점**:
- Supabase CLI 설치 및 설정 필요
- 프로젝트 ref 및 인증 설정 필요

### Option 2: 트리거 임시 삭제 (위험)
```sql
-- 트리거 백업
SELECT ... INTO trigger_backup FROM pg_trigger;

-- 트리거 삭제
DROP TRIGGER business_info_history ON business_info;

-- 데이터 복원
pg_restore ...

-- 트리거 재생성
CREATE TRIGGER ...
```

**장점**:
- pg_restore로 직접 제어 가능
- 빠른 복원

**단점**:
- ⚠️ 위험: 트리거 재생성 실패 시 데이터 무결성 손상
- 모든 의존 트리거 수동 관리 필요

### Option 3: API 기반 데이터 삽입
```typescript
// Supabase Service Role로 직접 삽입
const supabase = createClient(url, SERVICE_ROLE_KEY)

for (const row of oldData) {
  await supabase.from('business_info').insert(row)
}
```

**장점**:
- RLS 우회 가능
- 정확한 제어

**단점**:
- 11,365 rows 삽입에 시간 소요
- 프로그래밍 필요
- 외래키 순서 수동 관리

## ⏭️ 다음 단계

### 즉시 실행 가능

현재 마이그레이션된 데이터로 기본 기능은 작동합니다:
- ✅ 업체 목록 (12개)
- ✅ 직원 관리 (9명)
- ✅ 사용자 인증 (2명)
- ✅ 시설 업무 관리 (73개)

**제한 사항**:
- ❌ 업체 상세 정보 없음 (business_info)
- ❌ 배출시설/방지시설 데이터 없음
- ❌ 주문 관리 데이터 없음
- ❌ 매출 계산 데이터 없음

### 완전 마이그레이션을 위한 선택

**Option A**: Supabase 지원팀 문의
- 시스템 트리거 임시 비활성화 요청
- 마이그레이션 지원 받기

**Option B**: Supabase CLI 설치 및 사용
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_NEW_PROJECT_REF
supabase db push backups/data_dump_public_only.sql
```

**Option C**: 수동 데이터 입력 스크립트 작성
- TypeScript로 API 기반 데이터 삽입 스크립트
- 외래키 의존성 순서 관리
- 진행 상황 추적 및 오류 처리

## 📝 교훈

1. **Supabase 제약사항**: Postgres superuser 권한이 아니므로 시스템 트리거 비활성화 불가
2. **스키마 일치 중요성**: 초기 마이그레이션 SQL이 실제 DB 스키마와 불일치하여 시간 손실
3. **트리거 복잡도**: `data_history` 트리거가 복원을 블로킹하는 주요 원인
4. **외래키 의존성**: business_info 실패로 5개 테이블 연쇄 실패

## 🎯 현재 상태 요약

**스키마**: ✅ 완료 (95 테이블, 7 뷰)
**핵심 데이터**: ✅ 완료 (4/9 핵심 테이블)
**의존 데이터**: ❌ 블로킹됨 (11,365 rows)
**원인**: Supabase 시스템 트리거 권한 제한
**해결 방안**: Supabase CLI 또는 API 기반 삽입 필요
