# Vercel & Supabase 계정 변경 가이드

## 📋 개요

현재 프로젝트는 Vercel (프론트엔드/배포)과 Supabase (데이터베이스/스토리지)를 사용하고 있습니다. Git 계정은 그대로 유지하면서 Vercel과 Supabase 계정만 변경할 수 있습니다.

---

## ✅ 가능한 변경 시나리오

### 1. Vercel 계정만 변경
- ✅ 가능
- Git 저장소는 그대로 유지
- 새 Vercel 계정에서 같은 Git 저장소를 Import
- 환경 변수만 새로 설정

### 2. Supabase 계정만 변경
- ✅ 가능
- Git 저장소는 그대로 유지
- 새 Supabase 프로젝트 생성 후 데이터 마이그레이션
- 환경 변수만 새로 설정

### 3. 둘 다 변경
- ✅ 가능
- Git 저장소는 그대로 유지
- 각각 독립적으로 변경 가능

---

## 🔄 Vercel 계정 변경 절차

### 1단계: 현재 설정 백업

**필요한 정보 백업**:
```bash
# .env.local 파일 내용 저장
cat .env.local

# Vercel 환경 변수 확인
# Vercel Dashboard → Project Settings → Environment Variables
```

**백업할 환경 변수**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CRAWLER_SECRET`
- `SLACK_WEBHOOK_URL` (옵션)

### 2단계: 새 Vercel 계정 준비

1. **새 Vercel 계정 생성**
   - https://vercel.com/signup
   - GitHub 계정으로 로그인 (같은 Git 계정 사용 가능)

2. **기존 프로젝트 가져오기**
   - Vercel Dashboard → "Add New" → "Project"
   - "Import Git Repository" 선택
   - 기존 Git 저장소 선택 (`facility-manager`)

### 3단계: 환경 변수 설정

**Vercel Dashboard에서 설정**:
```
Project Settings → Environment Variables
```

**추가할 환경 변수**:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
CRAWLER_SECRET=your_crawler_secret
```

**각 환경별 설정**:
- ✅ Production
- ✅ Preview
- ✅ Development

### 4단계: GitHub Actions Secrets 업데이트

**GitHub Repository → Settings → Secrets and variables → Actions**

업데이트할 시크릿:
```
API_BASE_URL=https://your-new-vercel-app.vercel.app
CRAWLER_SECRET=your_crawler_secret
SLACK_WEBHOOK_URL=your_slack_webhook (옵션)
```

### 5단계: 배포 및 검증

1. **첫 배포 실행**
   ```bash
   # Vercel Dashboard에서 자동 배포 트리거
   # 또는 Git push로 트리거
   git commit --allow-empty -m "Trigger Vercel deployment"
   git push
   ```

2. **배포 확인**
   - Vercel Dashboard → Deployments
   - 배포 로그 확인
   - Production URL 접속 테스트

3. **기능 테스트**
   - 로그인 테스트
   - 데이터베이스 연결 확인
   - 파일 업로드 테스트
   - API 엔드포인트 테스트

### 6단계: 도메인 설정 (옵션)

**커스텀 도메인 사용 시**:
```
Vercel Dashboard → Project Settings → Domains
→ Add Domain → facility.blueon-iot.com
```

**DNS 설정**:
```
Type: CNAME
Name: facility
Value: cname.vercel-dns.com
```

---

## 🔄 Supabase 계정 변경 절차

### 1단계: 현재 데이터 백업

**데이터베이스 백업**:
```sql
-- Supabase Dashboard → SQL Editor
-- 또는 pg_dump 사용

-- 테이블 구조 백업
pg_dump -s -h db.xxx.supabase.co -U postgres -d postgres > schema.sql

-- 데이터 백업
pg_dump -a -h db.xxx.supabase.co -U postgres -d postgres > data.sql
```

**스토리지 파일 백업**:
```bash
# Supabase Dashboard → Storage → Download files
# 또는 API를 통한 일괄 다운로드
```

**현재 설정 정보 백업**:
- Row Level Security (RLS) 정책
- Storage 버킷 설정
- API Keys 정보

### 2단계: 새 Supabase 프로젝트 생성

1. **새 Supabase 계정/프로젝트 생성**
   - https://supabase.com/dashboard
   - "New Project" 클릭
   - Organization 및 Project 이름 설정

2. **데이터베이스 설정**
   - Region 선택 (기존과 동일 권장)
   - Database Password 설정

### 3단계: 스키마 및 데이터 마이그레이션

**스키마 복원**:
```sql
-- SQL Editor에서 실행
-- schema.sql 파일 내용 복사하여 실행
```

**데이터 복원**:
```sql
-- SQL Editor에서 실행
-- data.sql 파일 내용 복사하여 실행
```

**RLS 정책 재설정**:
```sql
-- 기존 RLS 정책을 새 프로젝트에 적용
-- SQL Editor에서 실행
```

### 4단계: Storage 설정

1. **버킷 생성**
   - Storage → New Bucket
   - 기존과 동일한 버킷 이름 사용

2. **파일 업로드**
   - 백업한 파일들을 새 버킷에 업로드

3. **Storage 정책 설정**
   - RLS 정책 적용
   - Public/Private 설정

### 5단계: API Keys 확인

**Project Settings → API**

필요한 키:
- `Project URL`: `https://xxx.supabase.co`
- `anon public` key
- `service_role` key (secret)

### 6단계: 환경 변수 업데이트

**Vercel 환경 변수 업데이트**:
```
NEXT_PUBLIC_SUPABASE_URL=https://new-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=new_anon_key
SUPABASE_SERVICE_ROLE_KEY=new_service_role_key
```

**로컬 환경 변수 업데이트**:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://new-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=new_anon_key
SUPABASE_SERVICE_ROLE_KEY=new_service_role_key
```

### 7단계: 검증 및 테스트

1. **로컬 테스트**
   ```bash
   npm run dev
   # 데이터베이스 연결 확인
   # CRUD 작업 테스트
   ```

2. **Vercel 재배포**
   ```bash
   git commit --allow-empty -m "Update Supabase connection"
   git push
   ```

3. **기능 테스트**
   - 데이터 조회 테스트
   - 데이터 입력 테스트
   - 파일 업로드 테스트
   - 크롤러 실행 테스트

---

## 🔧 통합 변경 절차 (Vercel + Supabase 모두)

### 권장 순서

1. **Supabase 먼저 변경**
   - 새 Supabase 프로젝트 생성
   - 데이터 마이그레이션
   - 로컬에서 테스트

2. **Vercel 변경**
   - 새 Vercel 프로젝트 생성
   - 새 Supabase 정보로 환경 변수 설정
   - 배포 및 검증

### 주의사항

⚠️ **다운타임 최소화**:
- 새 환경을 먼저 완전히 구축
- 검증 완료 후 DNS/도메인 변경
- 기존 환경은 검증 완료까지 유지

⚠️ **데이터 동기화**:
- 마이그레이션 중 발생한 새 데이터 처리 계획 수립
- 필요시 크롤러 일시 중지

---

## 📝 체크리스트

### Vercel 계정 변경
- [ ] 현재 환경 변수 백업
- [ ] 새 Vercel 계정 생성
- [ ] Git 저장소 Import
- [ ] 환경 변수 설정 (Production, Preview, Development)
- [ ] GitHub Actions Secrets 업데이트
- [ ] 첫 배포 실행
- [ ] 기능 테스트 완료
- [ ] 도메인 설정 (옵션)

### Supabase 계정 변경
- [ ] 데이터베이스 스키마 백업
- [ ] 데이터 백업
- [ ] Storage 파일 백업
- [ ] 새 Supabase 프로젝트 생성
- [ ] 스키마 복원
- [ ] 데이터 복원
- [ ] Storage 버킷 생성 및 파일 업로드
- [ ] RLS 정책 재설정
- [ ] 환경 변수 업데이트 (Vercel + Local)
- [ ] 기능 테스트 완료

### 통합 테스트
- [ ] 로그인/인증 테스트
- [ ] 데이터베이스 CRUD 테스트
- [ ] 파일 업로드/다운로드 테스트
- [ ] API 엔드포인트 테스트
- [ ] GitHub Actions 크롤러 테스트
- [ ] 모니터링 대시보드 테스트

---

## ❓ 자주 묻는 질문

### Q1: Git 저장소도 변경해야 하나요?
**A**: 아니요, Git 저장소는 그대로 유지하면 됩니다. Vercel과 Supabase는 Git과 독립적으로 작동합니다.

### Q2: 기존 계정을 유지하면서 새 계정을 테스트할 수 있나요?
**A**: 네, 새 Vercel 프로젝트에서 다른 URL로 배포하여 테스트한 후 도메인을 변경할 수 있습니다.

### Q3: 데이터 마이그레이션 중 서비스가 중단되나요?
**A**: 새 환경을 먼저 구축하고 검증한 후 전환하면 다운타임을 최소화할 수 있습니다.

### Q4: GitHub Actions는 자동으로 새 Vercel URL을 사용하나요?
**A**: 아니요, GitHub Secrets의 `API_BASE_URL`을 새 Vercel URL로 수동 업데이트해야 합니다.

### Q5: 비용은 어떻게 되나요?
**A**:
- Vercel Hobby Plan: 무료
- Supabase Free Plan: 무료 (제한 있음)
- 계정 변경 자체에는 추가 비용 없음

---

## 🆘 문제 해결

### 배포 실패 시
1. Vercel 배포 로그 확인
2. 환경 변수 설정 확인
3. Build Command 및 Output Directory 확인

### 데이터베이스 연결 실패 시
1. Supabase URL 및 API Key 확인
2. Network 설정 확인 (Supabase → Project Settings → Database)
3. RLS 정책 확인

### GitHub Actions 실패 시
1. Secrets 설정 확인
2. API_BASE_URL이 새 Vercel URL로 업데이트되었는지 확인
3. CRAWLER_SECRET이 Vercel 환경 변수와 일치하는지 확인

---

**작성일**: 2025-12-31
**최종 업데이트**: 2025-12-31
