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

    // 배출구의 additional_info에 게이트웨이 정보 저장
    const updateData = {
      additional_info: {
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