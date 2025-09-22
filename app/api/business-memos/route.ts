// app/api/business-memos/route.ts - Business Memos CRUD API
import { NextRequest } from 'next/server'
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
import type { BusinessMemo, CreateBusinessMemoInput, UpdateBusinessMemoInput } from '@/types/database'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// GET - 특정 사업장의 모든 메모 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const businessName = searchParams.get('businessName')

    if (!businessId && !businessName) {
      return createErrorResponse('사업장 ID 또는 사업장명이 필요합니다.', 400);
    }

    console.log(`🔍 [BUSINESS-MEMOS] 사업장 메모 조회 시작 - businessId: ${businessId}, businessName: ${businessName}`)

    let finalBusinessId = businessId;

    // businessName이 제공된 경우 businessId로 변환
    if (!businessId && businessName) {
      console.log(`🔍 [BUSINESS-MEMOS] businessName으로 business_id 조회: ${businessName}`)

      const { data: businessInfo, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('id, business_name')
        .eq('business_name', businessName)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .single();

      console.log(`🔍 [BUSINESS-MEMOS] business_info 조회 결과:`, { businessInfo, businessError })

      if (businessError || !businessInfo) {
        console.log(`⚠️ [BUSINESS-MEMOS] 사업장을 찾을 수 없음: ${businessName}`, businessError);
        // 빈 결과 반환 (에러가 아닌)
        return createSuccessResponse({
          data: [],
          metadata: {
            businessId: null,
            businessName,
            count: 0
          }
        });
      }

      finalBusinessId = businessInfo.id;
      console.log(`✅ [BUSINESS-MEMOS] businessName → businessId 변환: ${businessName} → ${finalBusinessId}`)
    }

    const { data: memos, error } = await supabaseAdmin
      .from('business_memos')
      .select('*')
      .eq('business_id', finalBusinessId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 조회 실패:', error)
      throw error;
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 조회 완료 - ${memos?.length || 0}개`)
    console.log(`🔍 [BUSINESS-MEMOS] 조회된 메모 데이터:`, memos?.map(m => ({
      id: m.id,
      title: m.title,
      content: m.content,
      titleLength: m.title?.length,
      contentLength: m.content?.length
    })))

    return createSuccessResponse({
      data: memos || [],
      metadata: {
        businessId,
        businessName,
        count: memos?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] GET 요청 처리 오류:', error)
    return createErrorResponse('서버 오류가 발생했습니다.', 500);
  }
}, { logLevel: 'debug' });

// POST - 새 메모 추가
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json()

    console.log(`🔍 [BUSINESS-MEMOS] POST 요청 데이터:`, {
      business_id: body.business_id,
      business_name: body.business_name,
      title: body.title,
      content: body.content,
      titleLength: body.title?.length,
      contentLength: body.content?.length
    })

    if ((!body.business_id && !body.business_name) || !body.title?.trim() || !body.content?.trim()) {
      return createErrorResponse('사업장 ID 또는 사업장명, 제목, 내용은 필수 입력사항입니다.', 400);
    }

    console.log(`📝 [BUSINESS-MEMOS] 새 메모 추가 - businessId: ${body.business_id}, businessName: ${body.business_name}`)

    let finalBusinessId = body.business_id;

    // business_name이 제공된 경우 business_id로 변환
    if (!body.business_id && body.business_name) {
      console.log(`🔍 [BUSINESS-MEMOS] POST - businessName으로 business_id 조회: ${body.business_name}`)

      const { data: businessInfo, error: businessError } = await supabaseAdmin
        .from('business_info')
        .select('id, business_name')
        .eq('business_name', body.business_name)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .single();

      console.log(`🔍 [BUSINESS-MEMOS] POST - business_info 조회 결과:`, { businessInfo, businessError })

      if (businessError || !businessInfo) {
        console.error(`❌ [BUSINESS-MEMOS] POST - 사업장을 찾을 수 없음: ${body.business_name}`, businessError);
        return createErrorResponse(`사업장을 찾을 수 없습니다: ${body.business_name}`, 404);
      }

      finalBusinessId = businessInfo.id;
      console.log(`✅ [BUSINESS-MEMOS] POST - businessName → businessId 변환: ${body.business_name} → ${finalBusinessId}`)
    }

    const memoData = {
      business_id: finalBusinessId,
      title: body.title.trim(),
      content: body.content.trim(),
      created_by: body.created_by || '관리자',
      updated_by: body.created_by || '관리자'
    }

    const { data: newMemo, error } = await supabaseAdmin
      .from('business_memos')
      .insert(memoData)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 추가 실패:', error)
      throw error;
    }

    console.log(`✅ [BUSINESS-MEMOS] 새 메모 추가 완료 - ID: ${newMemo.id}`)

    return createSuccessResponse({
      data: newMemo,
      message: '메모가 성공적으로 추가되었습니다.'
    });

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] POST 요청 처리 오류:', error)
    return createErrorResponse('서버 오류가 발생했습니다.', 500);
  }
}, { logLevel: 'debug' });

// PUT - 기존 메모 수정
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const memoId = searchParams.get('id')

    if (!memoId) {
      return createErrorResponse('메모 ID가 필요합니다.', 400);
    }

    const body: UpdateBusinessMemoInput = await request.json()

    if (!body.title?.trim() && !body.content?.trim()) {
      return createErrorResponse('제목 또는 내용 중 하나는 필수입니다.', 400);
    }

    console.log(`📝 [BUSINESS-MEMOS] 메모 수정 - ID: ${memoId}`)

    const updateData: any = {
      updated_by: body.updated_by || '관리자'
    }

    if (body.title?.trim()) {
      updateData.title = body.title.trim()
    }

    if (body.content?.trim()) {
      updateData.content = body.content.trim()
    }

    const { data: updatedMemo, error } = await supabaseAdmin
      .from('business_memos')
      .update(updateData)
      .eq('id', memoId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 수정 실패:', error)
      throw error;
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 수정 완료 - ID: ${memoId}`)

    return createSuccessResponse({
      data: updatedMemo,
      message: '메모가 성공적으로 수정되었습니다.'
    });

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] PUT 요청 처리 오류:', error)
    return createErrorResponse('서버 오류가 발생했습니다.', 500);
  }
}, { logLevel: 'debug' });

// DELETE - 메모 소프트 삭제
export const DELETE = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const memoId = searchParams.get('id')

    if (!memoId) {
      return createErrorResponse('메모 ID가 필요합니다.', 400);
    }

    console.log(`🗑️ [BUSINESS-MEMOS] 메모 삭제 - ID: ${memoId}`)

    // 메모 정보 조회 (자동 메모인지 확인)
    const { data: memoInfo, error: memoError } = await supabaseAdmin
      .from('business_memos')
      .select('id, title, business_id')
      .eq('id', memoId)
      .eq('is_deleted', false)
      .single();

    if (memoError || !memoInfo) {
      console.error(`❌ [BUSINESS-MEMOS] 메모 조회 실패: ${memoId}`, memoError);
      return createErrorResponse('메모를 찾을 수 없습니다.', 404);
    }

    // 자동 메모인 경우 슈퍼 관리자 권한 확인 필요
    const isAutoMemo = memoInfo.title?.startsWith('[자동]');
    if (isAutoMemo) {
      // 여기서 실제 사용자 권한을 확인해야 하지만, 현재는 임시로 통과
      // TODO: JWT 토큰에서 사용자 권한 추출하여 권한 4(슈퍼 관리자) 확인
      console.log(`⚠️ [BUSINESS-MEMOS] 자동 메모 삭제 시도 - 권한 확인 필요: ${memoId}`);
    }

    const { data: deletedMemo, error } = await supabaseAdmin
      .from('business_memos')
      .update({
        is_deleted: true,
        updated_by: '관리자' // 향후 계정 시스템에서 실제 사용자로 변경
      })
      .eq('id', memoId)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 삭제 실패:', error)
      throw error;
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 삭제 완료 - ID: ${memoId}`)

    // 자동 메모 삭제 로그 기록 (슈퍼 관리자 전용 기능에 대한 감사 로그)
    if (isAutoMemo) {
      try {
        // 사업장 정보 조회
        const { data: businessInfo } = await supabaseAdmin
          .from('business_info')
          .select('business_name')
          .eq('id', memoInfo.business_id)
          .single();

        // 삭제 로그 기록
        await supabaseAdmin
          .from('auto_memo_deletion_logs')
          .insert({
            memo_id: memoId,
            memo_title: memoInfo.title,
            business_name: businessInfo?.business_name || '알 수 없음',
            deleted_by: '시스템', // TODO: 실제 사용자 ID로 변경
            ip_address: request.headers.get('x-forwarded-for') ||
                       request.headers.get('x-real-ip') ||
                       '127.0.0.1'
          });

        console.log(`📝 [BUSINESS-MEMOS] 자동 메모 삭제 로그 기록 완료 - ${memoInfo.title}`);
      } catch (logError) {
        console.error(`❌ [BUSINESS-MEMOS] 삭제 로그 기록 실패:`, logError);
        // 로그 기록 실패는 메모 삭제 성공에 영향을 주지 않음
      }
    }

    return createSuccessResponse({
      data: deletedMemo,
      message: '메모가 성공적으로 삭제되었습니다.'
    });

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] DELETE 요청 처리 오류:', error)
    return createErrorResponse('서버 오류가 발생했습니다.', 500);
  }
}, { logLevel: 'debug' });