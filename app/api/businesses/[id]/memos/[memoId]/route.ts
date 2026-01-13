// app/api/businesses/[id]/memos/[memoId]/route.ts - 개별 메모 관리 API
import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  updateBusinessMemo,
  deleteBusinessMemo
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// PUT /api/businesses/[id]/memos/[memoId] - 메모 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; memoId: string } }
) {
  try {
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

    const { memoId } = params;
    const updateData = await request.json();

    const memo = await updateBusinessMemo(memoId, {
      title: updateData.title,
      content: updateData.content,
      updated_by: tokenPayload.name || 'Unknown'
    });

    return createSuccessResponse({
      memo: memo,
      message: '메모가 성공적으로 업데이트되었습니다'
    });

  } catch (error) {
    console.error('❌ [MEMO-UPDATE] 업데이트 실패:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '메모 업데이트에 실패했습니다',
      500
    );
  }
}

// DELETE /api/businesses/[id]/memos/[memoId] - 메모 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memoId: string } }
) {
  try {
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

    const { memoId } = params;

    await deleteBusinessMemo(memoId);

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
}