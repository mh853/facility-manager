// app/api/air-permit/update/route.ts
// 대기필증 측정기기 업데이트 API

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

interface MeasuringDevice {
  device_name: string
  quantity: number
}

interface Facility {
  facility_number: number
  name: string
  capacity: string
  quantity: number
  green_link_code: string
  measuring_devices: MeasuringDevice[]
}

interface AirPermit {
  business_type: string
  category: string
  first_report_date: string
  operation_start_date: string
  emission_facilities: Facility[]
  prevention_facilities: Facility[]
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
    console.error('[AIR-PERMIT-UPDATE] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// POST: 측정기기 업데이트
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const { authorized, user } = await checkUserPermission(request)
    if (!authorized || !user) {
      return createErrorResponse('인증이 필요합니다', 401)
    }

    const { business_id, air_permit } = await request.json() as {
      business_id: string
      air_permit: AirPermit
    }

    if (!business_id || !air_permit) {
      return createErrorResponse('필수 파라미터가 누락되었습니다', 400)
    }

    console.log('[AIR-PERMIT-UPDATE] 측정기기 업데이트 시작:', {
      user: user.name,
      business_id,
      emission_count: air_permit.emission_facilities?.length || 0,
      prevention_count: air_permit.prevention_facilities?.length || 0
    })

    // 1. air_permit_info 조회
    const { data: airPermitData, error: airPermitError } = await supabaseAdmin
      .from('air_permit_info')
      .select('id')
      .eq('business_id', business_id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (airPermitError || !airPermitData) {
      console.error('[AIR-PERMIT-UPDATE] 대기필증 조회 오류:', airPermitError)
      return createErrorResponse('대기필증 정보를 찾을 수 없습니다', 404)
    }

    // 2. 배출구 정보 조회
    const { data: outlets, error: outletsError } = await supabaseAdmin
      .from('discharge_outlets')
      .select('id')
      .eq('air_permit_id', airPermitData.id)
      .order('outlet_number', { ascending: true })

    if (outletsError || !outlets || outlets.length === 0) {
      console.error('[AIR-PERMIT-UPDATE] 배출구 조회 오류:', outletsError)
      return createErrorResponse('배출구 정보를 찾을 수 없습니다', 404)
    }

    let updateCount = 0
    let errorCount = 0

    // 3. 배출시설 측정기기 업데이트
    for (const outlet of outlets) {
      // 배출시설 조회
      const { data: dischargeFacilities, error: dischargeError } = await supabaseAdmin
        .from('discharge_facilities')
        .select('id, facility_number, additional_info')
        .eq('outlet_id', outlet.id)
        .order('facility_number', { ascending: true })

      if (dischargeError) {
        console.error('[AIR-PERMIT-UPDATE] 배출시설 조회 오류:', dischargeError)
        errorCount++
        continue
      }

      if (dischargeFacilities && dischargeFacilities.length > 0) {
        for (const facility of dischargeFacilities) {
          // air_permit의 emission_facilities에서 해당 시설 찾기
          const updatedFacility = air_permit.emission_facilities?.find(
            f => f.facility_number === facility.facility_number
          )

          if (updatedFacility) {
            // additional_info 업데이트
            const updatedInfo = {
              ...(facility.additional_info || {}),
              measuring_devices: updatedFacility.measuring_devices || []
            }

            const { error: updateError } = await supabaseAdmin
              .from('discharge_facilities')
              .update({ additional_info: updatedInfo })
              .eq('id', facility.id)

            if (updateError) {
              console.error('[AIR-PERMIT-UPDATE] 배출시설 업데이트 오류:', updateError)
              errorCount++
            } else {
              updateCount++
              console.log(`[AIR-PERMIT-UPDATE] 배출시설 ${facility.facility_number} 업데이트 완료`)
            }
          }
        }
      }

      // 방지시설 조회
      const { data: preventionFacilities, error: preventionError } = await supabaseAdmin
        .from('prevention_facilities')
        .select('id, facility_number, additional_info')
        .eq('outlet_id', outlet.id)
        .order('facility_number', { ascending: true })

      if (preventionError) {
        console.error('[AIR-PERMIT-UPDATE] 방지시설 조회 오류:', preventionError)
        errorCount++
        continue
      }

      if (preventionFacilities && preventionFacilities.length > 0) {
        for (const facility of preventionFacilities) {
          // air_permit의 prevention_facilities에서 해당 시설 찾기
          const updatedFacility = air_permit.prevention_facilities?.find(
            f => f.facility_number === facility.facility_number
          )

          if (updatedFacility) {
            // additional_info 업데이트
            const updatedInfo = {
              ...(facility.additional_info || {}),
              measuring_devices: updatedFacility.measuring_devices || []
            }

            const { error: updateError } = await supabaseAdmin
              .from('prevention_facilities')
              .update({ additional_info: updatedInfo })
              .eq('id', facility.id)

            if (updateError) {
              console.error('[AIR-PERMIT-UPDATE] 방지시설 업데이트 오류:', updateError)
              errorCount++
            } else {
              updateCount++
              console.log(`[AIR-PERMIT-UPDATE] 방지시설 ${facility.facility_number} 업데이트 완료`)
            }
          }
        }
      }
    }

    console.log('[AIR-PERMIT-UPDATE] 업데이트 완료:', {
      success: updateCount,
      errors: errorCount
    })

    if (errorCount > 0) {
      return createErrorResponse(
        `일부 시설 업데이트 실패 (성공: ${updateCount}, 실패: ${errorCount})`,
        500
      )
    }

    return createSuccessResponse({
      message: '측정기기 정보가 업데이트되었습니다',
      updated_count: updateCount
    })

  } catch (error) {
    console.error('[AIR-PERMIT-UPDATE] API 오류:', error)
    return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })
