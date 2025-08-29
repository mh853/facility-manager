// app/api/business-management/route.ts - 사업장 정보 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, BusinessInfo } from '@/lib/database-service'
import { sheets } from '@/lib/google-client'

// GET: 사업장 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search')
    const businessId = searchParams.get('id')

    // 특정 사업장 조회
    if (businessId) {
      const business = await DatabaseService.getBusinessById(businessId)
      if (!business) {
        return NextResponse.json(
          { error: '사업장을 찾을 수 없습니다' },
          { status: 404 }
        )
      }
      return NextResponse.json({ data: business })
    }

    // 검색어가 있으면 검색, 없으면 전체 목록
    const businesses = searchTerm 
      ? await DatabaseService.searchBusinessByName(searchTerm)
      : await DatabaseService.getBusinessList()

    return NextResponse.json({ 
      data: businesses,
      count: businesses.length 
    })

  } catch (error) {
    console.error('사업장 조회 오류:', error)
    return NextResponse.json(
      { error: '사업장 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 새 사업장 생성 또는 구글시트 가져오기
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔍 받은 데이터:', body)
    
    // 구글시트 가져오기 action 처리
    if (body.action === 'import_from_sheet') {
      return await importFromGoogleSheet(body)
    }
    
    // 필수 필드 검증
    if (!body.business_name) {
      return NextResponse.json(
        { error: '사업장명은 필수입니다' },
        { status: 400 }
      )
    }

    // 사업장 생성 데이터 준비 - 안전하게 기본 필드들만 사용
    const businessData = {
      business_name: body.business_name,
      local_government: body.local_government || null,
      address: body.address || null,
      manager_name: body.manager_name || null,
      manager_position: body.manager_position || null,
      manager_contact: body.manager_contact || null,
      business_contact: body.business_contact || null,
      email: body.email || null,
      representative_name: body.representative_name || null,
      representative_birth_date: body.representative_birth_date || null,
      business_registration_number: body.business_registration_number || null,
      
      // 모든 추가 데이터는 additional_info에 저장
      additional_info: {
        ...body.additional_info || {},
        // 측정기기 정보
        ph_meter: body.ph_meter || 0,
        differential_pressure_meter: body.differential_pressure_meter || 0,
        temperature_meter: body.temperature_meter || 0,
        // CT 정보
        discharge_ct: body.discharge_ct || '',
        fan_ct: body.fan_ct || 0,
        pump_ct: body.pump_ct || 0,
        gateway: body.gateway || '',
        // 네트워크 설정
        vpn_wired: body.vpn_wired || 0,
        vpn_wireless: body.vpn_wireless || 0,
        multiple_stack: body.multiple_stack || 0,
        // 기타 정보
        fax_number: body.fax_number || '',
        manufacturer: body.manufacturer || ''
      },
      
      is_active: true,
      is_deleted: false
    }

    console.log('🔍 사업장 생성 데이터:', businessData)
    
    const newBusiness = await DatabaseService.createBusiness(businessData)
    
    return NextResponse.json(
      { 
        message: '사업장이 성공적으로 생성되었습니다',
        data: newBusiness 
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('사업장 생성 오류:', error)
    
    // 중복 사업장명 오류 처리
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json(
        { error: '이미 존재하는 사업장명입니다' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: '사업장 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}

// PUT: 사업장 정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...rawUpdateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '사업장 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 기존 사업장 확인
    const existingBusiness = await DatabaseService.getBusinessById(id)
    if (!existingBusiness) {
      return NextResponse.json(
        { error: '사업장을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    console.log('🔍 사업장 업데이트 요청 데이터:', rawUpdateData)

    // 안전한 업데이트 데이터 구성 - 확실히 존재하는 필드들만 포함
    const safeUpdateData = {
      // 확실히 존재하는 기본 필드들
      business_name: rawUpdateData.business_name,
      local_government: rawUpdateData.local_government || null,
      address: rawUpdateData.address || null,
      manager_name: rawUpdateData.manager_name || null,
      manager_position: rawUpdateData.manager_position || null,
      manager_contact: rawUpdateData.manager_contact || null,
      business_contact: rawUpdateData.business_contact || null,
      email: rawUpdateData.email || null,
      representative_name: rawUpdateData.representative_name || null,
      representative_birth_date: rawUpdateData.representative_birth_date || null,
      business_registration_number: rawUpdateData.business_registration_number || null,
      
      // 모든 추가 데이터는 additional_info에 저장
      additional_info: {
        ...existingBusiness.additional_info || {},
        ...rawUpdateData.additional_info || {},
        // 측정기기 정보
        ph_meter: rawUpdateData.ph_meter || 0,
        differential_pressure_meter: rawUpdateData.differential_pressure_meter || 0,
        temperature_meter: rawUpdateData.temperature_meter || 0,
        // CT 정보
        discharge_ct: rawUpdateData.discharge_ct || '',
        fan_ct: rawUpdateData.fan_ct || 0,
        pump_ct: rawUpdateData.pump_ct || 0,
        gateway: rawUpdateData.gateway || '',
        // 네트워크 설정
        vpn_wired: rawUpdateData.vpn_wired || 0,
        vpn_wireless: rawUpdateData.vpn_wireless || 0,
        multiple_stack: rawUpdateData.multiple_stack || 0,
        // 기타 정보
        fax_number: rawUpdateData.fax_number || '',
        manufacturer: rawUpdateData.manufacturer || ''
      }
    }

    console.log('🔍 안전한 업데이트 데이터:', safeUpdateData)

    const updatedBusiness = await DatabaseService.updateBusiness(id, safeUpdateData)
    
    return NextResponse.json({
      message: '사업장 정보가 성공적으로 업데이트되었습니다',
      data: updatedBusiness
    })

  } catch (error: any) {
    console.error('사업장 업데이트 오류:', error)
    
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json(
        { error: '이미 존재하는 사업장명입니다' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: '사업장 정보 업데이트에 실패했습니다' },
      { status: 500 }
    )
  }
}

// DELETE: 사업장 삭제 (논리 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('id')

    if (!businessId) {
      return NextResponse.json(
        { error: '사업장 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 기존 사업장 확인
    const existingBusiness = await DatabaseService.getBusinessById(businessId)
    if (!existingBusiness) {
      return NextResponse.json(
        { error: '사업장을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    await DatabaseService.deleteBusiness(businessId)
    
    return NextResponse.json({
      message: '사업장이 성공적으로 삭제되었습니다'
    })

  } catch (error) {
    console.error('사업장 삭제 오류:', error)
    return NextResponse.json(
      { error: '사업장 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}

// PATCH: 구글시트에서 사업장 정보 일괄 가져오기
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔄 구글시트에서 사업장 정보 일괄 가져오기 시작...')
    
    const body = await request.json()
    const { spreadsheetId, sheetName = '사업장 정보', startRow = 2 } = body
    
    // 환경변수에서 기본 스프레드시트 ID 사용 (제공되지 않은 경우)
    const targetSpreadsheetId = spreadsheetId || process.env.DATA_COLLECTION_SPREADSHEET_ID
    
    console.log('📋 입력된 스프레드시트 ID:', spreadsheetId)
    console.log('📋 환경변수 기본 ID:', process.env.DATA_COLLECTION_SPREADSHEET_ID)
    console.log('📋 최종 사용할 ID:', targetSpreadsheetId)
    
    if (!targetSpreadsheetId) {
      return NextResponse.json(
        { error: '스프레드시트 ID가 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    console.log('📊 사용할 스프레드시트:', { targetSpreadsheetId, sheetName })

    // 구글시트에서 데이터 가져오기
    const range = `'${sheetName}'!A:Z` // 충분한 열 범위로 설정
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

    // 첫 번째 행을 헤더로 사용
    const headers = rows[0]
    console.log('📊 원본 헤더:', headers)
    console.log('📊 헤더 길이:', headers.length)

    const businessesToImport = []
    const errors = []
    let successCount = 0
    let skipCount = 0

    // 시작 행부터 데이터 처리 (기본값: 2행부터)
    for (let i = startRow - 1; i < rows.length; i++) {
      const row = rows[i]
      
      // 빈 행 스킵 (더 관대한 조건)
      if (!row || row.length === 0) {
        continue
      }
      
      // 첫 번째 몇 개 행의 상세 로그
      if (i < startRow + 2) {
        console.log(`📊 행 ${i + 1} 데이터:`, row)
        console.log(`📊 행 ${i + 1} 길이:`, row.length)
      }

      try {
        // 헤더를 기준으로 데이터 매핑
        const businessData: any = {
          business_name: '',
          local_government: null,
          address: null,
          manager_name: null,
          manager_position: null,
          manager_contact: null,
          business_contact: null,
          email: null,
          representative_name: null,
          representative_birth_date: null,
          business_registration_number: null,
          manufacturer: null,
          vpn: null,
          greenlink_id: null,
          greenlink_pw: null,
          business_management_code: null,
          sales_office: null,
          // 측정기기 필드들
          ph_sensor: null,
          differential_pressure_meter: null,
          temperature_meter: null,
          discharge_current_meter: null,
          fan_current_meter: null,
          pump_current_meter: null,
          gateway: null,
          vpn_wired: null,
          vpn_wireless: null,
          explosion_proof_differential_pressure_meter_domestic: null,
          explosion_proof_temperature_meter_domestic: null,
          expansion_device: null,
          relay_8ch: null,
          relay_16ch: null,
          main_board_replacement: null,
          multiple_stack: null,
          additional_info: {}
        }

        // 헤더 기반 데이터 매핑
        headers.forEach((header: string, index: number) => {
          const value = row[index] || ''
          const normalizedHeader = header.trim().toLowerCase()
          
          // 디버깅을 위한 로그 (첫 번째 몇 행)
          if (i < startRow + 2 && value.trim()) {
            console.log(`📊 행${i+1} 헤더[${index}]: "${header}" → normalized: "${normalizedHeader}" → value: "${value}"`)
          }

          // 20자 제한 필드를 위한 헬퍼 함수
          const truncateField = (text: string, maxLength: number = 20): string => {
            const cleanText = text.replace(/\n/g, ' ').trim()
            return cleanText.length > maxLength ? cleanText.substring(0, maxLength) : cleanText
          }

          switch (normalizedHeader) {
            case '사업장명':
            case '사업장이름':
            case 'business_name':
              businessData.business_name = value.trim()
              break
            case '지자체':
            case '지방자치단체':
            case 'local_government':
              businessData.local_government = value.trim() || null
              break
            case '주소':
            case 'address':
              businessData.address = value.trim() || null
              break
            case '담당자명':
            case '담당자이름':
            case '사업장담당자':
            case 'manager_name':
              businessData.manager_name = value.trim() || null
              break
            case '담당자직급':
            case '직급':
            case 'manager_position':
              businessData.manager_position = value.trim() || null
              break
            case '담당자연락처':
            case '담당자전화':
            case '연락처':
            case 'manager_contact':
              businessData.manager_contact = truncateField(value) || null
              // 원본 데이터가 20자를 초과하면 additional_info에 저장
              if (value.trim().length > 20) {
                businessData.additional_info.manager_contact_full = value.trim()
              }
              break
            case '사업장연락처':
            case '사업장전화':
            case 'business_contact':
              businessData.business_contact = truncateField(value) || null
              // 원본 데이터가 20자를 초과하면 additional_info에 저장
              if (value.trim().length > 20) {
                businessData.additional_info.business_contact_full = value.trim()
              }
              break
            case '팩스번호':
            case '팩스':
            case 'fax_number':
              businessData.additional_info.fax_number = truncateField(value) || ''
              break
            case '이메일':
            case 'email':
              businessData.email = value.trim() || null
              break
            case '대표자성명':
            case '대표자이름':
            case 'representative_name':
              businessData.representative_name = value.trim() || null
              break
            case '대표자생년월일':
            case 'representative_birth_date':
              businessData.representative_birth_date = value.trim() || null
              break
            case '사업자등록번호':
            case 'business_registration_number':
              businessData.business_registration_number = truncateField(value) || null
              // 원본 데이터가 20자를 초과하면 additional_info에 저장
              if (value.trim().length > 20) {
                businessData.additional_info.business_registration_number_full = value.trim()
              }
              break
            case '제조사':
            case 'manufacturer':
              const manufacturerValue = value.trim().toLowerCase()
              businessData.manufacturer = 
                manufacturerValue.includes('에코센스') || manufacturerValue.includes('ecosense') ? 'ecosense' :
                manufacturerValue.includes('클린어스') || manufacturerValue.includes('cleanearth') ? 'cleanearth' :
                manufacturerValue.includes('가이아씨앤에스') || manufacturerValue.includes('gaia') ? 'gaia_cns' :
                manufacturerValue.includes('이브이에스') || manufacturerValue.includes('evs') ? 'evs' : null
              break
            case 'vpn':
              const vpnValue = value.trim().toLowerCase()
              businessData.vpn = 
                vpnValue.includes('유선') || vpnValue.includes('wired') ? 'wired' :
                vpnValue.includes('무선') || vpnValue.includes('wireless') ? 'wireless' : null
              break
            case '그린링크id':
            case '그린링크 id':
              businessData.greenlink_id = value.trim() || null
              break
            case '그린링크pw':
            case '그린링크 pw':
              businessData.greenlink_pw = value.trim() || null
              break
            case '사업장관리코드':
            case 'business_management_code':
              businessData.business_management_code = parseInt(value) || null
              break
            case '영업점':
            case 'sales_office':
              businessData.sales_office = value.trim() || null
              break
            case '진행구분':
              businessData.additional_info.progress_status = value.trim() || ''
              break
            case '주관기관':
              businessData.additional_info.supervising_agency = value.trim() || ''
              break
            case '보조금 승인일':
            case '보조금승인일':
              businessData.additional_info.subsidy_approval_date = value.trim() || ''
              break
            case '그린링크id':
            case '그린링크 id':
              businessData.additional_info.greenlink_id = value.trim() || ''
              break
            case '그린링크pw':
            case '그린링크 pw':
              businessData.additional_info.greenlink_pw = value.trim() || ''
              break
            case '업종':
              businessData.additional_info.business_type = value.trim() || ''
              break
            case '종별':
              businessData.additional_info.category = value.trim() || ''
              break
            case '오염물질':
              businessData.additional_info.pollutants = value.trim() || ''
              break
            case '발생량(톤/년)':
            case '발생량':
              businessData.additional_info.emission_amount = value.trim() || ''
              break
            case '최초신고일':
              businessData.additional_info.first_report_date = value.trim() || ''
              break
            case '가동개시일':
              businessData.additional_info.operation_start_date = value.trim() || ''
              break
            // 측정기기 수량 관련 필드들
            case 'ph센서':
            case 'ph':
              businessData.ph_sensor = parseInt(value) || null
              break
            case '차압계':
            case '차압':
              businessData.differential_pressure_meter = parseInt(value) || null
              break
            case '온도계':
            case '온도':
              businessData.temperature_meter = parseInt(value) || null
              break
            case '배출전류계':
            case '배출전류':
              businessData.discharge_current_meter = parseInt(value) || null
              break
            case '송풍전류계':
            case '송풍전류':
              businessData.fan_current_meter = parseInt(value) || null
              break
            case '펌프전류계':
            case '펌프전류':
              businessData.pump_current_meter = parseInt(value) || null
              break
            case '게이트웨이':
            case 'gateway':
              businessData.gateway = parseInt(value) || null
              break
            case 'vpn(유선)':
            case 'vpn유선':
              businessData.vpn_wired = parseInt(value) || null
              break
            case 'vpn(무선)':
            case 'vpn무선':
              businessData.vpn_wireless = parseInt(value) || null
              break
            case '방폭차압계(국산)':
            case '방폭차압계':
              businessData.explosion_proof_differential_pressure_meter_domestic = parseInt(value) || null
              break
            case '방폭온도계(국산)':
            case '방폭온도계':
              businessData.explosion_proof_temperature_meter_domestic = parseInt(value) || null
              break
            case '확장디바이스':
            case '확장장치':
              businessData.expansion_device = parseInt(value) || null
              break
            case '중계기(8채널)':
            case '중계기8ch':
            case '중계기8':
              businessData.relay_8ch = parseInt(value) || null
              break
            case '중계기(16채널)':
            case '중계기16ch':
            case '중계기16':
              businessData.relay_16ch = parseInt(value) || null
              break
            case '메인보드교체':
            case '메인보드':
              businessData.main_board_replacement = parseInt(value) || null
              break
            case '복수굴뚝':
              businessData.multiple_stack = parseInt(value) || null
              break
            default:
              // 기타 필드는 additional_info에 저장
              if (value.trim()) {
                businessData.additional_info[header] = value.trim()
              }
              break
          }
        })

        // 디버깅을 위한 최종 데이터 로그 (첫 번째 몇 행)
        if (i < startRow + 2) {
          console.log(`📊 행${i+1} 최종 매핑된 데이터:`, {
            business_name: businessData.business_name,
            manager_name: businessData.manager_name,
            manager_contact: businessData.manager_contact,
            address: businessData.address
          })
        }

        // 필수 필드 검증
        if (!businessData.business_name) {
          console.log(`❌ 사업장명 누락 - 행 ${i + 1}:`, row)
          errors.push({
            row: i + 1,
            error: '사업장명이 누락되었습니다',
            data: row
          })
          continue
        }

        // 중복 사업장 확인
        const existingBusiness = await DatabaseService.getBusinessByName(businessData.business_name)
        if (existingBusiness) {
          console.log(`⚠️ 중복 사업장 스킵: ${businessData.business_name}`)
          skipCount++
          continue
        }

        // 기본값 설정
        businessData.is_active = true
        businessData.is_deleted = false

        businessesToImport.push(businessData)
        
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          data: row
        })
      }
    }

    console.log(`📊 처리 결과: 가져올 사업장 ${businessesToImport.length}개, 오류 ${errors.length}개, 중복 스킵 ${skipCount}개`)

    // 데이터베이스에 일괄 저장
    for (const businessData of businessesToImport) {
      try {
        await DatabaseService.createBusiness(businessData)
        successCount++
        console.log(`✅ 사업장 생성 완료: ${businessData.business_name}`)
      } catch (error) {
        errors.push({
          businessName: businessData.business_name,
          error: error instanceof Error ? error.message : '데이터베이스 저장 실패',
          data: businessData
        })
        console.error(`❌ 사업장 생성 실패: ${businessData.business_name}`, error)
      }
    }

    const result = {
      success: true,
      message: '구글시트에서 사업장 정보 가져오기 완료',
      summary: {
        totalRows: rows.length - 1, // 헤더 제외
        successCount,
        skipCount, // 중복으로 스킵된 개수
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
        error: '구글시트에서 사업장 정보를 가져오는데 실패했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}