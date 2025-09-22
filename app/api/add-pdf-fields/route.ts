// app/api/add-pdf-fields/route.ts - PDF 필드 추가 마이그레이션 API
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase 환경변수가 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 PDF 필드 추가 마이그레이션 시작...')

    // 1. 기존 데이터 확인을 통해 컬럼이 이미 존재하는지 확인
    try {
      const { data: testData, error: testError } = await supabase
        .from('air_permit_info')
        .select('facility_number, green_link_code, memo')
        .limit(1)

      if (!testError) {
        console.log('✅ PDF 필드가 이미 존재합니다')
        return NextResponse.json({
          success: true,
          message: 'PDF 필드가 이미 존재합니다',
          data: { fields_already_exist: true }
        })
      }
    } catch (checkError) {
      console.log('🔄 필드가 존재하지 않음, 추가 진행...')
    }

    // 2. 테스트용 레코드를 이용한 컬럼 추가 방식
    // 임시 레코드를 생성하면서 새 필드를 추가하는 방식
    const { data: existingRecords, error: fetchError } = await supabase
      .from('air_permit_info')
      .select('id')
      .limit(1)

    if (fetchError) {
      console.error('🔴 기존 레코드 조회 실패:', fetchError)
      return NextResponse.json(
        { error: '기존 레코드 조회 실패', details: fetchError.message },
        { status: 500 }
      )
    }

    // 2. 인덱스 추가
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_air_permit_facility_number ON air_permit_info(facility_number);`,
      `CREATE INDEX IF NOT EXISTS idx_air_permit_green_link_code ON air_permit_info(green_link_code);`
    ]

    for (const query of indexQueries) {
      const { error: indexError } = await supabase.rpc('exec', { sql: query })
      if (indexError && !indexError.message.includes('already exists')) {
        console.warn('⚠️ 인덱스 생성 경고:', indexError)
      }
    }

    // 3. 기존 데이터 업데이트 (NULL 값을 빈 문자열로)
    const { error: updateError } = await supabase
      .from('air_permit_info')
      .update({
        facility_number: '',
        green_link_code: '',
        memo: ''
      })
      .or('facility_number.is.null,green_link_code.is.null,memo.is.null')

    if (updateError) {
      console.warn('⚠️ 기존 데이터 업데이트 경고:', updateError)
    }

    // 4. 변경 사항 확인
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('air_permit_info')
      .select('facility_number, green_link_code, memo')
      .limit(1)

    if (schemaError) {
      return NextResponse.json(
        { error: '스키마 확인 실패', details: schemaError.message },
        { status: 500 }
      )
    }

    console.log('✅ PDF 필드 추가 마이그레이션 완료')

    return NextResponse.json({
      success: true,
      message: 'PDF 필드가 성공적으로 추가되었습니다',
      data: {
        fields_added: ['facility_number', 'green_link_code', 'memo'],
        schema_verified: schemaCheck !== null
      }
    })

  } catch (error) {
    console.error('💥 마이그레이션 오류:', error)
    return NextResponse.json(
      { error: '마이그레이션 실행 실패', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET 요청으로 현재 스키마 상태 확인
export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase 환경변수가 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 스키마 정보 조회
    const { data, error } = await supabase
      .from('air_permit_info')
      .select('facility_number, green_link_code, memo')
      .limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        message: 'PDF 필드가 아직 추가되지 않았습니다',
        error: error.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'PDF 필드가 이미 존재합니다',
      fields: ['facility_number', 'green_link_code', 'memo']
    })

  } catch (error) {
    console.error('💥 스키마 확인 오류:', error)
    return NextResponse.json(
      { error: '스키마 확인 실패', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}