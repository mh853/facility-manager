// app/api/setup-memos-table/route.ts - Business memos table setup
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔗 business_memos 테이블 설정 시작...');
    
    // 1. business_memos 테이블 생성
    console.log('1. business_memos 테이블 생성...');
    
    // Try direct table creation using raw SQL if possible
    console.log('직접 테이블 생성 시도...');
    
    // First check if table exists by attempting a simple query
    const { error: tableExistsCheck } = await supabaseAdmin
      .from('business_memos')
      .select('id')
      .limit(1);

    if (!tableExistsCheck) {
      console.log('✅ business_memos 테이블이 이미 존재합니다.');
    } else if (tableExistsCheck.message.includes('table') && tableExistsCheck.message.includes('not')) {
      // Table doesn't exist, need to create it
      throw new Error(`
        business_memos 테이블이 존재하지 않습니다. 
        
        다음 중 하나의 방법으로 테이블을 생성해주세요:
        
        1. Supabase 대시보드에서 SQL Editor로 접속
        2. 다음 SQL을 실행:
        
        CREATE TABLE IF NOT EXISTS business_memos (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by VARCHAR(100) DEFAULT '관리자',
          updated_by VARCHAR(100) DEFAULT '관리자',
          is_active BOOLEAN DEFAULT true,
          is_deleted BOOLEAN DEFAULT false,
          CONSTRAINT check_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
          CONSTRAINT check_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
        );
        
        CREATE INDEX IF NOT EXISTS idx_business_memos_business_id ON business_memos(business_id);
        CREATE INDEX IF NOT EXISTS idx_business_memos_created_at ON business_memos(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_business_memos_active ON business_memos(is_active, is_deleted);
        
        ALTER TABLE business_memos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Enable all access for business_memos" ON business_memos
          FOR ALL USING (true);
      `);
    } else {
      throw tableExistsCheck;
    }

    // 2. 테이블 확인
    console.log('2. 테이블 확인...');
    
    const { data: testData, error: testError } = await supabaseAdmin
      .from('business_memos')
      .select('id')
      .limit(1);

    if (testError) {
      console.log('테이블 확인 실패:', testError.message);
      throw new Error('business_memos 테이블 확인 실패: ' + testError.message);
    }

    console.log('✅ business_memos 테이블이 정상적으로 생성되었습니다.');

    return NextResponse.json({
      success: true,
      message: 'business_memos 테이블 설정 완료',
      data: {
        tableExists: true,
        message: '테이블이 성공적으로 생성되고 설정되었습니다.'
      }
    });

  } catch (error) {
    console.error('❌ 테이블 설정 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'business_memos 테이블 설정 중 오류 발생: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // business_memos 테이블 상태 확인
    const { data: memoData, error: memoError } = await supabaseAdmin
      .from('business_memos')
      .select('*')
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        tableExists: !memoError,
        memoCount: memoData?.length || 0,
        sampleMemos: memoData?.slice(0, 2)
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '상태 확인 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}