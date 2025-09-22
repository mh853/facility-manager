const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateSchemaAndSetPassword() {
  console.log('🔧 스키마 업데이트 및 비밀번호 설정 시작...');

  try {
    // 1. 스키마 업데이트 - password_hash 컬럼 추가
    console.log('📊 employees 테이블에 password_hash 컬럼 추가...');
    const { error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: `
        -- password_hash 컬럼 추가
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

        -- signup_method 컬럼 추가
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS signup_method VARCHAR(20) DEFAULT 'direct'
        CHECK (signup_method IN ('direct', 'kakao', 'naver', 'google', 'social+direct'));

        -- 약관 동의 컬럼들 추가
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_info_agreed_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS marketing_agreed_at TIMESTAMP WITH TIME ZONE;

        -- is_deleted 컬럼 추가
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        `
      });

    if (schemaError) {
      console.log('⚠️ 스키마 업데이트 시도 (RPC 방식 실패), 직접 업데이트 시도...');

      // RPC가 실패하면 직접 쿼리 실행
      const alterQueries = [
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS signup_method VARCHAR(20) DEFAULT 'direct'",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_info_agreed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS marketing_agreed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false"
      ];

      for (const query of alterQueries) {
        const { error } = await supabase.rpc('exec_sql', { sql: query });
        if (error) {
          console.log(`⚠️ 쿼리 실행 실패: ${query}`);
          console.log('Error:', error.message);
        }
      }
    }

    // 2. munong2@gmail.com 계정 확인
    console.log('👤 munong2@gmail.com 계정 조회...');
    const { data: existingUser, error: userError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', 'munong2@gmail.com')
      .single();

    if (userError) {
      console.log('❌ 사용자 조회 실패:', userError.message);
      return;
    }

    if (!existingUser) {
      console.log('❌ munong2@gmail.com 계정을 찾을 수 없습니다.');
      return;
    }

    console.log('✅ 사용자 정보:', {
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      signup_method: existingUser.signup_method,
      has_password: !!existingUser.password_hash
    });

    // 3. 비밀번호 해싱
    console.log('🔐 비밀번호 해싱 중...');
    const password = '250922';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. 비밀번호 설정
    console.log('💾 비밀번호 설정 중...');
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        password_hash: hashedPassword,
        signup_method: existingUser.signup_method === 'kakao' ? 'social+direct' : 'direct',
        updated_at: new Date().toISOString(),
        is_active: true
      })
      .eq('id', existingUser.id);

    if (updateError) {
      console.log('❌ 비밀번호 설정 실패:', updateError.message);
      return;
    }

    // 5. 업데이트 확인
    const { data: updatedUser, error: checkError } = await supabase
      .from('employees')
      .select('email, name, signup_method, is_active, updated_at')
      .eq('id', existingUser.id)
      .single();

    if (checkError) {
      console.log('❌ 업데이트 확인 실패:', checkError.message);
      return;
    }

    console.log('✅ 비밀번호 설정 완료!');
    console.log('📊 업데이트된 사용자 정보:', {
      email: updatedUser.email,
      name: updatedUser.name,
      signup_method: updatedUser.signup_method,
      is_active: updatedUser.is_active,
      updated_at: updatedUser.updated_at
    });
    console.log('🔑 설정된 비밀번호:', password);
    console.log('🌐 이제 https://facility.blueon-iot.com/login 에서 이메일 로그인이 가능합니다.');

  } catch (error) {
    console.log('❌ 처리 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
updateSchemaAndSetPassword();