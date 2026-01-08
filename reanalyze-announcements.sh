#!/bin/bash

# ============================================================
# Gemini AI 재분석 실행 스크립트
# ============================================================
# 목적: 기존 공고의 신청기간, 예산 정보 재추출
# 실행: ./reanalyze-announcements.sh [배치크기]
# ============================================================

set -e

# 환경 변수 로드
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | grep CRAWLER_SECRET | xargs)
fi

CRAWLER_SECRET="${CRAWLER_SECRET}"
API_URL="${1:-http://localhost:3000}/api/subsidy-crawler/reanalyze"
BATCH_SIZE="${2:-50}"

if [ -z "$CRAWLER_SECRET" ]; then
  echo "❌ 오류: CRAWLER_SECRET 환경 변수가 설정되지 않았습니다."
  exit 1
fi

echo "🔄 Gemini AI 재분석 시작..."
echo "📍 API URL: $API_URL"
echo "📊 배치 크기: ${BATCH_SIZE}개"
echo ""

# 재분석 실행
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRAWLER_SECRET" \
  -d "{
    \"reanalyze_all\": true,
    \"batch_size\": $BATCH_SIZE,
    \"force\": false
  }")

echo "$RESPONSE" | jq '.'

echo ""

# 결과 확인
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
UPDATED=$(echo "$RESPONSE" | jq -r '.updated // 0')
FAILED=$(echo "$RESPONSE" | jq -r '.failed // 0')
DURATION=$(echo "$RESPONSE" | jq -r '.duration_ms // 0')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ 재분석 완료!"
  echo "   업데이트: ${UPDATED}개"
  echo "   실패: ${FAILED}개"
  echo "   실행시간: ${DURATION}ms"
else
  echo "❌ 재분석 실패"
  exit 1
fi
