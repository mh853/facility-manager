// app/api/revenue/dealer-pricing/route.ts - 대리점 가격 관리 API
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] GET 요청 시작');

    const { supabaseAdmin } = await import('@/lib/supabase');

    // 활성 상태인 대리점 가격 목록 조회
    const { data, error } = await supabaseAdmin
      .from('dealer_pricing')
      .select('*')
      .eq('is_active', true)
      .order('equipment_type', { ascending: true })
      .order('equipment_name', { ascending: true });

    if (error) {
      console.error('❌ [DEALER-PRICING] 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '대리점 가격 목록 조회 실패: ' + error.message
      }, { status: 500 });
    }

    console.log(`✅ [DEALER-PRICING] 조회 성공: ${data?.length || 0}개`);

    return NextResponse.json({
      success: true,
      data: data || [],
      message: `대리점 가격 ${data?.length || 0}개 조회 완료`
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] GET 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 조회 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] POST 요청 시작');

    const body = await request.json();
    const { supabaseAdmin } = await import('@/lib/supabase');

    // 필수 필드 검증
    if (!body.equipment_type || !body.equipment_name ||
        !body.cost_price || !body.dealer_cost_price || !body.dealer_selling_price ||
        !body.effective_from) {
      return NextResponse.json({
        success: false,
        message: '필수 항목을 모두 입력해주세요 (기기 유형, 기기명, 원가, 공급가, 판매가, 시행일)'
      }, { status: 400 });
    }

    // 마진율 자동 계산
    const margin_rate = ((body.dealer_selling_price - body.dealer_cost_price) / body.dealer_cost_price * 100).toFixed(2);

    const insertData = {
      equipment_type: body.equipment_type,
      equipment_name: body.equipment_name,
      cost_price: parseInt(body.cost_price),
      dealer_cost_price: parseInt(body.dealer_cost_price),
      dealer_selling_price: parseInt(body.dealer_selling_price),
      margin_rate: parseFloat(margin_rate),
      manufacturer: body.manufacturer || null,
      effective_from: body.effective_from,
      effective_to: body.effective_to || null,
      notes: body.notes || null,
      is_active: body.is_active !== undefined ? body.is_active : true
    };

    const { data, error } = await supabaseAdmin
      .from('dealer_pricing')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ [DEALER-PRICING] 삽입 실패:', error);
      return NextResponse.json({
        success: false,
        message: '대리점 가격 추가 실패: ' + error.message
      }, { status: 500 });
    }

    console.log('✅ [DEALER-PRICING] 삽입 성공:', data.id);

    return NextResponse.json({
      success: true,
      data,
      message: '대리점 가격이 성공적으로 추가되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] POST 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 추가 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] PUT 요청 시작');

    const body = await request.json();
    const { supabaseAdmin } = await import('@/lib/supabase');

    if (!body.id) {
      return NextResponse.json({
        success: false,
        message: '수정할 항목의 ID가 필요합니다'
      }, { status: 400 });
    }

    // 마진율 재계산 (가격이 변경된 경우)
    const updateData: any = { ...body };
    if (body.dealer_cost_price && body.dealer_selling_price) {
      const margin_rate = ((body.dealer_selling_price - body.dealer_cost_price) / body.dealer_cost_price * 100).toFixed(2);
      updateData.margin_rate = parseFloat(margin_rate);
    }

    delete updateData.id; // ID는 업데이트하지 않음
    delete updateData.created_at; // 생성일은 변경하지 않음

    const { data, error } = await supabaseAdmin
      .from('dealer_pricing')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('❌ [DEALER-PRICING] 업데이트 실패:', error);
      return NextResponse.json({
        success: false,
        message: '대리점 가격 수정 실패: ' + error.message
      }, { status: 500 });
    }

    console.log('✅ [DEALER-PRICING] 업데이트 성공:', data.id);

    return NextResponse.json({
      success: true,
      data,
      message: '대리점 가격이 성공적으로 수정되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] PUT 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 수정 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('📊 [DEALER-PRICING] DELETE 요청 시작');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: '삭제할 항목의 ID가 필요합니다'
      }, { status: 400 });
    }

    const { supabaseAdmin } = await import('@/lib/supabase');

    // 소프트 삭제 (is_active = false)
    const { error } = await supabaseAdmin
      .from('dealer_pricing')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('❌ [DEALER-PRICING] 삭제 실패:', error);
      return NextResponse.json({
        success: false,
        message: '대리점 가격 삭제 실패: ' + error.message
      }, { status: 500 });
    }

    console.log('✅ [DEALER-PRICING] 삭제 성공:', id);

    return NextResponse.json({
      success: true,
      message: '대리점 가격이 성공적으로 삭제되었습니다'
    });

  } catch (error) {
    console.error('❌ [DEALER-PRICING] DELETE 오류:', error);
    return NextResponse.json({
      success: false,
      message: '대리점 가격 삭제 중 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}
