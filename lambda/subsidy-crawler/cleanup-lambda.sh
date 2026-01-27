#!/bin/bash
# AWS Lambda 리소스 정리 스크립트

set -e  # 오류 발생 시 중단

echo "🧹 AWS Lambda 리소스 정리 시작..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

REGION="us-east-1"
FUNCTION_NAME="subsidy-crawler"
S3_BUCKET="subsidy-crawler-lambda-1769159125"
ROLE_NAME="lambda-execution-role"
LOG_GROUP="/aws/lambda/subsidy-crawler"

# Lambda Function 삭제
echo "1️⃣ Lambda Function 삭제 중..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
  aws lambda delete-function --function-name $FUNCTION_NAME --region $REGION
  echo "   ✅ Lambda Function 삭제 완료"
else
  echo "   ⚠️ Lambda Function이 이미 삭제되었거나 존재하지 않습니다"
fi
echo ""

# S3 Bucket 정리
echo "2️⃣ S3 Bucket 정리 중..."
if aws s3 ls s3://$S3_BUCKET --region $REGION &>/dev/null; then
  echo "   - 버킷 내용 삭제 중..."
  aws s3 rm s3://$S3_BUCKET --recursive --region $REGION --quiet
  echo "   - 버킷 삭제 중..."
  aws s3 rb s3://$S3_BUCKET --region $REGION
  echo "   ✅ S3 Bucket 삭제 완료"
else
  echo "   ⚠️ S3 Bucket이 이미 삭제되었거나 존재하지 않습니다"
fi
echo ""

# IAM Role 정리
echo "3️⃣ IAM Role 정리 중..."
if aws iam get-role --role-name $ROLE_NAME &>/dev/null; then
  echo "   - 연결된 정책 분리 중..."
  aws iam detach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    2>/dev/null || echo "   ⚠️ 정책이 이미 분리되었거나 존재하지 않습니다"

  echo "   - Role 삭제 중..."
  aws iam delete-role --role-name $ROLE_NAME
  echo "   ✅ IAM Role 삭제 완료"
else
  echo "   ⚠️ IAM Role이 이미 삭제되었거나 존재하지 않습니다"
fi
echo ""

# CloudWatch Logs 삭제
echo "4️⃣ CloudWatch Logs 삭제 중..."
if aws logs describe-log-groups --log-group-name-prefix $LOG_GROUP --region $REGION | grep -q $LOG_GROUP; then
  aws logs delete-log-group \
    --log-group-name $LOG_GROUP \
    --region $REGION
  echo "   ✅ CloudWatch Logs 삭제 완료"
else
  echo "   ⚠️ CloudWatch Logs가 이미 삭제되었거나 존재하지 않습니다"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AWS Lambda 리소스 정리 완료!"
echo ""
echo "📝 수동 정리가 필요한 항목:"
echo "   1. IAM User (lambda-deployer)"
echo "      - 다른 용도로 사용 중이라면 그대로 유지"
echo "      - 삭제하려면: aws iam delete-user --user-name lambda-deployer"
echo ""
echo "   2. AWS CLI 설정 파일 (~/.aws/credentials)"
echo "      - lambda-deployer 프로필 수동 삭제"
echo ""
echo "   3. Lambda 워크플로우 파일 (선택)"
echo "      - .github/workflows/subsidy-crawler-lambda.yml"
echo ""
echo "💰 비용 확인:"
echo "   - AWS Console → Billing Dashboard에서 확인"
echo "   - 정리된 리소스로 인한 비용은 발생하지 않습니다"
echo ""
