# 시설별 사진 업로드 시스템

## 🎯 개요

시설관리 시스템의 시설별 사진 업로드 기능을 데이터베이스 기반으로 안정적이고 체계적으로 관리할 수 있는 고급 시스템입니다.

### ✨ 주요 특징

- **🏭 시설별 체계적 관리**: 배출시설(배1,배2,배3...), 방지시설(방1,방2,방3...) 자동 번호 할당
- **📱 모바일 최적화**: 드래그앤드롭 + 파일 첨부 지원, 반응형 UI
- **🗄️ 데이터베이스 통합**: Supabase 기반 안정적인 파일 및 메타데이터 관리
- **🖼️ 썸네일 그리드**: 시설별 사진을 썸네일로 표시하고 실시간 업데이트
- **🔄 실시간 추적**: 업로드 진행률 표시 및 즉시 사진 출력
- **🗑️ 수정/삭제**: 업로드 후 사진 수정 및 삭제 가능

## 🏗️ 시스템 구조

```
시설별 사진 시스템/
├── 📊 데이터베이스 (Supabase)
│   ├── businesses (사업장 정보)
│   ├── uploaded_files (파일 메타데이터)
│   └── facility-files (Storage 버킷)
├── 🔧 백엔드 API
│   ├── /api/facility-photos (시설별 사진 관리)
│   └── /api/uploaded-files-supabase (기존 호환성)
├── 🎨 프론트엔드 컴포넌트
│   ├── ImprovedFacilityPhotoSection (개선된 UI)
│   └── FacilityPhotoUploadSection (기존)
└── 📱 유틸리티
    ├── facility-photo-tracker (사진 추적기)
    ├── facility-numbering (번호 체계)
    └── filename-generator (파일명 생성)
```

## 🚀 구현된 기능들

### 1. 📋 시설별 사진 관리 추적기 (`FacilityPhotoTracker`)

```typescript
// 사용 예시
const tracker = createFacilityPhotoTracker('사업장명');

// 업로드된 파일들로부터 시설별 정보 구성
tracker.buildFromUploadedFiles(uploadedFiles);

// 배출시설 사진 조회
const dischargePhotos = tracker.getFacilityPhotos('discharge', 1, 1);

// 다음 사진 순번 계산
const nextIndex = tracker.getNextPhotoIndex('discharge', 1, 1);

// 통계 정보
const stats = tracker.getStatistics();
```

### 2. 🔌 개선된 API 엔드포인트

#### 시설별 사진 업로드 (POST `/api/facility-photos`)

```javascript
const formData = new FormData();
formData.append('businessName', '테스트사업장');
formData.append('facilityType', 'discharge'); // 'discharge' | 'prevention' | 'basic'
formData.append('facilityNumber', '1');
formData.append('outletNumber', '1');
files.forEach(file => formData.append('files', file));

const response = await fetch('/api/facility-photos', {
  method: 'POST',
  body: formData
});
```

#### 시설별 사진 조회 (GET `/api/facility-photos`)

```javascript
const response = await fetch(
  `/api/facility-photos?businessName=${businessName}&facilityType=discharge&facilityNumber=1`
);
```

#### 사진 삭제 (DELETE `/api/facility-photos`)

```javascript
const response = await fetch('/api/facility-photos', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ photoId: 'file-id', businessName: '사업장명' })
});
```

### 3. 🎨 개선된 UI 컴포넌트

```tsx
import ImprovedFacilityPhotoSection from '@/components/ImprovedFacilityPhotoSection';

<ImprovedFacilityPhotoSection 
  businessName="테스트사업장"
  facilities={facilitiesData}
/>
```

**주요 UI 기능:**
- ✅ 통계 대시보드 (시설 수, 사진 수)
- ✅ 그리드/리스트 뷰 모드 전환
- ✅ 배출구별 시설 그룹화
- ✅ 실시간 업로드 진행률 표시
- ✅ 사진 클릭으로 상세 모달
- ✅ 드래그앤드롭 + 파일 선택 지원

### 4. 📊 시설 번호 체계

```typescript
// facility-numbering.ts에서 제공
// 배출구별로 연속 번호 할당

배출구 1:
  - 배출시설 3개 → 배1, 배2, 배3
  - 방지시설 1개 → 방1

배출구 2:
  - 배출시설 2개 → 배4, 배5
  - 방지시설 2개 → 방2, 방3

// 총 9개 시설: 배1~배5, 방1~방3
```

## 📱 모바일 최적화

### 반응형 그리드
```css
/* 자동 적용되는 반응형 클래스 */
grid-cols-2 md:grid-cols-3 lg:grid-cols-4  /* 화면 크기별 그리드 */
text-sm md:text-base                       /* 텍스트 크기 조절 */
p-2 md:p-4                                /* 패딩 반응형 */
```

### 터치 최적화
- 👆 터치 영역 최소 44px 확보
- 📱 모바일에서 파일 선택 최적화
- 🖼️ 사진 확대/축소 제스처 지원
- ⚡ 즉시 반응하는 UI

## 🔧 설치 및 설정

### 1. 환경 변수 설정

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Supabase 테이블 설정

```sql
-- 사업장 테이블
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 업로드된 파일 테이블  
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_hash TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT DEFAULT 'uploaded',
  facility_info TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Storage 버킷
INSERT INTO storage.buckets (id, name, public) 
VALUES ('facility-files', 'facility-files', true);
```

### 3. 컴포넌트 사용

```tsx
// app/business/[businessName]/page.tsx
import ImprovedFacilityPhotoSection from '@/components/ImprovedFacilityPhotoSection';

export default function BusinessPage({ params }: { params: { businessName: string } }) {
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  
  return (
    <div>
      {/* 기존 시설 정보 로딩 */}
      
      {/* 개선된 시설별 사진 관리 */}
      <ImprovedFacilityPhotoSection 
        businessName={decodeURIComponent(params.businessName)}
        facilities={facilities}
      />
    </div>
  );
}
```

## 🧪 테스트

### 테스트 스크립트 실행

```bash
# 종합 테스트 실행
node scripts/test-facility-photo-system.js

# 특정 카테고리 테스트
npm run test:facility-photos
```

### 테스트 항목
- ✅ 데이터베이스 연결
- ✅ API 엔드포인트 동작
- ✅ 파일 업로드 로직
- ✅ 모바일 반응형
- ✅ 성능 최적화

## 📈 성능 최적화

### 이미지 처리
- 📦 5MB 이상 파일 자동 압축
- 🖼️ WebP 형식 변환
- ⚡ 워커 스레드 활용

### 캐싱 전략
- 🧠 메모리 캐시 (2분 TTL)
- 🔄 백그라운드 새로고침 (60초마다)
- 📱 모바일 최적화된 캐시

### 데이터베이스 최적화
- 🗂️ 파일 해시 기반 중복 방지
- 📊 인덱스 최적화
- 🔗 관계형 데이터 정규화

## 🚨 주의사항

### 보안
- ✅ 파일 유형 검증 (`image/*`)
- ✅ 파일 크기 제한 (기본 10MB)
- ✅ SQL 인젝션 방지
- ✅ XSS 방지 (파일명 새니타이징)

### 호환성
- 📱 iOS Safari 12+
- 🤖 Chrome Mobile 90+
- 🖥️ 모던 브라우저 전체 지원
- 📶 오프라인 대응 (PWA)

## 🐛 트러블슈팅

### 일반적인 문제들

#### 1. 파일 업로드 실패
```
원인: Supabase Storage 권한 문제
해결: RLS 정책 확인 및 서비스 역할 키 설정
```

#### 2. 사진이 표시되지 않음
```
원인: Public URL 생성 실패
해결: Storage 버킷이 public으로 설정되었는지 확인
```

#### 3. 모바일에서 드래그앤드롭 안됨
```
원인: 터치 이벤트 미지원
해결: 파일 입력 클릭 방식으로 대체 동작
```

#### 4. 시설 번호가 올바르지 않음
```
원인: facility-numbering.ts 로직 오류
해결: generateFacilityNumbering() 함수 디버깅
```

## 🔮 향후 개선 계획

### 단기 목표 (1개월)
- [ ] 📊 사진 메타데이터 확장 (GPS, 촬영일시)
- [ ] 🔍 사진 검색 및 필터링 기능
- [ ] 📤 일괄 내보내기 (ZIP)
- [ ] 🏷️ 태그 시스템

### 중기 목표 (3개월) 
- [ ] 🤖 AI 기반 사진 분류
- [ ] 📱 PWA 오프라인 동기화
- [ ] 📈 사진 품질 분석
- [ ] 🔄 자동 백업 시스템

### 장기 목표 (6개월)
- [ ] 🌐 다국어 지원
- [ ] 📊 고급 분석 대시보드
- [ ] 🔗 외부 시스템 연동 API
- [ ] 🛡️ 고급 보안 기능

## 🤝 기여하기

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

---

**📞 지원 및 문의**

문제가 발생하거나 기능 요청이 있으시면 GitHub Issues를 통해 연락주세요.

**🎉 축하합니다!** 
이제 강력하고 안정적인 시설별 사진 관리 시스템을 사용할 수 있습니다.