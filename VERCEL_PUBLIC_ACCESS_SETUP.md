# Vercel 퍼블릭 접근 설정 가이드

## 문제 상황
Vercel로 배포된 사이트에 접속할 때 로그인을 요구하는 경우

## 해결 방법

### 1. Vercel 대시보드에서 설정 변경

1. **Vercel 대시보드 접속**: https://vercel.com/dashboard
2. **프로젝트 선택**: 해당 프로젝트 클릭
3. **Settings 탭** → **Deployment Protection** 메뉴
4. **Protection Bypass for Automation** 설정 확인

### 2. Deployment Protection 설정

다음 옵션들 중 하나를 선택:

#### 옵션 A: 완전 퍼블릭 (권장)
- **Protection Mode**: `Disabled`
- 모든 사용자가 로그인 없이 접근 가능

#### 옵션 B: 패스워드 보호
- **Protection Mode**: `Standard Protection`
- **Password Protection**: 활성화
- 특정 패스워드로 보호 (팀원들과 공유)

#### 옵션 C: 특정 도메인만 허용
- **Protection Mode**: `Standard Protection`  
- **Vercel Authentication**: 비활성화
- **Custom Protection**: 활성화

### 3. Environment Variables 확인

다음 환경변수가 Vercel에 올바르게 설정되었는지 확인:

```bash
# 필수 환경변수
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (또는 GOOGLE_SERVICE_ACCOUNT_JSON)
UPLOAD_SPREADSHEET_ID
DATA_COLLECTION_SPREADSHEET_ID
COMPLETION_SPREADSHEET_ID
PRESURVEY_FOLDER_ID
COMPLETION_FOLDER_ID
```

### 4. 도메인 설정 (선택사항)

퍼블릭 접근을 위해 커스텀 도메인 설정:

1. **Settings** → **Domains**
2. 원하는 도메인 추가
3. DNS 설정 업데이트

### 5. 확인 방법

설정 완료 후:
1. 시크릿/프라이빗 브라우징 모드에서 사이트 접속
2. 로그인 없이 바로 접근되는지 확인
3. 사업장 리스트가 정상적으로 로드되는지 확인

## 주의사항

⚠️ **보안 고려사항**:
- 퍼블릭 접근 시 민감한 정보 노출 주의
- Google Sheets 권한 설정 확인
- API 키 및 환경변수 보안 유지

✅ **권장 설정**:
- 업무용이라면 패스워드 보호 사용
- 공개용이라면 완전 퍼블릭 설정
- 정기적인 접근 로그 모니터링

## 문제 해결

### 여전히 로그인이 요구되는 경우:
1. Vercel 대시보드에서 설정 재확인
2. 브라우저 캐시 삭제
3. 24시간 후 재시도 (DNS 전파 시간)
4. Vercel 지원팀 문의

### API 오류가 발생하는 경우:
1. `/api/health` 엔드포인트로 환경변수 확인
2. Vercel Function 로그 확인
3. Google API 권한 및 할당량 확인