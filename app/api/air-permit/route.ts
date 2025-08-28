// app/api/air-permit/route.ts - 대기필증 정보 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, AirPermitInfo } from '@/lib/database-service'

// GET: 대기필증 정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const permitId = searchParams.get('id')
    const includeDetails = searchParams.get('details') === 'true'

    // 특정 대기필증 상세 조회
    if (permitId && includeDetails) {
      const permit = await DatabaseService.getAirPermitWithDetails(permitId)
      if (!permit) {
        return NextResponse.json(
          { error: '대기필증을 찾을 수 없습니다' },
          { status: 404 }
        )
      }
      return NextResponse.json({ data: permit })
    }

    // 사업장별 대기필증 목록 조회
    if (businessId) {
      const permits = await DatabaseService.getAirPermitsByBusinessId(businessId)
      return NextResponse.json({ 
        data: permits,
        count: permits.length 
      })
    }

    return NextResponse.json(
      { error: '사업장 ID는 필수입니다' },
      { status: 400 }
    )

  } catch (error) {
    console.error('대기필증 조회 오류:', error)
    return NextResponse.json(
      { error: '대기필증 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 새 대기필증 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 필수 필드 검증
    if (!body.business_id) {
      return NextResponse.json(
        { error: '사업장 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 사업장 존재 확인
    const business = await DatabaseService.getBusinessById(body.business_id)
    if (!business) {
      return NextResponse.json(
        { error: '존재하지 않는 사업장입니다' },
        { status: 404 }
      )
    }

    // 배출구별 시설을 평면화하여 기존 데이터베이스 구조에 맞춤
    const allDischargeFacilities: Array<{name: string, capacity: string, quantity: number}> = []
    const allPreventionFacilities: Array<{name: string, capacity: string, quantity: number}> = []
    
    if (body.outlets && Array.isArray(body.outlets)) {
      for (const outlet of body.outlets) {
        if (outlet.discharge_facilities) {
          allDischargeFacilities.push(...outlet.discharge_facilities)
        }
        if (outlet.prevention_facilities) {
          allPreventionFacilities.push(...outlet.prevention_facilities)
        }
      }
    }

    // 대기필증 생성 데이터 준비 - 스키마에 정의된 실제 필드 사용
    const permitData: Omit<AirPermitInfo, 'id' | 'created_at' | 'updated_at'> = {
      business_id: body.business_id,
      business_type: body.business_type || null,
      annual_emission_amount: null,
      // 직접 테이블 컬럼에 날짜 데이터 저장
      first_report_date: body.first_report_date || null,
      operation_start_date: body.operation_start_date || null,
      additional_info: {
        ...body.additional_info || {},
        category: body.category || null,
        business_name: body.business_name || null,
        pollutants: body.pollutants || [],
        outlets: body.outlets || [],
        discharge_facilities: allDischargeFacilities,
        prevention_facilities: allPreventionFacilities
      },
      is_active: true,
      is_deleted: false
    }

    const newPermit = await DatabaseService.createAirPermit(permitData)
    
    return NextResponse.json(
      { 
        message: '대기필증이 성공적으로 생성되었습니다',
        data: newPermit 
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('대기필증 생성 오류:', error)
    return NextResponse.json(
      { error: '대기필증 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}

// PUT: 대기필증 정보 업데이트
export async function PUT(request: NextRequest) {
  let body: any = null
  
  try {
    console.log('🔄 대기필증 업데이트 요청 시작')
    
    // Step 1: JSON 파싱
    try {
      body = await request.json()
      console.log('✅ JSON 파싱 성공:', body)
    } catch (jsonError) {
      console.error('🔴 JSON 파싱 실패:', jsonError)
      return NextResponse.json(
        { error: 'JSON 파싱 실패', details: jsonError instanceof Error ? jsonError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    const { id, ...rawUpdateData } = body
    
    // Step 2: ID 검증
    if (!id) {
      console.error('🔴 ID 누락')
      return NextResponse.json(
        { error: '대기필증 ID는 필수입니다' },
        { status: 400 }
      )
    }
    console.log('✅ ID 검증 통과:', id)

    // Step 3: 배출구별 시설 평면화
    let allDischargeFacilities: Array<{name: string, capacity: string, quantity: number}> = []
    let allPreventionFacilities: Array<{name: string, capacity: string, quantity: number}> = []
    
    try {
      if (rawUpdateData.outlets && Array.isArray(rawUpdateData.outlets)) {
        for (const outlet of rawUpdateData.outlets) {
          if (outlet.discharge_facilities) {
            allDischargeFacilities.push(...outlet.discharge_facilities)
          }
          if (outlet.prevention_facilities) {
            allPreventionFacilities.push(...outlet.prevention_facilities)
          }
        }
      }
      console.log('✅ 시설 평면화 완료:', {
        discharge: allDischargeFacilities.length,
        prevention: allPreventionFacilities.length
      })
    } catch (facilitiesError) {
      console.error('🔴 시설 평면화 오류:', facilitiesError)
      return NextResponse.json(
        { error: '시설 데이터 처리 오류', details: facilitiesError instanceof Error ? facilitiesError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    // Step 4: 날짜 필드 검증
    const validateDate = (dateStr: string, fieldName: string): string | null => {
      try {
        if (!dateStr || dateStr === '' || dateStr === '--' || dateStr.length < 8) {
          console.log(`📅 ${fieldName}: 빈 값 또는 유효하지 않은 길이 - null 반환`)
          return null
        }
        // YYYY-MM-DD 형식 검증
        if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
          console.log(`📅 ${fieldName}: 형식 불일치 (${dateStr}) - null 반환`)
          return null
        }
        console.log(`📅 ${fieldName}: 검증 통과 (${dateStr})`)
        return dateStr
      } catch (dateError) {
        console.error(`🔴 날짜 검증 오류 (${fieldName}):`, dateError)
        return null
      }
    }

    let validatedFirstReportDate: string | null = null
    let validatedOperationStartDate: string | null = null

    try {
      validatedFirstReportDate = validateDate(rawUpdateData.first_report_date, 'first_report_date')
      validatedOperationStartDate = validateDate(rawUpdateData.operation_start_date, 'operation_start_date')
      console.log('✅ 날짜 검증 완료')
    } catch (dateValidationError) {
      console.error('🔴 날짜 검증 프로세스 오류:', dateValidationError)
      return NextResponse.json(
        { error: '날짜 검증 오류', details: dateValidationError instanceof Error ? dateValidationError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    // Step 5: 업데이트 데이터 구성
    let updateData: any = null
    
    try {
      updateData = {
        // 직접 테이블 컬럼 업데이트 (스키마에 정의된 실제 필드)
        business_type: rawUpdateData.business_type || null,
        first_report_date: validatedFirstReportDate,
        operation_start_date: validatedOperationStartDate,
        // additional_info에 나머지 정보 저장
        additional_info: {
          ...rawUpdateData.additional_info || {},
          category: rawUpdateData.category || null,
          business_name: rawUpdateData.business_name || null,
          pollutants: Array.isArray(rawUpdateData.pollutants) ? rawUpdateData.pollutants : [],
          outlets: Array.isArray(rawUpdateData.outlets) ? rawUpdateData.outlets : [],
          discharge_facilities: allDischargeFacilities,
          prevention_facilities: allPreventionFacilities
        }
      }
      console.log('✅ 업데이트 데이터 구성 완료')
      console.log('🔍 변환된 업데이트 데이터:', updateData)
    } catch (dataConstructionError) {
      console.error('🔴 데이터 구성 오류:', dataConstructionError)
      return NextResponse.json(
        { error: '데이터 구성 오류', details: dataConstructionError instanceof Error ? dataConstructionError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    // Step 6: 데이터베이스 업데이트
    let updatedPermit: any = null
    
    try {
      console.log('🔄 데이터베이스 업데이트 시작...')
      updatedPermit = await DatabaseService.updateAirPermit(id, updateData)
      console.log('✅ 데이터베이스 업데이트 완료:', updatedPermit)
    } catch (dbError) {
      console.error('🔴 데이터베이스 업데이트 오류:', dbError)
      return NextResponse.json(
        { error: '데이터베이스 업데이트 실패', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // Step 7: 성공 응답
    console.log('🎉 대기필증 업데이트 완료')
    return NextResponse.json({
      message: '대기필증 정보가 성공적으로 업데이트되었습니다',
      data: updatedPermit
    })

  } catch (error: any) {
    console.error('💥 대기필증 업데이트 최종 오류:', {
      message: error?.message || 'No message',
      stack: error?.stack || 'No stack',
      name: error?.name || 'Unknown error',
      cause: error?.cause || 'No cause',
      rawUpdateData: body
    })
    
    return NextResponse.json(
      { 
        error: '대기필증 정보 업데이트에 실패했습니다',
        details: error?.message || 'Unknown error',
        step: 'Final catch block'
      },
      { status: 500 }
    )
  }
}

// DELETE: 대기필증 삭제 (논리 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const permitId = searchParams.get('id')

    if (!permitId) {
      return NextResponse.json(
        { error: '대기필증 ID는 필수입니다' },
        { status: 400 }
      )
    }

    await DatabaseService.deleteAirPermit(permitId)
    
    return NextResponse.json({
      message: '대기필증이 성공적으로 삭제되었습니다'
    })

  } catch (error) {
    console.error('대기필증 삭제 오류:', error)
    return NextResponse.json(
      { error: '대기필증 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}