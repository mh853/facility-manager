// app/api/businesses/[id]/memos/[memoId]/route.ts - 개별 메모 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  updateBusinessMemo,
  deleteBusinessMemo
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// PUT /api/businesses/[id]/memos/[memoId] - 메모 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; memoId: string } }
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

    const { id: businessId, memoId } = params;

    try {
      const updateData = await request.json();
      console.log(`📝 [MEMO-UPDATE] 메모 업데이트: ${memoId}`);

      // 업데이트자 정보 추가
      updateData.updated_by = tokenPayload.userId;

      const updatedMemo = await updateBusinessMemo(memoId, updateData);
      console.log(`✅ [MEMO-UPDATE] 업데이트 완료: ${updatedMemo.title}`);

      return createSuccessResponse({
        memo: updatedMemo,
        message: '메모가 성공적으로 업데이트되었습니다'
      });

    } catch (error) {
      console.error('❌ [MEMO-UPDATE] 업데이트 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '메모 업데이트에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}

// DELETE /api/businesses/[id]/memos/[memoId] - 메모 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memoId: string } }
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

    const { id: businessId, memoId } = params;

    try {
      console.log(`🗑️ [MEMO-DELETE] 메모 삭제: ${memoId}`);

      await deleteBusinessMemo(memoId);
      console.log('✅ [MEMO-DELETE] 삭제 완료');

      return createSuccessResponse({
        message: '메모가 성공적으로 삭제되었습니다'
      });

    } catch (error) {
      console.error('❌ [MEMO-DELETE] 삭제 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '메모 삭제에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}