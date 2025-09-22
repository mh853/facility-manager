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

async function setMunong2Password() {
  console.log('🔐 munong2@gmail.com 계정에 비밀번호 설정 시작...');

  try {
    // 1. 계정 조회
    console.log('👤 munong2@gmail.com 계정 조회...');
    const { data: user, error: userError } = await supabase
      .from('employees')
      .select('id, name, email, is_active, provider, signup_method, password_hash')
      .eq('email', 'munong2@gmail.com')
      .single();

    if (userError) {
      console.log('❌ 사용자 조회 실패:', userError.message);
      return;
    }

    if (!user) {
      console.log('❌ munong2@gmail.com 계정을 찾을 수 없습니다.');
      return;
    }

    console.log('✅ 사용자 정보:', {
      id: user.id,
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      provider: user.provider || 'null',
      signup_method: user.signup_method || 'null',
      has_password: !!user.password_hash
    });

    // 2. 비밀번호 해싱
    const password = '250922';
    console.log('🔐 비밀번호 해싱 중...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ 비밀번호 해시 생성 완료');

    // 3. signup_method 결정
    let newSignupMethod = 'direct';
    if (user.provider && user.provider !== 'system') {
      newSignupMethod = 'social+direct'; // 하이브리드 계정
      console.log('🔄 하이브리드 계정으로 설정 (social+direct)');
    } else {
      console.log('📧 일반 이메일 계정으로 설정 (direct)');
    }

    // 4. 비밀번호 및 관련 정보 업데이트
    console.log('💾 비밀번호 설정 중...');
    const updateData = {
      password_hash: hashedPassword,
      signup_method: newSignupMethod,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    // 약관 동의 정보 설정 (기본값)
    const agreementTime = new Date().toISOString();
    updateData.terms_agreed_at = agreementTime;
    updateData.privacy_agreed_at = agreementTime;
    updateData.personal_info_agreed_at = agreementTime;

    const { error: updateError } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.log('❌ 비밀번호 설정 실패:', updateError.message);
      console.log('📋 사용 가능한 컬럼 확인이 필요할 수 있습니다.');

      // 기본적인 업데이트만 시도
      console.log('🔄 기본 업데이트 시도...');
      const basicUpdate = {
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      };

      const { error: basicError } = await supabase
        .from('employees')
        .update(basicUpdate)
        .eq('id', user.id);

      if (basicError) {
        console.log('❌ 기본 업데이트도 실패:', basicError.message);
        return;
      } else {
        console.log('✅ 기본 비밀번호 설정 완료 (password_hash만)');
      }
    } else {
      console.log('✅ 전체 비밀번호 설정 완료');
    }

    // 5. 업데이트 확인
    const { data: updatedUser, error: checkError } = await supabase
      .from('employees')
      .select('email, name, signup_method, is_active, updated_at')
      .eq('id', user.id)
      .single();

    if (checkError) {
      console.log('❌ 업데이트 확인 실패:', checkError.message);
    } else {
      console.log('✅ 최종 확인 완료!');
      console.log('📊 업데이트된 사용자 정보:', {
        email: updatedUser.email,
        name: updatedUser.name,
        signup_method: updatedUser.signup_method || 'null',
        is_active: updatedUser.is_active,
        updated_at: updatedUser.updated_at
      });
    }

    console.log('');
    console.log('🎉 비밀번호 설정 완료!');
    console.log('📧 이메일: munong2@gmail.com');
    console.log('🔑 비밀번호: 250922');
    console.log('');
    console.log('🌐 이제 다음 URL에서 이메일 로그인이 가능합니다:');
    console.log('   https://facility.blueon-iot.com/login');
    console.log('   http://localhost:3000/login');
    console.log('');
    console.log('ℹ️  기존 소셜 로그인(카카오)도 계속 사용 가능합니다.');

  } catch (error) {
    console.log('❌ 처리 중 오류 발생:', error.message);
    console.log('스택 트레이스:', error.stack);
  }
}

// 스크립트 실행
setMunong2Password();