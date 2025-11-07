// app/api/estimates/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 견적서 데이터 조회
    const { data: estimate, error } = await supabase
      .from('estimate_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !estimate) {
      return NextResponse.json(
        { success: false, error: '견적서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 견적서 데이터를 JSON으로 반환 (클라이언트에서 PDF 생성)
    return NextResponse.json({
      success: true,
      data: {
        estimate_number: estimate.estimate_number,
        estimate_date: estimate.estimate_date,
        customer_name: estimate.customer_name,
        customer_address: estimate.customer_address,
        customer_registration_number: estimate.customer_registration_number,
        customer_representative: estimate.customer_representative,
        customer_business_type: estimate.customer_business_type,
        customer_business_category: estimate.customer_business_category,
        customer_phone: estimate.customer_phone,
        supplier_info: estimate.supplier_info,
        estimate_items: estimate.estimate_items,
        subtotal: parseFloat(estimate.subtotal),
        vat_amount: parseFloat(estimate.vat_amount),
        total_amount: parseFloat(estimate.total_amount),
        terms_and_conditions: estimate.terms_and_conditions
      }
    });

  } catch (error) {
    console.error('견적서 데이터 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
