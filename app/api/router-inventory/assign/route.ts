// app/api/router-inventory/assign/route.ts
// 무선 라우터 할당 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { RouterAssignRequest } from '@/types/router-inventory'

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
    console.error('[ROUTER-ASSIGN] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// POST: 라우터 할당
export const POST = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body: RouterAssignRequest = await request.json()

      console.log('[ROUTER-ASSIGN] 할당 요청:', {
        user: user.name,
        routerId: body.router_id,
        businessId: body.business_id,
        orderId: body.order_management_id
      })

      // 입력 검증
      if (!body.router_id || !body.business_id || !body.order_management_id) {
        return createErrorResponse('필수 정보가 누락되었습니다', 400)
      }

      // 라우터 존재 및 상태 확인
      const { data: router, error: routerError } = await supabaseAdmin
        .from('router_inventory')
        .select('id, serial_number, status, assigned_business_id')
        .eq('id', body.router_id)
        .eq('is_deleted', false)
        .single()

      if (routerError || !router) {
        console.error('[ROUTER-ASSIGN] 라우터 조회 오류:', routerError)
        return createErrorResponse('라우터를 찾을 수 없습니다', 404)
      }

      // 이미 할당된 라우터인지 확인
      if (router.status !== 'in_stock') {
        return createErrorResponse(
          `이미 할당된 라우터입니다 (S/N: ${router.serial_number})`,
          400
        )
      }

      if (router.assigned_business_id) {
        return createErrorResponse(
          `이 라우터는 다른 사업장에 할당되어 있습니다 (S/N: ${router.serial_number})`,
          400
        )
      }

      // 사업장 존재 확인
      const { data: business, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('id, business_name')
        .eq('id', body.business_id)
        .eq('is_deleted', false)
        .single()

      if (businessError || !business) {
        console.error('[ROUTER-ASSIGN] 사업장 조회 오류:', businessError)
        return createErrorResponse('사업장을 찾을 수 없습니다', 404)
      }

      // 발주 정보 존재 확인
      const { data: order, error: orderError } = await supabaseAdmin
        .from('order_management')
        .select('id')
        .eq('id', body.order_management_id)
        .single()

      if (orderError || !order) {
        console.error('[ROUTER-ASSIGN] 발주 정보 조회 오류:', orderError)
        return createErrorResponse('발주 정보를 찾을 수 없습니다', 404)
      }

      // 라우터 할당 실행
      const { data: assignedRouter, error: assignError } = await supabaseAdmin
        .from('router_inventory')
        .update({
          assigned_business_id: body.business_id,
          order_management_id: body.order_management_id,
          assigned_at: new Date().toISOString(),
          assigned_by: body.assigned_by || user.id,
          status: 'assigned'
        })
        .eq('id', body.router_id)
        .select('*, business_info!assigned_business_id(business_name)')
        .single()

      if (assignError) {
        console.error('[ROUTER-ASSIGN] 할당 오류:', assignError)
        return createErrorResponse('라우터 할당 중 오류가 발생했습니다', 500)
      }

      // 응답 데이터 구성
      const routerData = {
        ...assignedRouter,
        assigned_business_name: assignedRouter.business_info?.business_name || null
      }

      return createSuccessResponse({
        message: `라우터(S/N: ${routerData.serial_number})가 ${business.business_name}에 할당되었습니다`,
        router: routerData
      })
    } catch (error) {
      console.error('[ROUTER-ASSIGN] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// DELETE: 라우터 할당 해제
export const DELETE = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { searchParams } = new URL(request.url)
      const routerId = searchParams.get('router_id')

      if (!routerId) {
        return createErrorResponse('라우터 ID가 필요합니다', 400)
      }

      console.log('[ROUTER-UNASSIGN] 할당 해제 요청:', {
        user: user.name,
        routerId
      })

      // 라우터 존재 및 상태 확인
      const { data: router, error: routerError } = await supabaseAdmin
        .from('router_inventory')
        .select('id, serial_number, status, assigned_business_id')
        .eq('id', routerId)
        .eq('is_deleted', false)
        .single()

      if (routerError || !router) {
        return createErrorResponse('라우터를 찾을 수 없습니다', 404)
      }

      // 설치 완료된 라우터는 할당 해제 불가
      if (router.status === 'installed') {
        return createErrorResponse(
          '설치 완료된 라우터는 할당 해제할 수 없습니다',
          400
        )
      }

      // 할당 해제 실행
      const { data: unassignedRouter, error: unassignError } = await supabaseAdmin
        .from('router_inventory')
        .update({
          assigned_business_id: null,
          order_management_id: null,
          assigned_at: null,
          assigned_by: null,
          status: 'in_stock'
        })
        .eq('id', routerId)
        .select()
        .single()

      if (unassignError) {
        console.error('[ROUTER-UNASSIGN] 할당 해제 오류:', unassignError)
        return createErrorResponse('할당 해제 중 오류가 발생했습니다', 500)
      }

      return createSuccessResponse({
        message: `라우터(S/N: ${router.serial_number}) 할당이 해제되었습니다`,
        router: unassignedRouter
      })
    } catch (error) {
      console.error('[ROUTER-UNASSIGN] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
