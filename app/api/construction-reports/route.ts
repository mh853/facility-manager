// app/api/construction-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

// Helper: Generate report number
function generateReportNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

  return `CR-${year}${month}${day}-${time}${random}`
}

// GET: 착공신고서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('business_id')

    let query = supabase
      .from('construction_reports')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (businessId) {
      query = query.eq('business_id', businessId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[CONSTRUCTION-REPORTS] 조회 오류:', error)
      return NextResponse.json(
        { success: false, error: '착공신고서 조회 실패' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('[CONSTRUCTION-REPORTS] 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: 착공신고서 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 필수 필드 검증
    const requiredFields = [
      'business_id',
      'business_name',
      'subsidy_approval_date',
      'government_notice_price',
      'subsidy_amount'
    ]

    // 숫자 필드 (0도 유효한 값)
    const numericFields = ['government_notice_price', 'subsidy_amount']

    for (const field of requiredFields) {
      // 숫자 필드는 undefined/null만 체크, 0은 허용
      if (numericFields.includes(field)) {
        if (body[field] === undefined || body[field] === null) {
          return NextResponse.json(
            { success: false, error: `필수 필드 누락: ${field}` },
            { status: 400 }
          )
        }
      } else {
        // 문자열 필드는 빈 문자열도 체크
        if (!body[field]) {
          return NextResponse.json(
            { success: false, error: `필수 필드 누락: ${field}` },
            { status: 400 }
          )
        }
      }
    }

    // 신고서 번호 생성
    const reportNumber = generateReportNumber()

    // 자부담 계산
    const selfPayment = body.government_notice_price - body.subsidy_amount

    // 작성일 설정
    const reportDate = body.report_date || new Date().toISOString().split('T')[0]

    // 사용자 정보 (인증 토큰에서 추출 - 추후 구현)
    const createdByName = body.created_by_name || '관리자'
    const createdByEmail = body.created_by_email || null

    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from('construction_reports')
      .insert({
        business_id: body.business_id,
        business_name: body.business_name,
        report_number: reportNumber,
        report_data: body,
        report_date: reportDate,
        subsidy_approval_date: body.subsidy_approval_date,
        government_notice_price: body.government_notice_price,
        subsidy_amount: body.subsidy_amount,
        self_payment: selfPayment,
        created_by_name: createdByName,
        created_by_email: createdByEmail
      })
      .select()
      .single()

    if (error) {
      console.error('[CONSTRUCTION-REPORTS] 생성 오류:', error)
      return NextResponse.json(
        { success: false, error: '착공신고서 생성 실패' },
        { status: 500 }
      )
    }

    console.log('[CONSTRUCTION-REPORTS] 생성 성공:', {
      report_number: reportNumber,
      business_name: body.business_name
    })

    // 문서 이력에도 기록 (document_history 테이블)
    try {
      await supabase.from('document_history').insert({
        business_id: body.business_id,
        business_name: body.business_name,
        document_type: 'construction_report',
        document_name: `착공신고서_${body.business_name}_${reportNumber}`,
        file_format: 'pdf',
        document_data: body,
        metadata: {
          report_number: reportNumber,
          subsidy_amount: body.subsidy_amount,
          report_date: reportDate
        },
        created_by_name: createdByName,
        created_by_email: createdByEmail
      })
    } catch (historyError) {
      console.warn('[CONSTRUCTION-REPORTS] 문서 이력 기록 실패:', historyError)
      // 이력 기록 실패는 치명적이지 않으므로 계속 진행
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: '착공신고서가 생성되었습니다.'
    })
  } catch (error) {
    console.error('[CONSTRUCTION-REPORTS] 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: 착공신고서 삭제 (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('construction_reports')
      .update({ is_deleted: true })
      .eq('id', reportId)

    if (error) {
      console.error('[CONSTRUCTION-REPORTS] 삭제 오류:', error)
      return NextResponse.json(
        { success: false, error: '착공신고서 삭제 실패' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '착공신고서가 삭제되었습니다.'
    })
  } catch (error) {
    console.error('[CONSTRUCTION-REPORTS] 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류' },
      { status: 500 }
    )
  }
}
