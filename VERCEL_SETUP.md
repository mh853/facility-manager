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

## 업로드 테스트 방법

### 1. 테스트 페이지 접속
```
http://localhost:3000/test-upload (개발 환경)
https://your-domain.vercel.app/test-upload (배포 환경)
```

### 2. 헬스체크 먼저 실행
- **헬스체크** 버튼을 클릭하여 모든 시스템 상태 확인
- 모든 항목이 `pass` 상태인지 확인

### 3. 파일 업로드 테스트
- 이미지 파일 선택 (최대 10MB/파일, 50MB 총합)
- **업로드 테스트** 버튼 클릭
- 실시간 로그로 진행 상황 확인

## 트러블슈팅

### 1. 환경변수 오류
**증상**: `Missing environment variables` 오류
**해결**: Vercel 대시보드에서 환경변수 재설정
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
PRESURVEY_FOLDER_ID=your_folder_id
COMPLETION_FOLDER_ID=your_folder_id
```

### 2. Google API 연결 실패
**증상**: `Google Drive 연결 실패` 오류
**해결**:
1. Private Key 형식 확인 (큰따옴표로 감싸기)
2. Service Account 권한 확인
3. 폴더 ID가 올바른지 확인
4. 폴더가 Service Account와 공유되어 있는지 확인

### 3. 파일 크기 오류
**증상**: `파일 크기 초과` 오류
**해결**:
- 개별 파일: 10MB 이하
- 전체 파일: 50MB 이하
- 5MB 이상 이미지는 자동 압축됨

### 4. 업로드 시간 초과
**증상**: `업로드 시간 초과` 오류
**해결**:
1. 파일 개수 줄이기 (한 번에 5개 이하 권장)
2. 이미지 해상도 낮추기 (1920px 이하)
3. 네트워크 연결 상태 확인

### 5. 네트워크 연결 오류
**증상**: `Failed to fetch` 오류
**해결**:
1. 인터넷 연결 확인
2. 방화벽/프록시 설정 확인
3. Vercel 함수 상태 확인

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