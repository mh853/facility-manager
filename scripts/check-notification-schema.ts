/**
 * user_notifications 테이블 스키마 확인 스크립트
 *
 * 용도: 실제 DB 테이블에 어떤 컬럼들이 있는지 확인
 * 실행: npx tsx scripts/check-notification-schema.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryAll } from '@/lib/supabase-direct';

async function checkNotificationSchema() {
  console.log('🔍 user_notifications 테이블 스키마 확인 중...\n');

  try {
    // PostgreSQL information_schema를 사용하여 컬럼 정보 조회
    const columns = await queryAll(
      `SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'user_notifications'
      ORDER BY ordinal_position`,
      []
    );

    if (!columns || columns.length === 0) {
      console.log('❌ user_notifications 테이블을 찾을 수 없습니다.');
      return;
    }

    console.log('✅ user_notifications 테이블 스키마:\n');
    console.log('컬럼명'.padEnd(30), '타입'.padEnd(20), 'NULL 허용', '기본값');
    console.log('='.repeat(80));

    columns.forEach((col: any) => {
      console.log(
        col.column_name.padEnd(30),
        col.data_type.padEnd(20),
        col.is_nullable.padEnd(10),
        col.column_default || '없음'
      );
    });

    console.log('\n📊 총 컬럼 수:', columns.length);

    // 특정 컬럼 존재 여부 확인
    const columnNames = columns.map((c: any) => c.column_name);
    const requiredColumns = ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at', 'expires_at'];

    console.log('\n✅ 필수 컬럼 확인:');
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✓' : '✗'} ${col}`);
    });

  } catch (error) {
    console.error('❌ 스키마 조회 실패:', error);
  }
}

checkNotificationSchema()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });
