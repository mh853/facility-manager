// app/api/air-permit-pdf/route.ts - 대기필증 PDF 생성 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: NextRequest) {
  try {
    const { permitId } = await request.json()
    
    if (!permitId) {
      return NextResponse.json(
        { error: '대기필증 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 대기필증 상세 정보 조회 (배출구 및 시설 정보 포함) - forcePrimary=true로 최신 데이터 보장
    const permitDetail = await DatabaseService.getAirPermitWithDetails(permitId, true)

    if (!permitDetail) {
      return NextResponse.json(
        { error: '대기필증 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // PDF 생성을 위한 데이터 구성
    const pdfData = {
      permitInfo: {
        id: permitDetail.id,
        businessName: permitDetail.business?.business_name || '사업장명 없음',
        businessManagementCode: permitDetail.business?.business_management_code || '',
        localGovernment: permitDetail.business?.local_government || '',
        businessType: permitDetail.business_type || '',
        memo: permitDetail.memo || '',
        firstReportDate: (permitDetail as any).first_report_date || '',
        operationStartDate: (permitDetail as any).operation_start_date || '',
        createdAt: permitDetail.created_at,
        updatedAt: permitDetail.updated_at
      },
      outlets: permitDetail.outlets?.map((outlet, index) => ({
        outletNumber: outlet.outlet_number || index + 1,
        outletName: outlet.outlet_name || `배출구 ${index + 1}`,
        dischargeFacilities: outlet.discharge_facilities?.map((facility, facilityIdx) => {
          const additionalInfo = facility.additional_info || {}
          return {
            name: facility.facility_name,
            capacity: facility.capacity || '',
            quantity: facility.quantity || 1,
            // 기본 시설번호 (배1, 배2...) + 사용자 입력값을 함께 전달
            defaultFacilityNumber: `배${facilityIdx + 1}`,
            facilityNumber: additionalInfo.facility_number || '',
            greenLinkCode: additionalInfo.green_link_code || '',
            memo: additionalInfo.memo || ''
          }
        }) || [],
        preventionFacilities: outlet.prevention_facilities?.map((facility, facilityIdx) => {
          const additionalInfo = facility.additional_info || {}
          return {
            name: facility.facility_name,
            capacity: facility.capacity || '',
            quantity: facility.quantity || 1,
            // 기본 시설번호 (방1, 방2...) + 사용자 입력값을 함께 전달
            defaultFacilityNumber: `방${facilityIdx + 1}`,
            facilityNumber: additionalInfo.facility_number || '',
            greenLinkCode: additionalInfo.green_link_code || '',
            memo: additionalInfo.memo || ''
          }
        }) || []
      })) || []
    }

    return NextResponse.json({
      success: true,
      message: 'PDF 데이터가 성공적으로 준비되었습니다',
      data: pdfData
    })

  } catch (error) {
    console.error('💥 PDF 데이터 준비 오류:', error)
    return NextResponse.json(
      { 
        error: 'PDF 데이터 준비 실패', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}