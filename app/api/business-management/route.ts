// app/api/business-management/route.ts - 어드민용 사업장 관리 API (기존 데이터 활용)
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    console.log('🔍 [BUSINESS-MGMT] 어드민 사업장 목록 조회 (기존 데이터 활용)');
    
    // 1. 기존 business-list API에서 사업장 목록 가져오기
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL 
      ? process.env.NEXT_PUBLIC_BASE_URL
      : `http://localhost:${process.env.PORT || 3000}`;
      
    const businessListResponse = await fetch(`${baseUrl}/api/business-list`);
    const businessListData = await businessListResponse.json();
    
    if (!businessListData.success || !businessListData.data?.businesses) {
      throw new Error('사업장 목록을 가져올 수 없습니다');
    }
    
    const businessNames = businessListData.data.businesses;
    console.log(`🔍 [BUSINESS-MGMT] ${businessNames.length}개 사업장 발견`);
    
    // 쿼리 파라미터로 간단한 목록만 요청할 수 있도록 추가
    const { searchParams } = new URL(request.url);
    const simpleList = searchParams.get('simple') === 'true';
    
    if (simpleList) {
      // 간단한 목록만 반환 (즉시 응답)
      const simpleBusinesses = businessNames.map((name: string, index: number) => ({
        id: `business-${index}`,
        사업장명: name,
        주소: '',
        담당자명: '',
        담당자연락처: '',
        담당자직급: '',
        대표자: '',
        사업자등록번호: '',
        업종: '',
        사업장연락처: '',
        상태: '로딩중',
        배출시설수: 0,
        방지시설수: 0,
        총측정기기수: 0,
        등록일: new Date().toLocaleDateString('ko-KR'),
        수정일: new Date().toLocaleDateString('ko-KR')
      }));
      
      return createSuccessResponse({
        businesses: simpleBusinesses,
        count: simpleBusinesses.length,
        metadata: {
          source: 'business-list-simple',
          totalAvailable: businessNames.length,
          processed: simpleBusinesses.length,
          isSimple: true
        }
      });
    }

    // 2. 각 사업장의 상세 정보를 facilities-supabase API에서 가져오기 (병렬 처리)
    const businessDetailsPromises = businessNames.map(async (businessName: string) => {
      try {
        const encodedName = encodeURIComponent(businessName);
        const response = await fetch(`${baseUrl}/api/facilities-supabase/${encodedName}`);
        const data = await response.json();
        
        if (data.success && data.data?.businessInfo) {
          const info = data.data.businessInfo;
          const facilities = data.data.facilities;
          
          // 측정기기 수량 계산
          const dischargeCount = facilities?.discharge?.length || 0;
          const preventionCount = facilities?.prevention?.length || 0;
          const totalDevices = dischargeCount + preventionCount; // 간소화된 계산
          
          return {
            id: `business-${businessName}`,
            사업장명: businessName,
            주소: info.주소 || '',
            담당자명: info.담당자명 || '',
            담당자연락처: info.담당자연락처 || '',
            담당자직급: info.담당자직급 || '',
            대표자: info.대표자 || '',
            사업자등록번호: info.사업자등록번호 || '',
            업종: info.업종 || '',
            사업장연락처: info.사업장연락처 || '',
            상태: '활성',
            배출시설수: dischargeCount,
            방지시설수: preventionCount,
            총측정기기수: totalDevices,
            등록일: new Date().toLocaleDateString('ko-KR'),
            수정일: new Date().toLocaleDateString('ko-KR')
          };
        }
        
        return {
          id: `business-${businessName}`,
          사업장명: businessName,
          주소: '',
          담당자명: '',
          담당자연락처: '',
          담당자직급: '',
          대표자: '',
          사업자등록번호: '',
          업종: '',
          사업장연락처: '',
          상태: '정보 부족',
          배출시설수: 0,
          방지시설수: 0,
          총측정기기수: 0,
          등록일: new Date().toLocaleDateString('ko-KR'),
          수정일: new Date().toLocaleDateString('ko-KR')
        };
      } catch (error) {
        console.error(`❌ [BUSINESS-MGMT] ${businessName} 정보 로드 실패:`, error);
        return {
          id: `business-${businessName}`,
          사업장명: businessName,
          주소: '',
          담당자명: '',
          담당자연락처: '',
          담당자직급: '',
          대표자: '',
          사업자등록번호: '',
          업종: '',
          사업장연락처: '',
          상태: '로드 실패',
          배출시설수: 0,
          방지시설수: 0,
          총측정기기수: 0,
          등록일: new Date().toLocaleDateString('ko-KR'),
          수정일: new Date().toLocaleDateString('ko-KR')
        };
      }
    });
    
    console.log('🔄 [BUSINESS-MGMT] 병렬 상세 정보 로드 시작...');
    const businessDetails = await Promise.allSettled(businessDetailsPromises);
    
    const formattedBusinesses = businessDetails
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);
    
    console.log(`✅ [BUSINESS-MGMT] ${formattedBusinesses.length}개 사업장 정보 완료`);
    
    return createSuccessResponse({
      businesses: formattedBusinesses,
      count: formattedBusinesses.length,
      metadata: {
        source: 'facilities-supabase',
        totalAvailable: businessNames.length,
        processed: formattedBusinesses.length,
        withCompleteInfo: formattedBusinesses.filter(b => b.상태 === '활성').length
      }
    });
    
  } catch (error: any) {
    console.error('🔴 [BUSINESS-MGMT] 오류:', error?.message || error);
    return createErrorResponse(error?.message || 'Supabase 연결에 실패했습니다', 500);
  }
}, { logLevel: 'debug' });

export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    console.log('📝 [BUSINESS-MGMT] 사업장 추가/수정 요청:', body);
    
    // 실제 구현은 필요시 추가
    return createSuccessResponse({ 
      message: '사업장 정보는 읽기 전용입니다. 원본 시스템에서 수정해주세요.' 
    });
    
  } catch (error: any) {
    console.error('🔴 [BUSINESS-MGMT] 저장 오류:', error);
    return createErrorResponse(error?.message || '사업장 저장에 실패했습니다', 500);
  }
}, { logLevel: 'debug' });

export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    console.log('🗑️ [BUSINESS-MGMT] 사업장 삭제 요청:', body);
    
    // 실제 구현은 필요시 추가
    return createSuccessResponse({ 
      message: '사업장 정보는 읽기 전용입니다. 원본 시스템에서 수정해주세요.' 
    });
    
  } catch (error: any) {
    console.error('🔴 [BUSINESS-MGMT] 삭제 오류:', error);
    return createErrorResponse(error?.message || '사업장 삭제에 실패했습니다', 500);
  }
}, { logLevel: 'debug' });