# 🚀 시설관리시스템 빠른 시작 가이드

## 5분 만에 시작하기

### 1️⃣ Supabase 설정 (2분)
1. [Supabase.com](https://supabase.com) 접속 → 로그인
2. "New Project" → 프로젝트명 입력 → 패스워드 설정 → 서울 리전 선택
3. 생성 완료 후 `Settings > API`에서 다음 정보 복사:
   - Project URL
   - anon public key
   - service_role key

### 2️⃣ 환경변수 설정 (1분)
프로젝트 루트에 `.env.local` 파일 생성:
```env
NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_key
SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_key
```

### 3️⃣ 데이터베이스 생성 (1분)
1. Supabase 대시보드 → `SQL Editor`
2. `database/schema.sql` 내용 복사 → 붙여넣기 → `Run` 클릭

### 4️⃣ 서버 시작 (1분)
```bash
npm install
npm run dev
```

### 5️⃣ 테스트 확인 (1분)
http://localhost:3000/test → "전체 테스트 실행" → 모든 테스트 ✅ 확인

---

## 🎯 완료! 이제 사용할 수 있습니다

### 📍 주요 페이지
- **관리자 홈**: http://localhost:3000/admin
- **사업장 관리**: http://localhost:3000/admin/business  
- **대기필증 관리**: http://localhost:3000/admin/air-permit
- **데이터 이력**: http://localhost:3000/admin/data-history
- **문서 자동화**: http://localhost:3000/admin/document-automation

### 🔧 문제가 생기면?
1. `docs/SETUP_GUIDE.md` - 상세한 설정 가이드
2. `docs/TEST_GUIDE.md` - 완전한 테스트 가이드
3. 브라우저 F12 → Console 탭에서 오류 확인

### 📊 테스트 데이터 추가하려면?
Supabase SQL Editor에서 `database/test-data.sql` 실행

---

**🎉 축하합니다! 완전한 시설관리시스템이 준비되었습니다.**