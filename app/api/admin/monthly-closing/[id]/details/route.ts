import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTokenString } from '@/utils/auth';

// GET: 특정 월 마감의 상세 내역 조회 (모든 사업장별 계산 내역)
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

    const permissionLevel = decoded.permissionLevel || decoded.permission_level;
    if (!permissionLevel || permissionLevel < 1) {
      return NextResponse.json({
        success: false,
        message: '권한이 부족합니다.'
      }, { status: 403 });
    }

    const closingId = params.id;
    const supabase = supabaseAdmin;

    // 1. 월 마감 기본 정보 조회
    const { data: closing, error: closingError } = await supabase
      .from('monthly_closings')
      .select('*')
      .eq('id', closingId)
      .single();

    if (closingError || !closing) {
      return NextResponse.json({
        success: false,
        message: '월 마감 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. 해당 월에 포함된 모든 사업장별 매출 계산 내역 조회
    const startDate = `${closing.year}-${String(closing.month).padStart(2, '0')}-01`;
    const endDate = closing.month === 12
      ? `${closing.year + 1}-01-01`
      : `${closing.year}-${String(closing.month + 1).padStart(2, '0')}-01`;

    const { data: revenueData, error: revenueError } = await supabase
      .from('revenue_calculations')
      .select(`
        id,
        business_id,
        business_name,
        calculation_date,
        total_revenue,
        total_cost,
        gross_profit,
        sales_commission,
        adjusted_sales_commission,
        installation_costs,
        survey_costs,
        net_profit,
        created_at,
        business_info!inner(
          installation_date,
          completion_date
        )
      `)
      .gte('calculation_date', startDate)
      .lt('calculation_date', endDate)
      .not('business_info.installation_date', 'is', null)
      .order('calculation_date', { ascending: true });

    if (revenueError) {
      console.error('사업장 매출 데이터 조회 오류:', revenueError);
      return NextResponse.json({
        success: false,
        message: '사업장 매출 데이터 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // 3. 데이터 포맷팅
    const details = revenueData?.map(d => ({
      id: d.id,
      businessId: d.business_id,
      businessName: d.business_name,
      calculationDate: d.calculation_date,
      totalRevenue: Number(d.total_revenue) || 0,
      totalCost: Number(d.total_cost) || 0,
      grossProfit: Number(d.gross_profit) || 0,
      salesCommission: Number(d.adjusted_sales_commission) || Number(d.sales_commission) || 0,
      installationCosts: Number(d.installation_costs) || 0,
      surveyCosts: Number(d.survey_costs) || 0,
      netProfit: Number(d.net_profit) || 0,
      createdAt: d.created_at,
      installationDate: d.business_info?.installation_date || null,
      completionDate: d.business_info?.completion_date || null
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        closing: {
          id: closing.id,
          year: closing.year,
          month: closing.month,
          totalRevenue: Number(closing.total_revenue) || 0,
          totalCost: Number(closing.total_cost) || 0,
          salesCommissionCosts: Number(closing.sales_commission_costs) || 0,
          surveyCosts: Number(closing.survey_costs) || 0,
          installationCosts: Number(closing.installation_costs) || 0,
          miscellaneousCosts: Number(closing.miscellaneous_costs) || 0,
          netProfit: Number(closing.net_profit) || 0,
          businessCount: closing.business_count || 0
        },
        businesses: details
      }
    });

  } catch (error) {
    console.error('월 마감 상세 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
