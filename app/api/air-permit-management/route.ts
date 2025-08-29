// app/api/air-permit-management/route.ts - 대기필증 정보 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, BusinessInfo, AirPermitInfo } from '@/lib/database-service'
import { sheets } from '@/lib/google-client'

// GET: 대기필증 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const permitId = searchParams.get('id')

    // 특정 대기필증 조회
    if (permitId) {
      const permit = await DatabaseService.getAirPermitWithDetails(permitId)
      if (!permit) {
        return NextResponse.json(
          { error: '대기필증을 찾을 수 없습니다' },
          { status: 404 }
        )
      }
      return NextResponse.json({ data: permit })
    }

    // 사업장별 대기필증 조회
    if (businessId) {
      const permits = await DatabaseService.getAirPermitsByBusinessId(businessId)
      return NextResponse.json({ 
        data: permits,
        count: permits.length 
      })
    }

    // 전체 대기필증 조회
    const permits = await DatabaseService.getAllAirPermits()
    return NextResponse.json({ 
      data: permits,
      count: permits.length 
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
    console.log('🔍 받은 데이터:', body)

    // 필수 필드 검증
    if (!body.business_id) {
      return NextResponse.json(
        { error: '사업장 ID는 필수입니다' },
        { status: 400 }
      )
    }

    const permitData = {
      business_id: body.business_id,
      business_type: body.business_type || null,
      annual_emission_amount: body.annual_emission_amount || null,
      first_report_date: body.first_report_date || null,
      operation_start_date: body.operation_start_date || null,
      additional_info: body.additional_info || {},
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

// PATCH: 구글시트에서 대기필증 정보 일괄 가져오기
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔄 구글시트에서 대기필증 정보 일괄 가져오기 시작...')
    
    const body = await request.json()
    const { spreadsheetId, sheetName = '대기필증 DB', startRow = 2 } = body
    
    // 환경변수에서 기본 스프레드시트 ID 사용
    const targetSpreadsheetId = spreadsheetId || process.env.MAIN_SPREADSHEET_ID
    
    console.log('📋 입력된 스프레드시트 ID:', spreadsheetId)
    console.log('📋 환경변수 기본 ID:', process.env.MAIN_SPREADSHEET_ID)
    console.log('📋 최종 사용할 ID:', targetSpreadsheetId)
    
    if (!targetSpreadsheetId) {
      return NextResponse.json(
        { error: '스프레드시트 ID가 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    console.log('📊 사용할 스프레드시트:', { targetSpreadsheetId, sheetName })

    // 구글시트에서 데이터 가져오기 (A열부터 HE열까지)
    const range = `'${sheetName}'!A:HE`
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range
    })

    const rows = response.data.values || []
    console.log(`📊 가져온 행 수: ${rows.length}`)

    if (rows.length < 2) {
      return NextResponse.json(
        { error: '스프레드시트에 데이터가 없거나 헤더만 있습니다' },
        { status: 400 }
      )
    }

    const processedData = new Map() // 사업장별 배출구 데이터 그룹핑
    const errors = []
    let successCount = 0
    let skipCount = 0

    // 시작 행부터 데이터 처리
    for (let i = startRow - 1; i < rows.length; i++) {
      const row = rows[i]
      
      // 빈 행 스킵
      if (!row || row.length === 0 || !row[1]) {
        continue
      }

      const businessName = row[1]?.trim()
      const outletNumber = parseInt(row[2]) || 1

      if (!businessName) {
        continue
      }

      try {
        // 사업장 정보 찾기
        const business = await DatabaseService.getBusinessByName(businessName)
        if (!business) {
          errors.push({
            row: i + 1,
            error: `사업장을 찾을 수 없습니다: ${businessName}`,
            businessName
          })
          continue
        }

        // 사업장별 데이터 그룹핑
        if (!processedData.has(business.id)) {
          processedData.set(business.id, {
            businessName,
            businessId: business.id,
            outlets: new Map()
          })
        }

        const businessData = processedData.get(business.id)
        
        // 배출구별 데이터 그룹핑
        if (!businessData.outlets.has(outletNumber)) {
          businessData.outlets.set(outletNumber, {
            outletNumber,
            dischargeFacilities: [],
            preventionFacilities: []
          })
        }

        const outletData = businessData.outlets.get(outletNumber)

        // 배출시설 파싱 (D~DD열, 35개)
        for (let facilityIndex = 0; facilityIndex < 35; facilityIndex++) {
          const nameCol = 3 + (facilityIndex * 3) // D열부터 3칸씩
          const capacityCol = nameCol + 1
          const quantityCol = nameCol + 2

          const facilityName = row[nameCol]?.trim()
          const capacity = row[capacityCol]?.trim()
          const quantity = parseInt(row[quantityCol]) || 0

          if (facilityName && facilityName !== '-' && quantity > 0) {
            outletData.dischargeFacilities.push({
              facility_name: facilityName,
              capacity: capacity || null,
              quantity
            })
          }
        }

        // 방지시설 파싱 (DE~HE열, 35개)
        const preventionStartCol = 3 + (35 * 3) // DE열 = D열 + (35 * 3)
        for (let facilityIndex = 0; facilityIndex < 35; facilityIndex++) {
          const nameCol = preventionStartCol + (facilityIndex * 3)
          const capacityCol = nameCol + 1
          const quantityCol = nameCol + 2

          const facilityName = row[nameCol]?.trim()
          const capacity = row[capacityCol]?.trim()
          const quantity = parseInt(row[quantityCol]) || 0

          if (facilityName && facilityName !== '-' && quantity > 0) {
            outletData.preventionFacilities.push({
              facility_name: facilityName,
              capacity: capacity || null,
              quantity
            })
          }
        }

      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          businessName
        })
      }
    }

    console.log(`📊 처리할 사업장 수: ${processedData.size}`)

    // 데이터베이스에 저장
    for (const [businessId, businessData] of Array.from(processedData.entries()) as [string, any][]) {
      try {
        // 기존 대기필증 확인
        const existingPermits = await DatabaseService.getAirPermitsByBusinessId(businessId)
        
        let airPermit
        if (existingPermits.length > 0) {
          // 기존 대기필증 사용
          airPermit = existingPermits[0]
          console.log(`🔄 기존 대기필증 사용: ${businessData.businessName}`)
        } else {
          // 새 대기필증 생성
          airPermit = await DatabaseService.createAirPermit({
            business_id: businessId,
            business_type: null,
            annual_emission_amount: null,
            first_report_date: null,
            operation_start_date: null,
            additional_info: {},
            is_active: true,
            is_deleted: false
          })
          console.log(`✅ 새 대기필증 생성: ${businessData.businessName}`)
        }

        // 배출구별 데이터 처리
        for (const [outletNumber, outletData] of Array.from(businessData.outlets.entries()) as [number, any][]) {
          // 기존 배출구 확인
          const existingOutlets = await DatabaseService.getDischargeOutlets(airPermit.id)
          let outlet = existingOutlets.find(o => o.outlet_number === outletNumber)

          if (!outlet) {
            // 새 배출구 생성
            const createdOutlet = await DatabaseService.createDischargeOutlet({
              air_permit_id: airPermit.id,
              outlet_number: outletNumber,
              outlet_name: `배출구 ${outletNumber}`,
              additional_info: {}
            })
            // OutletWithFacilities 형태로 변환
            outlet = {
              ...createdOutlet,
              discharge_facilities: [],
              prevention_facilities: []
            }
            console.log(`✅ 배출구 생성: ${businessData.businessName} - 배출구 ${outletNumber}`)
          }

          // 기존 시설 삭제 (새 데이터로 덮어쓰기)
          const existingDischargeFacilities = await DatabaseService.getDischargeFacilities(outlet.id)
          const existingPreventionFacilities = await DatabaseService.getPreventionFacilities(outlet.id)

          // 배출시설 생성
          for (const facility of outletData.dischargeFacilities) {
            await DatabaseService.createDischargeFacility({
              outlet_id: outlet.id,
              ...facility,
              additional_info: {}
            })
          }

          // 방지시설 생성
          for (const facility of outletData.preventionFacilities) {
            await DatabaseService.createPreventionFacility({
              outlet_id: outlet.id,
              ...facility,
              additional_info: {}
            })
          }

          console.log(`✅ 시설 생성 완료: ${businessData.businessName} - 배출구 ${outletNumber} (배출: ${outletData.dischargeFacilities.length}, 방지: ${outletData.preventionFacilities.length})`)
        }

        successCount++

      } catch (error) {
        errors.push({
          businessName: businessData.businessName,
          error: error instanceof Error ? error.message : '데이터베이스 저장 실패',
          businessId
        })
        console.error(`❌ 대기필증 처리 실패: ${businessData.businessName}`, error)
      }
    }

    const result = {
      success: true,
      message: '구글시트에서 대기필증 정보 가져오기 완료',
      summary: {
        totalBusinesses: processedData.size,
        successCount,
        skipCount,
        errorCount: errors.length
      },
      errors: errors.length > 0 ? errors : null
    }

    console.log('📊 최종 결과:', result)
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ 구글시트 가져오기 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '구글시트에서 대기필증 정보를 가져오는데 실패했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}