// app/api/order-management/[businessId]/complete/route.ts
// 발주 완료 처리 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { OrderCompleteResponse } from '@/types/order-management'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 사용자 인증
async function checkUserPermission(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '')
  } else {
    const cookieToken = request.cookies.get('auth_token')?.value
    if (cookieToken) token = cookieToken
  }

  if (!token) {
    return { authorized: false, user: null }
  }

  try {
    const result = await verifyTokenHybrid(token)
    if (!result.user) {
      return { authorized: false, user: null }
    }
    return { authorized: true, user: result.user }
  } catch (error) {
    console.error('[ORDER-COMPLETE] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// POST: 발주 완료 처리
export const POST = withApiHandler(
  async (
    request: NextRequest,
    { params }: { params: { businessId: string } }
  ) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { businessId } = params

      console.log('[ORDER-COMPLETE] 완료 처리 요청:', {
        user: user.name,
        businessId
      })

      // 1. 사업장 정보 확인
      const { data: business, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('*')
        .eq('id', businessId)
        .eq('is_deleted', false)
        .single()

      if (businessError || !business) {
        console.error('[ORDER-COMPLETE] 사업장 조회 오류:', businessError)
        return createErrorResponse('사업장을 찾을 수 없습니다', 404)
      }

      // 2. 이미 발주 완료된 경우 체크
      if (business.order_date) {
        return createErrorResponse('이미 발주가 완료된 사업장입니다', 400)
      }

      // 3. 현재 날짜로 발주일 설정
      const orderDate = new Date().toISOString().split('T')[0]

      // 4. business_info의 order_date 업데이트
      const { error: updateError } = await supabaseAdmin
        .from('business_info')
        .update({ order_date: orderDate })
        .eq('id', businessId)

      if (updateError) {
        console.error('[ORDER-COMPLETE] 발주일 업데이트 오류:', updateError)
        return createErrorResponse('발주 완료 처리 중 오류가 발생했습니다', 500)
      }

      // 5. order_management 레코드가 있다면 완료 상태로 업데이트
      const { data: orderRecord } = await supabaseAdmin
        .from('order_management')
        .select('id')
        .eq('business_id', businessId)
        .single()

      if (orderRecord) {
        await supabaseAdmin
          .from('order_management')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('business_id', businessId)
      }

      // 성공 응답
      const responseData: OrderCompleteResponse = {
        success: true,
        data: {
          business_id: businessId,
          order_date: orderDate,
          completed_at: new Date().toISOString(),
          message: '발주가 완료되었습니다.'
        }
      }

      return createSuccessResponse(responseData.data)
    } catch (error) {
      console.error('[ORDER-COMPLETE] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
