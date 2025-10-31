// app/api/router-inventory/[id]/route.ts
// 무선 라우터 개별 조회/수정/삭제 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { RouterInventoryItem } from '@/types/router-inventory'

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
    console.error('[ROUTER-DETAIL] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 라우터 상세 조회
export const GET = withApiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { id } = params

      console.log('[ROUTER-DETAIL] 상세 조회:', {
        user: user.name,
        routerId: id
      })

      const { data: router, error } = await supabaseAdmin
        .from('router_inventory')
        .select('*, business_info!assigned_business_id(business_name)')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (error || !router) {
        console.error('[ROUTER-DETAIL] 조회 오류:', error)
        return createErrorResponse('라우터를 찾을 수 없습니다', 404)
      }

      // 응답 데이터 구성
      const routerData: RouterInventoryItem = {
        ...router,
        assigned_business_name: router.business_info?.business_name || null
      }

      return createSuccessResponse(routerData)
    } catch (error) {
      console.error('[ROUTER-DETAIL] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// PUT: 라우터 정보 수정
export const PUT = withApiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { id } = params
      const body = await request.json()

      console.log('[ROUTER-UPDATE] 수정 요청:', {
        user: user.name,
        routerId: id,
        updates: body
      })

      // 라우터 존재 확인
      const { data: existingRouter, error: checkError } = await supabaseAdmin
        .from('router_inventory')
        .select('id')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (checkError || !existingRouter) {
        return createErrorResponse('라우터를 찾을 수 없습니다', 404)
      }

      // 업데이트 데이터 구성 (기본 정보 포함)
      const updateData: any = {}

      if ('product_name' in body) updateData.product_name = body.product_name
      if ('serial_number' in body) updateData.serial_number = body.serial_number
      if ('mac_address' in body) updateData.mac_address = body.mac_address || null
      if ('imei' in body) updateData.imei = body.imei || null
      if ('shipped_date' in body) updateData.shipped_date = body.shipped_date || null
      if ('shipped_batch' in body) updateData.shipped_batch = body.shipped_batch || null
      if ('supplier' in body) updateData.supplier = body.supplier || null
      if ('notes' in body) updateData.notes = body.notes || null
      if ('status' in body) updateData.status = body.status

      // 할당 사업장 업데이트
      if ('assigned_business_id' in body) {
        updateData.assigned_business_id = body.assigned_business_id || null
        // 할당 시 타임스탬프 및 사용자 정보 업데이트
        if (body.assigned_business_id) {
          updateData.assigned_at = new Date().toISOString()
          updateData.assigned_by = user.id
          // 할당되면 상태를 'assigned'로 변경
          if (!('status' in body)) {
            updateData.status = 'assigned'
          }
        } else {
          // 할당 해제 시
          updateData.assigned_at = null
          updateData.assigned_by = null
          // 상태를 'in_stock'으로 변경
          if (!('status' in body)) {
            updateData.status = 'in_stock'
          }
        }
      }

      // S/N 중복 체크 (변경 시)
      if ('serial_number' in body && body.serial_number) {
        const { data: duplicate } = await supabaseAdmin
          .from('router_inventory')
          .select('id')
          .eq('serial_number', body.serial_number)
          .neq('id', id)
          .eq('is_deleted', false)
          .single()

        if (duplicate) {
          return createErrorResponse(
            `이미 존재하는 S/N입니다: ${body.serial_number}`,
            400
          )
        }
      }

      // 업데이트 실행
      const { data: updatedRouter, error: updateError } = await supabaseAdmin
        .from('router_inventory')
        .update(updateData)
        .eq('id', id)
        .select('*, business_info!assigned_business_id(business_name)')
        .single()

      if (updateError) {
        console.error('[ROUTER-UPDATE] 업데이트 오류:', updateError)
        return createErrorResponse('라우터 정보 수정 중 오류가 발생했습니다', 500)
      }

      // 응답 데이터 구성
      const routerData: RouterInventoryItem = {
        ...updatedRouter,
        assigned_business_name: updatedRouter.business_info?.business_name || null
      }

      return createSuccessResponse({
        message: '라우터 정보가 수정되었습니다',
        router: routerData
      })
    } catch (error) {
      console.error('[ROUTER-UPDATE] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// DELETE: 라우터 삭제 (소프트 삭제)
export const DELETE = withApiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { id } = params

      console.log('[ROUTER-DELETE] 삭제 요청:', {
        user: user.name,
        routerId: id
      })

      // 라우터 존재 확인
      const { data: existingRouter, error: checkError } = await supabaseAdmin
        .from('router_inventory')
        .select('id, status, assigned_business_id')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (checkError || !existingRouter) {
        return createErrorResponse('라우터를 찾을 수 없습니다', 404)
      }

      // 할당된 라우터는 삭제 불가
      if (existingRouter.status !== 'in_stock' || existingRouter.assigned_business_id) {
        return createErrorResponse(
          '할당되거나 설치된 라우터는 삭제할 수 없습니다',
          400
        )
      }

      // 소프트 삭제 실행
      const { error: deleteError } = await supabaseAdmin
        .from('router_inventory')
        .update({ is_deleted: true })
        .eq('id', id)

      if (deleteError) {
        console.error('[ROUTER-DELETE] 삭제 오류:', deleteError)
        return createErrorResponse('라우터 삭제 중 오류가 발생했습니다', 500)
      }

      return createSuccessResponse({
        message: '라우터가 삭제되었습니다'
      })
    } catch (error) {
      console.error('[ROUTER-DELETE] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
