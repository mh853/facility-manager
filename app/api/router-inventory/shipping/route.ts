// app/api/router-inventory/shipping/route.ts
// 무선 라우터 출고일 일괄 업데이트 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { RouterShippingBulkUpdateRequest } from '@/types/router-inventory'

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
    console.error('[ROUTER-SHIPPING] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// POST: 출고일 일괄 업데이트
export const POST = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body: RouterShippingBulkUpdateRequest = await request.json()

      console.log('[ROUTER-SHIPPING] 일괄 업데이트:', {
        user: user.name,
        count: body.router_ids.length,
        shipped_date: body.shipped_date
      })

      if (!body.router_ids || body.router_ids.length === 0) {
        return createErrorResponse('라우터 ID가 없습니다', 400)
      }

      if (!body.shipped_date) {
        return createErrorResponse('출고일을 입력해주세요', 400)
      }

      // 라우터 존재 확인
      const { data: routers, error: checkError } = await supabaseAdmin
        .from('router_inventory')
        .select('id, serial_number, status')
        .in('id', body.router_ids)
        .eq('is_deleted', false)

      if (checkError) {
        console.error('[ROUTER-SHIPPING] 조회 오류:', checkError)
        return createErrorResponse('라우터 조회 중 오류가 발생했습니다', 500)
      }

      if (!routers || routers.length === 0) {
        return createErrorResponse('선택한 라우터를 찾을 수 없습니다', 404)
      }

      if (routers.length !== body.router_ids.length) {
        return createErrorResponse(
          `${body.router_ids.length}개 중 ${routers.length}개만 찾았습니다`,
          400
        )
      }

      // 업데이트 데이터 구성
      const updateData: any = {
        shipped_date: body.shipped_date
      }

      if (body.shipped_batch) {
        updateData.shipped_batch = body.shipped_batch
      }

      // 일괄 업데이트 실행
      const { data: updatedRouters, error: updateError } = await supabaseAdmin
        .from('router_inventory')
        .update(updateData)
        .in('id', body.router_ids)
        .select('*, business_info!assigned_business_id(business_name)')

      if (updateError) {
        console.error('[ROUTER-SHIPPING] 업데이트 오류:', updateError)
        return createErrorResponse('출고일 업데이트 중 오류가 발생했습니다', 500)
      }

      // 응답 데이터 구성
      const routerList = updatedRouters?.map((r: any) => ({
        ...r,
        assigned_business_name: r.business_info?.business_name || null
      })) || []

      return createSuccessResponse({
        message: `${routerList.length}개 라우터의 출고일이 업데이트되었습니다`,
        routers: routerList
      })
    } catch (error) {
      console.error('[ROUTER-SHIPPING] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
