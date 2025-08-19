# Facility Manager

시설 관리 시스템 - 구글 드라이브 파일 업로드 및 관리 시스템

## 기능

- 사업장별 자동 폴더 생성
- 파일 타입별 분류 업로드 (기본사진, 배출시설, 방지시설)
- 구글 스프레드시트 연동
- 체계적인 파일명 생성
- 업로드 이력 관리

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 모바일 테스트용 (네트워크 접근 허용)
npm run dev-mobile
```

## 환경 설정

`.env.local` 파일에 다음 환경변수 설정:

```env
# Google API 인증 정보
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Google Drive 폴더 ID
PRESURVEY_FOLDER_ID=your_folder_id
COMPLETION_FOLDER_ID=your_folder_id

# Google Sheets ID
MAIN_SPREADSHEET_ID=your_spreadsheet_id
UPLOAD_SPREADSHEET_ID=your_spreadsheet_id
```

## 테스트

시스템 테스트: http://localhost:3000/test

## 폴더 구조

```
📁 설치전실사 (루트 폴더)
  └── 📁 [사업장명] (자동 생성)
      ├── 📁 기본사진
      ├── 📁 배출시설
      └── 📁 방지시설
```

## 기술 스택

- Next.js 14
- TypeScript
- Google Drive API
- Google Sheets API
- Tailwind CSS
