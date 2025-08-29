// app/api/facility-detail/route.ts - 시설 상세정보 업데이트 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

// PUT: 시설 상세정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { facilityId, facilityType, updates } = body
    
    if (!facilityId || !facilityType) {
      return NextResponse.json(
        { error: '시설 ID와 타입은 필수입니다' },
        { status: 400 }
      )
    }

    console.log('🔧 시설 정보 업데이트:', { facilityId, facilityType, updates })

    let result
    if (facilityType === 'discharge') {
      // 배출시설 업데이트
      const updateData: any = {}
      
      // 기본 필드들
      if (updates.facility_name !== undefined) updateData.facility_name = updates.facility_name
      if (updates.capacity !== undefined) updateData.capacity = updates.capacity
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity
      
      // additional_info에 저장할 확장 필드들
      const additionalInfo: any = {}
      if (updates.facility_number !== undefined) additionalInfo.facility_number = updates.facility_number
      if (updates.green_link_code !== undefined) additionalInfo.green_link_code = updates.green_link_code
      if (updates.memo !== undefined) additionalInfo.memo = updates.memo
      
      if (Object.keys(additionalInfo).length > 0) {
        updateData.additional_info = additionalInfo
      }

      result = await DatabaseService.updateDischargeFacility(facilityId, updateData)
      
    } else if (facilityType === 'prevention') {
      // 방지시설 업데이트
      const updateData: any = {}
      
      // 기본 필드들
      if (updates.facility_name !== undefined) updateData.facility_name = updates.facility_name
      if (updates.capacity !== undefined) updateData.capacity = updates.capacity
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity
      
      // additional_info에 저장할 확장 필드들
      const additionalInfo: any = {}
      if (updates.facility_number !== undefined) additionalInfo.facility_number = updates.facility_number
      if (updates.green_link_code !== undefined) additionalInfo.green_link_code = updates.green_link_code
      if (updates.measurement_device !== undefined) additionalInfo.measurement_device = updates.measurement_device
      if (updates.memo !== undefined) additionalInfo.memo = updates.memo
      
      if (Object.keys(additionalInfo).length > 0) {
        updateData.additional_info = additionalInfo
      }

      result = await DatabaseService.updatePreventionFacility(facilityId, updateData)
      
    } else {
      return NextResponse.json(
        { error: '잘못된 시설 타입입니다' },
        { status: 400 }
      )
    }

    console.log('✅ 시설 정보 업데이트 완료:', result)

    return NextResponse.json({
      message: '시설 정보가 성공적으로 업데이트되었습니다',
      data: result
    })

  } catch (error) {
    console.error('시설 정보 업데이트 오류:', error)
    return NextResponse.json(
      { error: '시설 정보 업데이트에 실패했습니다' },
      { status: 500 }
    )
  }
}