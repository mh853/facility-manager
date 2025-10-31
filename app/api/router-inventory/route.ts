// app/api/router-inventory/route.ts
// 무선 라우터 재고 관리 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type {
  RouterListResponse,
  RouterBulkAddRequest,
  RouterListFilter,
  RouterStatus
} from '@/types/router-inventory'

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
    console.error('[ROUTER-INVENTORY] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 라우터 목록 조회
export const GET = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || 'all'
      const search = searchParams.get('search') || ''
      const business_id = searchParams.get('business_id') || ''
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')

      // 기본 쿼리 (라우터 데이터만 먼저 조회)
      let query = supabaseAdmin
        .from('router_inventory')
        .select('*', {
          count: 'exact'
        })
        .eq('is_deleted', false)

      // 상태 필터
      if (status !== 'all') {
        query = query.eq('status', status)
      }

      // 사업장 이름으로 검색하는 경우 - 먼저 사업장 ID 조회
      let businessIdFilter: string[] = []
      if (search) {
        const { data: matchedBusinesses } = await supabaseAdmin
          .from('business_info')
          .select('id')
          .ilike('business_name', `%${search}%`)
          .eq('is_deleted', false)

        if (matchedBusinesses && matchedBusinesses.length > 0) {
          businessIdFilter = matchedBusinesses.map(b => b.id)
        }
      }

      // 검색 필터 (S/N, MAC, IMEI, 또는 사업장 이름)
      if (search) {
        if (businessIdFilter.length > 0) {
          // 사업장 이름 매치 또는 S/N, MAC, IMEI 매치
          query = query.or(
            `serial_number.ilike.%${search}%,mac_address.ilike.%${search}%,imei.ilike.%${search}%,assigned_business_id.in.(${businessIdFilter.join(',')})`
          )
        } else {
          // S/N, MAC, IMEI만 검색
          query = query.or(
            `serial_number.ilike.%${search}%,mac_address.ilike.%${search}%,imei.ilike.%${search}%`
          )
        }
      }

      // 사업장 필터
      if (business_id) {
        query = query.eq('assigned_business_id', business_id)
      }

      // 정렬: S/N 오름차순
      query = query.order('serial_number', { ascending: true })

      // 페이지네이션
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data: routers, error, count } = await query

      if (error) {
        console.error('[ROUTER-INVENTORY] 조회 오류:', error)
        return createErrorResponse('라우터 목록 조회 중 오류가 발생했습니다', 500)
      }

      // 할당된 사업장 정보 가져오기 (별도 쿼리)
      const businessIds = Array.from(new Set(
        routers
          ?.filter((r: any) => r.assigned_business_id)
          .map((r: any) => r.assigned_business_id) || []
      ))

      let businessMap: Record<string, string> = {}

      if (businessIds.length > 0) {
        const { data: businesses, error: businessError } = await supabaseAdmin
          .from('business_info')
          .select('id, business_name')
          .in('id', businessIds)
          .eq('is_deleted', false)

        if (businesses) {
          businessMap = businesses.reduce((acc: Record<string, string>, b: any) => {
            acc[b.id] = b.business_name
            return acc
          }, {})
        }
      }

      // 통계 계산
      const { count: totalCount } = await supabaseAdmin
        .from('router_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)

      const { count: inStockCount } = await supabaseAdmin
        .from('router_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_stock')
        .eq('is_deleted', false)

      const { count: assignedCount } = await supabaseAdmin
        .from('router_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'assigned')
        .eq('is_deleted', false)

      // 출고 후 미할당 (출고일은 있지만 할당되지 않음)
      const { count: shippedPendingCount } = await supabaseAdmin
        .from('router_inventory')
        .select('*', { count: 'exact', head: true })
        .not('shipped_date', 'is', null)
        .eq('status', 'in_stock')
        .eq('is_deleted', false)

      const totalPages = Math.ceil((count || 0) / limit)

      // 응답 데이터 구성 (사업장 이름 매핑)
      const routerList = routers?.map((r: any) => ({
        ...r,
        assigned_business_name: r.assigned_business_id
          ? (businessMap[r.assigned_business_id] || null)
          : null
      })) || []

      const response: RouterListResponse = {
        success: true,
        data: {
          routers: routerList,
          pagination: {
            total: count || 0,
            page,
            limit,
            total_pages: totalPages
          },
          summary: {
            total: totalCount || 0,
            in_stock: inStockCount || 0,
            assigned: assignedCount || 0,
            shipped_pending: shippedPendingCount || 0
          }
        }
      }

      return createSuccessResponse(response.data)
    } catch (error) {
      console.error('[ROUTER-INVENTORY] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)

// POST: 라우터 일괄 추가 (복사-붙여넣기)
export const POST = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const body: RouterBulkAddRequest = await request.json()

      if (!body.routers || body.routers.length === 0) {
        return createErrorResponse('라우터 정보가 없습니다', 400)
      }

      // 기존 라우터 조회 (UPSERT를 위해)
      const serialNumbers = body.routers.map(r => r.serial_number)
      const { data: existingRouters } = await supabaseAdmin
        .from('router_inventory')
        .select('id, serial_number, assigned_business_id, assigned_at, assigned_by, status')
        .in('serial_number', serialNumbers)
        .eq('is_deleted', false)

      const existingRouterMap = new Map(
        (existingRouters || []).map(r => [r.serial_number, r])
      )

      // 할당 사업장 이름 → ID 매핑 (업로드 시 사업장 자동 할당)
      const businessNames = Array.from(new Set(
        body.routers
          .filter(r => r.assigned_business_name)
          .map(r => r.assigned_business_name as string)
      ))

      let businessNameToIdMap: Record<string, string> = {}

      if (businessNames.length > 0) {
        // 1. 기존 사업장 조회 (대량 조회 시 배치 처리)
        let existingBusinesses: any[] = []
        let businessError: any = null

        try {
          // 50개씩 배치로 조회 (PostgreSQL IN 절 제한 회피)
          const BATCH_SIZE = 50
          const batches = []

          for (let i = 0; i < businessNames.length; i += BATCH_SIZE) {
            const batch = businessNames.slice(i, i + BATCH_SIZE)
            batches.push(
              supabaseAdmin
                .from('business_info')
                .select('id, business_name')
                .in('business_name', batch)
                .eq('is_deleted', false)
            )
          }

          const results = await Promise.all(batches)

          for (const result of results) {
            if (result.error) {
              businessError = result.error
              console.error('[ROUTER-INVENTORY] 배치 조회 오류:', result.error)
              break
            }
            if (result.data) {
              existingBusinesses.push(...result.data)
            }
          }
        } catch (error: any) {
          console.error('[ROUTER-INVENTORY] 사업장 조회 예외:', error)
          businessError = error
        }

        if (existingBusinesses && existingBusinesses.length > 0) {
          businessNameToIdMap = existingBusinesses.reduce((acc: Record<string, string>, b: any) => {
            acc[b.business_name] = b.id
            return acc
          }, {})
        }

        // 2. 찾지 못한 사업장 자동 생성
        const notFoundBusinesses = businessNames.filter(name => !businessNameToIdMap[name])
        if (notFoundBusinesses.length > 0) {
          // 신규 사업장 레코드 생성 (최소 정보만)
          const newBusinessRecords = notFoundBusinesses.map(name => ({
            business_name: name,
            is_deleted: false,
            is_active: true
          }))

          const { data: createdBusinesses, error: createError } = await supabaseAdmin
            .from('business_info')
            .insert(newBusinessRecords)
            .select('id, business_name')

          if (createError) {
            console.error('[ROUTER-INVENTORY] 신규 사업장 생성 오류:', createError)
          } else if (createdBusinesses) {
            // 새로 생성된 사업장 ID 매핑에 추가
            createdBusinesses.forEach(b => {
              businessNameToIdMap[b.business_name] = b.id
            })
          }
        }
      }

      // 라우터 UPSERT (신규 추가 또는 업데이트)
      const routersToUpsert = body.routers.map(r => {
        const existingRouter = existingRouterMap.get(r.serial_number)

        const baseRouter: any = {
          product_name: r.product_name,
          serial_number: r.serial_number,
          mac_address: r.mac_address || null,
          imei: r.imei || null,
          shipped_date: r.shipped_date || null,
          supplier: r.supplier || null,
          status: existingRouter?.status || 'in_stock' // 기존 상태 유지
        }

        // 기존 라우터가 있으면 ID 포함 (업데이트)
        if (existingRouter) {
          baseRouter.id = existingRouter.id
        }

        // 사업장 할당 처리
        if (r.assigned_business_name && businessNameToIdMap[r.assigned_business_name]) {
          // 사업장 이름이 있고, ID 매핑을 찾은 경우 → 자동 할당
          baseRouter.assigned_business_id = businessNameToIdMap[r.assigned_business_name]
          baseRouter.assigned_at = new Date().toISOString()
          baseRouter.assigned_by = user.id
          baseRouter.status = 'assigned'
        } else if (existingRouter && existingRouter.assigned_business_id) {
          // 기존 라우터가 있고, 새로운 사업장 할당이 없으면 → 기존 할당 유지
          baseRouter.assigned_business_id = existingRouter.assigned_business_id
          baseRouter.assigned_at = existingRouter.assigned_at
          baseRouter.assigned_by = existingRouter.assigned_by
        }

        return baseRouter
      })

      const { data: upsertedRouters, error } = await supabaseAdmin
        .from('router_inventory')
        .upsert(routersToUpsert, {
          onConflict: 'serial_number', // S/N 기준으로 UPSERT
          ignoreDuplicates: false // 중복 시 업데이트
        })
        .select()

      if (error) {
        console.error('[ROUTER-INVENTORY] UPSERT 오류:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          full: error
        })
        return createErrorResponse(
          `라우터 처리 중 오류가 발생했습니다: ${error.message || error.code || 'Unknown error'}`,
          500
        )
      }

      // 신규 추가 vs 업데이트 구분
      const addedCount = routersToUpsert.filter(r => !r.id).length
      const updatedCount = routersToUpsert.filter(r => r.id).length

      let message = ''
      if (addedCount > 0 && updatedCount > 0) {
        message = `${addedCount}개 신규 추가, ${updatedCount}개 업데이트되었습니다`
      } else if (addedCount > 0) {
        message = `${addedCount}개 라우터가 추가되었습니다`
      } else if (updatedCount > 0) {
        message = `${updatedCount}개 라우터가 업데이트되었습니다`
      }

      return createSuccessResponse({
        message,
        routers: upsertedRouters,
        summary: {
          total: upsertedRouters?.length || 0,
          added: addedCount,
          updated: updatedCount
        }
      })
    } catch (error) {
      console.error('[ROUTER-INVENTORY] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
