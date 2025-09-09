// app/api/file-count/route.ts - 파일 개수 조회 API (사진 순서 계산용)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('businessName');
    const facilityInfo = searchParams.get('facilityInfo');
    const fileType = searchParams.get('fileType'); // 'discharge', 'prevention', 'basic'
    const category = searchParams.get('category'); // for basic photos

    if (!businessName) {
      return NextResponse.json({
        success: false,
        message: '사업장명이 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🔢 [FILE-COUNT] 파일 개수 조회: ${businessName}, ${fileType}, ${facilityInfo || category}`);

    // 사업장 조회
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    if (businessError || !business) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: '사업장을 찾을 수 없습니다.'
      });
    }

    let query = supabaseAdmin
      .from('uploaded_files')
      .select('filename', { count: 'exact' })
      .eq('business_id', business.id);

    // 파일 타입별 필터링
    if (fileType === 'discharge' || fileType === 'prevention') {
      // 시설별 사진 개수 계산
      const folderName = fileType === 'discharge' ? '배출시설' : '방지시설';
      
      // 파일명 패턴으로 필터링 (구조화된 파일명 기준)
      const facilityPrefix = fileType === 'prevention' ? '방' : '배';
      
      if (facilityInfo) {
        // facilityInfo에서 시설 정보 추출
        const facilityMatch = facilityInfo.match(/^([^(]+?)(\([^)]+\))?/);
        let facilityName = fileType === 'discharge' ? '배출시설' : '방지시설';
        let capacity = '';
        
        if (facilityMatch) {
          facilityName = facilityMatch[1].trim().replace(/\d+$/, '');
          if (facilityMatch[2]) {
            capacity = facilityMatch[2].replace(/[()]/g, '');
          }
        }
        
        // 용량 정보 추출
        const capacityMatch = facilityInfo.match(/용량:\s*([^,]+)/);
        if (capacityMatch && !capacity) {
          capacity = capacityMatch[1].trim();
        }
        
        // 정리된 시설 정보 생성
        const sanitizedFacilityInfo = `${facilityName}${capacity}`.replace(/\s+/g, '');
        
        // 구조화된 파일명 패턴으로 검색
        query = query.like('filename', `${facilityPrefix}%${sanitizedFacilityInfo}%`);
        
        console.log(`🔍 [FILE-COUNT-PATTERN] 검색 패턴: ${facilityPrefix}%${sanitizedFacilityInfo}%`);
      }
      
    } else if (fileType === 'basic' && category) {
      // 기본사진 카테고리별 개수 계산
      const categoryMap: { [key: string]: string } = {
        'gateway': '게이트웨이',
        'fan': '송풍기', 
        'electrical': '배전함',
        'others': '기타시설'
      };
      
      const categoryName = categoryMap[category] || category;
      query = query.like('filename', `기본_${categoryName}%`);
      
      console.log(`🔍 [FILE-COUNT-BASIC] 기본사진 패턴: 기본_${categoryName}%`);
    }

    const { count, error: countError } = await query;

    if (countError) {
      console.error('파일 개수 조회 오류:', countError);
      throw countError;
    }

    const fileCount = count || 0;
    const nextPhotoIndex = fileCount + 1;

    console.log(`✅ [FILE-COUNT] 결과: ${fileCount}개 기존 파일, 다음 순서: ${nextPhotoIndex}`);

    return NextResponse.json({
      success: true,
      count: fileCount,
      nextIndex: nextPhotoIndex
    });

  } catch (error) {
    console.error('파일 개수 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: '파일 개수 조회 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}