# Vercel 환경변수 설정 가이드

## 필수 환경변수

Vercel 프로젝트 설정에서 다음 환경변수들을 설정해야 합니다:

### Google API 인증
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
```

**⚠️ IMPORTANT: Private Key 설정 시 주의사항**

### 방법 1: 표준 방식 (가장 일반적)
```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
```

### 방법 2: Base64 인코딩 방식 (DECODER 오류 발생 시)
```bash
# 1. Private Key를 Base64로 인코딩
echo "-----BEGIN PRIVATE KEY-----
your_private_key_here
-----END PRIVATE KEY-----" | base64 -w 0

# 2. 결과를 Vercel 환경변수에 설정
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=LS0tLS1CRUdJTi...
```

### 방법 3: 전체 Service Account JSON 방식 (권장)
```bash
# 1. Google Cloud Console에서 Service Account JSON 파일 다운로드
# 2. JSON 내용을 한 줄로 압축 (minify)
# 3. 전체 JSON을 환경변수로 설정
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project",...}
```

**설정 순서:**
1. 방법 1로 시도
2. DECODER 오류 발생 시 방법 2 또는 3 사용

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