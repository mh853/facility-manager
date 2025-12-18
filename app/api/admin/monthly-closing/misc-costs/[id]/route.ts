import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// DELETE: 기타 비용 항목 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyTokenString(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      }, { status: 401 });
    }

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '권한이 부족합니다.'
      }, { status: 403 });
    }

    const { id } = params;
    const supabase = supabaseAdmin;

    // 1. 삭제할 기타 비용 정보 조회
    const { data: miscCost } = await supabase
      .from('miscellaneous_costs')
      .select('monthly_closing_id, amount')
      .eq('id', id)
      .single();

    if (!miscCost) {
      return NextResponse.json({
        success: false,
        message: '기타 비용 항목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const monthlyClosingId = miscCost.monthly_closing_id;

    // 2. 기타 비용 삭제
    const { error: deleteError } = await supabase
      .from('miscellaneous_costs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('기타 비용 삭제 오류:', deleteError);
      return NextResponse.json({
        success: false,
        message: '기타 비용 삭제 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // 3. 해당 월의 총 기타 비용 재계산
    const { data: allMiscCosts } = await supabase
      .from('miscellaneous_costs')
      .select('amount')
      .eq('monthly_closing_id', monthlyClosingId);

    const totalMiscCosts = allMiscCosts?.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0;

    // 4. 순이익 재계산
    const { data: closing } = await supabase
      .from('monthly_closings')
      .select('total_revenue, sales_commission_costs, installation_costs')
      .eq('id', monthlyClosingId)
      .single();

    if (!closing) {
      return NextResponse.json({
        success: false,
        message: '마감 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const newNetProfit = Number(closing.total_revenue || 0)
      - Number(closing.sales_commission_costs || 0)
      - Number(closing.installation_costs || 0)
      - totalMiscCosts;

    // 5. 마감 데이터 업데이트
    const { data: updatedClosing, error: updateError } = await supabase
      .from('monthly_closings')
      .update({
        miscellaneous_costs: totalMiscCosts,
        net_profit: newNetProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', monthlyClosingId)
      .select()
      .single();

    if (updateError) {
      console.error('마감 데이터 업데이트 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '마감 데이터 업데이트 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedClosing: {
          id: updatedClosing.id,
          year: updatedClosing.year,
          month: updatedClosing.month,
          totalRevenue: Number(updatedClosing.total_revenue) || 0,
          salesCommissionCosts: Number(updatedClosing.sales_commission_costs) || 0,
          installationCosts: Number(updatedClosing.installation_costs) || 0,
          miscellaneousCosts: Number(updatedClosing.miscellaneous_costs) || 0,
          netProfit: Number(updatedClosing.net_profit) || 0,
          businessCount: updatedClosing.business_count || 0,
          updatedAt: updatedClosing.updated_at
        }
      }
    });

  } catch (error) {
    console.error('기타 비용 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
