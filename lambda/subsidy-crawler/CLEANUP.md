# AWS Lambda 정리 가이드

## 시도 내용 요약

### 배경
- Vercel 60초 타임아웃 문제 해결을 위해 AWS Lambda (15분 타임아웃) 마이그레이션 시도
- 211개 직접 URL 크롤링을 위한 Chromium 기반 브라우저 자동화 필요

### 시도한 방법들

1. **Playwright + @sparticuz/chromium**
   - 오류: `libnss3.so: cannot open shared object file`
   - 원인: Lambda 환경에 Chromium 실행에 필요한 시스템 라이브러리 부족

2. **Puppeteer + @sparticuz/chromium**
   - 동일한 `libnss3.so` 오류 발생
   - Lambda Layer 추가/제거 시도했으나 효과 없음

3. **Lambda Layer 변경 시도**
   - chrome-aws-lambda:31 (구버전)
   - chrome-aws-lambda:46 (접근 권한 없음)
   - chromium:131 (접근 권한 없음)

### 생성된 AWS 리소스

1. **Lambda Function**: `subsidy-crawler` (us-east-1)
2. **S3 Bucket**: `subsidy-crawler-lambda-1769159125`
3. **IAM User**: `lambda-deployer`
4. **IAM Role**: `lambda-execution-role`
5. **Function URL**: `https://j4dzqgc4wy7wol2bbeod276tcy0serok.lambda-url.us-east-1.on.aws/`

### 실패 원인

**근본 원인**: AWS Lambda의 기본 Amazon Linux 2 환경에는 Chromium 실행에 필요한 시스템 라이브러리가 없음

**필요한 라이브러리들**:
- libnss3.so
- libX11.so
- libatk-1.0.so
- libcups.so
- 기타 GUI 관련 라이브러리들

### 해결 방안 (미구현)

#### Option 1: Lambda Container Image
- Docker 이미지에 모든 시스템 라이브러리 포함
- 복잡도: 높음
- 비용: 프리티어 내 무료
- 타임아웃: 15분

#### Option 2: EC2 서버
- Ubuntu + Node.js + Chromium 직접 설치
- 복잡도: 중간
- 비용: $3-10/월
- 타임아웃: 무제한

#### Option 3: 전용 서비스 (Railway, DigitalOcean)
- 관리형 서버 환경
- 복잡도: 낮음
- 비용: $5-8/월
- 타임아웃: 무제한

## AWS 리소스 정리 방법

### 1. Lambda Function 삭제
```bash
aws lambda delete-function \
  --function-name subsidy-crawler \
  --region us-east-1
```

### 2. S3 Bucket 정리 및 삭제
```bash
# S3 버킷 내용 삭제
aws s3 rm s3://subsidy-crawler-lambda-1769159125 --recursive --region us-east-1

# S3 버킷 삭제
aws s3 rb s3://subsidy-crawler-lambda-1769159125 --region us-east-1
```

### 3. IAM Role 삭제
```bash
# 연결된 정책 분리
aws iam detach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Role 삭제
aws iam delete-role \
  --role-name lambda-execution-role
```

### 4. IAM User 정리 (선택)
```bash
# 연결된 정책 분리
aws iam detach-user-policy \
  --user-name lambda-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam detach-user-policy \
  --user-name lambda-deployer \
  --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess

# Access Key 삭제 (먼저 키 ID 확인)
aws iam list-access-keys --user-name lambda-deployer
aws iam delete-access-key --user-name lambda-deployer --access-key-id [ACCESS_KEY_ID]

# User 삭제
aws iam delete-user --user-name lambda-deployer
```

### 5. CloudWatch Logs 정리
```bash
# Lambda 로그 그룹 삭제
aws logs delete-log-group \
  --log-group-name /aws/lambda/subsidy-crawler \
  --region us-east-1
```

## 한 번에 정리하는 스크립트

```bash
#!/bin/bash
# cleanup-lambda.sh

echo "🧹 AWS Lambda 리소스 정리 시작..."

# Lambda Function 삭제
echo "1️⃣ Lambda Function 삭제 중..."
aws lambda delete-function --function-name subsidy-crawler --region us-east-1

# S3 Bucket 정리
echo "2️⃣ S3 Bucket 정리 중..."
aws s3 rm s3://subsidy-crawler-lambda-1769159125 --recursive --region us-east-1
aws s3 rb s3://subsidy-crawler-lambda-1769159125 --region us-east-1

# IAM Role 정리
echo "3️⃣ IAM Role 정리 중..."
aws iam detach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name lambda-execution-role

# CloudWatch Logs 삭제
echo "4️⃣ CloudWatch Logs 삭제 중..."
aws logs delete-log-group \
  --log-group-name /aws/lambda/subsidy-crawler \
  --region us-east-1

echo "✅ 정리 완료!"
echo ""
echo "📝 남은 작업:"
echo "  - IAM User (lambda-deployer)는 수동으로 삭제하세요 (다른 용도로 사용 시)"
echo "  - ~/.aws/credentials 파일에서 lambda-deployer 프로필 삭제"
```

## 비용 확인

정리 후 남은 비용이 없는지 확인:
```bash
# 실행 중인 Lambda 확인
aws lambda list-functions --region us-east-1

# S3 버킷 목록 확인
aws s3 ls

# CloudWatch Logs 그룹 확인
aws logs describe-log-groups --region us-east-1
```

## 학습 내용

1. **Lambda 제약사항 이해**
   - 기본 환경에는 GUI 라이브러리가 없음
   - Container Image나 완전한 Layer가 필요

2. **대안 방안 필요**
   - 간단한 웹 크롤링: Lambda 적합
   - Chromium 기반 크롤링: 전용 서버 또는 Container Image 필요

3. **다음 프로젝트 시 고려사항**
   - 첫 배포 전에 환경 제약사항 확인
   - PoC 테스트로 기술 스택 검증
   - 복잡도와 비용 트레이드오프 분석

## 참고 자료

- [AWS Lambda 실행 환경](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [@sparticuz/chromium GitHub](https://github.com/Sparticuz/chromium)
- [Playwright AWS Lambda 이슈](https://github.com/microsoft/playwright/issues/13776)
