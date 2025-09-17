// app/api/businesses/[id]/route.ts - 개별 사업장 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  getAirPermitsByBusinessId,
  getBusinessMemos
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// GET /api/businesses/[id] - 개별 사업장 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
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

    const { id } = params;
    const url = new URL(request.url);
    const includePermits = url.searchParams.get('include_permits') === 'true';
    const includeMemos = url.searchParams.get('include_memos') === 'true';

    try {
      console.log(`🔍 [BUSINESS-DETAIL] 사업장 조회: ${id}`);

      const business = await getBusinessById(id);
      const response: any = { business };

      // 대기배출허가 정보 포함
      if (includePermits) {
        const permits = await getAirPermitsByBusinessId(id);
        response.air_permits = permits;
        console.log(`📋 [BUSINESS-DETAIL] 대기배출허가 ${permits.length}개 포함`);
      }

      // 메모 정보 포함
      if (includeMemos) {
        const memos = await getBusinessMemos(id);
        response.memos = memos;
        console.log(`📝 [BUSINESS-DETAIL] 메모 ${memos.length}개 포함`);
      }

      console.log(`✅ [BUSINESS-DETAIL] 조회 완료: ${business.business_name}`);

      return createSuccessResponse(response);

    } catch (error) {
      console.error('❌ [BUSINESS-DETAIL] 조회 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '사업장 조회에 실패했습니다',
        404
      );
    }
  }, { logLevel: 'info' })();
}

// PUT /api/businesses/[id] - 사업장 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
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

    const { id } = params;

    try {
      const updateData = await request.json();
      console.log(`📝 [BUSINESS-UPDATE] 사업장 업데이트: ${id}`);

      // 업데이트자 정보 추가
      updateData.updated_by = tokenPayload.userId;

      const updatedBusiness = await updateBusiness(id, updateData);
      console.log(`✅ [BUSINESS-UPDATE] 업데이트 완료: ${updatedBusiness.business_name}`);

      return createSuccessResponse({
        business: updatedBusiness,
        message: '사업장 정보가 성공적으로 업데이트되었습니다'
      });

    } catch (error) {
      console.error('❌ [BUSINESS-UPDATE] 업데이트 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '사업장 업데이트에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}

// DELETE /api/businesses/[id] - 사업장 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

    if (!token) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

    const tokenPayload = await verifyToken(token);
    if (!tokenPayload || tokenPayload.role < 3) {
      return createErrorResponse('관리자 권한이 필요합니다', 403);
    }

    const { id } = params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    try {
      console.log(`🗑️ [BUSINESS-DELETE] 사업장 삭제: ${id} (hard: ${hardDelete})`);

      await deleteBusiness(id, hardDelete);
      console.log('✅ [BUSINESS-DELETE] 삭제 완료');

      return createSuccessResponse({
        message: hardDelete ? '사업장이 영구 삭제되었습니다' : '사업장이 삭제되었습니다'
      });

    } catch (error) {
      console.error('❌ [BUSINESS-DELETE] 삭제 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '사업장 삭제에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}