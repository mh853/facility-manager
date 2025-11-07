// app/api/estimates/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEstimatePDF } from '@/lib/document-generators/estimate-pdf-generator';

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

    // 1. 견적서 데이터 조회
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

    // 2. PDF 생성
    const pdfBuffer = await generateEstimatePDF({
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
    });

    // 3. Supabase Storage에 업로드
    const fileName = `estimates/${estimate.business_id}/${estimate.estimate_number}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('PDF 업로드 오류:', uploadError);
      // 업로드 실패해도 PDF는 반환
    } else {
      // Public URL 생성
      const { data: urlData } = supabase
        .storage
        .from('documents')
        .getPublicUrl(fileName);

      // estimate_history 업데이트
      await supabase
        .from('estimate_history')
        .update({
          pdf_file_path: fileName,
          pdf_file_url: urlData.publicUrl
        })
        .eq('id', id);
    }

    // 4. PDF 반환
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${estimate.estimate_number}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: 'PDF 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
