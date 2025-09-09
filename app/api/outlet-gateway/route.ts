// app/api/outlet-gateway/route.ts - 배출구 게이트웨이 할당 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

// PUT: 배출구 게이트웨이 할당
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { outletId, gateway } = body
    
    if (!outletId) {
      return NextResponse.json(
        { error: '배출구 ID는 필수입니다' },
        { status: 400 }
      )
    }

    console.log('🔧 게이트웨이 할당:', { outletId, gateway })

    // 기존 배출구 정보 조회
    const existingOutlet = await DatabaseService.getDischargeOutletById(outletId)
    if (!existingOutlet) {
      return NextResponse.json(
        { error: '존재하지 않는 배출구입니다' },
        { status: 404 }
      )
    }

    // 기존 additional_info와 병합하여 게이트웨이 정보만 업데이트
    const updateData = {
      additional_info: {
        ...existingOutlet.additional_info,
        gateway: gateway || null
      }
    }

    const result = await DatabaseService.updateDischargeOutlet(outletId, updateData)

    console.log('✅ 게이트웨이 할당 완료:', result)

    return NextResponse.json({
      message: '게이트웨이 할당이 성공적으로 업데이트되었습니다',
      data: result
    })

  } catch (error) {
    console.error('게이트웨이 할당 오류:', error)
    return NextResponse.json(
      { error: '게이트웨이 할당에 실패했습니다' },
      { status: 500 }
    )
  }
}