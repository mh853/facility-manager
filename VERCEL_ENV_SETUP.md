# 🔐 Vercel Private Key 오류 해결 가이드

## 🚨 "privatekey undefined" 오류 해결

### 문제 증상
```
privatekey undefined
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 환경변수가 설정되지 않았습니다
```

### 📋 즉시 해결 방법

#### 1단계: Vercel 환경변수 확인
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 해당 프로젝트 선택
3. **Settings** → **Environment Variables**
4. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 확인

#### 2단계: 올바른 Private Key 형식

**✅ 정확한 입력 방법:**
```
Name: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
Value: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhki...\n-----END PRIVATE KEY-----\n"
```

**⚠️ 중요 포인트:**
- 반드시 큰따옴표(`"`)로 시작하고 끝나야 함
- `-----BEGIN PRIVATE KEY-----` 포함 필수
- `\n` 개행문자 포함 필수
- `-----END PRIVATE KEY-----` 포함 필수

#### 3단계: Google Cloud Console에서 키 가져오기

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **IAM 및 관리자** → **Service Account** 
3. 해당 서비스 계정 선택
4. **키** 탭 → **키 추가** → **새 키 만들기** → **JSON**
5. 다운로드된 JSON 파일에서 `private_key` 값 복사

**JSON 파일 예시:**
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service@project.iam.gserviceaccount.com"
}
```

#### 4단계: Vercel에 정확히 입력

**Name:** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

**Value:** (JSON의 private_key 값을 그대로 복사, 큰따옴표 포함)
```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

#### 5단계: 필수 환경변수 모두 설정

```
# Google API 인증
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"

# Google Drive 폴더 ID (필수)
PRESURVEY_FOLDER_ID=your_folder_id_here
COMPLETION_FOLDER_ID=your_folder_id_here
```

#### 6단계: 배포 및 테스트

1. 환경변수 저장 후 **재배포** (자동 또는 수동)
2. 헬스체크 테스트: `https://your-domain.vercel.app/api/health`
3. 업로드 테스트: `https://your-domain.vercel.app/test-upload`

---

## 🔍 문제 해결

### Case 1: 여전히 "undefined" 오류
**원인:** 환경변수가 제대로 설정되지 않음
**해결:** 
1. Vercel CLI로 직접 설정
```bash
npx vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
# 값 입력 시 큰따옴표 포함해서 붙여넣기
```

### Case 2: "Invalid key format" 오류
**원인:** Private Key 형식 문제
**해결:** 
1. Google Cloud에서 새 JSON 키 다운로드
2. `private_key` 값을 정확히 복사 (큰따옴표 포함)
3. Vercel에 다시 입력

### Case 3: "API timeout" 오류
**원인:** Google API 연결 실패
**해결:**
1. Service Account 권한 확인 (Google Drive API 활성화)
2. 폴더 ID가 올바른지 확인
3. Service Account에 폴더 공유 권한 부여

---

## ✅ 성공 확인 방법

헬스체크 API 응답:
```json
{
  "status": "healthy",
  "checks": {
    "googleAuth": { "status": "pass" },
    "googleApi": { 
      "status": "connected",
      "keyInfo": {
        "hasKey": true,
        "keyFormat": "PEM"
      }
    }
  }
}
```

모든 `status`가 `"pass"` 또는 `"connected"`이면 성공!

---

## 🚨 여전히 안 될 때

1. **Vercel Function 로그 확인**
2. **환경변수 스크린샷** 첨부 (키 값은 가리기)  
3. **헬스체크 응답** 첨부
4. **Google Cloud Service Account 설정** 스크린샷 첨부

### Optional: Google Sheets ID (시트 로그 기능용)
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