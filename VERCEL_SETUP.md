# Vercel 배포 설정 가이드

## 환경변수 설정

Vercel 프로젝트 설정에서 다음 환경변수들을 설정해야 합니다:

### Google API 인증
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
```

**중요**: Private Key 설정 시 주의사항
1. 전체 키를 큰따옴표(`"`)로 감싸세요
2. `\n`을 실제 개행문자로 변환하지 마세요
3. 키의 시작과 끝 부분(`-----BEGIN PRIVATE KEY-----`, `-----END PRIVATE KEY-----`)을 포함하세요

### Google Drive 폴더 ID
```
PRESURVEY_FOLDER_ID=your_presurvey_folder_id
COMPLETION_FOLDER_ID=your_completion_folder_id
```

### Google Sheets ID
```
MAIN_SPREADSHEET_ID=your_main_spreadsheet_id
DATA_COLLECTION_SPREADSHEET_ID=your_data_collection_spreadsheet_id
COMPLETION_SPREADSHEET_ID=your_completion_spreadsheet_id
UPLOAD_SPREADSHEET_ID=your_upload_spreadsheet_id
```

## Vercel 프로젝트 설정

### 1. Functions 설정
- **Function Timeout**: 60초 (Pro 플랜 필요)
- **Memory**: 1024MB (권장)

### 2. 빌드 설정
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

### 3. 환경변수 설정 방법
1. Vercel Dashboard → 프로젝트 선택
2. Settings → Environment Variables
3. 위의 환경변수들을 하나씩 추가
4. **Production**, **Preview**, **Development** 모두에 적용

## 파일 업로드 제한사항

### Vercel 제한
- **개별 파일**: 최대 10MB
- **전체 요청**: 최대 30MB
- **함수 실행 시간**: 60초 (Pro 플랜)

### 최적화 설정
1. **이미지 압축**: 자동으로 WebP 형식으로 변환 (2MB 이상 파일)
2. **배치 업로드**: 동시에 최대 2개 파일씩 처리
3. **재시도 로직**: 실패 시 최대 2회 재시도
4. **타임아웃 보호**: 모든 API 호출에 타임아웃 설정

## 트러블슈팅

### 1. "FormData 파싱 실패" 오류
- 파일 크기를 10MB 이하로 줄이세요
- 여러 파일을 나누어서 업로드하세요

### 2. "Google Drive 연결 실패" 오류
- 환경변수 설정을 다시 확인하세요
- Private Key 형식이 올바른지 확인하세요
- Service Account 권한을 확인하세요

### 3. "업로드 시간 초과" 오류
- 이미지 해상도를 낮추세요 (1920px 이하 권장)
- 파일 개수를 줄여서 업로드하세요
- 인터넷 연결을 확인하세요

### 4. Google API 할당량 초과
- API 사용량을 Google Cloud Console에서 확인하세요
- 필요시 할당량 증가를 요청하세요

## 성능 최적화

### 클라이언트 사이드
- 이미지 자동 압축 (WebP, 품질 80%)
- 파일 크기 사전 검증
- 배치 업로드로 동시성 제어

### 서버 사이드
- Node.js Runtime 사용
- Promise.race()로 타임아웃 보호
- 비동기 백그라운드 처리
- 에러 처리 및 재시도 로직

## 배포 후 확인사항

1. **환경변수 확인**: 모든 필수 환경변수가 설정되었는지
2. **API 테스트**: `/api/health` 엔드포인트로 연결 확인
3. **파일 업로드 테스트**: 작은 파일로 업로드 기능 확인
4. **로그 확인**: Vercel Functions 로그에서 오류 확인

## 모니터링

### Vercel 대시보드
- Function 실행 시간 모니터링
- 에러율 확인
- 트래픽 패턴 분석

### Google Cloud Console
- API 사용량 모니터링
- 할당량 사용률 확인
- 오류 로그 확인