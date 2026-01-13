// app/api/businesses/[id]/memos/route.ts - 사업장별 메모 관리 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import {
  getBusinessMemos,
  createBusinessMemo
} from '@/lib/supabase-business';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// GET /api/businesses/[id]/memos - 사업장 메모 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: businessId } = params;
    const memos = await getBusinessMemos(businessId);

    return createSuccessResponse({
      memos: memos,
      count: memos?.length || 0
    });

  } catch (error) {
    console.error('❌ [MEMOS-GET] 조회 실패:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '메모 조회에 실패했습니다',
      500
    );
  }
}

// POST /api/businesses/[id]/memos - 새 메모 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: businessId } = params;
    const memoData = await request.json();

    const createInput = {
      business_id: businessId,
      title: memoData.title,
      content: memoData.content,
      created_by: tokenPayload.name || 'Unknown'
    };

    const memo = await createBusinessMemo(createInput);

    return createSuccessResponse({
      memo: memo,
      message: '메모가 성공적으로 생성되었습니다'
    });

  } catch (error) {
    console.error('❌ [MEMOS-POST] 생성 실패:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '메모 생성에 실패했습니다',
      500
    );
  }
}