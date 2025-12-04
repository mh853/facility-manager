// app/api/air-permit/route.ts - 대기필증 정보 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, AirPermitInfo } from '@/lib/database-service'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// GET: 대기필증 정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const permitId = searchParams.get('id')
    const includeDetails = searchParams.get('details') === 'true'
    const forcePrimary = searchParams.get('forcePrimary') === 'true' // Read-after-write consistency

    // 특정 대기필증 상세 조회
    if (permitId && includeDetails) {
      console.log(`🔍 [AIR-PERMIT] GET 요청: permitId=${permitId}, forcePrimary=${forcePrimary}`)
      const permit = await DatabaseService.getAirPermitWithDetails(permitId, forcePrimary)
      if (!permit) {
        return NextResponse.json(
          { error: '대기필증을 찾을 수 없습니다' },
          { status: 404 }
        )
      }
      console.log(`✅ [AIR-PERMIT] GET 완료: ${permit.outlets?.length || 0}개 배출구`)
      return NextResponse.json({ data: permit }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    }

    // 사업장별 대기필증 목록 조회
    if (businessId) {
      // businessId가 UUID 형식이 아니면 사업장명으로 간주하여 실제 ID 조회
      let actualBusinessId = businessId
      
      // UUID 형식이 아니면 사업장명으로 처리
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(businessId)) {
        // 사업장명으로 실제 사업장 ID 조회
        const business = await DatabaseService.getBusinessByName(businessId)
        if (!business) {
          return NextResponse.json(
            { error: '존재하지 않는 사업장입니다' },
            { status: 404 }
          )
        }
        actualBusinessId = business.id
      }
      
      let permits
      if (includeDetails) {
        // 상세 정보 포함하여 조회 (forcePrimary 전달)
        permits = await DatabaseService.getAirPermitsByBusinessIdWithDetails(actualBusinessId, forcePrimary)
      } else {
        // 기본 정보만 조회
        permits = await DatabaseService.getAirPermitsByBusinessId(actualBusinessId)
      }
      return NextResponse.json({ 
        data: permits,
        count: permits.length 
      }, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      })
    }

    // 모든 대기필증 조회 (대기필증이 있는 사업장 목록 확인용)
    const allPermits = await DatabaseService.getAllAirPermits()
    return NextResponse.json({ 
      data: allPermits,
      count: allPermits.length 
    })

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

    // 사업장 존재 확인 (UUID로 조회)
    const business = await DatabaseService.getBusinessById(body.business_id)
    if (!business) {
      return NextResponse.json(
        { error: '존재하지 않는 사업장입니다' },
        { status: 404 }
      )
    }

    // 날짜 필드 검증 함수
    const validateDate = (dateStr: string, fieldName: string): string | null => {
      try {
        if (!dateStr || dateStr === '' || dateStr === '--' || dateStr.length < 8) {
          console.log(`📅 [POST] ${fieldName}: 빈 값 또는 유효하지 않은 길이 - null 반환`)
          return null
        }
        // YYYY-MM-DD 형식 검증
        if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
          console.log(`📅 [POST] ${fieldName}: 형식 불일치 (${dateStr}) - null 반환`)
          return null
        }
        console.log(`📅 [POST] ${fieldName}: 검증 통과 (${dateStr})`)
        return dateStr
      } catch (dateError) {
        console.error(`🔴 [POST] 날짜 검증 오류 (${fieldName}):`, dateError)
        return null
      }
    }

    // 날짜 검증
    const validatedFirstReportDate = validateDate(body.first_report_date, 'first_report_date')
    const validatedOperationStartDate = validateDate(body.operation_start_date, 'operation_start_date')

    // 대기필증 생성 데이터 준비 - 배출구별 시설 관계 유지
    const permitData: Omit<AirPermitInfo, 'id' | 'created_at' | 'updated_at'> = {
      business_id: business.id, // 실제 사업장 ID 사용
      business_type: body.business_type || null,
      first_report_date: validatedFirstReportDate,
      operation_start_date: validatedOperationStartDate,
      annual_emission_amount: null,
      additional_info: {
        ...body.additional_info || {},
        category: body.category || null,
        business_name: body.business_name || null,
        pollutants: body.pollutants || []
      },
      is_active: true,
      is_deleted: false
    }

    console.log('✅ [POST] 대기필증 생성 데이터:', {
      business_id: permitData.business_id,
      first_report_date: permitData.first_report_date,
      operation_start_date: permitData.operation_start_date
    })

    // 배출구별 시설을 포함한 완전한 대기필증 생성
    const outlets = body.outlets || []
    const newPermit = await DatabaseService.createAirPermitWithOutlets(permitData, outlets)
    
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

    // Step 3: 편집 모드 감지 - outlets 데이터 포함 여부로 판단
    const outlets = rawUpdateData.outlets || []
    const hasOutletsData = outlets && Array.isArray(outlets) && outlets.length > 0

    console.log('✅ 배출구 정보 추출 완료:', {
      outletCount: outlets.length,
      hasOutletsData,
      outletsData: outlets.map((o: any) => ({
        number: o.outlet_number,
        discharge: o.discharge_facilities?.length || 0,
        prevention: o.prevention_facilities?.length || 0
      }))
    })

    // 🔍 시설별 additional_info 디버그 로그
    console.log('🔍 [DEBUG] 시설별 additional_info 상세:')
    outlets.forEach((outlet: any, oi: number) => {
      console.log(`  배출구 ${oi + 1}:`)
      outlet.discharge_facilities?.forEach((f: any, fi: number) => {
        console.log(`    - 배출시설 ${fi + 1} (${f.name}): additional_info =`, JSON.stringify(f.additional_info))
      })
      outlet.prevention_facilities?.forEach((f: any, fi: number) => {
        console.log(`    - 방지시설 ${fi + 1} (${f.name}): additional_info =`, JSON.stringify(f.additional_info))
      })
    })

    // Step 5: 날짜 필드 검증
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

    // Step 6: 업데이트 데이터 구성
    let updateData: any = null
    
    try {
      updateData = {
        // 직접 테이블 컬럼 업데이트 (스키마에 정의된 실제 필드)
        business_type: rawUpdateData.business_type || null,
        first_report_date: validatedFirstReportDate,
        operation_start_date: validatedOperationStartDate,
        // additional_info에 나머지 정보 저장 (배출구 정보는 별도 테이블에서 관리)
        additional_info: {
          ...rawUpdateData.additional_info || {},
          category: rawUpdateData.additional_info?.category || rawUpdateData.category || null,
          business_name: rawUpdateData.additional_info?.business_name || rawUpdateData.business_name || null,
          pollutants: rawUpdateData.additional_info?.pollutants || (Array.isArray(rawUpdateData.pollutants) ? rawUpdateData.pollutants : []),
          // PDF 출력용 필드는 additional_info에 저장
          facility_number: rawUpdateData.facility_number ?? rawUpdateData.additional_info?.facility_number ?? null,
          green_link_code: rawUpdateData.green_link_code ?? rawUpdateData.additional_info?.green_link_code ?? null,
          memo: rawUpdateData.memo ?? rawUpdateData.additional_info?.memo ?? null
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

    // Step 7: 데이터베이스 업데이트
    let updatedPermit: any = null

    try {
      console.log('🔄 데이터베이스 업데이트 시작...')

      if (hasOutletsData) {
        // 배출구 데이터가 포함된 경우: 전체 업데이트 (배출구 포함)
        console.log('💾 전체 정보 업데이트 (기본 정보 + 배출구 포함)')
        updatedPermit = await DatabaseService.updateAirPermitWithOutlets(id, updateData, outlets)
      } else {
        // 배출구 데이터가 없는 경우: 기본 정보만 업데이트 (배출구 데이터 보존)
        console.log('✏️ 기본 정보만 업데이트 (배출구 데이터 보존)')
        const basicUpdate = await DatabaseService.updateAirPermit(id, updateData)
        // 기본 정보 업데이트 후, Primary DB에서 최신 데이터 조회 (read-after-write consistency)
        updatedPermit = await DatabaseService.getAirPermitWithDetails(id, true)
      }

      console.log('✅ 데이터베이스 업데이트 완료:', updatedPermit)
    } catch (dbError) {
      console.error('🔴 데이터베이스 업데이트 오류:', dbError)
      return NextResponse.json(
        { error: '데이터베이스 업데이트 실패', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // Step 8: 성공 응답
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