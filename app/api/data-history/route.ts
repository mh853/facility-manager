// app/api/data-history/route.ts - 데이터 이력 및 복구 관리 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

// GET: 데이터 변경 이력 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableNames = searchParams.get('tables')?.split(',')
    const recordId = searchParams.get('recordId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    const history = await DatabaseService.getDataHistory({
      tableNames,
      recordId,
      limit
    })

    // 이력 데이터에 한국어 테이블명 추가
    const historyWithDisplayNames = history.map(record => ({
      ...record,
      table_display_name: getTableDisplayName(record.table_name),
      operation_display_name: getOperationDisplayName(record.operation),
      formatted_created_at: new Date(record.created_at).toLocaleString('ko-KR')
    }))

    return NextResponse.json({ 
      data: historyWithDisplayNames,
      count: historyWithDisplayNames.length 
    })

  } catch (error) {
    console.error('데이터 이력 조회 오류:', error)
    return NextResponse.json(
      { error: '데이터 이력을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 데이터 복구 실행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { historyId, reason } = body

    if (!historyId) {
      return NextResponse.json(
        { error: '이력 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 복구 실행
    const result = await DatabaseService.restoreFromHistory(historyId)

    if (result) {
      // 복구 성공 로그 (선택적으로 별도 테이블에 저장 가능)
      console.log(`데이터 복구 성공: 이력 ID ${historyId}${reason ? `, 사유: ${reason}` : ''}`)
      
      return NextResponse.json({
        message: '데이터가 성공적으로 복구되었습니다',
        historyId,
        restoredAt: new Date().toISOString()
      })
    } else {
      return NextResponse.json(
        { error: '데이터 복구에 실패했습니다' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('데이터 복구 오류:', error)
    return NextResponse.json(
      { error: `데이터 복구에 실패했습니다: ${error.message}` },
      { status: 500 }
    )
  }
}

// 테이블명을 한국어로 변환
function getTableDisplayName(tableName: string): string {
  const tableNames: Record<string, string> = {
    'business_info': '사업장 정보',
    'air_permit_info': '대기필증 정보',
    'discharge_outlets': '배출구 정보',
    'discharge_facilities': '배출시설 정보',
    'prevention_facilities': '방지시설 정보'
  }
  return tableNames[tableName] || tableName
}

// 작업명을 한국어로 변환
function getOperationDisplayName(operation: string): string {
  const operations: Record<string, string> = {
    'INSERT': '생성',
    'UPDATE': '수정',
    'DELETE': '삭제'
  }
  return operations[operation] || operation
}