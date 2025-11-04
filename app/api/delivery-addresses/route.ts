// app/api/delivery-addresses/route.ts
// 택배 주소 관리 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'

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
    console.error('[DELIVERY-ADDRESSES] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

export interface DeliveryAddress {
  id: string
  name: string
  recipient: string
  phone: string
  address: string
  postal_code?: string
  is_default: boolean
  use_count: number
  last_used_at?: string
  created_at: string
  updated_at: string
  created_by?: string
  is_active: boolean
  notes?: string
}

// GET: 택배 주소 목록 조회
export const GET = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { searchParams } = new URL(request.url)
      const activeOnly = searchParams.get('active_only') !== 'false' // 기본값: true

      console.log('[DELIVERY-ADDRESSES] 목록 조회:', {
        user: user.name,
        activeOnly
      })

      // 택배 주소 목록 조회 (사용 횟수 순 정렬)
      let query = supabaseAdmin
        .from('delivery_addresses')
        .select('*')
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false })

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data: addresses, error } = await query

      if (error) {
        console.error('[DELIVERY-ADDRESSES] 조회 오류:', error)
        return createErrorResponse('택배 주소 조회에 실패했습니다', 500)
      }

      console.log('[DELIVERY-ADDRESSES] 조회 완료:', {
        count: addresses?.length || 0
      })

      return createSuccessResponse({
        addresses: addresses || [],
        total: addresses?.length || 0
      })
    } catch (error) {
      console.error('[DELIVERY-ADDRESSES] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// POST: 새 택배 주소 추가
export const POST = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body = await request.json()

      console.log('[DELIVERY-ADDRESSES] 주소 추가 요청:', {
        user: user.name,
        name: body.name
      })

      // 필수 필드 검증
      if (!body.name || !body.recipient || !body.phone || !body.address) {
        return createErrorResponse('필수 필드가 누락되었습니다', 400)
      }

      // 기본 주소로 설정하는 경우 기존 기본 주소 해제 (트리거가 자동 처리)
      const { data: newAddress, error } = await supabaseAdmin
        .from('delivery_addresses')
        .insert({
          name: body.name,
          recipient: body.recipient,
          phone: body.phone,
          address: body.address,
          postal_code: body.postal_code || null,
          is_default: body.is_default || false,
          notes: body.notes || null,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('[DELIVERY-ADDRESSES] 추가 오류:', error)
        return createErrorResponse('택배 주소 추가에 실패했습니다', 500)
      }

      console.log('[DELIVERY-ADDRESSES] 추가 완료:', {
        id: newAddress.id,
        name: newAddress.name
      })

      return createSuccessResponse({
        address: newAddress
      })
    } catch (error) {
      console.error('[DELIVERY-ADDRESSES] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// PATCH: 택배 주소 수정 또는 사용 횟수 증가
export const PATCH = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body = await request.json()

      console.log('[DELIVERY-ADDRESSES] 주소 수정 요청:', {
        user: user.name,
        addressId: body.id,
        action: body.action
      })

      if (!body.id) {
        return createErrorResponse('주소 ID가 필요합니다', 400)
      }

      // 사용 횟수 증가 (발주서 생성시 호출)
      if (body.action === 'increment_usage') {
        const { data: updated, error } = await supabaseAdmin
          .from('delivery_addresses')
          .update({
            use_count: supabaseAdmin.rpc('increment', { x: 1 }),
            last_used_at: new Date().toISOString()
          })
          .eq('id', body.id)
          .select()
          .single()

        if (error) {
          console.error('[DELIVERY-ADDRESSES] 사용 횟수 증가 오류:', error)
          return createErrorResponse('사용 횟수 업데이트에 실패했습니다', 500)
        }

        return createSuccessResponse({
          address: updated
        })
      }

      // 주소 정보 수정
      const updateData: any = {}
      if (body.name !== undefined) updateData.name = body.name
      if (body.recipient !== undefined) updateData.recipient = body.recipient
      if (body.phone !== undefined) updateData.phone = body.phone
      if (body.address !== undefined) updateData.address = body.address
      if (body.postal_code !== undefined) updateData.postal_code = body.postal_code
      if (body.is_default !== undefined) updateData.is_default = body.is_default
      if (body.is_active !== undefined) updateData.is_active = body.is_active
      if (body.notes !== undefined) updateData.notes = body.notes

      const { data: updated, error } = await supabaseAdmin
        .from('delivery_addresses')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single()

      if (error) {
        console.error('[DELIVERY-ADDRESSES] 수정 오류:', error)
        return createErrorResponse('택배 주소 수정에 실패했습니다', 500)
      }

      console.log('[DELIVERY-ADDRESSES] 수정 완료:', {
        id: updated.id,
        name: updated.name
      })

      return createSuccessResponse({
        address: updated
      })
    } catch (error) {
      console.error('[DELIVERY-ADDRESSES] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// DELETE: 택배 주소 삭제 (소프트 삭제)
export const DELETE = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { searchParams } = new URL(request.url)
      const addressId = searchParams.get('id')

      console.log('[DELIVERY-ADDRESSES] 주소 삭제 요청:', {
        user: user.name,
        addressId
      })

      if (!addressId) {
        return createErrorResponse('주소 ID가 필요합니다', 400)
      }

      // 소프트 삭제 (is_active = false)
      const { error } = await supabaseAdmin
        .from('delivery_addresses')
        .update({ is_active: false })
        .eq('id', addressId)

      if (error) {
        console.error('[DELIVERY-ADDRESSES] 삭제 오류:', error)
        return createErrorResponse('택배 주소 삭제에 실패했습니다', 500)
      }

      console.log('[DELIVERY-ADDRESSES] 삭제 완료:', { addressId })

      return createSuccessResponse({
        message: '택배 주소가 삭제되었습니다'
      })
    } catch (error) {
      console.error('[DELIVERY-ADDRESSES] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
