// app/api/migrate-schema/route.ts - 데이터베이스 스키마 마이그레이션 API
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [MIGRATION] 데이터베이스 스키마 마이그레이션 시작...');

    const { supabaseAdmin } = await import('@/lib/supabase');

    // 1. 현재 스키마 구조 확인
    console.log('🔍 [MIGRATION] 현재 스키마 구조 확인...');
    
    // negotiation 컬럼 추가 시도
    console.log('📊 [MIGRATION] negotiation 컬럼 추가...');
    const { data, error } = await supabaseAdmin
      .from('business_info')
      .select('id, ph_meter, differential_pressure_meter, temperature_meter, negotiation')
      .limit(1);

    if (error && error.message.includes('column "negotiation" does not exist')) {
      // negotiation 컬럼이 없으면 추가 필요 - 하지만 RPC를 사용할 수 없으므로 
      // 사용자가 Supabase 대시보드에서 수동으로 실행하도록 안내
      return NextResponse.json({
        success: false,
        message: '수동 마이그레이션이 필요합니다.',
        instructions: [
          '1. Supabase 대시보드 → SQL Editor 접속',
          '2. 다음 SQL 실행:',
          'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS negotiation VARCHAR(255);',
          'ALTER TABLE business_info ALTER COLUMN ph_meter TYPE INTEGER USING CASE WHEN ph_meter = true THEN 1 ELSE 0 END;',
          'ALTER TABLE business_info ALTER COLUMN differential_pressure_meter TYPE INTEGER USING CASE WHEN differential_pressure_meter = true THEN 1 ELSE 0 END;',
          'ALTER TABLE business_info ALTER COLUMN temperature_meter TYPE INTEGER USING CASE WHEN temperature_meter = true THEN 1 ELSE 0 END;',
          'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS discharge_current_meter INTEGER DEFAULT 0;',
          'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS fan_current_meter INTEGER DEFAULT 0;',
          'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS pump_current_meter INTEGER DEFAULT 0;',
          '3. 마이그레이션 완료 후 업로드 테스트 진행'
        ]
      });
    }

    // negotiation 컬럼이 존재하고 meter 필드들의 타입 확인
    if (data && data.length > 0) {
      const sampleRecord = data[0];
      console.log('📋 [MIGRATION] 샘플 레코드:', sampleRecord);
      
      // ph_meter가 boolean인지 integer인지 확인
      const phMeterValue = sampleRecord.ph_meter;
      const isBoolean = typeof phMeterValue === 'boolean';
      
      if (isBoolean) {
        return NextResponse.json({
          success: false,
          message: '수동 마이그레이션이 필요합니다. meter 필드들이 아직 BOOLEAN 타입입니다.',
          currentTypes: {
            ph_meter: typeof phMeterValue,
            differential_pressure_meter: typeof sampleRecord.differential_pressure_meter,
            temperature_meter: typeof sampleRecord.temperature_meter
          },
          instructions: [
            '1. Supabase 대시보드 → SQL Editor 접속',
            '2. 다음 SQL을 순서대로 실행:',
            '',
            '-- negotiation 컬럼 추가',
            'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS negotiation VARCHAR(255);',
            '',
            '-- BOOLEAN → INTEGER 변환',
            'ALTER TABLE business_info ALTER COLUMN ph_meter TYPE INTEGER USING CASE WHEN ph_meter = true THEN 1 ELSE 0 END;',
            'ALTER TABLE business_info ALTER COLUMN differential_pressure_meter TYPE INTEGER USING CASE WHEN differential_pressure_meter = true THEN 1 ELSE 0 END;',
            'ALTER TABLE business_info ALTER COLUMN temperature_meter TYPE INTEGER USING CASE WHEN temperature_meter = true THEN 1 ELSE 0 END;',
            '',
            '-- 새로운 INTEGER 컬럼 추가',
            'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS discharge_current_meter INTEGER DEFAULT 0;',
            'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS fan_current_meter INTEGER DEFAULT 0;',
            'ALTER TABLE business_info ADD COLUMN IF NOT EXISTS pump_current_meter INTEGER DEFAULT 0;',
            '',
            '3. 완료 후 업로드 테스트 재시도'
          ]
        });
      } else {
        return NextResponse.json({
          success: true,
          message: '스키마가 이미 INTEGER 형식으로 설정되어 있습니다.',
          currentTypes: {
            ph_meter: typeof phMeterValue,
            differential_pressure_meter: typeof sampleRecord.differential_pressure_meter,
            temperature_meter: typeof sampleRecord.temperature_meter,
            negotiation: typeof sampleRecord.negotiation
          }
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        message: '데이터베이스에서 샘플 데이터를 조회할 수 없습니다.',
        error: error?.message
      });
    }

  } catch (error) {
    console.error('❌ [MIGRATION] 마이그레이션 확인 실패:', error);
    return NextResponse.json({
      success: false,
      message: '스키마 확인 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }, { status: 500 });
  }
}