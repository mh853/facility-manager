// app/api/revenue/commission-rates/route.ts
// 수수료율 조회 및 업데이트 API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type {
  CommissionRate,
  CommissionRateUpdateRequest,
  Manufacturer
} from '@/types/commission'

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

    // 권한 레벨 3 이상만 수수료율 조회/수정 가능
    if (result.user.permission_level < 3) {
      return { authorized: false, user: null }
    }

    return {
      authorized: true,
      user: result.user
    }
  } catch (error) {
    console.error('❌ [COMMISSION-RATES] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 수수료율 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  // 권한 확인
  const { authorized, user } = await checkUserPermission(request)
  if (!authorized) {
    return createErrorResponse('권한이 없습니다', 403)
  }

  const { searchParams } = new URL(request.url)
  const salesOffice = searchParams.get('sales_office')

  try {
    if (salesOffice) {
      // 특정 영업점의 현재 수수료율 조회
      const { data: rates, error } = await supabaseAdmin
        .from('current_commission_rates')
        .select('*')
        .eq('sales_office', salesOffice)
        .order('manufacturer')

      if (error) {
        throw error
      }

      return createSuccessResponse({
        sales_office: salesOffice,
        rates: rates || []
      })
    } else {
      // 모든 영업점의 현재 수수료율 조회
      const { data: rates, error } = await supabaseAdmin
        .from('current_commission_rates')
        .select('*')
        .order('sales_office, manufacturer')

      if (error) {
        throw error
      }

      // 영업점별로 그룹화
      const groupedRates: Record<string, CommissionRate[]> = {}
      rates?.forEach((rate: any) => {
        if (!groupedRates[rate.sales_office]) {
          groupedRates[rate.sales_office] = []
        }
        groupedRates[rate.sales_office].push(rate)
      })

      return createSuccessResponse({
        offices: Object.keys(groupedRates).map(office => ({
          sales_office: office,
          rates: groupedRates[office]
        }))
      })
    }
  } catch (error) {
    console.error('❌ [COMMISSION-RATES] 조회 오류:', error)
    return createErrorResponse('수수료율 조회 중 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })

// PUT: 수수료율 업데이트
export const PUT = withApiHandler(async (request: NextRequest) => {
  // 권한 확인
  const { authorized, user } = await checkUserPermission(request)
  if (!authorized || !user) {
    return createErrorResponse('권한이 없습니다', 403)
  }

  try {
    const body: CommissionRateUpdateRequest = await request.json()

    const { sales_office, effective_from, rates } = body

    if (!sales_office || !effective_from || !rates || rates.length === 0) {
      return createErrorResponse('필수 파라미터가 누락되었습니다', 400)
    }

    // 트랜잭션: 기존 유효 기간 종료 + 새로운 수수료율 추가
    const effectiveFromDate = new Date(effective_from)
    const previousDay = new Date(effectiveFromDate)
    previousDay.setDate(previousDay.getDate() - 1)

    // 1. 기존 수수료율의 effective_to 설정 (해당 영업점의 모든 제조사)
    const { error: updateError } = await supabaseAdmin
      .from('sales_office_commission_rates')
      .update({
        effective_to: previousDay.toISOString().split('T')[0]
      })
      .eq('sales_office', sales_office)
      .is('effective_to', null)

    if (updateError) {
      console.error('❌ [COMMISSION-RATES] 기존 수수료율 업데이트 오류:', updateError)
      throw updateError
    }

    // 2. 새로운 수수료율 추가
    const newRates = rates.map(rate => ({
      sales_office,
      manufacturer: rate.manufacturer,
      commission_rate: rate.commission_rate,
      effective_from,
      notes: rate.notes || null,
      created_by: user.id
    }))

    const { data: insertedRates, error: insertError } = await supabaseAdmin
      .from('sales_office_commission_rates')
      .insert(newRates)
      .select()

    if (insertError) {
      console.error('❌ [COMMISSION-RATES] 새 수수료율 삽입 오류:', insertError)
      throw insertError
    }

    return createSuccessResponse({
      message: '수수료율이 성공적으로 업데이트되었습니다',
      sales_office,
      effective_from,
      updated_count: insertedRates?.length || 0,
      rates: insertedRates
    })
  } catch (error) {
    console.error('❌ [COMMISSION-RATES] 업데이트 오류:', error)
    return createErrorResponse('수수료율 업데이트 중 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })
