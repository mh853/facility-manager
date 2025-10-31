// app/api/order-management/[businessId]/route.ts
// 발주 관리 API - 개별 조회 및 업데이트

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type {
  OrderDetailResponse,
  OrderUpdateRequest,
  Manufacturer
} from '@/types/order-management'
import { MANUFACTURER_WORKFLOWS } from '@/types/order-management'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 한글 제조사명 → 영문 키 매핑
const MANUFACTURER_MAP: Record<string, Manufacturer> = {
  '에코센스': 'ecosense',
  '가이아씨앤에스': 'gaia_cns',
  '크린어스': 'cleanearth',
  '이브이에스': 'evs',
  'EVS': 'evs'
}

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
    console.error('[ORDER-DETAIL] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 발주 상세 정보 조회
export const GET = withApiHandler(
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

      console.log('[ORDER-DETAIL] 상세 조회:', {
        user: user.name,
        businessId
      })

      // 1. 사업장 정보 조회
      const { data: business, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select(
          `
          id,
          business_name,
          address,
          manager_name,
          manager_position,
          manager_contact,
          manufacturer,
          vpn,
          greenlink_id,
          greenlink_pw
        `
        )
        .eq('id', businessId)
        .eq('is_deleted', false)
        .single()

      if (businessError || !business) {
        console.error('[ORDER-DETAIL] 사업장 조회 오류:', businessError)
        return createErrorResponse('사업장을 찾을 수 없습니다', 404)
      }

      // 2. 발주 정보 조회 (없으면 생성)
      let { data: order, error: orderError } = await supabaseAdmin
        .from('order_management')
        .select('*')
        .eq('business_id', businessId)
        .single()

      if (orderError && orderError.code === 'PGRST116') {
        // 발주 정보가 없으면 새로 생성
        const { data: newOrder, error: createError } = await supabaseAdmin
          .from('order_management')
          .insert({
            business_id: businessId,
            status: 'in_progress',
            created_by: user.id
          })
          .select()
          .single()

        if (createError) {
          console.error('[ORDER-DETAIL] 발주 정보 생성 오류:', createError)
          return createErrorResponse('발주 정보 생성 중 오류가 발생했습니다', 500)
        }

        order = newOrder
      } else if (orderError) {
        console.error('[ORDER-DETAIL] 발주 정보 조회 오류:', orderError)
        return createErrorResponse('발주 정보 조회 중 오류가 발생했습니다', 500)
      }

      // 3. 제조사별 워크플로우 정보
      const manufacturerKey = MANUFACTURER_MAP[business.manufacturer] || business.manufacturer as Manufacturer
      const workflow = MANUFACTURER_WORKFLOWS[manufacturerKey]

      if (!workflow) {
        console.error('[ORDER-DETAIL] 워크플로우를 찾을 수 없음:', {
          original: business.manufacturer,
          mapped: manufacturerKey
        })
        return createErrorResponse('제조사 정보가 올바르지 않습니다', 400)
      }

      // 4. 완료된 단계 계산
      const completedSteps = workflow.steps.filter(
        (step) => order![step.field] != null
      ).length

      const progressPercentage = Math.round(
        (completedSteps / workflow.total_steps) * 100
      )

      // 5. 응답 데이터 구성
      const responseData: OrderDetailResponse = {
        success: true,
        data: {
          business: {
            id: business.id,
            business_name: business.business_name,
            address: business.address,
            manager_name: business.manager_name,
            manager_position: business.manager_position,
            manager_contact: business.manager_contact,
            manufacturer: manufacturerKey,
            vpn: business.vpn,
            greenlink_id: business.greenlink_id,
            greenlink_pw: business.greenlink_pw
          },
          order: {
            id: order!.id,
            layout_date: order!.layout_date,
            order_form_date: order!.order_form_date,
            ip_request_date: order!.ip_request_date,
            greenlink_ip_setting_date: order!.greenlink_ip_setting_date,
            router_request_date: order!.router_request_date,
            status: order!.status,
            completed_at: order!.completed_at,
            created_at: order!.created_at,
            updated_at: order!.updated_at
          },
          workflow: {
            manufacturer: manufacturerKey,
            manufacturer_name: workflow.name,
            total_steps: workflow.total_steps,
            completed_steps: completedSteps,
            required_steps: workflow.steps.map((s) => s.key),
            progress_percentage: progressPercentage
          }
        }
      }

      return createSuccessResponse(responseData.data)
    } catch (error) {
      console.error('[ORDER-DETAIL] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// PUT: 발주 단계 업데이트
export const PUT = withApiHandler(
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
      const body: OrderUpdateRequest = await request.json()

      console.log('[ORDER-UPDATE] 업데이트 요청:', {
        user: user.name,
        businessId,
        updates: body
      })

      // 1. 사업장 존재 확인
      const { data: business, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('id, manufacturer')
        .eq('id', businessId)
        .eq('is_deleted', false)
        .single()

      if (businessError || !business) {
        return createErrorResponse('사업장을 찾을 수 없습니다', 404)
      }

      // 2. 발주 정보 업데이트
      const updateData: any = {
        updated_by: user.id
      }

      // 날짜 필드만 업데이트 (null 포함)
      if ('layout_date' in body) updateData.layout_date = body.layout_date
      if ('order_form_date' in body)
        updateData.order_form_date = body.order_form_date
      if ('ip_request_date' in body)
        updateData.ip_request_date = body.ip_request_date
      if ('greenlink_ip_setting_date' in body)
        updateData.greenlink_ip_setting_date = body.greenlink_ip_setting_date
      if ('router_request_date' in body)
        updateData.router_request_date = body.router_request_date

      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('order_management')
        .update(updateData)
        .eq('business_id', businessId)
        .select()
        .single()

      if (updateError) {
        console.error('[ORDER-UPDATE] 업데이트 오류:', updateError)
        return createErrorResponse('발주 정보 업데이트 중 오류가 발생했습니다', 500)
      }

      // 3. 업데이트된 정보로 응답
      const manufacturerKey = MANUFACTURER_MAP[business.manufacturer] || business.manufacturer as Manufacturer
      const workflow = MANUFACTURER_WORKFLOWS[manufacturerKey]

      if (!workflow) {
        console.error('[ORDER-UPDATE] 워크플로우를 찾을 수 없음:', {
          original: business.manufacturer,
          mapped: manufacturerKey
        })
        return createErrorResponse('제조사 정보가 올바르지 않습니다', 400)
      }

      const completedSteps = workflow.steps.filter(
        (step) => updatedOrder[step.field] != null
      ).length

      const progressPercentage = Math.round(
        (completedSteps / workflow.total_steps) * 100
      )

      return createSuccessResponse({
        order: updatedOrder,
        progress: {
          completed_steps: completedSteps,
          total_steps: workflow.total_steps,
          progress_percentage: progressPercentage
        }
      })
    } catch (error) {
      console.error('[ORDER-UPDATE] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
