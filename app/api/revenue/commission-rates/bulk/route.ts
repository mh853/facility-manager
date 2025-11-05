// app/api/revenue/commission-rates/bulk/route.ts
// 수수료율 대량 업데이트 API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { BulkCommissionRateUpdate, Manufacturer } from '@/types/commission'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 권한 확인 함수
async function checkUserPermission(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null }
  }

  try {
    const token = authHeader.replace('Bearer ', '')
    const result = await verifyTokenHybrid(token)

    if (!result.user) {
      return { authorized: false, user: null }
    }

    // 권한 레벨 3 이상만 대량 수수료율 업데이트 가능
    if (result.user.permission_level < 3) {
      return { authorized: false, user: null }
    }

    return {
      authorized: true,
      user: result.user
    }
  } catch (error) {
    console.error('❌ [COMMISSION-BULK] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// POST: 수수료율 대량 업데이트
export const POST = withApiHandler(async (request: NextRequest) => {
  // 권한 확인
  const { authorized, user } = await checkUserPermission(request)
  if (!authorized || !user) {
    return createErrorResponse('권한이 없습니다', 403)
  }

  try {
    const body: BulkCommissionRateUpdate = await request.json()

    const { manufacturer, commission_rate, effective_from, notes, sales_offices } = body

    if (!manufacturer || commission_rate === undefined || !effective_from) {
      return createErrorResponse('필수 파라미터가 누락되었습니다', 400)
    }

    // 대상 영업점 확인
    let targetOffices: string[] = []

    if (sales_offices && sales_offices.length > 0) {
      // 지정된 영업점만 업데이트
      targetOffices = sales_offices
    } else {
      // 모든 영업점 조회
      const { data: currentRates, error: fetchError } = await supabaseAdmin
        .from('current_commission_rates')
        .select('sales_office')
        .eq('manufacturer', manufacturer)

      if (fetchError) {
        throw fetchError
      }

      targetOffices = [...new Set(currentRates?.map(r => r.sales_office) || [])]
    }

    if (targetOffices.length === 0) {
      return createErrorResponse('업데이트할 영업점이 없습니다', 400)
    }

    // 업데이트 전 현재 수수료율 조회 (상세 정보용)
    const { data: previousRates, error: prevError } = await supabaseAdmin
      .from('current_commission_rates')
      .select('sales_office, commission_rate')
      .eq('manufacturer', manufacturer)
      .in('sales_office', targetOffices)

    if (prevError) {
      throw prevError
    }

    const previousRateMap = new Map(
      previousRates?.map(r => [r.sales_office, r.commission_rate]) || []
    )

    // 적용 시작일의 전날 계산
    const effectiveFromDate = new Date(effective_from)
    const previousDay = new Date(effectiveFromDate)
    previousDay.setDate(previousDay.getDate() - 1)

    // 1. 기존 수수료율의 effective_to 설정
    const { error: updateError } = await supabaseAdmin
      .from('sales_office_commission_rates')
      .update({
        effective_to: previousDay.toISOString().split('T')[0]
      })
      .eq('manufacturer', manufacturer)
      .in('sales_office', targetOffices)
      .is('effective_to', null)

    if (updateError) {
      throw updateError
    }

    // 2. 새로운 수수료율 추가
    const newRates = targetOffices.map(office => ({
      sales_office: office,
      manufacturer,
      commission_rate,
      effective_from,
      notes: notes || null,
      created_by: user.id
    }))

    const { data: insertedRates, error: insertError } = await supabaseAdmin
      .from('sales_office_commission_rates')
      .insert(newRates)
      .select()

    if (insertError) {
      throw insertError
    }

    // 상세 정보 생성
    const details = targetOffices.map(office => ({
      sales_office: office,
      previous_rate: previousRateMap.get(office) || null,
      new_rate: commission_rate
    }))

    return createSuccessResponse({
      message: `${manufacturer} 제조사의 수수료율이 ${targetOffices.length}개 영업점에 대해 성공적으로 업데이트되었습니다`,
      manufacturer,
      commission_rate,
      effective_from,
      affected_count: targetOffices.length,
      updated_offices: targetOffices,
      details
    })
  } catch (error) {
    console.error('❌ [COMMISSION-BULK] 대량 업데이트 오류:', error)
    return createErrorResponse('수수료율 대량 업데이트 중 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })
