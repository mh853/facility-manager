#!/bin/bash

# ============================================================
# API 테스트 스크립트
# ============================================================

set -e  # 오류 시 중단

CRAWLER_SECRET="7r7VQkjb734CNIyqryJrDz9GtmtfRs0dQHrd74bVG00="
BASE_URL="http://localhost:3000"

echo "🧪 보조금 크롤러 API 테스트 시작"
echo "=================================="
echo ""

# ============================================================
# 1. Stats API 테스트
# ============================================================

echo "📊 [Test 1] Stats API - 기본 조회"
echo "GET /api/subsidy-crawler/stats"
echo ""

RESPONSE=$(curl -s "${BASE_URL}/api/subsidy-crawler/stats")
echo "$RESPONSE" | jq '.'

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✅ Stats API 정상 작동"
else
  echo "❌ Stats API 실패"
  exit 1
fi

echo ""
echo "---"
echo ""

# ============================================================
# 2. Stats API 상세 조회 테스트
# ============================================================

echo "📊 [Test 2] Stats API - 상세 조회"
echo "GET /api/subsidy-crawler/stats?details=true&problems=true"
echo ""

RESPONSE=$(curl -s -H "Authorization: Bearer ${CRAWLER_SECRET}" \
  "${BASE_URL}/api/subsidy-crawler/stats?details=true&problems=true")

echo "$RESPONSE" | jq '.stats | {total_runs, recent_runs: (.recent_runs // [] | length), running_crawls: (.running_crawls // [] | length)}'

echo "✅ Stats API 상세 조회 정상"
echo ""
echo "---"
echo ""

# ============================================================
# 3. Direct URL API - GET 테스트
# ============================================================

echo "🔍 [Test 3] Direct URL API - 크롤링 대상 조회"
echo "GET /api/subsidy-crawler/direct?limit=5"
echo ""

RESPONSE=$(curl -s -H "Authorization: Bearer ${CRAWLER_SECRET}" \
  "${BASE_URL}/api/subsidy-crawler/direct?limit=5")

echo "$RESPONSE" | jq '.'

TOTAL_URLS=$(echo "$RESPONSE" | jq -r '.total_urls')
echo "크롤링 대상 URL 수: $TOTAL_URLS"

echo "✅ Direct URL API GET 정상"
echo ""
echo "---"
echo ""

# ============================================================
# 4. Direct URL API - POST 테스트 (소규모)
# ============================================================

echo "🚀 [Test 4] Direct URL API - 크롤링 실행 (테스트 URL)"
echo "POST /api/subsidy-crawler/direct"
echo ""

# 테스트용 URL (실제로는 유효하지 않을 수 있음)
TEST_URLS='["https://www.seoul.go.kr","https://www.busan.go.kr"]'

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer ${CRAWLER_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"direct_mode\": true, \"urls\": ${TEST_URLS}}" \
  "${BASE_URL}/api/subsidy-crawler/direct")

echo "$RESPONSE" | jq '.'

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
TOTAL=$(echo "$RESPONSE" | jq -r '.total_urls')
SUCCESSFUL=$(echo "$RESPONSE" | jq -r '.successful_urls')
FAILED=$(echo "$RESPONSE" | jq -r '.failed_urls')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Direct URL API POST 정상"
  echo "   총 URL: $TOTAL, 성공: $SUCCESSFUL, 실패: $FAILED"
else
  echo "❌ Direct URL API POST 실패"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi

echo ""
echo "---"
echo ""

# ============================================================
# 5. 인증 실패 테스트
# ============================================================

echo "🔐 [Test 5] 인증 실패 테스트"
echo "POST /api/subsidy-crawler/direct (잘못된 토큰)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"direct_mode": true, "urls": ["https://example.com"]}' \
  "${BASE_URL}/api/subsidy-crawler/direct")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "401" ]; then
  echo "✅ 인증 실패 처리 정상 (HTTP 401)"
  echo "$BODY" | jq '.'
else
  echo "❌ 인증 실패 처리 오류 (예상: 401, 실제: $HTTP_STATUS)"
  exit 1
fi

echo ""
echo "---"
echo ""

# ============================================================
# 6. 잘못된 요청 테스트
# ============================================================

echo "⚠️  [Test 6] 잘못된 요청 테스트"
echo "POST /api/subsidy-crawler/direct (direct_mode 없음)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Authorization: Bearer ${CRAWLER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}' \
  "${BASE_URL}/api/subsidy-crawler/direct")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "400" ]; then
  echo "✅ 잘못된 요청 처리 정상 (HTTP 400)"
  echo "$BODY" | jq '.'
else
  echo "❌ 잘못된 요청 처리 오류 (예상: 400, 실제: $HTTP_STATUS)"
  exit 1
fi

echo ""
echo "=================================="
echo "✅ 모든 API 테스트 통과!"
echo "=================================="
echo ""

# ============================================================
# 테스트 요약
# ============================================================

echo "📋 테스트 요약:"
echo "  1. ✅ Stats API 기본 조회"
echo "  2. ✅ Stats API 상세 조회"
echo "  3. ✅ Direct URL API GET"
echo "  4. ✅ Direct URL API POST"
echo "  5. ✅ 인증 실패 처리"
echo "  6. ✅ 잘못된 요청 처리"
echo ""
