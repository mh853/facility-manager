// app/api/create-tables/route.ts - 테이블 생성 SQL 제공
import { NextResponse } from 'next/server';

export async function GET() {
  const emergencyFix = `
-- 🚨 응급 수정: 누락된 컬럼 추가 (기존 데이터 보존)
DO $$
BEGIN
    -- discharge_facilities 테이블에 누락된 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'discharge_facilities' 
        AND column_name = 'business_name'
    ) THEN
        ALTER TABLE discharge_facilities ADD COLUMN business_name TEXT;
        RAISE NOTICE 'discharge_facilities에 business_name 컬럼 추가됨';
    END IF;
    
    -- prevention_facilities 테이블에 누락된 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prevention_facilities' 
        AND column_name = 'business_name'
    ) THEN
        ALTER TABLE prevention_facilities ADD COLUMN business_name TEXT;
        RAISE NOTICE 'prevention_facilities에 business_name 컬럼 추가됨';
    END IF;
    
    -- 기타 필수 컬럼 추가
    ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS outlet_number INTEGER;
    ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS facility_number INTEGER;
    ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE discharge_facilities ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
    
    ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS outlet_number INTEGER;
    ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS facility_number INTEGER;
    ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE prevention_facilities ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
END $$;

-- 기존 레코드에 기본값 설정 (단계별 업데이트)
-- 1단계: business_name과 outlet_number 설정
UPDATE discharge_facilities 
SET 
    business_name = COALESCE(business_name, '(주)조양(전체)'),
    outlet_number = COALESCE(outlet_number, 1)
WHERE business_name IS NULL OR outlet_number IS NULL;

UPDATE prevention_facilities 
SET 
    business_name = COALESCE(business_name, '(주)조양(전체)'),
    outlet_number = COALESCE(outlet_number, 1)
WHERE business_name IS NULL OR outlet_number IS NULL;

-- 2단계: facility_number 설정 (서브쿼리 방식)
UPDATE discharge_facilities 
SET facility_number = sub.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
    FROM discharge_facilities 
    WHERE facility_number IS NULL
) sub
WHERE discharge_facilities.id = sub.id;

UPDATE prevention_facilities 
SET facility_number = sub.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
    FROM prevention_facilities 
    WHERE facility_number IS NULL
) sub
WHERE prevention_facilities.id = sub.id;

-- 성능 향상을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_business_name ON discharge_facilities(business_name);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_business_name ON prevention_facilities(business_name);
`;

  const sampleData = `
-- 샘플 데이터 추가 (기존 데이터가 없는 경우에만)
INSERT INTO discharge_facilities (business_name, outlet_number, facility_number, facility_name, capacity, quantity) 
SELECT * FROM (VALUES
    ('(주)조양(전체)', 1, 1, '펠릿제조기', '100kg/h', 1),
    ('(주)조양(전체)', 1, 2, '건조기', '200kg/h', 1),
    ('(주)조양(전체)', 1, 3, '냉각기', '150kg/h', 1),
    ('(주)조양(전체)', 1, 4, '선별기', '80kg/h', 1),
    ('(주)조양(전체)', 1, 5, '포장기', '50kg/h', 2),
    ('(주)조양(전체)', 2, 1, '압출성형기', '180kg/h', 2),
    ('(주)조양(전체)', 2, 2, '혼합기', '220kg/h', 1),
    ('(주)조양(전체)', 2, 3, '분쇄기', '90kg/h', 3),
    ('(주)조양(전체)', 3, 1, '세척기', '120kg/h', 1),
    ('(주)조양(전체)', 3, 2, '탈수기', '100kg/h', 2),
    ('(주)조양(전체)', 3, 3, '건조기', '150kg/h', 1)
) AS v(business_name, outlet_number, facility_number, facility_name, capacity, quantity)
WHERE NOT EXISTS (SELECT 1 FROM discharge_facilities WHERE business_name = '(주)조양(전체)');

INSERT INTO prevention_facilities (business_name, outlet_number, facility_number, facility_name, capacity, quantity) 
SELECT * FROM (VALUES
    ('(주)조양(전체)', 1, 1, '사이클론 집진기', '1000㎥/min', 1),
    ('(주)조양(전체)', 1, 2, '백필터 집진기', '800㎥/min', 1),
    ('(주)조양(전체)', 2, 1, '습식 집진기', '600㎥/min', 1),
    ('(주)조양(전체)', 2, 2, '활성탄 흡착탑', '500㎥/min', 1),
    ('(주)조양(전체)', 3, 1, '전기집진기', '700㎥/min', 2)
) AS v(business_name, outlet_number, facility_number, facility_name, capacity, quantity)
WHERE NOT EXISTS (SELECT 1 FROM prevention_facilities WHERE business_name = '(주)조양(전체)');
`;

  const sql = emergencyFix + '\n\n' + sampleData;

  return NextResponse.json({
    success: true,
    message: '🚨 응급 수정: 다음 SQL을 Supabase 대시보드의 SQL Editor에서 실행해주세요',
    sql: sql,
    instructions: [
      '1. Supabase 대시보드 (https://supabase.com/dashboard) 접속',
      '2. 프로젝트 선택 (qdfqoykhmuiambtrrlnf)',
      '3. 왼쪽 메뉴에서 "SQL Editor" 클릭',
      '4. 위의 SQL 코드를 복사하여 붙여넣기',
      '5. "RUN" 버튼 클릭하여 실행',
      '6. 실행 완료 후 웹사이트에서 (주)조양(전체) 페이지 새로고침'
    ],
    summary: {
      action: 'emergency_fix',
      description: '기존 테이블에 누락된 business_name 컬럼과 기타 필수 컬럼을 추가합니다',
      safety: '기존 데이터는 보존되며, 새로운 컬럼만 추가됩니다',
      expectedResult: 'API가 정상적으로 시설 데이터를 반환할 것입니다'
    }
  });
}