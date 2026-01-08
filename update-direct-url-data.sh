#!/bin/bash

# ============================================================
# 기존 Direct URL 크롤링 데이터 업데이트 스크립트
# ============================================================

set -e

# 환경 변수 로드
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ 오류: SUPABASE_URL 또는 SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."
  exit 1
fi

echo "🔄 Direct URL Source 데이터 업데이트 시작..."
echo "📍 Supabase URL: $SUPABASE_URL"
echo ""

# ============================================================
# Step 1: region_name 업데이트
# ============================================================

echo "📝 Step 1: region_name 업데이트 중..."

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/update_direct_url_regions" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json")

echo "✅ region_name 업데이트 완료"
echo ""

# ============================================================
# Step 2: 검증
# ============================================================

echo "🔍 Step 2: 업데이트 결과 확인..."

# Direct URL Source 개수 확인
DIRECT_COUNT=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/subsidy_announcements?region_name=eq.Direct%20URL%20Source&select=count" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  | jq -r '.[0].count // 0')

echo "📊 남은 'Direct URL Source' 개수: ${DIRECT_COUNT}개 (0이어야 정상)"

# 지자체별 통계
echo ""
echo "📊 지자체별 공고 개수:"
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/subsidy_announcements?select=region_name&region_name=neq.Direct%20URL%20Source" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  | jq -r '.[].region_name' | sort | uniq -c | sort -rn | head -10

echo ""
echo "✅ 데이터 업데이트 완료!"
echo ""
echo "⚠️  참고: Gemini AI 정보 재추출은 별도로 실행해야 합니다."
echo "   신청기간, 예산 등의 정보를 추출하려면 재크롤링이 필요합니다."
