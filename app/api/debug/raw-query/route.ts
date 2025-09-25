// Raw query API for deep database debugging
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { query_type } = await request.json();

    console.log(`🔍 [DEBUG] Raw query request: ${query_type}`);

    const results: any = {};

    // 1. 테이블 존재 여부 확인
    if (query_type === 'table_exists' || query_type === 'all') {
      try {
        const { data, error } = await supabaseAdmin
          .from('task_notifications')
          .select('count(*)', { count: 'exact' });

        results.table_exists = {
          exists: !error,
          error: error?.message || null,
          method: 'count_query'
        };
      } catch (e: any) {
        results.table_exists = {
          exists: false,
          error: e.message,
          method: 'count_query'
        };
      }
    }

    // 2. 실제 데이터 조회 테스트
    if (query_type === 'data_access' || query_type === 'all') {
      try {
        const { data, error, count } = await supabaseAdmin
          .from('task_notifications')
          .select('*', { count: 'exact' })
          .limit(10);

        results.data_access = {
          success: !error,
          error: error?.message || null,
          count: count,
          sample_data: data || [],
          data_length: data?.length || 0
        };
      } catch (e: any) {
        results.data_access = {
          success: false,
          error: e.message,
          count: 0,
          sample_data: [],
          data_length: 0
        };
      }
    }

    // 3. 특정 사용자 ID로 필터링 테스트
    if (query_type === 'user_filter' || query_type === 'all') {
      // 실제 존재하는 사용자 ID 찾기
      try {
        const { data: users, error: usersError } = await supabaseAdmin
          .from('employees')
          .select('id, name')
          .eq('is_active', true)
          .limit(1);

        if (!usersError && users && users.length > 0) {
          const testUserId = users[0].id;

          const { data: userNotifications, error: userError } = await supabaseAdmin
            .from('task_notifications')
            .select('*')
            .eq('user_id', testUserId)
            .limit(5);

          results.user_filter = {
            test_user_id: testUserId,
            test_user_name: users[0].name,
            success: !userError,
            error: userError?.message || null,
            user_notifications: userNotifications || [],
            count: userNotifications?.length || 0
          };
        } else {
          results.user_filter = {
            error: 'No active employees found for testing',
            employees_error: usersError?.message || null
          };
        }
      } catch (e: any) {
        results.user_filter = {
          error: e.message,
          test_failed: true
        };
      }
    }

    // 4. Supabase 클라이언트 설정 확인
    if (query_type === 'client_config' || query_type === 'all') {
      results.client_config = {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
        service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
        anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'missing',
        environment: process.env.NODE_ENV || 'unknown'
      };
    }

    return NextResponse.json({
      success: true,
      query_type: query_type,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Raw query error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}