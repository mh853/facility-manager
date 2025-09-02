-- Create discharge_facilities table (배출시설)
CREATE TABLE IF NOT EXISTS discharge_facilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  outlet_number INTEGER NOT NULL,
  facility_number INTEGER NOT NULL,
  facility_name TEXT NOT NULL,
  capacity TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 인덱스를 위한 제약
  UNIQUE(business_name, outlet_number, facility_number)
);

-- Create prevention_facilities table (방지시설)
CREATE TABLE IF NOT EXISTS prevention_facilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  outlet_number INTEGER NOT NULL,
  facility_number INTEGER NOT NULL,
  facility_name TEXT NOT NULL,
  capacity TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 인덱스를 위한 제약
  UNIQUE(business_name, outlet_number, facility_number)
);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수 (이미 있다면 재사용)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_discharge_facilities_updated_at 
  BEFORE UPDATE ON discharge_facilities 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prevention_facilities_updated_at 
  BEFORE UPDATE ON prevention_facilities 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_business_name ON discharge_facilities(business_name);
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_outlet ON discharge_facilities(business_name, outlet_number);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_business_name ON prevention_facilities(business_name);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_outlet ON prevention_facilities(business_name, outlet_number);

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO discharge_facilities (business_name, outlet_number, facility_number, facility_name, capacity, quantity) 
VALUES 
  ('(주)조양(전체)', 1, 1, '혼합시설(이동식)', '3.5㎥', 1),
  ('(주)조양(전체)', 1, 2, '건조시설', '8.82㎥', 1),
  ('(주)조양(전체)', 1, 3, '건조시설', '66㎥', 1),
  ('(주)조양(전체)', 1, 4, '건조시설', '15㎥', 1),
  ('(주)조양(전체)', 1, 5, '혼합시설(이동식)', '1.2㎥', 1),
  ('(주)조양(전체)', 2, 6, '건조시설(무동력)', '18.36㎥', 1),
  ('(주)조양(전체)', 2, 7, '건조시설(무동력)', '18.36㎥', 1),
  ('(주)조양(전체)', 2, 8, '건조시설', '8.5㎥', 1),
  ('(주)조양(전체)', 2, 9, '건조시설', '98㎥', 1),
  ('(주)조양(전체)', 3, 10, '건조시설(무동력)', '14.72㎥', 1),
  ('(주)조양(전체)', 3, 11, '건조시설', '49.4㎥', 1),
  ('(주)조양(전체)', 3, 12, '건조시설', '8.82㎥', 1),
  ('(주)조양(전체)', 3, 13, '건조시설', '46.8㎥', 1),
  ('(주)조양(전체)', 4, 14, '인쇄시설', '0.82㎥', 1),
  ('(주)조양(전체)', 4, 15, '혼합시설', '0.2㎥', 1),
  ('(주)조양(전체)', 4, 16, '혼합시설', '0.2㎥', 1),
  ('(주)조양(전체)', 4, 17, '혼합시설', '1.5㎥', 1),
  ('(주)조양(전체)', 4, 18, '혼합시설', '3.7㎥', 1),
  ('(주)조양(전체)', 4, 19, '혼합시설', '4.5㎥', 1)
ON CONFLICT (business_name, outlet_number, facility_number) DO NOTHING;

INSERT INTO prevention_facilities (business_name, outlet_number, facility_number, facility_name, capacity, quantity) 
VALUES 
  ('(주)조양(전체)', 1, 1, '흡착에의한시설', '250㎥/분', 1),
  ('(주)조양(전체)', 2, 2, '흡착에의한시설', '300㎥/분', 1),
  ('(주)조양(전체)', 3, 3, '흡착에의한시설', '250㎥/분', 1),
  ('(주)조양(전체)', 4, 4, '흡착에의한시설', '200㎥/분', 1)
ON CONFLICT (business_name, outlet_number, facility_number) DO NOTHING;