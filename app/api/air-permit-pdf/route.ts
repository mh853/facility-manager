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

    // 대기필증 상세 정보 조회 (배출구 및 시설 정보 포함)
    const permitDetail = await DatabaseService.getAirPermitWithDetails(permitId)
    
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
        localGovernment: permitDetail.business?.local_government || '',
        businessType: permitDetail.business_type || '',
        facilityNumber: permitDetail.facility_number || '',
        greenLinkCode: permitDetail.green_link_code || '',
        memo: permitDetail.memo || '',
        firstReportDate: (permitDetail as any).first_report_date || '',
        operationStartDate: (permitDetail as any).operation_start_date || '',
        createdAt: permitDetail.created_at,
        updatedAt: permitDetail.updated_at
      },
      outlets: permitDetail.outlets?.map((outlet, index) => ({
        outletNumber: outlet.outlet_number || index + 1,
        outletName: outlet.outlet_name || `배출구 ${index + 1}`,
        dischargeFacilities: outlet.discharge_facilities?.map(facility => ({
          name: facility.facility_name,
          capacity: facility.capacity || '',
          quantity: facility.quantity || 1
        })) || [],
        preventionFacilities: outlet.prevention_facilities?.map(facility => ({
          name: facility.facility_name,
          capacity: facility.capacity || '',
          quantity: facility.quantity || 1
        })) || []
      })) || []
    }

    console.log('📋 PDF 생성용 데이터 구성 완료:', {
      businessName: pdfData.permitInfo.businessName,
      outletCount: pdfData.outlets.length,
      totalDischargeFacilities: pdfData.outlets.reduce((sum, outlet) => sum + outlet.dischargeFacilities.length, 0),
      totalPreventionFacilities: pdfData.outlets.reduce((sum, outlet) => sum + outlet.preventionFacilities.length, 0)
    })

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