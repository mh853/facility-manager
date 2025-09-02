-- Create business_contacts table
CREATE TABLE IF NOT EXISTS business_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  
  -- 주소 정보
  address TEXT,
  
  -- 담당자 정보
  manager_name TEXT,
  manager_contact TEXT,
  
  -- 사업장 연락처
  business_contact TEXT,
  
  -- 추가 정보
  business_registration_number TEXT,
  representative_name TEXT,
  business_type TEXT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 인덱스를 위한 제약
  UNIQUE(business_name)
);

-- 업데이트 시간 자동 갱신을 위한 트리거
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
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_contacts_business_name ON business_contacts(business_name);
CREATE INDEX IF NOT EXISTS idx_business_contacts_business_id ON business_contacts(business_id);