# 착공신고서 자동화 구현 완료

## 📋 구현 개요

**위치**: `/app/admin/document-automation` (새 탭 추가)

사업장별 착공신고서 및 관련 서류를 자동으로 생성하는 기능이 구현되었습니다. 사업장 정보와 보조금 정보를 입력하면 4개의 문서가 자동으로 생성됩니다.

### 생성되는 문서
1. **착공신고서** - 지자체 제출용 공식 신고서
2. **IoT 설치 계약서 (지자체 제출용)** - 보조금 계약서
3. **IoT 설치 계약서 (사업장 보관용)** - 추가 비용 포함
4. **개선 계획서** - IoT 설치 전후 개선 사항

## ✅ 구현된 컴포넌트

### 1. 메인 관리 컴포넌트
**파일**: `/app/admin/document-automation/components/ConstructionReportManagement.tsx`

- 사업장 선택 카드 UI (그리드 레이아웃)
- 보조금 정보 입력 모달
- 방지시설 자동 로딩 (대기필증 API 연동)
- 자부담액 자동 계산 (환경부고시가 - 보조금)
- 설치기간 자동 계산 (승인일 + 3개월)

### 2. 템플릿 컴포넌트

#### ConstructionReportTemplate.tsx
- 착공신고서 메인 양식
- 테이블 레이아웃 (PDF 양식 재현)
- 날짜 파싱 및 포맷팅
- 설치기간 계산 로직

#### ContractGovernmentTemplate.tsx
- 지자체 제출용 계약서
- IoT 보조금 내역 테이블
- 설치 장비 상세 테이블
- 5개 조항 (계약 내용)
- 양측 서명란

#### ContractBusinessTemplate.tsx
- 사업장 보관용 계약서
- 추가 비용 및 협의 금액 포함
- VAT 계산 로직
- 총 금액 자동 계산

#### ImprovementPlanTemplate.tsx
- 개선 계획서
- IoT 설치 전/후 비교
- 추가 조치 사항
- greenlink.or.kr 시스템 참조

### 3. API 엔드포인트
**파일**: `/app/api/construction-reports/route.ts`

#### GET - 착공신고서 목록 조회
```typescript
GET /api/construction-reports?business_id=<uuid>
```
- business_id 필터링 지원
- is_deleted=false 레코드만 조회
- created_at 내림차순 정렬

#### POST - 착공신고서 생성
```typescript
POST /api/construction-reports
{
  business_id: string
  business_name: string
  subsidy_approval_date: string
  government_notice_price: number
  subsidy_amount: number
  // ... 기타 필드
}
```
- 필수 필드 검증
- 신고서 번호 자동 생성: `CR-YYYYMMDD-HHMM{random}`
- 자부담 자동 계산
- report_data에 JSONB로 전체 데이터 저장
- document_history 테이블에도 이력 기록

#### DELETE - 착공신고서 삭제
```typescript
DELETE /api/construction-reports?id=<uuid>
```
- Soft delete (is_deleted=true)

### 4. 데이터베이스 스키마
**파일**: `/sql/construction_reports.sql`

```sql
CREATE TABLE construction_reports (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL,
  report_number TEXT UNIQUE NOT NULL,
  report_data JSONB NOT NULL,
  report_date DATE NOT NULL,
  subsidy_approval_date DATE NOT NULL,
  government_notice_price NUMERIC(12, 2),
  subsidy_amount NUMERIC(12, 2),
  self_payment NUMERIC(12, 2),
  file_path TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by_name TEXT,
  created_by_email TEXT,
  is_deleted BOOLEAN DEFAULT FALSE
);
```

**인덱스**:
- business_id
- report_date
- created_at
- report_number (unique)

**트리거**: updated_at 자동 갱신

## 🔧 설정 완료 방법

### 1. 데이터베이스 테이블 생성

현재 코드는 모두 준비되었으나, 데이터베이스 테이블만 수동 생성이 필요합니다.

**방법**:
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택: `qdfqoykhmuiambtrrlnf`
3. **SQL Editor** 메뉴 선택
4. 새 쿼리 생성
5. `/sql/construction_reports.sql` 파일 내용 복사
6. 실행 (Run)
7. 성공 메시지 확인

**검증**:
```bash
node scripts/verify-construction-reports-setup.js
```

### 2. 개발 서버 시작

```bash
npm run dev
```

### 3. 기능 접근

브라우저에서 다음 URL 접속:
```
http://localhost:3000/admin/document-automation
```

"착공신고서" 탭 선택

## 📖 사용 방법

### 1단계: 사업장 선택
- 카드 그리드에서 사업장 선택
- 검색 기능으로 빠른 찾기 가능

### 2단계: 보조금 정보 입력
모달 폼에서 다음 정보 입력:
- **보조금 승인일** (YYYY-MM-DD)
- **환경부고시가** (숫자)
- **보조금 승인액** (숫자)
- **방지시설** (자동 로딩, 선택 가능)
- **게이트웨이 수량**
- **VPN 종류**
- 측정기기 수량 (전류계, 차압계, 온도계 등)

**자동 계산**:
- 자부담 = 환경부고시가 - 보조금승인액
- 설치 종료일 = 승인일 + 3개월

### 3단계: 문서 생성
- "착공신고서 생성" 버튼 클릭
- 4개 문서가 자동 생성됨
- 각 문서는 한 페이지씩 표시

### 4단계: 확인 및 인쇄
- 생성된 문서 미리보기
- 브라우저 인쇄 기능으로 PDF 저장/인쇄

## 🗂️ 데이터 흐름

```
사용자 입력
    ↓
ConstructionReportManagement.tsx (카드 선택)
    ↓
입력 폼 모달 (보조금 정보)
    ↓
POST /api/construction-reports
    ↓
Supabase: construction_reports 테이블
    ↓
document_history 테이블 (이력)
    ↓
응답: 생성된 문서 데이터
    ↓
4개 템플릿 컴포넌트 렌더링
```

## 🔍 주요 기술 사항

### 날짜 계산
```typescript
// 설치 종료일 = 승인일 + 3개월
const endDate = new Date(approvalDate)
endDate.setMonth(endDate.getMonth() + 3)
```

### 자부담 계산
```typescript
const selfPayment = governmentNoticePrice - subsidyAmount
```

### VAT 계산 (사업장 보관용)
```typescript
const additionalCostVat = Math.round(data.additional_cost * 0.1)
const negotiationCostVat = Math.round(data.negotiation_cost * 0.1)
const totalVat = selfPayment + additionalCostVat + negotiationCostVat
```

### 신고서 번호 생성
```typescript
// 형식: CR-YYYYMMDD-HHMM{random}
// 예: CR-20250125-143521
function generateReportNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') +
               String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CR-${year}${month}${day}-${time}${random}`
}
```

## 📊 데이터 구조

### ConstructionReportData Interface
```typescript
interface ConstructionReportData {
  business_id: string
  business_name: string
  business_address: string
  representative_name: string
  business_number: string
  contact_number: string
  local_government: string
  local_government_head: string
  subsidy_approval_date: string
  government_notice_price: number
  subsidy_amount: number
  self_payment: number
  prevention_facility_names: string[]
  gateway: number
  vpn_type: string
  current_meter: number
  differential_pressure_meter: number
  temperature_meter: number
  additional_cost?: number
  negotiation_cost?: number
  report_date: string
  installation_start_date: string
  installation_end_date: string
}
```

## 🎨 UI/UX 특징

- **모바일 반응형**: 그리드 레이아웃 (1-3열 자동 조정)
- **검색 기능**: 사업장명 실시간 검색
- **자동 계산**: 금액/날짜 자동 계산으로 입력 간소화
- **카드 UI**: 직관적인 사업장 선택
- **모달 폼**: 집중된 입력 경험
- **테이블 레이아웃**: PDF 양식과 동일한 구조

## 🔒 보안 고려사항

- Service Role Key 사용 (서버 사이드 API)
- 필수 필드 검증
- Soft delete (데이터 보존)
- JSONB 저장 (유연한 데이터 구조)
- document_history 이력 추적

## 📈 향후 개선 가능 사항

1. **PDF 생성**: html2pdf 또는 jsPDF 통합
2. **파일 업로드**: Supabase Storage 연동
3. **이메일 전송**: 자동 이메일 발송 기능
4. **미리보기 모달**: 생성 전 문서 미리보기
5. **수정 기능**: 생성된 문서 수정
6. **템플릿 커스터마이징**: 사용자 정의 템플릿

## ✅ 체크리스트

- [x] ConstructionReportManagement 컴포넌트 생성
- [x] 4개 템플릿 컴포넌트 생성
- [x] document-automation 페이지에 탭 추가
- [x] API 엔드포인트 (GET/POST/DELETE) 구현
- [x] SQL 스키마 생성
- [ ] 데이터베이스 테이블 생성 (수동 필요)
- [ ] 기능 테스트
- [ ] PDF 생성 기능 (선택사항)

## 🚀 다음 단계

1. **Supabase Dashboard**에서 SQL 스크립트 실행
2. 개발 서버 재시작
3. `/admin/document-automation` 접속
4. 착공신고서 탭에서 기능 테스트
5. 실제 데이터로 문서 생성 확인

---

**구현 완료일**: 2025-11-25
**구현 파일 수**: 8개 (6개 생성, 2개 수정)
**코드 라인 수**: ~1,500줄
