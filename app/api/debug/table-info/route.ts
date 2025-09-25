// API endpoint for database debugging
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { table, action } = await request.json();

    if (table !== 'task_notifications') {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    console.log(`🔍 [DEBUG] Table info request: ${table}, action: ${action}`);

    if (action === 'structure') {
      // 테이블 구조 확인
      const { data: columns, error: columnsError } = await supabaseAdmin
        .rpc('get_table_columns', { table_name: table })
        .select('*');

      if (columnsError) {
        console.error('❌ [DEBUG] Column query error:', columnsError);
        // 직접 정보 스키마 쿼리 시도
        const { data: schemaInfo, error: schemaError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', table);

        if (schemaError) {
          console.error('❌ [DEBUG] Schema query error:', schemaError);

          // 단순 존재 확인 시도
          const { data: existsCheck, error: existsError } = await supabaseAdmin
            .from(table)
            .select('*')
            .limit(1);

          return NextResponse.json({
            table_exists: !existsError,
            columns_error: columnsError.message,
            schema_error: schemaError.message,
            exists_check: existsError ? existsError.message : 'Table exists',
            sample_data: existsCheck || null
          });
        }

        return NextResponse.json({
          table_exists: true,
          columns: schemaInfo,
          method: 'information_schema'
        });
      }

      return NextResponse.json({
        table_exists: true,
        columns: columns,
        method: 'rpc_function'
      });
    }

    // 기본 데이터 확인
    const { data: sampleData, error: dataError } = await supabaseAdmin
      .from(table)
      .select('*')
      .limit(5);

    return NextResponse.json({
      table_exists: !dataError,
      sample_data: sampleData || [],
      data_count: sampleData?.length || 0,
      error: dataError?.message || null
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Table info error:', error);
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}