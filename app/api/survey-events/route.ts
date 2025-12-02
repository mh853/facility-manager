// app/api/survey-events/route.ts - 실사 이벤트 관리 API
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ========================================
// GET: 실사 이벤트 조회
// ========================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM 형식
    const businessId = searchParams.get('businessId');

    let query = supabase
      .from('survey_events')
      .select('*')
      .order('event_date', { ascending: true });

    // 월별 필터링
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;

      // 해당 월의 마지막 날짜를 정확히 계산 (28~31일)
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

      query = query.gte('event_date', startDate).lte('event_date', endDate);
    }

    // 사업장별 필터링
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [SURVEY-EVENTS] 조회 실패:', error);
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log(`✅ [SURVEY-EVENTS] ${data.length}개 이벤트 조회 완료`);

    return Response.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('❌ [SURVEY-EVENTS] GET 오류:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// ========================================
// POST: 실사 이벤트 생성
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_id,
      business_name,
      survey_type, // 'estimate_survey' | 'pre_construction_survey' | 'completion_survey'
      event_date,
      start_time,  // ✅ 시간 필드 추가
      end_time,    // ✅ 시간 필드 추가
      author_name,
      description
    } = body;

    // 필수 필드 검증
    if (!business_id || !survey_type || !event_date) {
      return Response.json({
        success: false,
        error: '필수 필드가 누락되었습니다: business_id, survey_type, event_date'
      }, { status: 400 });
    }

    // survey_type에 따른 라벨 매핑
    const labelMap: Record<string, string> = {
      'estimate_survey': '견적실사',
      'pre_construction_survey': '착공전실사',
      'completion_survey': '준공실사'
    };

    const label = labelMap[survey_type];
    if (!label) {
      return Response.json({
        success: false,
        error: '유효하지 않은 survey_type입니다'
      }, { status: 400 });
    }

    // 이벤트 ID 생성
    const eventId = `${survey_type}-${business_id}`;
    const title = `${business_name} - ${label}`;

    // survey_events 테이블에 삽입 (트리거로 자동 동기화)
    const { data, error } = await supabase
      .from('survey_events')
      .insert([{
        id: eventId,
        title,
        event_date,
        start_time: start_time || null,  // ✅ 시간 필드 추가
        end_time: end_time || null,      // ✅ 시간 필드 추가
        labels: [label],
        business_id,
        business_name,
        author_name: author_name || '미지정',
        event_type: 'survey',
        survey_type,
        description: description || null
      }])
      .select();

    if (error) {
      console.error('❌ [SURVEY-EVENTS] 생성 실패:', error);
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ [SURVEY-EVENTS] 생성 완료:', eventId);

    return Response.json({
      success: true,
      data: data[0],
      message: '실사 이벤트가 생성되었습니다 (business_info와 자동 동기화됨)'
    });
  } catch (error) {
    console.error('❌ [SURVEY-EVENTS] POST 오류:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// ========================================
// PUT: 실사 이벤트 수정
// ========================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      event_date,
      start_time,  // ✅ 시간 필드 추가
      end_time,    // ✅ 시간 필드 추가
      author_name,
      description
    } = body;

    if (!id) {
      return Response.json({
        success: false,
        error: '이벤트 ID가 필요합니다'
      }, { status: 400 });
    }

    // survey_events 업데이트 (트리거로 business_info 자동 동기화)
    const { data, error } = await supabase
      .from('survey_events')
      .update({
        event_date: event_date || undefined,
        start_time: start_time !== undefined ? start_time : undefined,  // ✅ 시간 필드 추가
        end_time: end_time !== undefined ? end_time : undefined,        // ✅ 시간 필드 추가
        author_name: author_name || undefined,
        description: description || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ [SURVEY-EVENTS] 수정 실패:', error);
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return Response.json({
        success: false,
        error: '해당 이벤트를 찾을 수 없습니다'
      }, { status: 404 });
    }

    console.log('✅ [SURVEY-EVENTS] 수정 완료:', id);

    return Response.json({
      success: true,
      data: data[0],
      message: '실사 이벤트가 수정되었습니다 (business_info와 자동 동기화됨)'
    });
  } catch (error) {
    console.error('❌ [SURVEY-EVENTS] PUT 오류:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// ========================================
// DELETE: 실사 이벤트 삭제
// ========================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({
        success: false,
        error: '이벤트 ID가 필요합니다'
      }, { status: 400 });
    }

    // survey_events 삭제
    const { error } = await supabase
      .from('survey_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [SURVEY-EVENTS] 삭제 실패:', error);
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ [SURVEY-EVENTS] 삭제 완료:', id);

    // business_info의 해당 실사 날짜를 NULL로 업데이트
    // ID 형식: 'estimate-survey-{uuid}' 또는 'pre-construction-survey-{uuid}' 또는 'completion-survey-{uuid}'
    let businessId = '';
    let fieldToUpdate = '';

    if (id.startsWith('estimate-survey-')) {
      businessId = id.replace('estimate-survey-', ''); // UUID 추출
      fieldToUpdate = 'estimate_survey_date';
    } else if (id.startsWith('pre-construction-survey-')) {
      businessId = id.replace('pre-construction-survey-', ''); // UUID 추출
      fieldToUpdate = 'pre_construction_survey_date';
    } else if (id.startsWith('completion-survey-')) {
      businessId = id.replace('completion-survey-', ''); // UUID 추출
      fieldToUpdate = 'completion_survey_date';
    }

    if (fieldToUpdate && businessId) {
      await supabase
        .from('business_info')
        .update({ [fieldToUpdate]: null })
        .eq('id', businessId);
    }

    return Response.json({
      success: true,
      message: '실사 이벤트가 삭제되었습니다 (business_info도 업데이트됨)'
    });
  } catch (error) {
    console.error('❌ [SURVEY-EVENTS] DELETE 오류:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
