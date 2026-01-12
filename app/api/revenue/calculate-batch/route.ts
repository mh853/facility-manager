import { NextRequest, NextResponse } from 'next/server';

/**
 * Batch Revenue Calculation API
 *
 * 여러 사업장의 매출 계산을 한 번에 처리
 * 용도: admin/revenue 테이블에서 모든 사업장의 계산 결과를 효율적으로 로드
 *
 * ⚠️ 중요: 이 API는 /api/revenue/calculate API를 내부적으로 호출하여
 * 단일 소스의 진실(Single Source of Truth)을 유지합니다.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_ids, save_result = true } = body;

    if (!Array.isArray(business_ids) || business_ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'business_ids 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🚀 [BATCH-CALC] ${business_ids.length}개 사업장 계산 시작`);

    // Authorization 헤더 추출 (개별 API 호출 시 전달)
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      console.error('❌ [BATCH-CALC] Authorization 헤더가 없습니다');
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 각 사업장에 대해 개별 계산 API 호출
    const results: any[] = [];
    const errors: any[] = [];

    // 병렬 처리 (최대 10개씩)
    const chunkSize = 10;
    for (let i = 0; i < business_ids.length; i += chunkSize) {
      const chunk = business_ids.slice(i, i + chunkSize);

      const chunkPromises = chunk.map(async (businessId: number) => {
        try {
          // 🔑 핵심: 단일 계산 API 호출 (동일한 로직 사용)
          // 로컬 API 호출 (서버 사이드에서 localhost 사용)
          const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${apiUrl}/api/revenue/calculate`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              business_id: businessId,
              save_result: save_result  // 요청에서 받은 save_result 파라미터 전달
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.success && data.data && data.data.calculation) {
            const calc = data.data.calculation;
            const result = {
              business_id: businessId,
              total_revenue: calc.total_revenue ?? 0,
              total_cost: calc.total_cost ?? 0,
              gross_profit: calc.gross_profit ?? 0,
              sales_commission: calc.sales_commission ?? 0,
              survey_costs: calc.survey_costs ?? 0,
              installation_costs: calc.installation_costs ?? 0,
              installation_extra_cost: calc.installation_extra_cost ?? 0,
              net_profit: calc.net_profit ?? 0,
            };
            console.log(`✓ [BATCH-CALC] ID:${businessId} - 순이익: ${result.net_profit.toLocaleString()}원`);
            return result;
          } else {
            throw new Error(data.message || 'API 응답 오류');
          }
        } catch (error) {
          console.error(`❌ [BATCH-CALC] 사업장 ${businessId} 계산 실패:`, error);
          errors.push({ business_id: businessId, error: error instanceof Error ? error.message : '알 수 없는 오류' });
          return null;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults.filter(r => r !== null));
    }

    console.log(`✅ [BATCH-CALC] ${results.length}개 사업장 계산 완료 (실패: ${errors.length}개)`);

    if (errors.length > 0) {
      console.warn('⚠️ [BATCH-CALC] 실패한 사업장:', errors.map(e => e.business_id).join(', '));
    }

    return NextResponse.json({
      success: true,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: business_ids.length,
        succeeded: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('❌ [BATCH-CALC] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
