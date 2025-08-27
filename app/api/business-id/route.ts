// app/api/business-id/route.ts - 사업장 ID 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { businessName } = await request.json();

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🏢 [BUSINESS-ID] 조회 시작: ${businessName}`);

    // 사업장 ID 조회
    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    if (error) {
      console.warn(`🏢 [BUSINESS-ID] 조회 실패: ${error.message}`);
      
      // 사업장이 없으면 생성
      const { data: newBusiness, error: createError } = await supabaseAdmin
        .from('businesses')
        .insert({ name: businessName })
        .select('id')
        .single();

      if (createError) {
        throw createError;
      }

      console.log(`🏢 [BUSINESS-ID] 새 사업장 생성: ${businessName}, ID: ${newBusiness.id}`);
      
      return NextResponse.json({
        success: true,
        businessId: newBusiness.id,
        created: true
      });
    }

    console.log(`🏢 [BUSINESS-ID] 조회 완료: ${businessName}, ID: ${business.id}`);

    return NextResponse.json({
      success: true,
      businessId: business.id,
      created: false
    });

  } catch (error) {
    console.error('🏢 [BUSINESS-ID] 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '사업장 ID 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}