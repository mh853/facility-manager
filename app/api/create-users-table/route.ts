import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST() {
  try {
    console.log('🚀 [CREATE-TABLE] users 테이블 생성 시작');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 먼저 기존 테이블 삭제 (있다면)
    console.log('🗑️ [CREATE-TABLE] 기존 테이블 확인 및 정리');

    // users 테이블 생성
    const createUsersTableSQL = `
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        role INTEGER NOT NULL DEFAULT 1,
        department VARCHAR(100),
        position VARCHAR(100),
        phone VARCHAR(20),
        provider VARCHAR(20),
        provider_id VARCHAR(100),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP WITH TIME ZONE,
        email_verified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        CONSTRAINT valid_role CHECK (role IN (1, 2, 3)),
        CONSTRAINT valid_provider CHECK (provider IN ('kakao', 'naver', 'google') OR provider IS NULL)
      );
    `;

    console.log('📝 [CREATE-TABLE] users 테이블 생성 중...');

    // 원시 SQL 실행 - 직접 SQL을 전송
    const { data: createResult, error: createError } = await supabase
      .rpc('exec', { sql: createUsersTableSQL });

    if (createError) {
      console.error('❌ [CREATE-TABLE] users 테이블 생성 실패:', createError);

      // 대안: 직접 테이블 생성 쿼리를 시도
      console.log('🔄 [CREATE-TABLE] 대안 방법으로 테이블 생성 시도');

      // 간단한 insert로 테스트 (테이블이 없으면 자동으로 오류를 반환할 것)
      const { error: testError } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (testError && testError.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'users 테이블이 존재하지 않습니다. Supabase 웹 콘솔에서 직접 스키마를 생성해주세요.',
          createError: createError.message,
          testError: testError.message,
          sqlToExecute: createUsersTableSQL
        });
      }
    } else {
      console.log('✅ [CREATE-TABLE] users 테이블 생성 성공');
    }

    // 인덱스 생성
    const createIndexesSQL = [
      `CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);`,
      `CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider, provider_id);`
    ];

    for (const indexSQL of createIndexesSQL) {
      console.log('📝 [CREATE-TABLE] 인덱스 생성 중:', indexSQL.substring(0, 50) + '...');
      const { error: indexError } = await supabase.rpc('exec', { sql: indexSQL });
      if (indexError) {
        console.warn('⚠️ [CREATE-TABLE] 인덱스 생성 실패:', indexError.message);
      }
    }

    // 기본 사용자 데이터 삽입
    console.log('👤 [CREATE-TABLE] 기본 사용자 데이터 삽입 중...');

    const defaultUsers = [
      {
        id: 'admin-1',
        email: 'admin@facility.blueon-iot.com',
        name: '시스템 관리자',
        role: 3,
        department: 'IT팀',
        provider: 'system',
        is_active: true,
        email_verified_at: new Date().toISOString()
      },
      {
        id: 'user-1',
        email: 'inspector1@facility.blueon-iot.com',
        name: '실사담당자1',
        role: 2,
        department: '환경팀',
        provider: 'system',
        is_active: true,
        email_verified_at: new Date().toISOString()
      },
      {
        id: 'user-2',
        email: 'inspector2@facility.blueon-iot.com',
        name: '실사담당자2',
        role: 1,
        department: '환경팀',
        provider: 'system',
        is_active: true,
        email_verified_at: new Date().toISOString()
      }
    ];

    const insertResults = [];

    for (const user of defaultUsers) {
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .upsert(user, { onConflict: 'email' })
        .select();

      if (insertError) {
        console.error('❌ [CREATE-TABLE] 사용자 삽입 실패:', user.email, insertError);
        insertResults.push({ email: user.email, success: false, error: insertError.message });
      } else {
        console.log('✅ [CREATE-TABLE] 사용자 삽입 성공:', user.email);
        insertResults.push({ email: user.email, success: true, data: insertData });
      }
    }

    // 최종 테스트
    const { data: testUsers, error: testError } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (testError) {
      console.error('❌ [CREATE-TABLE] 최종 테스트 실패:', testError);
      return NextResponse.json({
        success: false,
        error: '테이블은 생성되었으나 데이터 조회에 실패했습니다.',
        testError: testError.message,
        insertResults
      });
    }

    console.log('🎉 [CREATE-TABLE] 모든 작업 완료');

    return NextResponse.json({
      success: true,
      message: 'users 테이블과 기본 데이터가 성공적으로 생성되었습니다.',
      usersCreated: testUsers?.length || 0,
      users: testUsers,
      insertResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CREATE-TABLE] 예외 발생:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    });
  }
}