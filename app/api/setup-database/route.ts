// app/api/setup-database/route.ts - 데이터베이스 설정 및 샘플 데이터 삽입
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST() {
  try {
    console.log('🔗 데이터베이스 설정 시작...');
    
    // 1. 테이블 생성 (존재하지 않는 경우)
    console.log('1. 테이블 생성...');
    
    try {
      // 배출시설 테이블 생성
      const { error: createDischargeError } = await supabaseAdmin
        .rpc('create_table_if_not_exists', {
          table_sql: `
            CREATE TABLE IF NOT EXISTS discharge_facilities (
              id BIGSERIAL PRIMARY KEY,
              business_name TEXT NOT NULL,
              outlet_number INTEGER NOT NULL,
              facility_number INTEGER NOT NULL,
              facility_name TEXT NOT NULL,
              capacity TEXT,
              quantity INTEGER DEFAULT 1,
              notes TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
            );
          `
        });

      // 방지시설 테이블 생성
      const { error: createPreventionError } = await supabaseAdmin
        .rpc('create_table_if_not_exists', {
          table_sql: `
            CREATE TABLE IF NOT EXISTS prevention_facilities (
              id BIGSERIAL PRIMARY KEY,
              business_name TEXT NOT NULL,
              outlet_number INTEGER NOT NULL,
              facility_number INTEGER NOT NULL,
              facility_name TEXT NOT NULL,
              capacity TEXT,
              quantity INTEGER DEFAULT 1,
              notes TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
            );
          `
        });

      if (createDischargeError) console.log('배출시설 테이블 생성 시도:', createDischargeError.message);
      if (createPreventionError) console.log('방지시설 테이블 생성 시도:', createPreventionError.message);
    } catch (rpcError) {
      console.log('RPC 함수를 사용할 수 없습니다. SQL 직접 실행을 시도합니다.');
    }

    // 2. 기존 데이터 확인
    console.log('2. 기존 데이터 확인...');
    
    const { data: dischargeData, error: dischargeError } = await supabaseAdmin
      .from('discharge_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)');

    const { data: preventionData, error: preventionError } = await supabaseAdmin
      .from('prevention_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)');

    if (dischargeError) {
      console.log('배출시설 테이블이 존재하지 않습니다:', dischargeError.message);
      throw new Error('배출시설 테이블을 생성할 수 없습니다. Supabase 대시보드에서 수동으로 테이블을 생성해주세요.');
    }

    if (preventionError) {
      console.log('방지시설 테이블이 존재하지 않습니다:', preventionError.message);
      throw new Error('방지시설 테이블을 생성할 수 없습니다. Supabase 대시보드에서 수동으로 테이블을 생성해주세요.');
    }

    console.log('기존 배출시설:', dischargeData?.length || 0, '개');
    console.log('기존 방지시설:', preventionData?.length || 0, '개');

    // 2. 샘플 데이터 삽입 (데이터가 없는 경우에만)
    let insertedDischarge = 0;
    let insertedPrevention = 0;

    if (!dischargeData || dischargeData.length === 0) {
      console.log('2. 배출시설 샘플 데이터 삽입...');
      
      const dischargeSampleData = [
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 1, facility_name: '펠릿제조기', capacity: '100kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 2, facility_name: '건조기', capacity: '200kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 3, facility_name: '냉각기', capacity: '150kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 4, facility_name: '선별기', capacity: '80kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 5, facility_name: '포장기', capacity: '50kg/h', quantity: 2 },
        { business_name: '(주)조양(전체)', outlet_number: 2, facility_number: 1, facility_name: '압출성형기', capacity: '180kg/h', quantity: 2 },
        { business_name: '(주)조양(전체)', outlet_number: 2, facility_number: 2, facility_name: '혼합기', capacity: '220kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 2, facility_number: 3, facility_name: '분쇄기', capacity: '90kg/h', quantity: 3 },
        { business_name: '(주)조양(전체)', outlet_number: 3, facility_number: 1, facility_name: '세척기', capacity: '120kg/h', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 3, facility_number: 2, facility_name: '탈수기', capacity: '100kg/h', quantity: 2 },
        { business_name: '(주)조양(전체)', outlet_number: 3, facility_number: 3, facility_name: '건조기', capacity: '150kg/h', quantity: 1 },
      ];

      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('discharge_facilities')
        .insert(dischargeSampleData)
        .select();

      if (insertError) {
        console.error('배출시설 삽입 실패:', insertError);
        throw insertError;
      }
      
      insertedDischarge = insertResult?.length || 0;
      console.log(`배출시설 ${insertedDischarge}개 삽입 완료`);
    }

    if (!preventionData || preventionData.length === 0) {
      console.log('3. 방지시설 샘플 데이터 삽입...');
      
      const preventionSampleData = [
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 1, facility_name: '사이클론 집진기', capacity: '1000㎥/min', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 1, facility_number: 2, facility_name: '백필터 집진기', capacity: '800㎥/min', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 2, facility_number: 1, facility_name: '습식 집진기', capacity: '600㎥/min', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 2, facility_number: 2, facility_name: '활성탄 흡착탑', capacity: '500㎥/min', quantity: 1 },
        { business_name: '(주)조양(전체)', outlet_number: 3, facility_number: 1, facility_name: '전기집진기', capacity: '700㎥/min', quantity: 2 },
      ];

      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('prevention_facilities')
        .insert(preventionSampleData)
        .select();

      if (insertError) {
        console.error('방지시설 삽입 실패:', insertError);
        throw insertError;
      }
      
      insertedPrevention = insertResult?.length || 0;
      console.log(`방지시설 ${insertedPrevention}개 삽입 완료`);
    }

    // 4. 최종 데이터 확인
    const { data: finalDischarge } = await supabaseAdmin
      .from('discharge_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)')
      .order('outlet_number')
      .order('facility_number');

    const { data: finalPrevention } = await supabaseAdmin
      .from('prevention_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)')
      .order('outlet_number')
      .order('facility_number');

    console.log('🎉 데이터베이스 설정 완료!');

    return NextResponse.json({
      success: true,
      message: '데이터베이스 설정 완료',
      data: {
        existingDischarge: dischargeData?.length || 0,
        existingPrevention: preventionData?.length || 0,
        insertedDischarge,
        insertedPrevention,
        finalDischarge: finalDischarge?.length || 0,
        finalPrevention: finalPrevention?.length || 0,
        sampleData: {
          discharge: finalDischarge?.slice(0, 3),
          prevention: finalPrevention?.slice(0, 2)
        }
      }
    });

  } catch (error) {
    console.error('❌ 데이터베이스 설정 실패:', error);
    return NextResponse.json({
      success: false,
      message: '데이터베이스 설정 중 오류 발생: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // 현재 상태 확인
    const { data: dischargeData } = await supabaseAdmin
      .from('discharge_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)');

    const { data: preventionData } = await supabaseAdmin
      .from('prevention_facilities')
      .select('*')
      .eq('business_name', '(주)조양(전체)');

    return NextResponse.json({
      success: true,
      data: {
        dischargeCount: dischargeData?.length || 0,
        preventionCount: preventionData?.length || 0,
        sampleDischarge: dischargeData?.slice(0, 2),
        samplePrevention: preventionData?.slice(0, 2)
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '상태 확인 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}