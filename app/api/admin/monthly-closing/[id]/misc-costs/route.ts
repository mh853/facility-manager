import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// GET: 특정 월의 기타 비용 상세 조회
export async function GET(
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

    const { id } = params;
    const supabase = supabaseAdmin;

    const { data: miscCosts, error } = await supabase
      .from('miscellaneous_costs')
      .select('*')
      .eq('monthly_closing_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('기타 비용 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '기타 비용 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    const total = miscCosts?.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        miscCosts: miscCosts?.map(c => ({
          id: c.id,
          monthlyClosingId: c.monthly_closing_id,
          itemName: c.item_name,
          amount: Number(c.amount) || 0,
          description: c.description,
          createdBy: c.created_by,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        })) || [],
        total
      }
    });

  } catch (error) {
    console.error('기타 비용 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// POST: 기타 비용 항목 추가
export async function POST(
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
    const body = await request.json();
    const { itemName, amount, description } = body;

    if (!itemName || amount === undefined || amount < 0) {
      return NextResponse.json({
        success: false,
        message: '항목명과 유효한 금액을 입력해주세요.'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // 1. 기타 비용 추가
    const { data: miscCost, error: insertError } = await supabase
      .from('miscellaneous_costs')
      .insert({
        monthly_closing_id: id,
        item_name: itemName,
        amount,
        description
      })
      .select()
      .single();

    if (insertError) {
      console.error('기타 비용 추가 오류:', insertError);
      return NextResponse.json({
        success: false,
        message: '기타 비용 추가 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // 2. 해당 월의 총 기타 비용 재계산
    const { data: allMiscCosts } = await supabase
      .from('miscellaneous_costs')
      .select('amount')
      .eq('monthly_closing_id', id);

    const totalMiscCosts = allMiscCosts?.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0;

    // 3. 순이익 재계산
    const { data: closing } = await supabase
      .from('monthly_closings')
      .select('total_revenue, sales_commission_costs, installation_costs')
      .eq('id', id)
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

    // 4. 마감 데이터 업데이트
    const { data: updatedClosing, error: updateError } = await supabase
      .from('monthly_closings')
      .update({
        miscellaneous_costs: totalMiscCosts,
        net_profit: newNetProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
        miscCost: {
          id: miscCost.id,
          monthlyClosingId: miscCost.monthly_closing_id,
          itemName: miscCost.item_name,
          amount: Number(miscCost.amount) || 0,
          description: miscCost.description,
          createdAt: miscCost.created_at,
          updatedAt: miscCost.updated_at
        },
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
    console.error('기타 비용 추가 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
