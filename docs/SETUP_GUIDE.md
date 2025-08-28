# 시설관리시스템 설정 가이드

## 1단계: Supabase 프로젝트 생성

### 1.1 Supabase 계정 생성 및 로그인
1. [Supabase 웹사이트](https://supabase.com)에 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인 (또는 이메일로 계정 생성)

### 1.2 새 프로젝트 생성
1. 대시보드에서 "New project" 클릭
2. 프로젝트 정보 입력:
   - **Name**: `facility-manager` (또는 원하는 이름)
   - **Database Password**: 강력한 패스워드 생성 (기록해두세요!)
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국 서버)
3. "Create new project" 클릭
4. 프로젝트 생성 완료까지 1-2분 대기

### 1.3 프로젝트 정보 확인
생성 완료 후 다음 정보를 메모장에 복사해두세요:

1. **Project URL**: `Settings > API > Project URL`
2. **Anon Key**: `Settings > API > Project API keys > anon public`
3. **Service Role Key**: `Settings > API > Project API keys > service_role` (⚠️ 비밀 정보)

## 2단계: 환경변수 설정

### 2.1 환경변수 파일 생성
프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력:

```env
# Supabase 설정 (필수)
NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL_입력
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_Anon_Key_입력
SUPABASE_SERVICE_ROLE_KEY=여기에_Service_Role_Key_입력

# Google API 설정 (기존 기능 사용시)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Google Drive 폴더 ID (기존 기능 사용시)
PRESURVEY_FOLDER_ID=your_folder_id
COMPLETION_FOLDER_ID=15zwT-4-8SybkURKXzKw_kARTgNAh9pb6

# Google Sheets ID (기존 기능 사용시)
MAIN_SPREADSHEET_ID=your_spreadsheet_id
DATA_COLLECTION_SPREADSHEET_ID=your_spreadsheet_id
COMPLETION_SPREADSHEET_ID=1eEkO1LyqlhZiW-1en3ir5VzE652J5AT2Pg6Z_if1Tqo
UPLOAD_SPREADSHEET_ID=your_spreadsheet_id

# Google Docs 템플릿 ID (문서 자동화 사용시 - 선택사항)
BUSINESS_REPORT_TEMPLATE_ID=your-business-report-template-id
AIR_PERMIT_TEMPLATE_ID=your-air-permit-template-id
FACILITY_INSPECTION_TEMPLATE_ID=your-facility-inspection-template-id

# Google 프로젝트 정보 (문서 자동화 사용시 - 선택사항)
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_CLIENT_ID=your-client-id
```

### 2.2 중요 사항
- ⚠️ `.env.local` 파일은 절대 Git에 커밋하지 마세요
- ✅ 현재 `.gitignore`에 이미 포함되어 있음
- ✅ Supabase 설정만 있어도 새로운 기능들은 모두 작동합니다

## 3단계: 데이터베이스 스키마 생성

### 3.1 Supabase SQL Editor 접속
1. Supabase 대시보드에서 `SQL Editor` 메뉴 클릭
2. "New query" 클릭

### 3.2 스키마 SQL 실행
1. `database/schema.sql` 파일의 내용 전체를 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭 (또는 Ctrl+Enter)
4. 실행 완료 메시지 확인

### 3.3 테이블 생성 확인
`Table Editor` 메뉴에서 다음 테이블들이 생성되었는지 확인:
- `business_info` (사업장 정보)
- `air_permit_info` (대기필증 정보)
- `discharge_outlets` (배출구 정보)
- `discharge_facilities` (배출시설)
- `prevention_facilities` (방지시설)
- `data_history` (데이터 이력)

## 4단계: 패키지 설치 및 서버 시작

### 4.1 패키지 설치
```bash
npm install
```

### 4.2 개발 서버 시작
```bash
npm run dev
```

### 4.3 접속 확인
브라우저에서 http://localhost:3000 접속하여 시스템 로드 확인

## 5단계: 데이터베이스 연결 테스트

### 5.1 테스트 페이지 접속
http://localhost:3000/test 접속

### 5.2 데이터베이스 연결 확인
페이지에서 "Database Connection Test" 섹션 확인:
- ✅ 연결 성공: "Connected to Supabase" 표시
- ❌ 연결 실패: 환경변수 설정 재확인

## 다음 단계
- [테스트 데이터 생성](#테스트-데이터-생성)
- [시스템 기능 테스트](#기능-테스트)
- [문서 자동화 설정](#문서-자동화-설정) (선택사항)