#!/bin/bash

# AWS Lambda 배포 스크립트
# 사용법: ./deploy-lambda.sh

set -e  # 오류 발생 시 즉시 중단

echo "🚀 AWS Lambda 배포 시작"

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI가 설치되지 않았습니다."
    echo "📦 설치 방법: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# AWS 자격증명 확인
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS 자격증명이 설정되지 않았습니다."
    echo "🔐 설정 방법: aws configure"
    exit 1
fi

echo "✅ AWS CLI 설정 확인 완료"

# Lambda 함수 이름
FUNCTION_NAME="subsidy-crawler"
REGION="us-east-1"  # 또는 ap-northeast-2 (서울)

# 의존성 설치
echo "📦 의존성 설치 중..."
npm install --production

# ZIP 파일 생성
echo "📦 Lambda 패키지 생성 중..."
rm -f function.zip
zip -r function.zip . -x "*.git*" -x "deploy-lambda.sh" -x "*.md"

echo "✅ function.zip 생성 완료"

# Lambda 함수가 존재하는지 확인
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo "🔄 기존 Lambda 함수 업데이트 중..."

    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $REGION

    echo "✅ Lambda 함수 코드 업데이트 완료"

    # 환경 변수 업데이트
    echo "🔧 환경 변수 업데이트 중..."
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --timeout 900 \
        --memory-size 1024 \
        --environment Variables="{
            SUPABASE_URL=${SUPABASE_URL},
            SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},
            GEMINI_API_KEY=${GEMINI_API_KEY},
            CRAWLER_SECRET=${CRAWLER_SECRET}
        }"

    echo "✅ 환경 변수 업데이트 완료"

else
    echo "🆕 새 Lambda 함수 생성 중..."

    # IAM Role ARN (사전에 생성 필요)
    # 실행 권한: AWSLambdaBasicExecutionRole
    ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text 2>/dev/null || echo "")

    if [ -z "$ROLE_ARN" ]; then
        echo "❌ Lambda 실행 역할(lambda-execution-role)이 존재하지 않습니다."
        echo "📝 다음 명령으로 생성하세요:"
        echo ""
        echo "aws iam create-role --role-name lambda-execution-role \\"
        echo "  --assume-role-policy-document file://trust-policy.json"
        echo ""
        echo "aws iam attach-role-policy --role-name lambda-execution-role \\"
        echo "  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        echo ""
        exit 1
    fi

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --timeout 900 \
        --memory-size 1024 \
        --region $REGION \
        --environment Variables="{
            SUPABASE_URL=${SUPABASE_URL},
            SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},
            GEMINI_API_KEY=${GEMINI_API_KEY},
            CRAWLER_SECRET=${CRAWLER_SECRET}
        }"

    echo "✅ Lambda 함수 생성 완료"
fi

# Lambda Layer 추가 (Chromium)
echo "📦 Chromium Layer 추가 중..."

# 공개 Chromium Layer ARN (us-east-1)
CHROMIUM_LAYER_ARN="arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:31"

aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --layers $CHROMIUM_LAYER_ARN

echo "✅ Chromium Layer 추가 완료"

# 함수 URL 확인
FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION --query 'FunctionUrl' --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ]; then
    echo "🌐 Function URL 생성 중..."

    aws lambda create-function-url-config \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --auth-type NONE \
        --cors AllowOrigins="*",AllowMethods="POST"

    FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION --query 'FunctionUrl' --output text)
fi

echo ""
echo "✅ 배포 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Lambda 정보:"
echo "  - 함수 이름: $FUNCTION_NAME"
echo "  - 리전: $REGION"
echo "  - Function URL: $FUNCTION_URL"
echo ""
echo "🧪 테스트 명령:"
echo "curl -X POST $FUNCTION_URL \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"urls\": [\"https://example.com\"], \"secret\": \"${CRAWLER_SECRET}\", \"batch_number\": 1}'"
echo ""
echo "📝 GitHub Actions에서 사용할 URL을 .env에 추가하세요:"
echo "LAMBDA_CRAWLER_URL=$FUNCTION_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
