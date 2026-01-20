# AWS Lambda 보조금 크롤러 배포 가이드

## 📋 사전 준비

### 1. AWS CLI 설치
```bash
# macOS
brew install awscli

# Windows
# https://aws.amazon.com/cli/ 에서 설치 프로그램 다운로드

# 설치 확인
aws --version
```

### 2. AWS 자격증명 설정
```bash
aws configure

# 입력 정보:
# AWS Access Key ID: [YOUR_ACCESS_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: us-east-1 (또는 ap-northeast-2)
# Default output format: json
```

### 3. 환경 변수 설정
```bash
# .env 파일 생성 또는 환경변수 export
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export GEMINI_API_KEY="your-gemini-api-key"
export CRAWLER_SECRET="your-secret-key"
```

## 🚀 배포 단계

### Step 1: IAM Role 생성 (최초 1회만)
```bash
cd lambda/subsidy-crawler

# Lambda 실행 역할 생성
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document file://trust-policy.json

# 기본 실행 권한 부여
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 2: Lambda 함수 배포
```bash
# 배포 스크립트 실행
./deploy-lambda.sh
```

배포가 완료되면 다음과 같은 정보가 출력됩니다:
```
✅ 배포 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Lambda 정보:
  - 함수 이름: subsidy-crawler
  - 리전: us-east-1
  - Function URL: https://abc123.lambda-url.us-east-1.on.aws/
```

### Step 3: GitHub Secrets 설정
GitHub Repository → Settings → Secrets and variables → Actions에서 다음 시크릿 추가:

```
LAMBDA_CRAWLER_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws/
```

### Step 4: 테스트 실행
```bash
# Lambda 함수 직접 테스트
curl -X POST "https://your-lambda-url.lambda-url.us-east-1.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://www.g4b.go.kr/"],
    "secret": "your-crawler-secret",
    "batch_number": 1,
    "run_id": "test-run-001"
  }'
```

예상 응답:
```json
{
  "success": true,
  "batch_number": 1,
  "results": {
    "successful_urls": 1,
    "failed_urls": 0,
    "total_announcements": 5
  }
}
```

### Step 5: GitHub Actions 활성화
1. GitHub Repository → Actions 탭
2. "Lambda Subsidy Crawler" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. 배치 번호 입력 (또는 비워두고 전체 실행)

## 🔧 유지보수

### Lambda 함수 업데이트
코드를 수정한 후 다시 배포:
```bash
./deploy-lambda.sh
```

### Lambda 로그 확인
```bash
# CloudWatch Logs 확인
aws logs tail /aws/lambda/subsidy-crawler --follow --region us-east-1
```

### Lambda 함수 삭제
```bash
aws lambda delete-function \
  --function-name subsidy-crawler \
  --region us-east-1
```

## 📊 비용 분석

### 현재 사용량 기준
- 월간 실행: 77회 (77개 배치)
- 평균 실행 시간: 50초
- 메모리: 1GB
- **예상 비용: $0/월** (프리티어 내)

### AWS Lambda 프리티어
- 1백만 요청/월
- 400,000 GB-초/월

### 프리티어 초과 시
- 요청: $0.20 per 1M requests
- 실행 시간: $0.0000166667 per GB-second
- **예상 초과 비용**: ~$0.07/월 (약 100원)

## ⚠️ 트러블슈팅

### 오류: "Lambda execution role not found"
```bash
# IAM Role 생성 (Step 1 참조)
aws iam create-role --role-name lambda-execution-role \
  --assume-role-policy-document file://trust-policy.json
```

### 오류: "Task timed out after 900.00 seconds"
- Lambda 타임아웃 증가 (최대 15분):
```bash
aws lambda update-function-configuration \
  --function-name subsidy-crawler \
  --timeout 900
```

### 오류: "Chromium binary not found"
- Chromium Layer 재추가:
```bash
aws lambda update-function-configuration \
  --function-name subsidy-crawler \
  --layers arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:31
```

### 크롤링 실패가 많을 경우
1. CloudWatch Logs에서 상세 오류 확인
2. 개별 URL 직접 테스트
3. 메모리 증가 (1024MB → 2048MB):
```bash
aws lambda update-function-configuration \
  --function-name subsidy-crawler \
  --memory-size 2048
```

## 📈 성능 모니터링

### CloudWatch 대시보드
AWS Console → CloudWatch → Dashboards에서 다음 지표 확인:
- 실행 횟수 (Invocations)
- 에러 발생률 (Errors)
- 평균 실행 시간 (Duration)
- 메모리 사용량 (Max Memory Used)

### 알람 설정
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name crawler-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=subsidy-crawler
```

## 🎯 다음 단계

Lambda 배포가 완료되면:
1. ✅ GitHub Actions에서 크롤링 실행
2. ✅ 모니터링 대시보드에서 결과 확인
3. ✅ 성공 시 기존 Vercel API 비활성화
4. ✅ CloudWatch 알람 설정

## 📞 지원

문제가 발생하면:
1. CloudWatch Logs 확인
2. GitHub Actions 로그 확인
3. [AWS Lambda 문서](https://docs.aws.amazon.com/lambda/)
4. [Playwright AWS Lambda](https://github.com/Sparticuz/chromium)
