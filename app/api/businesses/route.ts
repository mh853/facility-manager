// app/api/businesses/route.ts - 비즈니스 정보 CRUD API
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  getAllBusinesses,
  createBusiness,
  searchBusinesses,
  getBusinessStats
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// GET /api/businesses - 사업장 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  // 인증 확인
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

  if (!token) {
    return createErrorResponse('인증이 필요합니다', 401);
  }

  const tokenPayload = await verifyToken(token);
  if (!tokenPayload) {
    return createErrorResponse('유효하지 않은 토큰입니다', 401);
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    if (search) {
      // 검색 모드
      const results = await searchBusinesses(search, limit);
      console.log(`🔍 [BUSINESSES] 검색 완료: "${search}" => ${results.length}개 결과`);

      return createSuccessResponse({
        businesses: results,
        count: results.length,
        search,
        metadata: {
          type: 'search',
          query: search,
          limit
        }
      });
    } else {
      // 전체 목록 조회
      const businesses = await getAllBusinesses({
        limit,
        offset,
        isActive: true
      });

      console.log(`📋 [BUSINESSES] 목록 조회 완료: ${businesses.length}개`);

      return createSuccessResponse({
        businesses,
        count: businesses.length,
        metadata: {
          type: 'list',
          limit,
          offset
        }
      });
    }
  } catch (error) {
    console.error('❌ [BUSINESSES] 조회 실패:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '사업장 조회에 실패했습니다',
      500
    );
  }
}, { logLevel: 'info' });

// POST /api/businesses - 새 사업장 생성
export const POST = withApiHandler(async (request: NextRequest) => {
  // 인증 확인
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

  if (!token) {
    return createErrorResponse('인증이 필요합니다', 401);
  }

  const tokenPayload = await verifyToken(token);
  if (!tokenPayload || tokenPayload.role < 2) {
    return createErrorResponse('관리자 권한이 필요합니다', 403);
  }

  try {
    const businessData = await request.json();
    console.log('📝 [BUSINESSES] 사업장 생성 요청:', { businessName: businessData.business_name });

    // 필수 필드 검증
    if (!businessData.business_name) {
      return createErrorResponse('사업장명은 필수입니다', 400);
    }

    // 생성자 정보 추가
    businessData.created_by = tokenPayload.userId;
    businessData.updated_by = tokenPayload.userId;

    const newBusiness = await createBusiness(businessData);
    console.log('✅ [BUSINESSES] 사업장 생성 완료:', newBusiness.id);

    return createSuccessResponse({
      business: newBusiness,
      message: '사업장이 성공적으로 생성되었습니다'
    });

  } catch (error) {
    console.error('❌ [BUSINESSES] 생성 실패:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '사업장 생성에 실패했습니다',
      500
    );
  }
}, { logLevel: 'info' });