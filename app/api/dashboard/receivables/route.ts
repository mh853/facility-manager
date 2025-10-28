import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 기간 파라미터 (3가지 모드)
    const months = searchParams.get('months') ? parseInt(searchParams.get('months')!) : null;
    const startDate = searchParams.get('startDate'); // YYYY-MM 형식
    const endDate = searchParams.get('endDate');     // YYYY-MM 형식
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;

    // 필터 파라미터
    const office = searchParams.get('office'); // 지역 필터 (주소에서 추출)
    const manufacturer = searchParams.get('manufacturer');
    const salesOffice = searchParams.get('salesOffice');
    const progressStatus = searchParams.get('progressStatus'); // 진행구분 필터

    console.log('💰 [Dashboard Receivables API] Request params:', { months, startDate, endDate, year, office, manufacturer, salesOffice, progressStatus });

    const supabase = supabaseAdmin;

    // 1. 사업장 조회 (설치 완료된 사업장만)
    let businessQuery = supabase
      .from('business_info')
      .select('*')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('installation_date', 'is', null);

    // 필터 적용
    if (manufacturer) businessQuery = businessQuery.eq('manufacturer', manufacturer);
    if (salesOffice) businessQuery = businessQuery.eq('sales_office', salesOffice);
    if (progressStatus) businessQuery = businessQuery.eq('progress_status', progressStatus);

    const { data: businesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('❌ [Dashboard Receivables API] Business query error:', businessError);
      throw businessError;
    }

    console.log('💰 [Dashboard Receivables API] Total businesses (before region filter):', businesses?.length || 0);

    // 지역 필터링 (주소에서 지역 추출 - 사업장 관리와 동일)
    let filteredBusinesses = businesses || [];
    if (office) {
      filteredBusinesses = filteredBusinesses.filter(business => {
        const address = business.address || '';
        if (!address) return false;

        // 주소에서 지역 추출
        const regionMatch = address.match(/^(.*?시|.*?도|.*?군)/);
        const region = regionMatch ? regionMatch[1] : '';
        return region === office;
      });
    }

    console.log('💰 [Dashboard Receivables API] Total businesses (after filters):', filteredBusinesses.length);

    // 2. 월별 데이터 집계 맵 초기화
    const monthlyData: Map<string, any> = new Map();

    if (year) {
      // 연도별 모드: 해당 연도의 12개월 초기화
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        monthlyData.set(monthKey, {
          month: monthKey,
          outstanding: 0,
          collected: 0,
          collectionRate: 0,
          prevMonthChange: 0
        });
      }
    } else if (startDate && endDate) {
      // 기간 지정 모드: 시작월부터 종료월까지 초기화
      const start = new Date(startDate + '-01');
      const end = new Date(endDate + '-01');

      const current = new Date(start);
      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(monthKey, {
          month: monthKey,
          outstanding: 0,
          collected: 0,
          collectionRate: 0,
          prevMonthChange: 0
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // 최근 N개월 모드 (기본값: 12개월)
      const monthsToShow = months || 12;
      for (let i = 0; i < monthsToShow; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(monthKey, {
          month: monthKey,
          outstanding: 0,
          collected: 0,
          collectionRate: 0,
          prevMonthChange: 0
        });
      }
    }

    // 3. 월별 미수금 집계 (매출 관리와 동일한 로직)
    filteredBusinesses.forEach(business => {
      if (!business.installation_date) return;

      const installDate = new Date(business.installation_date);
      const monthKey = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const current = monthlyData.get(monthKey);
        const progressStatus = business.progress_status || '';
        const normalizedCategory = progressStatus.trim();

        // 진행구분에 따라 미수금 계산 로직 다름
        if (normalizedCategory === '보조금' || normalizedCategory === '보조금 동시진행') {
          // 보조금: 1차 + 2차 + 추가공사비
          const invoice1st = business.invoice_1st_amount || 0;
          const payment1st = business.payment_1st_amount || 0;
          const receivable1st = invoice1st - payment1st;

          const invoice2nd = business.invoice_2nd_amount || 0;
          const payment2nd = business.payment_2nd_amount || 0;
          const receivable2nd = invoice2nd - payment2nd;

          // 추가공사비는 계산서가 발행된 경우에만 미수금 계산
          const hasAdditionalInvoice = business.invoice_additional_date;
          const receivableAdditional = hasAdditionalInvoice
            ? (business.additional_cost || 0) - (business.payment_additional_amount || 0)
            : 0;

          const totalReceivables = receivable1st + receivable2nd + receivableAdditional;
          const totalPayments = payment1st + payment2nd + (hasAdditionalInvoice ? (business.payment_additional_amount || 0) : 0);

          current.outstanding += totalReceivables;
          current.collected += totalPayments;
        } else if (normalizedCategory === '자비' || normalizedCategory === '대리점' || normalizedCategory === 'AS') {
          // 자비: 선금 + 잔금
          const invoiceAdvance = business.invoice_advance_amount || 0;
          const paymentAdvance = business.payment_advance_amount || 0;
          const receivableAdvance = invoiceAdvance - paymentAdvance;

          const invoiceBalance = business.invoice_balance_amount || 0;
          const paymentBalance = business.payment_balance_amount || 0;
          const receivableBalance = invoiceBalance - paymentBalance;

          const totalReceivables = receivableAdvance + receivableBalance;
          const totalPayments = paymentAdvance + paymentBalance;

          current.outstanding += totalReceivables;
          current.collected += totalPayments;
        }
      }
    });

    // 4. 회수율 및 전월 대비 계산
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    let prevOutstanding = 0;

    sortedMonths.forEach((monthKey, index) => {
      const data = monthlyData.get(monthKey);
      const total = data.outstanding + data.collected;

      // 회수율 계산
      if (total > 0) {
        data.collectionRate = (data.collected / total) * 100;
      }

      // 전월 대비 증감률
      if (index > 0 && prevOutstanding !== 0) {
        data.prevMonthChange = ((data.outstanding - prevOutstanding) / Math.abs(prevOutstanding)) * 100;
      }

      prevOutstanding = data.outstanding;
    });

    // 5. 요약 정보 계산
    // 연도별/기간지정 모드는 오래된 것부터, 최근 모드는 최신부터
    const dataArray = (year || (startDate && endDate))
      ? Array.from(monthlyData.values()) // 연도별/기간지정: 순방향 (1월→12월)
      : Array.from(monthlyData.values()).reverse(); // 최근 모드: 역방향 (최신→과거)
    const totalOutstanding = dataArray.reduce((sum, d) => sum + d.outstanding, 0);
    const validCollectionRates = dataArray.filter(d => d.collectionRate > 0);
    const avgCollectionRate = validCollectionRates.length > 0
      ? validCollectionRates.reduce((sum, d) => sum + d.collectionRate, 0) / validCollectionRates.length
      : 0;

    console.log('💰 [Dashboard Receivables API] Summary:', {
      businesses: filteredBusinesses.length,
      totalOutstanding: Math.round(totalOutstanding),
      avgCollectionRate: Math.round(avgCollectionRate * 100) / 100
    });

    return NextResponse.json({
      success: true,
      data: dataArray,
      summary: {
        totalOutstanding: Math.round(totalOutstanding),
        avgCollectionRate: Math.round(avgCollectionRate * 100) / 100
      }
    });

  } catch (error: any) {
    console.error('❌ [Dashboard Receivables API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        data: [],
        summary: {
          totalOutstanding: 0,
          avgCollectionRate: 0
        }
      },
      { status: 500 }
    );
  }
}
