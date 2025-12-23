# 보조금 크롤링 시스템 구현 진행 상황

## 구현 개요
- **목표**: 기존 자동 검색 크롤링(212개 소스) + 직접 URL 크롤링(211개) 하이브리드 시스템
- **성공률 목표**: 99%+
- **비용**: $0/월 (Vercel Hobby + GitHub Actions Free)
- **시작일**: 2025-12-22

## Phase 1: Foundation (CSV + Database) ✅ 완료

### 1.1 진행 상황 문서 생성 ✅
- **시작**: 2025-12-22 (현재)
- **파일**: `docs/crawling-implementation-progress.md`
- **상태**: 완료

### 1.2 CSV 템플릿 생성 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `data/direct_urls.csv`
- **상태**: 완료
- **설명**: 211개 URL 관리용 CSV 파일 구조 생성
- **참고**: 실제 211개 URL은 사용자 제공 목록으로 대체 필요

### 1.3 crawl_logs 테이블 생성 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `sql/create_crawl_logs.sql`
- **상태**: 완료
- **설명**: 크롤링 실행 로그 테이블
- **포함**:
  - 테이블: `crawl_logs`
  - 뷰: `crawl_stats_recent`
  - 함수: `get_running_crawls()`
  - 인덱스: 4개 (type, started_at, completed, workflow)

### 1.4 direct_url_sources 테이블 생성 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `sql/create_direct_url_sources.sql`
- **상태**: 완료
- **설명**: 211개 직접 URL 관리 테이블
- **포함**:
  - 테이블: `direct_url_sources`
  - 뷰: `problem_urls`, `crawl_stats_by_region`
  - 함수: 6개 (success/failure 기록, URL 가져오기, CSV 임포트 등)
  - 트리거: `updated_at` 자동 갱신
  - Circuit Breaker: 5회 연속 실패 시 자동 비활성화

### 1.5 SQL 마이그레이션 가이드 생성 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `sql/README_MIGRATION.md`
- **상태**: 완료
- **설명**: 마이그레이션 실행 가이드 및 테스트 시나리오

### 1.6 SQL 마이그레이션 실행 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: Supabase SQL Editor
- **상태**: 완료
- **설명**: Supabase에서 SQL 파일 실행 및 검증
- **실행 순서** (수정):
  1. ✅ ~~`sql/create_crawl_logs.sql`~~ → `sql/create_crawl_logs_fixed.sql` 실행
  2. ✅ `sql/create_direct_url_sources.sql` 실행
  3. (선택) 테스트 데이터 삽입
  4. ✅ 검증 쿼리 실행
- **오류 해결**:
  - 문제: `ERROR: 42703: column "crawl_type" does not exist`
  - 원인: `GENERATED ALWAYS` 컬럼 문법 호환성 문제
  - 해결: `create_crawl_logs_fixed.sql` 파일 생성 (GENERATED 제거)
  - 가이드: `sql/TROUBLESHOOTING.md` 참조
- **검증 완료**:
  - crawl_logs 테이블 생성 확인
  - direct_url_sources 테이블 생성 확인
  - 모든 뷰 및 함수 정상 작동

### 1.7 트러블슈팅 가이드 생성 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `sql/TROUBLESHOOTING.md`
- **상태**: 완료
- **설명**: SQL 오류 해결 가이드 및 단계별 실행 파일
- **포함**:
  - `sql/create_crawl_logs_fixed.sql` (GENERATED 컬럼 제거)
  - `sql/step1_table_only.sql` (테이블만 생성)
  - `sql/step2_views_functions.sql` (뷰/함수만 생성)
  - 문제 진단 쿼리 모음
  - 체크리스트

---

## Phase 2: API Development ✅ 완료

### 2.1 Direct URL Crawler API ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `app/api/subsidy-crawler/direct/route.ts`
- **상태**: 완료
- **설명**: 211개 직접 URL 크롤링 API 엔드포인트
- **포함**:
  - GET /api/subsidy-crawler/direct (크롤링 대상 URL 조회)
  - POST /api/subsidy-crawler/direct (크롤링 실행)
  - 배치 처리 (max 10 URLs, 병렬 실행)
  - Gemini AI 분석 및 관련성 점수
  - Supabase 저장 (중복 방지)
  - direct_url_sources 테이블 업데이트 (성공/실패)
  - crawl_logs 로깅
  - 8초 타임아웃 (Vercel 10초 제한 고려)

### 2.2 Stats API ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `app/api/subsidy-crawler/stats/route.ts`
- **상태**: 완료
- **설명**: 크롤링 통계 및 모니터링 API
- **포함**:
  - GET /api/subsidy-crawler/stats
  - 최근 7일 통계 (crawl_stats_recent 뷰)
  - 타입별 통계 (auto/direct)
  - URL 소스 통계 (active/inactive)
  - 최근 실행 목록 (옵션)
  - 진행 중인 크롤링 (옵션)
  - 문제 URL 목록 (옵션)

### 2.3 maxDuration 수정 ✅
- **시작**: 2025-12-22
- **완료**: 2025-12-22
- **파일**: `app/api/subsidy-crawler/route.ts`
- **상태**: 완료
- **변경**: `maxDuration = 300` → `maxDuration = 10`
- **이유**: Vercel Hobby 플랜 호환성 (10초 제한)

---

## Phase 3: GitHub Actions ✅ 완료

### 3.1 Direct URL Workflow 생성 ✅
- **시작**: 2025-12-23
- **완료**: 2025-12-23
- **파일**: `.github/workflows/subsidy-crawler-direct.yml`
- **상태**: 완료
- **설명**: 211개 직접 URL 크롤링 GitHub Actions 워크플로우
- **포함**:
  - 매주 일요일 21:00 KST 자동 실행
  - Matrix 전략: 22개 배치 (배치당 최대 10 URLs)
  - 병렬 실행: 최대 3개 배치 동시 실행
  - 3-tier 재시도 메커니즘
  - Slack 알림 (관련 공고, 문제 URL)
  - 상세 통계 및 모니터링

### 3.2 소규모 테스트 (10개 URL) ⏸️
- **상태**: 대기중 (사용자 수동 실행 필요)
- **방법**: GitHub Actions → workflow_dispatch
- **참고**: 먼저 개발 환경에서 테스트 권장

### 3.3 전체 테스트 (211개 URL) ⏸️
- **상태**: 대기중 (소규모 테스트 성공 후)
- **방법**: 일요일 21:00 KST 자동 실행 또는 수동 실행
- **중요**: Secrets 설정 필요 (CRAWLER_SECRET, SLACK_WEBHOOK_URL)

---

## Phase 4: Monitoring & UI ⏸️

### 4.1 크롤링 통계 대시보드 ⏸️
- **파일**: `app/admin/subsidy/page.tsx`
- **상태**: 대기중

### 4.2 URL 수동 등록 폼 ⏸️
- **상태**: 대기중

### 4.3 실패 URL 재시도 UI ⏸️
- **상태**: 대기중

---

## 중단/재개 가이드

### 현재 진행 단계 확인
1. 이 문서에서 "⏳ 진행중" 상태 찾기
2. 해당 단계의 "시작" 타임스탬프 확인
3. 아래 단계부터 재개

### 다음 실행 단계
**현재 위치**: Phase 1.2 (CSV 템플릿 생성)
**다음 단계**: `data/direct_urls.csv` 파일 생성 완료 후 Phase 1.3으로 이동

---

## 체크포인트

- ✅ **2025-12-22 (09:00)**: Phase 1 시작, 진행 문서 생성
- ✅ **2025-12-22 (09:30)**: CSV 템플릿 생성 완료
- ✅ **2025-12-22 (10:00)**: crawl_logs 테이블 SQL 완료
- ✅ **2025-12-22 (10:15)**: direct_url_sources 테이블 SQL 완료
- ✅ **2025-12-22 (10:30)**: 마이그레이션 가이드 완료
- ✅ **2025-12-22 (11:00)**: SQL 오류 해결 및 트러블슈팅 가이드 생성
- ✅ **2025-12-22 (11:30)**: SQL 마이그레이션 실행 완료 (사용자)
- ✅ **2025-12-22 (11:35)**: Phase 1 완료
- ✅ **2025-12-22 (12:00)**: Phase 2 완료 - Direct URL Crawler API 구현
- ✅ **2025-12-23 (00:00)**: API 테스트 완료 (6/6 테스트 통과)
- ✅ **2025-12-23 (00:30)**: Phase 3 완료 - GitHub Actions 워크플로우 생성
- ⏸️ **대기중**: Phase 3.2 - 소규모 테스트 (사용자 수동 실행)
- ⏸️ **대기중**: Phase 4 - 모니터링 & UI

## Phase 1 완료 파일 목록

### 생성된 파일
1. ✅ `docs/crawling-implementation-progress.md` - 진행 상황 추적 문서
2. ✅ `docs/PHASE1_SUMMARY.md` - Phase 1 완료 요약
3. ✅ `data/direct_urls.csv` - 211개 URL 관리 CSV 템플릿
4. ✅ `sql/create_crawl_logs.sql` - 크롤링 로그 테이블 (원본)
5. ✅ `sql/create_crawl_logs_fixed.sql` - 크롤링 로그 테이블 (수정) ⭐
6. ✅ `sql/create_direct_url_sources.sql` - URL 소스 테이블 마이그레이션
7. ✅ `sql/README_MIGRATION.md` - 마이그레이션 실행 가이드
8. ✅ `sql/TROUBLESHOOTING.md` - 트러블슈팅 가이드 ⭐
9. ✅ `sql/step1_table_only.sql` - 단계별 실행 1단계 ⭐
10. ✅ `sql/step2_views_functions.sql` - 단계별 실행 2단계 ⭐

### 다음 작업
**Phase 1.6**: Supabase에서 SQL 마이그레이션 실행
- **중요**: `sql/create_crawl_logs_fixed.sql` 사용 (원본 아님!)
- 실행 가이드: `sql/TROUBLESHOOTING.md` 참조
- 검증 후 Phase 2로 진행
