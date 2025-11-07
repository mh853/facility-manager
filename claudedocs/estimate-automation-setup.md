# 견적서 자동화 시스템 실행 가이드

## 📋 개요
admin/document-automation 페이지에 "견적서 관리" 탭이 추가되었습니다. 사업장의 측정기기 정보와 환경부 고시가를 기반으로 견적서를 자동 생성하고 PDF로 다운로드할 수 있습니다.

---

## 🎯 주요 기능
1. ✅ 사업장 선택 및 견적서 자동 생성
2. ✅ 환경부 고시가 기반 단가 자동 조회
3. ✅ 측정기기, 추가공사비, 협의사항 자동 포함
4. ✅ PDF 다운로드 기능
5. ✅ 견적서 이력 관리 및 조회
6. ✅ 템플릿 안내사항 수정 기능

---

## 🚀 실행 준비 단계

### Step 1: 데이터베이스 마이그레이션 실행

Supabase SQL Editor에서 다음 파일을 실행하세요:

```sql
-- 파일: sql/estimate_automation_schema.sql
-- 이 파일을 Supabase SQL Editor에 붙여넣고 실행
```

**실행 확인사항:**
- ✅ `estimate_templates` 테이블 생성
- ✅ `estimate_history` 테이블 생성
- ✅ 기본 템플릿 데이터 삽입
- ✅ 인덱스 생성

**확인 쿼리:**
```sql
SELECT * FROM estimate_templates WHERE is_active = true;
SELECT COUNT(*) FROM estimate_history;
```

---

### Step 2: 패키지 설치 (완료됨)

pdfmake 라이브러리가 이미 설치되었습니다:
```bash
npm install pdfmake  # ✅ 완료
```

---

### Step 3: 환경부 고시가 데이터 확인

견적서 생성을 위해 `government_pricing` 테이블에 측정기기 가격 데이터가 필요합니다.

**확인 쿼리:**
```sql
SELECT
    equipment_type,
    equipment_name,
    official_price,
    is_active
FROM government_pricing
WHERE is_active = true
ORDER BY equipment_type;
```

**만약 데이터가 없다면**, 원가 관리 페이지(`/admin/revenue/pricing`)에서 환경부 고시가를 먼저 등록하세요.

---

### Step 4: Supabase Storage 버킷 확인

PDF 파일 저장을 위해 `documents` 버킷이 필요합니다.

**Supabase Dashboard → Storage → documents 버킷 확인**

만약 버킷이 없다면:
1. Supabase Dashboard → Storage
2. "New bucket" 클릭
3. Name: `documents`
4. Public: ✅ (체크)
5. Create bucket

---

## 💻 시스템 실행

### 개발 서버 시작

```bash
npm run dev
```

### 접속 URL

```
http://localhost:3000/admin/document-automation
```

### 견적서 탭 선택
- "견적서 관리" 탭 클릭

---

## 📖 사용 방법

### 1. 견적서 생성

1. **사업장 선택**
   - 검색창에서 사업장명 검색
   - 원하는 사업장 카드 클릭

2. **견적서 생성**
   - 선택한 사업장 카드에서 "견적서 생성" 버튼 클릭
   - 시스템이 자동으로:
     - 사업장의 측정기기 수량 확인
     - 환경부 고시가 조회
     - 견적 항목 생성
     - 부가세 계산
     - 합계 산출

3. **견적서 확인**
   - 하단 "견적서 이력" 테이블에서 생성된 견적서 확인

### 2. 견적서 다운로드

1. 견적서 이력 테이블에서 원하는 견적서의 "다운로드" 아이콘 클릭
2. PDF 파일 자동 다운로드

### 3. 견적서 상세보기

1. 견적서 이력 테이블에서 "상세보기" 아이콘 클릭
2. 모달에서 견적 항목 및 금액 확인

### 4. 템플릿 설정 수정

1. 우측 상단 "템플릿 설정" 버튼 클릭
2. 안내사항 텍스트 수정
3. "저장" 버튼 클릭

---

## 📂 생성된 파일 목록

### 백엔드 API
```
app/api/estimates/
├── generate/route.ts        # 견적서 생성 API
├── route.ts                  # 견적서 조회 및 템플릿 수정 API
├── template/route.ts         # 템플릿 조회 API
└── [id]/pdf/route.ts         # PDF 생성 및 다운로드 API
```

### 프론트엔드 컴포넌트
```
app/admin/document-automation/
└── components/
    └── EstimateManagement.tsx    # 견적서 관리 메인 컴포넌트
```

### 유틸리티
```
lib/document-generators/
└── estimate-pdf-generator.ts     # PDF 생성 로직
```

### 데이터베이스
```
sql/
└── estimate_automation_schema.sql    # 마이그레이션 파일
```

---

## 🔧 측정기기 필드 매핑

견적서에 자동 포함되는 측정기기 항목:

| DB 필드명 | 견적서 품명 |
|-----------|-------------|
| ph_meter | pH미터 |
| differential_pressure_meter | 온도계 |
| temperature_meter | 배출전류계 |
| discharge_current_meter | 송풍전류계 |
| fan_current_meter | 펌프전류계 |
| pump_current_meter | 게이트웨이 |
| gateway | G/W(1,2CH) |
| vpn_wired | VPN(유선) |
| vpn_wireless | VPN(무선) |

---

## 📊 견적서 구조

### 헤더
- **제목**: IoT 견적서
- **견적일자**: 생성 날짜
- **공급자 번호**: 사업자등록번호

### 공급자 정보 (템플릿에서 관리)
- 상호(법인명)
- 사업자등록번호
- 대표자
- 업태/종목
- 전화/팩스

### 공급받는자 정보 (사업장 데이터)
- 상호: business_name
- 사업자등록번호: business_registration_number
- 대표자: representative_name
- 업태: business_type
- 주소: address

### 견적 항목 테이블
- No | 품명 | 규격 | 수량 | 단가 | 공급가액 | 세액 | 비고

### 하단
- 안내사항 (템플릿 수정 가능)
- 합계 (공급가액 + 세액)

---

## 🐛 트러블슈팅

### 1. 견적서 생성 시 "가격 정보를 찾을 수 없습니다" 오류

**원인**: `government_pricing` 테이블에 해당 측정기기의 가격 데이터가 없음

**해결방법**:
1. `/admin/revenue/pricing` 페이지 접속
2. "환경부 고시가 관리" 섹션에서 해당 측정기기 가격 등록

---

### 2. PDF 다운로드 시 한글 깨짐

**원인**: 한글 폰트 로딩 실패

**해결방법**:
- pdfmake 라이브러리가 NanumGothic 폰트를 자동으로 사용하도록 설정되어 있습니다
- 브라우저 캐시 삭제 후 재시도

---

### 3. PDF 업로드 실패

**원인**: Supabase Storage `documents` 버킷이 없거나 권한 문제

**해결방법**:
1. Supabase Dashboard → Storage 확인
2. `documents` 버킷 생성 (Public 체크)
3. RLS 정책 확인

---

## 📈 데이터 흐름

```
1. 사용자: 사업장 선택 + 견적서 생성 버튼 클릭
   ↓
2. API: /api/estimates/generate (POST)
   ↓
3. business_info 조회 (측정기기 수량)
   ↓
4. government_pricing 조회 (환경부 고시가)
   ↓
5. 견적 항목 계산 (수량 × 단가, 부가세)
   ↓
6. estimate_history 저장 (스냅샷)
   ↓
7. 프론트엔드: 견적서 이력 표시
   ↓
8. 사용자: PDF 다운로드 버튼 클릭
   ↓
9. API: /api/estimates/[id]/pdf (GET)
   ↓
10. PDF 생성 (pdfmake)
    ↓
11. Supabase Storage 업로드
    ↓
12. PDF 파일 다운로드
```

---

## ✅ 테스트 체크리스트

- [ ] 데이터베이스 마이그레이션 실행 완료
- [ ] 템플릿 기본 데이터 삽입 확인
- [ ] 환경부 고시가 데이터 등록 확인
- [ ] 개발 서버 정상 실행
- [ ] 견적서 관리 탭 표시 확인
- [ ] 사업장 목록 로드 확인
- [ ] 견적서 생성 테스트
- [ ] 견적서 이력 표시 확인
- [ ] PDF 다운로드 테스트
- [ ] 견적서 상세보기 모달 확인
- [ ] 템플릿 설정 수정 테스트

---

## 📝 다음 단계 (선택사항)

### 1. 실행 이력 탭 통합
- `document_history` 테이블에 견적서 타입 추가
- 실행 이력 탭에서 견적서 조회 가능

### 2. 이메일 발송 기능
- 견적서 PDF를 이메일로 자동 발송

### 3. 견적서 승인 워크플로우
- 견적서 생성 → 검토 → 승인 → 발송 단계 추가

### 4. 견적서 비교 기능
- 동일 사업장의 여러 견적서 비교

---

## 🎉 완료!

견적서 자동화 시스템이 준비되었습니다.
데이터베이스 마이그레이션만 실행하면 바로 사용 가능합니다!

**문의사항이 있으시면 언제든지 알려주세요.**
