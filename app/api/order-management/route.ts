// app/api/order-management/route.ts
// 발주 관리 API - 목록 조회

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type {
  OrderListItem,
  OrderListResponse,
  OrderListFilter,
  Manufacturer
} from '@/types/order-management'

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

// 영문 키 → 한글 제조사명 역매핑
const MANUFACTURER_REVERSE_MAP: Record<Manufacturer, string> = {
  'ecosense': '에코센스',
  'gaia_cns': '가이아씨앤에스',
  'cleanearth': '크린어스',
  'evs': '이브이에스'
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
    console.error('[ORDER-MANAGEMENT] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 발주 대상 사업장 목록 조회
export const GET = withApiHandler(
  async (request: NextRequest) => {
    try {
      const { authorized, user } = await checkUserPermission(request)
      if (!authorized || !user) {
        return createErrorResponse('인증이 필요합니다', 401)
      }

      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search') || ''
      const manufacturer = searchParams.get('manufacturer') || 'all'
      const status = searchParams.get('status') || 'all'
      const sort = searchParams.get('sort') || 'latest'
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')

      console.log('[ORDER-MANAGEMENT] 목록 조회:', {
        user: user.name,
        search,
        manufacturer,
        status,
        page,
        limit
      })

      let orders: any[] = []
      let orderError: any = null

      // 1. 상태에 따라 다른 쿼리 실행
      if (status === 'in_progress') {
        // 발주 필요: facility_tasks에서 status='product_order'인 사업장
        const { data: tasks, error: taskErr } = await supabaseAdmin
          .from('facility_tasks')
          .select('id, business_id, business_name, task_type, status, updated_at')
          .eq('status', 'product_order')
          .eq('is_deleted', false)

        if (taskErr) {
          orderError = taskErr
        } else if (tasks && tasks.length > 0) {
          // business_id로 business_info 조회 (null 값 필터링)
          const businessIds = tasks
            .map(t => t.business_id)
            .filter(id => id !== null && id !== undefined)

          if (businessIds.length === 0) {
            console.warn('[ORDER-MANAGEMENT] 모든 tasks의 business_id가 null입니다')
            orders = []
          } else {
            const { data: businesses, error: bizErr } = await supabaseAdmin
              .from('business_info')
              .select('*')
              .in('id', businessIds)
              .eq('is_deleted', false)

          if (bizErr) {
            orderError = bizErr
          } else {
            // business_info를 Map으로 변환
            const businessMap = new Map(
              businesses?.map(b => [b.id, b]) || []
            )

            // facility_tasks와 business_info 결합
            orders = tasks
              .map((task: any) => {
                const bi = businessMap.get(task.business_id)
                if (!bi) return null

                // 사업장명 검색 필터
                if (search && !bi.business_name?.toLowerCase().includes(search.toLowerCase())) {
                  return null
                }

                // 제조사 한글 → 영문 변환
                const manufacturerKey = MANUFACTURER_MAP[bi.manufacturer] || null

                // 제조사 필터
                if (manufacturer !== 'all' && manufacturerKey !== manufacturer) {
                  return null
                }

                return {
                  id: task.id,
                  business_id: bi.id,
                  business_name: bi.business_name,
                  address: bi.address,
                  manufacturer: manufacturerKey,
                  status: 'in_progress',
                  progress_percentage: 0,
                  last_updated: task.updated_at,
                  steps_completed: 0,
                  steps_total: manufacturerKey === 'ecosense' ? 2 : 5
                }
              })
              .filter((o: any) => o !== null)
          }
          }
        }
      } else if (status === 'not_started') {
        // 발주 진행 전: business_info에서 order_date가 NULL인 사업장
        let businessQuery = supabaseAdmin
          .from('business_info')
          .select('*')
          .is('order_date', null)
          .eq('is_deleted', false)

        // 사업장명 검색
        if (search) {
          businessQuery = businessQuery.ilike('business_name', `%${search}%`)
        }

        // 제조사 필터 (영문 키 → 한글 변환)
        if (manufacturer !== 'all') {
          const manufacturerKorean = MANUFACTURER_REVERSE_MAP[manufacturer as Manufacturer]
          if (manufacturerKorean) {
            businessQuery = businessQuery.eq('manufacturer', manufacturerKorean)
          }
        }

        const { data: businesses, error: bizErr } = await businessQuery

        if (bizErr) {
          orderError = bizErr
        } else if (businesses) {
          // business_info 데이터를 order 형식으로 변환
          orders = businesses.map((bi: any) => {
            const manufacturerKey = MANUFACTURER_MAP[bi.manufacturer] || null
            return {
              id: bi.id,
              business_id: bi.id,
              business_name: bi.business_name,
              address: bi.address,
              manufacturer: manufacturerKey,
              status: 'not_started',
              progress_percentage: 0,
              last_updated: bi.updated_at,
              steps_completed: 0,
              steps_total: manufacturerKey === 'ecosense' ? 2 : 5
            }
          })
        }
      } else if (status === 'completed') {
        // 발주 완료: business_info에서 order_date가 있는 사업장
        let businessQuery = supabaseAdmin
          .from('business_info')
          .select('*')
          .not('order_date', 'is', null)
          .eq('is_deleted', false)

        // 사업장명 검색
        if (search) {
          businessQuery = businessQuery.ilike('business_name', `%${search}%`)
        }

        // 제조사 필터 (영문 키 → 한글 변환)
        if (manufacturer !== 'all') {
          const manufacturerKorean = MANUFACTURER_REVERSE_MAP[manufacturer as Manufacturer]
          if (manufacturerKorean) {
            businessQuery = businessQuery.eq('manufacturer', manufacturerKorean)
          }
        }

        const { data: businesses, error: bizErr } = await businessQuery

        if (bizErr) {
          orderError = bizErr
        } else if (businesses) {
          // business_info 데이터를 order 형식으로 변환
          orders = businesses.map((bi: any) => {
            const manufacturerKey = MANUFACTURER_MAP[bi.manufacturer] || null
            return {
              id: bi.id,
              business_id: bi.id,
              business_name: bi.business_name,
              address: bi.address,
              manufacturer: manufacturerKey,
              status: 'completed',
              progress_percentage: 100,
              last_updated: bi.updated_at,
              steps_completed: manufacturerKey === 'ecosense' ? 2 : 5,
              steps_total: manufacturerKey === 'ecosense' ? 2 : 5
            }
          })
        }
      } else {
        // 'all' 상태: 모든 사업장 조회
        let businessQuery = supabaseAdmin
          .from('business_info')
          .select('*')
          .eq('is_deleted', false)

        if (search) {
          businessQuery = businessQuery.ilike('business_name', `%${search}%`)
        }

        // 제조사 필터 (영문 키 → 한글 변환)
        if (manufacturer !== 'all') {
          const manufacturerKorean = MANUFACTURER_REVERSE_MAP[manufacturer as Manufacturer]
          if (manufacturerKorean) {
            businessQuery = businessQuery.eq('manufacturer', manufacturerKorean)
          }
        }

        const { data: businesses, error: bizErr } = await businessQuery

        if (bizErr) {
          orderError = bizErr
        } else if (businesses) {
          orders = businesses.map((bi: any) => {
            const hasOrderDate = !!bi.order_date
            const manufacturerKey = MANUFACTURER_MAP[bi.manufacturer] || null
            return {
              id: bi.id,
              business_id: bi.id,
              business_name: bi.business_name,
              address: bi.address,
              manufacturer: manufacturerKey,
              status: hasOrderDate ? 'completed' : 'in_progress',
              progress_percentage: hasOrderDate ? 100 : 0,
              last_updated: bi.updated_at,
              steps_completed: hasOrderDate ? (manufacturerKey === 'ecosense' ? 2 : 5) : 0,
              steps_total: manufacturerKey === 'ecosense' ? 2 : 5
            }
          })
        }
      }

      if (orderError) {
        console.error('[ORDER-MANAGEMENT] 발주 정보 조회 오류:', {
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          code: orderError.code,
          full: orderError
        })
        return createErrorResponse('발주 정보 조회 중 오류가 발생했습니다', 500)
      }

      if (!orders || orders.length === 0) {
        return createSuccessResponse({
          orders: [],
          pagination: { total: 0, page: 1, limit, total_pages: 0 },
          summary: {
            total_orders: 0,
            in_progress: 0,
            completed: 0,
            by_manufacturer: { ecosense: 0, gaia_cns: 0, cleanearth: 0, evs: 0 }
          }
        })
      }

      // 2. 데이터 매핑
      let orderList: OrderListItem[] = orders.map((order: any) => {
        return {
          id: order.id || '',
          business_id: order.business_id,
          business_name: order.business_name,
          address: order.address,
          manufacturer: order.manufacturer,
          status: order.status || 'in_progress',
          progress_percentage: order.progress_percentage || 0,
          last_updated: order.updated_at,
          steps_completed: order.steps_completed || 0,
          steps_total: order.steps_total || 2,
          latest_step: null,
          latest_step_date: null
        }
      })

      // 3. 정렬
      if (sort === 'name') {
        orderList.sort((a, b) =>
          a.business_name.localeCompare(b.business_name, 'ko')
        )
      } else if (sort === 'updated') {
        orderList.sort(
          (a, b) =>
            new Date(b.last_updated).getTime() -
            new Date(a.last_updated).getTime()
        )
      } else {
        // latest (기본)
        orderList.sort(
          (a, b) =>
            new Date(b.last_updated).getTime() -
            new Date(a.last_updated).getTime()
        )
      }

      // 6. 페이지네이션
      const total = orderList.length
      const totalPages = Math.ceil(total / limit)
      const startIndex = (page - 1) * limit
      const paginatedOrders = orderList.slice(startIndex, startIndex + limit)

      // 7. 통계 계산 (전체 데이터 기준)
      // 발주 필요: facility_tasks에서 status='product_order' 카운트
      const { count: inProgressCount } = await supabaseAdmin
        .from('facility_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'product_order')
        .eq('is_deleted', false)

      // 발주 진행 전: business_info.order_date가 NULL인 사업장 카운트
      const { count: notStartedCount } = await supabaseAdmin
        .from('business_info')
        .select('*', { count: 'exact', head: true })
        .is('order_date', null)
        .eq('is_deleted', false)

      // 발주 완료: business_info.order_date가 있는 사업장 카운트
      const { count: completedCount } = await supabaseAdmin
        .from('business_info')
        .select('*', { count: 'exact', head: true })
        .not('order_date', 'is', null)
        .eq('is_deleted', false)

      const summary = {
        total_orders: (inProgressCount || 0) + (notStartedCount || 0) + (completedCount || 0),
        in_progress: inProgressCount || 0,
        not_started: notStartedCount || 0,
        completed: completedCount || 0,
        by_manufacturer: {
          ecosense: orderList.filter((o) => o.manufacturer === 'ecosense')
            .length,
          gaia_cns: orderList.filter((o) => o.manufacturer === 'gaia_cns')
            .length,
          cleanearth: orderList.filter((o) => o.manufacturer === 'cleanearth')
            .length,
          evs: orderList.filter((o) => o.manufacturer === 'evs').length
        }
      }

      return createSuccessResponse({
        orders: paginatedOrders,
        pagination: {
          total,
          page,
          limit,
          total_pages: totalPages
        },
        summary
      })
    } catch (error) {
      console.error('[ORDER-MANAGEMENT] API 오류:', error)
      return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
    }
  },
  { logLevel: 'debug' }
)
