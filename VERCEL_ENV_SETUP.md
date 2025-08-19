# Vercel 환경변수 설정 가이드

## 필수 환경변수

Vercel 프로젝트 설정에서 다음 환경변수들을 설정해야 합니다:

### Google API 인증
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
```

### Google Sheets ID
```
MAIN_SPREADSHEET_ID=your_main_spreadsheet_id
UPLOAD_SPREADSHEET_ID=your_upload_spreadsheet_id
DATA_COLLECTION_SPREADSHEET_ID=your_data_collection_spreadsheet_id
COMPLETION_SPREADSHEET_ID=your_completion_spreadsheet_id
```

### Google Drive 폴더 ID
```
PRESURVEY_FOLDER_ID=your_presurvey_folder_id
COMPLETION_FOLDER_ID=your_completion_folder_id
```

## 설정 방법

1. Vercel 대시보드 접속
2. 프로젝트 선택
3. Settings > Environment Variables
4. 위의 환경변수들을 하나씩 추가
5. Production, Preview, Development 모두 체크

## 주의사항

- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`는 반드시 큰따옴표로 감싸기
- 개행 문자(`\n`)가 포함되어야 함
- 환경변수 설정 후 재배포 필요

## 환경변수 검증

배포 후 다음 URL로 환경변수 설정 확인:
```
https://your-vercel-domain.vercel.app/api/health
```

모든 환경변수가 올바르면 `status: "healthy"` 반환