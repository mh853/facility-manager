# 마이그레이션 체크리스트

## 📅 시작일: 2025-12-31

### 사전 준비
- [ ] 현재 환경 변수 백업 완료
- [ ] 데이터베이스 백업 완료
- [ ] 로컬 Git 저장소 백업 완료
- [ ] Storage 파일 백업 완료

### Phase 1: GitHub 마이그레이션
- [ ] 새 GitHub Organization 생성 (mhc853@gmail.com)
- [ ] Repository Transfer 완료
- [ ] 로컬 Git remote URL 업데이트
- [ ] Push 테스트 완료

### Phase 2: Supabase 마이그레이션
- [ ] 새 Supabase 프로젝트 생성
- [ ] 데이터베이스 스키마 복원
  - ✅ 통합 SQL 파일 생성 완료: `sql/COMBINED_MIGRATION_COMPLETE.sql`
  - ✅ 51개 핵심 SQL 파일 선별 완료 (총 173개 중)
  - [ ] Supabase SQL Editor에서 통합 SQL 실행
  - [ ] 테이블 생성 확인 (약 50~60개 예상)
  - 📖 상세 가이드: `claudedocs/sql-migration-guide.md`
- [ ] 데이터 복원 (필요시)
- [ ] Storage 버킷 생성
- [ ] Storage 파일 업로드 (필요시)
- [ ] RLS 정책 적용 (통합 SQL에 포함됨)
- [ ] API Keys 확인

### Phase 3: Vercel 마이그레이션
- [ ] 새 Vercel 프로젝트 생성
- [ ] GitHub 저장소 연결
- [ ] 환경 변수 설정
- [ ] 첫 배포 완료
- [ ] Production URL 확인

### Phase 4: GitHub Actions 업데이트
- [ ] Repository Secrets 업데이트
- [ ] Workflow 수동 실행 테스트
- [ ] 크롤러 정상 작동 확인

### Phase 5: 최종 검증
- [ ] 로그인/인증 테스트
- [ ] 데이터베이스 CRUD 테스트
- [ ] 파일 업로드/다운로드 테스트
- [ ] 보조금 공고 조회 테스트
- [ ] 관리자 대시보드 테스트
- [ ] 크롤러 실행 테스트
- [ ] 모니터링 대시보드 테스트

### Phase 6: 정리
- [ ] 기존 환경 백업 보관
- [ ] 기존 Vercel 프로젝트 삭제 (7일 후)
- [ ] 기존 Supabase 프로젝트 일시정지 (7일 후)
- [ ] 문서 업데이트

## 📝 중요 정보 기록

### 새 계정 정보
- Email: mhc853@gmail.com
- GitHub Organization: [생성 후 기록]
- Vercel Project URL: [배포 후 기록]
- Supabase Project URL: [생성 후 기록]

### API Keys (생성 후 기록)
- Supabase URL:
- Supabase Anon Key:
- Supabase Service Role Key:
- Vercel Production URL:

## ⚠️ 주의사항
- Transfer는 되돌릴 수 없으므로 신중히 진행
- 각 단계 완료 후 체크 필수
- 문제 발생 시 즉시 기존 환경으로 롤백 가능하도록 유지
