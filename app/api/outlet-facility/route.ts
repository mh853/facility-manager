// app/api/outlet-facility/route.ts - 배출구 및 시설 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, DischargeOutlet, DischargeFacility, PreventionFacility } from '@/lib/database-service'

// GET: 배출구 및 시설 정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const airPermitId = searchParams.get('airPermitId')
    const outletId = searchParams.get('outletId')
    const type = searchParams.get('type') // 'outlets', 'discharge', 'prevention'

    if (!airPermitId && !outletId) {
      return NextResponse.json(
        { error: '대기필증 ID 또는 배출구 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 배출구별 시설 정보 조회
    if (outletId) {
      if (type === 'discharge') {
        const facilities = await DatabaseService.getDischargeFacilities(outletId)
        return NextResponse.json({ data: facilities })
      } else if (type === 'prevention') {
        const facilities = await DatabaseService.getPreventionFacilities(outletId)
        return NextResponse.json({ data: facilities })
      }
      // 둘 다 조회
      const [dischargeFacilities, preventionFacilities] = await Promise.all([
        DatabaseService.getDischargeFacilities(outletId),
        DatabaseService.getPreventionFacilities(outletId)
      ])
      return NextResponse.json({ 
        data: {
          discharge_facilities: dischargeFacilities,
          prevention_facilities: preventionFacilities
        }
      })
    }

    // 대기필증별 모든 배출구 조회
    if (airPermitId) {
      const outlets = await DatabaseService.getDischargeOutlets(airPermitId)
      return NextResponse.json({ 
        data: outlets,
        count: outlets.length 
      })
    }

  } catch (error) {
    console.error('배출구/시설 조회 오류:', error)
    return NextResponse.json(
      { error: '배출구/시설 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 새 배출구 또는 시설 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...data } = body

    switch (type) {
      case 'outlet':
        // 배출구 생성
        if (!data.air_permit_id || data.outlet_number === undefined) {
          return NextResponse.json(
            { error: '대기필증 ID와 배출구 번호는 필수입니다' },
            { status: 400 }
          )
        }

        const outletData: Omit<DischargeOutlet, 'id' | 'created_at' | 'updated_at'> = {
          air_permit_id: data.air_permit_id,
          outlet_number: data.outlet_number,
          outlet_name: data.outlet_name || null,
          additional_info: data.additional_info || {}
        }

        const newOutlet = await DatabaseService.createDischargeOutlet(outletData)
        return NextResponse.json(
          { 
            message: '배출구가 성공적으로 생성되었습니다',
            data: newOutlet 
          },
          { status: 201 }
        )

      case 'discharge_facility':
        // 배출시설 생성
        if (!data.outlet_id || !data.facility_name) {
          return NextResponse.json(
            { error: '배출구 ID와 시설명은 필수입니다' },
            { status: 400 }
          )
        }

        const dischargeFacilityData: Omit<DischargeFacility, 'id' | 'created_at' | 'updated_at'> = {
          outlet_id: data.outlet_id,
          facility_name: data.facility_name,
          capacity: data.capacity || null,
          quantity: data.quantity || 1,
          additional_info: data.additional_info || {}
        }

        const newDischargeFacility = await DatabaseService.createDischargeFacility(dischargeFacilityData)
        return NextResponse.json(
          { 
            message: '배출시설이 성공적으로 생성되었습니다',
            data: newDischargeFacility 
          },
          { status: 201 }
        )

      case 'prevention_facility':
        // 방지시설 생성
        if (!data.outlet_id || !data.facility_name) {
          return NextResponse.json(
            { error: '배출구 ID와 시설명은 필수입니다' },
            { status: 400 }
          )
        }

        const preventionFacilityData: Omit<PreventionFacility, 'id' | 'created_at' | 'updated_at'> = {
          outlet_id: data.outlet_id,
          facility_name: data.facility_name,
          capacity: data.capacity || null,
          quantity: data.quantity || 1,
          additional_info: data.additional_info || {}
        }

        const newPreventionFacility = await DatabaseService.createPreventionFacility(preventionFacilityData)
        return NextResponse.json(
          { 
            message: '방지시설이 성공적으로 생성되었습니다',
            data: newPreventionFacility 
          },
          { status: 201 }
        )

      default:
        return NextResponse.json(
          { error: '올바르지 않은 타입입니다. (outlet, discharge_facility, prevention_facility)' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('배출구/시설 생성 오류:', error)
    
    // 중복 배출구 번호 오류 처리
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json(
        { error: '이미 존재하는 배출구 번호입니다' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: '배출구/시설 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}

// PUT: 배출구 또는 시설 정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 각 타입별 업데이트 로직은 DatabaseService에 추가 메서드가 필요
    // 현재는 기본 응답만 제공
    return NextResponse.json({
      message: '업데이트 기능은 추후 구현 예정입니다',
      data: { type, id, updateData }
    })

  } catch (error: any) {
    console.error('배출구/시설 업데이트 오류:', error)
    return NextResponse.json(
      { error: '배출구/시설 정보 업데이트에 실패했습니다' },
      { status: 500 }
    )
  }
}

// DELETE: 배출구 또는 시설 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!id || !type) {
      return NextResponse.json(
        { error: 'ID와 타입은 필수입니다' },
        { status: 400 }
      )
    }

    // 각 타입별 삭제 로직은 DatabaseService에 추가 메서드가 필요
    // 현재는 기본 응답만 제공
    return NextResponse.json({
      message: '삭제 기능은 추후 구현 예정입니다',
      data: { type, id }
    })

  } catch (error) {
    console.error('배출구/시설 삭제 오류:', error)
    return NextResponse.json(
      { error: '배출구/시설 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}