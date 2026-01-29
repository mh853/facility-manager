/**
 * Business ID 마이그레이션 API
 *
 * GET /api/migrate-business-id?action=preview - 마이그레이션 미리보기
 * POST /api/migrate-business-id - 실제 마이그레이션 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, query } from '@/lib/supabase-direct';

// 성공 응답 생성
function createSuccessResponse(data: any, message: string = 'Success') {
  return NextResponse.json({
    success: true,
    message,
    data
  });
}

// 오류 응답 생성
function createErrorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
      data: null
    },
    { status }
  );
}

/**
 * GET - 마이그레이션 미리보기
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action !== 'preview') {
      return createErrorResponse('Invalid action. Use action=preview', 400);
    }

    // 1. 현재 상태 확인
    const stats = await queryOne(`
      SELECT
        COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END)::int as with_business_id,
        COUNT(CASE WHEN business_id IS NULL THEN 1 END)::int as without_business_id,
        COUNT(*)::int as total
      FROM facility_tasks
      WHERE is_deleted = FALSE
    `);

    // 2. 매핑 미리보기
    const preview = await queryAll(`
      SELECT
        ft.id as task_id,
        ft.title,
        ft.business_name,
        ft.business_id as current_business_id,
        bi.id as resolved_business_id,
        bi.business_name as resolved_business_name
      FROM facility_tasks ft
      LEFT JOIN business_info bi ON ft.business_name = bi.business_name
        AND bi.is_active = TRUE
        AND bi.is_deleted = FALSE
      WHERE ft.business_id IS NULL
        AND ft.is_deleted = FALSE
      ORDER BY ft.created_at DESC
      LIMIT 50
    `);

    const canMap = preview.filter((p: any) => p.resolved_business_id).length;
    const cannotMap = preview.filter((p: any) => !p.resolved_business_id).length;

    return createSuccessResponse({
      stats,
      preview: {
        total: preview.length,
        canMap,
        cannotMap,
        items: preview
      }
    }, 'Preview loaded successfully');

  } catch (error: any) {
    console.error('❌ [MIGRATE-BUSINESS-ID] Preview failed:', error);
    return createErrorResponse(error?.message || 'Failed to load preview', 500);
  }
}

/**
 * POST - 실제 마이그레이션 실행
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [MIGRATE-BUSINESS-ID] Starting migration...');

    // 1. 업데이트 전 통계
    const beforeStats = await queryOne(`
      SELECT
        COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END)::int as with_business_id,
        COUNT(CASE WHEN business_id IS NULL THEN 1 END)::int as without_business_id,
        COUNT(*)::int as total
      FROM facility_tasks
      WHERE is_deleted = FALSE
    `);

    console.log('📊 [MIGRATE-BUSINESS-ID] Before migration:', beforeStats);

    if (beforeStats.without_business_id === 0) {
      return createSuccessResponse({
        message: '모든 업무에 business_id가 이미 설정되어 있습니다.',
        stats: beforeStats,
        updated: 0
      });
    }

    // 2. 실제 업데이트 실행
    const updateResult = await query(`
      UPDATE facility_tasks ft
      SET
        business_id = bi.id,
        updated_at = NOW(),
        last_modified_by_name = 'system_migration'
      FROM business_info bi
      WHERE ft.business_name = bi.business_name
        AND bi.is_active = TRUE
        AND bi.is_deleted = FALSE
        AND ft.business_id IS NULL
        AND ft.is_deleted = FALSE
    `);

    const updatedCount = updateResult.rowCount || 0;
    console.log(`✅ [MIGRATE-BUSINESS-ID] Updated ${updatedCount} tasks`);

    // 3. 업데이트 후 통계
    const afterStats = await queryOne(`
      SELECT
        COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END)::int as with_business_id,
        COUNT(CASE WHEN business_id IS NULL THEN 1 END)::int as without_business_id,
        COUNT(*)::int as total
      FROM facility_tasks
      WHERE is_deleted = FALSE
    `);

    console.log('📊 [MIGRATE-BUSINESS-ID] After migration:', afterStats);

    // 4. 매핑 실패한 업무 확인
    const unmapped = await queryAll(`
      SELECT
        ft.id,
        ft.title,
        ft.business_name,
        ft.created_at
      FROM facility_tasks ft
      LEFT JOIN business_info bi ON ft.business_name = bi.business_name
        AND bi.is_active = TRUE
        AND bi.is_deleted = FALSE
      WHERE ft.business_id IS NULL
        AND ft.is_deleted = FALSE
        AND bi.id IS NULL
      ORDER BY ft.created_at DESC
    `);

    return createSuccessResponse({
      message: `마이그레이션 완료: ${updatedCount}개 업무 업데이트`,
      beforeStats,
      afterStats,
      updated: updatedCount,
      unmapped: unmapped.length > 0 ? unmapped : null
    });

  } catch (error: any) {
    console.error('❌ [MIGRATE-BUSINESS-ID] Migration failed:', error);
    return createErrorResponse(error?.message || 'Migration failed', 500);
  }
}
