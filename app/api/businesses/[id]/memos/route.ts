// app/api/businesses/[id]/memos/route.ts - 사업장 메모 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  getBusinessMemos,
  createBusinessMemo,
  updateBusinessMemo,
  deleteBusinessMemo
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// GET /api/businesses/[id]/memos - 사업장 메모 목록 조회
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

    const { id: businessId } = params;

    try {
      console.log(`📝 [BUSINESS-MEMOS] 메모 목록 조회: ${businessId}`);

      const memos = await getBusinessMemos(businessId);
      console.log(`✅ [BUSINESS-MEMOS] ${memos.length}개 메모 조회 완료`);

      return createSuccessResponse({
        memos,
        count: memos.length,
        businessId
      });

    } catch (error) {
      console.error('❌ [BUSINESS-MEMOS] 조회 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '메모 조회에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}

// POST /api/businesses/[id]/memos - 새 메모 생성
export async function POST(
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

    const { id: businessId } = params;

    try {
      const memoData = await request.json();
      console.log(`📝 [BUSINESS-MEMO] 메모 생성: ${businessId}`);

      // 필수 필드 검증
      if (!memoData.title) {
        return createErrorResponse('메모 제목은 필수입니다', 400);
      }

      // 메모 데이터 구성
      const newMemoData = {
        business_id: businessId,
        title: memoData.title,
        content: memoData.content || '',
        memo_type: memoData.memo_type || 'general',
        priority: memoData.priority || 1,
        is_important: memoData.is_important || false,
        created_by: tokenPayload.userId
      };

      const newMemo = await createBusinessMemo(newMemoData);
      console.log(`✅ [BUSINESS-MEMO] 메모 생성 완료: ${newMemo.id}`);

      return createSuccessResponse({
        memo: newMemo,
        message: '메모가 성공적으로 생성되었습니다'
      });

    } catch (error) {
      console.error('❌ [BUSINESS-MEMO] 생성 실패:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : '메모 생성에 실패했습니다',
        500
      );
    }
  }, { logLevel: 'info' })();
}