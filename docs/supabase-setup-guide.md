# 🚀 Supabase 완전 설정 가이드

## 📋 1단계: Supabase 계정 및 프로젝트 생성

### 1.1 계정 생성
1. https://supabase.com 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인 (권장)
4. "New project" 클릭

### 1.2 프로젝트 설정
```
Project Name: facility-manager
Database Password: 안전한 비밀번호 설정 (기록해두세요!)
Region: Northeast Asia (Seoul) - ap-northeast-2
Pricing Plan: Free (무료)
```

### 1.3 프로젝트 정보 확인
프로젝트 생성 후 다음 정보를 기록해두세요:
- **Project URL**: https://your-project-id.supabase.co
- **API Key (anon public)**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- **API Key (service_role)**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

## 📊 2단계: 데이터베이스 스키마 생성

### 2.1 SQL Editor 접속
1. Supabase 대시보드에서 "SQL Editor" 메뉴 클릭
2. "New query" 버튼 클릭

### 2.2 스키마 생성 SQL 실행
```sql
-- 사업장 정보 테이블
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  google_folder_id TEXT,
  facility_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- 시설 정보 테이블
CREATE TABLE facilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('basic', 'discharge', 'prevention')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 업로드된 파일 테이블
CREATE TABLE uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_hash TEXT,
  file_path TEXT NOT NULL, -- Supabase Storage 경로
  google_file_id TEXT, -- Google Drive 동기화용
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'syncing', 'synced', 'failed')),
  thumbnail_path TEXT, -- 썸네일 경로
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- 동기화 큐 테이블
CREATE TABLE sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('upload_to_drive', 'update_sheet', 'delete_file')),
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_businesses_name ON businesses(name);
CREATE INDEX idx_uploaded_files_business_id ON uploaded_files(business_id);
CREATE INDEX idx_uploaded_files_created_at ON uploaded_files(created_at DESC);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_uploaded_files_hash ON uploaded_files(file_hash);

-- RLS (Row Level Security) 활성화
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 정책 설정 (개발용)
CREATE POLICY "모든 작업 허용 - businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "모든 작업 허용 - facilities" ON facilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "모든 작업 허용 - uploaded_files" ON uploaded_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "모든 작업 허용 - sync_queue" ON sync_queue FOR ALL USING (true) WITH CHECK (true);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 설정
CREATE TRIGGER update_businesses_updated_at 
  BEFORE UPDATE ON businesses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

"RUN" 버튼을 클릭하여 실행하세요.

## 📁 3단계: Storage 설정

### 3.1 Storage Bucket 생성
1. Supabase 대시보드에서 "Storage" 메뉴 클릭
2. "Create a new bucket" 클릭
3. 설정:
   ```
   Name: facility-files
   Public bucket: ✅ (체크)
   File size limit: 50MB
   Allowed MIME types: image/*, .heic, .heif
   ```
4. "Save" 클릭

### 3.2 Storage 정책 설정
1. "facility-files" 버킷 클릭
2. "Policies" 탭 클릭
3. "New policy" 클릭
4. "For full customization" 선택
5. 다음 정책 입력:

```sql
-- 읽기 정책
CREATE POLICY "모든 사용자 파일 읽기 허용"
ON storage.objects FOR SELECT
USING (bucket_id = 'facility-files');

-- 업로드 정책
CREATE POLICY "모든 사용자 파일 업로드 허용"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'facility-files');

-- 삭제 정책
CREATE POLICY "모든 사용자 파일 삭제 허용"
ON storage.objects FOR DELETE
USING (bucket_id = 'facility-files');
```

## 🔑 4단계: 환경변수 설정

### 4.1 .env.local 파일 수정
```env
# 기존 Google API 설정 (백그라운드 동기화용 유지)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
PRESURVEY_FOLDER_ID=your_folder_id
COMPLETION_FOLDER_ID=15zwT-4-8SybkURKXzKw_kARTgNAh9pb6
MAIN_SPREADSHEET_ID=your_spreadsheet_id
DATA_COLLECTION_SPREADSHEET_ID=your_spreadsheet_id
COMPLETION_SPREADSHEET_ID=1eEkO1LyqlhZiW-1en3ir5VzE652J5AT2Pg6Z_if1Tqo
UPLOAD_SPREADSHEET_ID=your_spreadsheet_id

# 새로 추가 - Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.2 Vercel 환경변수 설정 (배포용)
Vercel 대시보드에서 동일한 환경변수들을 설정하세요.

## 📦 5단계: 패키지 설치

```bash
npm install @supabase/supabase-js
npm install @supabase/ssr  # SSR 지원용
```

## 🧪 6단계: 연결 테스트

### 6.1 테스트 API 생성
`app/api/supabase-test/route.ts` 파일 생성:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. 데이터베이스 연결 테스트
    const { data: businesses, error: dbError } = await supabase
      .from('businesses')
      .select('*')
      .limit(1);

    if (dbError) throw dbError;

    // 2. Storage 연결 테스트
    const { data: buckets, error: storageError } = await supabase
      .storage
      .listBuckets();

    if (storageError) throw storageError;

    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 성공!',
      database: '✅ 연결됨',
      storage: '✅ 연결됨',
      buckets: buckets.map(b => b.name),
      businesses_count: businesses?.length || 0
    });

  } catch (error) {
    console.error('Supabase 연결 테스트 실패:', error);
    return NextResponse.json({
      success: false,
      message: '연결 실패',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
```

### 6.2 테스트 실행
1. 개발 서버 재시작: `npm run dev`
2. 브라우저에서 `http://localhost:3000/api/supabase-test` 접속
3. 성공 응답 확인

## ✅ 7단계: 설정 완료 체크리스트

- [ ] Supabase 프로젝트 생성 완료
- [ ] 데이터베이스 스키마 생성 완료
- [ ] Storage 버킷 생성 및 정책 설정 완료
- [ ] 환경변수 설정 완료
- [ ] 패키지 설치 완료
- [ ] 연결 테스트 통과

## 🚨 주의사항

### 무료 플랜 제한사항
- **데이터베이스**: 500MB
- **스토리지**: 1GB
- **대역폭**: 2GB/월
- **동시 연결**: 60개

### 모니터링
- Supabase 대시보드에서 사용량 모니터링
- 80% 도달 시 알림 설정 권장

## 🔄 다음 단계
설정이 완료되면 기존 Google API 코드를 Supabase로 마이그레이션할 준비가 끝났습니다!