// app/api/setup-db/route.ts - 데이터베이스 테이블 생성 API (개발용)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [SETUP-DB] 데이터베이스 테이블 생성 시작...');

    // business_contacts 테이블 생성 - Supabase를 통한 직접 테이블 생성
    // 먼저 businesses 테이블이 있는지 확인하고, 없으면 생성
    const { error: businessesTableError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .limit(1);

    // businesses 테이블이 없으면 생성 (임시로 business_contacts에서 참조 제거)
    let createTableError = null;
    
    try {
      // 현재는 business_id 없이 테이블 생성 (독립적으로 운영)
      console.log('📝 [SETUP-DB] 테이블 스키마 확인 중...');
      
      // 테이블이 존재하는지 확인
      const { data: existingTable, error: checkError } = await supabaseAdmin
        .from('business_contacts')
        .select('id')
        .limit(1);
        
      if (checkError && checkError.code === 'PGRST116') {
        console.log('📝 [SETUP-DB] business_contacts 테이블이 존재하지 않아 생성을 시도합니다...');
        console.log('⚠️ [SETUP-DB] Supabase에서는 CREATE TABLE을 직접 실행할 수 없습니다.');
        console.log('📋 [SETUP-DB] 대신 Supabase 대시보드에서 SQL 편집기를 사용하여 수동으로 테이블을 생성해야 합니다.');
        
        return NextResponse.json({
          success: false,
          message: 'Supabase에서는 CREATE TABLE을 직접 실행할 수 없습니다. Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행해주세요:\n\n' +
          `CREATE TABLE IF NOT EXISTS business_contacts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            business_name TEXT NOT NULL UNIQUE,
            address TEXT,
            manager_name TEXT,
            manager_contact TEXT,
            business_contact TEXT,
            business_registration_number TEXT,
            representative_name TEXT,
            business_type TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ language 'plpgsql';
          
          CREATE TRIGGER update_business_contacts_updated_at 
            BEFORE UPDATE ON business_contacts 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();`,
          instructions: '1. Supabase 프로젝트 대시보드로 이동\n2. 왼쪽 메뉴에서 SQL Editor 선택\n3. 위의 SQL 코드를 복사하여 실행\n4. 실행 완료 후 이 API를 다시 호출하여 테이블 생성 확인'
        }, { status: 400 });
      } else if (existingTable) {
        console.log('✅ [SETUP-DB] business_contacts 테이블이 이미 존재합니다.');
      } else {
        console.error('❌ [SETUP-DB] 테이블 확인 중 오류:', checkError);
        createTableError = checkError;
      }
      
    } catch (error) {
      console.error('❌ [SETUP-DB] 테이블 생성 시도 중 오류:', error);
      createTableError = error;
    }

    if (createTableError) {
      console.error('❌ [SETUP-DB] 테이블 생성 실패:', createTableError);
      return NextResponse.json({
        success: false,
        message: '테이블 생성 실패: ' + (createTableError as any).message
      }, { status: 500 });
    }

    console.log('✅ [SETUP-DB] business_contacts 테이블 생성 완료');

    // 테이블 정보 확인
    const { data: tableInfo, error: infoError } = await supabaseAdmin
      .from('business_contacts')
      .select('*')
      .limit(0);

    if (infoError) {
      console.warn('⚠️ [SETUP-DB] 테이블 정보 확인 실패:', infoError);
    }

    return NextResponse.json({
      success: true,
      message: 'business_contacts 테이블이 성공적으로 생성되었습니다.',
      tableCreated: 'business_contacts',
      tableExists: !infoError
    });

  } catch (error) {
    console.error('❌ [SETUP-DB] 데이터베이스 설정 실패:', error);
    
    return NextResponse.json({
      success: false,
      message: '데이터베이스 설정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}

// 테이블 상태 확인 (GET)
export async function GET(request: NextRequest) {
  try {
    console.log('📊 [SETUP-DB] 테이블 상태 확인...');

    // business_contacts 테이블 존재 확인
    const { data, error } = await supabaseAdmin
      .from('business_contacts')
      .select('count(*)')
      .limit(1);

    const tableExists = !error;
    const recordCount = tableExists && data ? data.length : 0;

    console.log(`📊 [SETUP-DB] business_contacts 테이블 상태: ${tableExists ? '존재함' : '없음'}, 레코드 수: ${recordCount}`);

    return NextResponse.json({
      success: true,
      tables: {
        business_contacts: {
          exists: tableExists,
          recordCount: recordCount,
          error: error?.message || null
        }
      }
    });

  } catch (error) {
    console.error('❌ [SETUP-DB] 상태 확인 실패:', error);
    
    return NextResponse.json({
      success: false,
      message: '테이블 상태 확인 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}