// app/api/survey-events/route.ts - 실사 이벤트 관리 API
import { NextRequest } from 'next/server';
import { queryAll, queryOne, query as pgQuery } from '@/lib/supabase-direct';

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

    // Direct PostgreSQL 쿼리 구성
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // 월별 필터링
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;

      // 해당 월의 마지막 날짜를 정확히 계산 (28~31일)
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

      conditions.push(`event_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;

      conditions.push(`event_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    // 사업장별 필터링
    if (businessId) {
      conditions.push(`business_id = $${paramIndex}`);
      params.push(businessId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const data = await queryAll(
      `SELECT * FROM survey_events
       ${whereClause}
       ORDER BY event_date ASC`,
      params
    );

    console.log(`✅ [SURVEY-EVENTS] ${data?.length || 0}개 이벤트 조회 완료`);

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

    // survey_events 테이블에 삽입 - Direct PostgreSQL
    const data = await queryOne(
      `INSERT INTO survey_events (
        id, title, event_date, start_time, end_time, labels,
        business_id, business_name, author_name, event_type, survey_type, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        eventId,
        title,
        event_date,
        start_time || null,
        end_time || null,
        JSON.stringify([label]),
        business_id,
        business_name,
        author_name || '미지정',
        'survey',
        survey_type,
        description || null
      ]
    );

    if (!data) {
      console.error('❌ [SURVEY-EVENTS] 생성 실패');
      return Response.json({
        success: false,
        error: '실사 이벤트 생성에 실패했습니다'
      }, { status: 500 });
    }

    console.log('✅ [SURVEY-EVENTS] 생성 완료:', eventId);

    return Response.json({
      success: true,
      data,
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

    // 동적 UPDATE 필드 구성 - Direct PostgreSQL
    const updateFields: string[] = ['updated_at = $1'];
    const params: any[] = [new Date().toISOString()];
    let paramIndex = 2;

    if (event_date !== undefined) {
      updateFields.push(`event_date = $${paramIndex}`);
      params.push(event_date);
      paramIndex++;
    }
    if (start_time !== undefined) {
      updateFields.push(`start_time = $${paramIndex}`);
      params.push(start_time);
      paramIndex++;
    }
    if (end_time !== undefined) {
      updateFields.push(`end_time = $${paramIndex}`);
      params.push(end_time);
      paramIndex++;
    }
    if (author_name !== undefined) {
      updateFields.push(`author_name = $${paramIndex}`);
      params.push(author_name);
      paramIndex++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    // WHERE 조건용 파라미터 추가
    params.push(id);

    const data = await queryOne(
      `UPDATE survey_events
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (!data) {
      return Response.json({
        success: false,
        error: '해당 이벤트를 찾을 수 없습니다'
      }, { status: 404 });
    }

    console.log('✅ [SURVEY-EVENTS] 수정 완료:', id);

    return Response.json({
      success: true,
      data,
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

    // survey_events 삭제 - Direct PostgreSQL
    const result = await pgQuery(
      `DELETE FROM survey_events WHERE id = $1`,
      [id]
    );

    if (!result || result.rowCount === 0) {
      console.error('❌ [SURVEY-EVENTS] 삭제 실패: 이벤트를 찾을 수 없음');
      return Response.json({
        success: false,
        error: '해당 이벤트를 찾을 수 없습니다'
      }, { status: 404 });
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
      await pgQuery(
        `UPDATE business_info SET ${fieldToUpdate} = NULL WHERE id = $1`,
        [businessId]
      );
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
