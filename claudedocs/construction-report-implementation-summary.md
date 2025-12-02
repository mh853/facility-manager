# 착공신고서 템플릿 방식 전환 완료

## 작업 완료 시간
2024년 11월 25일

## 완료된 작업 요약

### 1. 기술 스택 변경
- **이전**: `docx` 라이브러리를 사용한 programmatic 문서 생성 (1000+ 줄 코드)
- **이후**: `docxtemplater` + `pizzip`를 사용한 template 기반 생성 (200 줄 코드)

### 2. 설치된 패키지
```bash
npm install docxtemplater pizzip
```

### 3. 수정된 파일

**[수정] `/app/api/construction-reports/download/route.ts`**
- 완전히 재작성: programmatic → template 방식
- 코드 라인 수: 1,078줄 → 177줄 (84% 감소)
- 템플릿 경로: `양식/☆착공신고서 템플릿.docx`
- 55개의 플레이스홀더 자동 치환

**[신규] `/claudedocs/construction-report-placeholders.md`**
- 모든 사용 가능한 플레이스홀더 목록
- 사용 예시 및 포맷팅 규칙
- 조건부 표시 방법
- 반복 영역 (방지시설) 사용법

**[신규] `/claudedocs/construction-report-template-guide.md`**
- Word 템플릿 작성 방법
- 단계별 가이드
- 예시 구조
- 테스트 방법
- 추가 개발 가이드

## 주요 기능

### 자동 포맷팅
- **숫자**: 천단위 콤마 자동 추가 (5000000 → 5,000,000)
- **날짜**: YYYY.MM.DD 형식 (2024.11.25)
- **성명**: 글자 사이 공백 (김유정 → 김 유 정)

### 플레이스홀더 카테고리
1. **기본 정보** (8개): 사업장명, 주소, 전화, 팩스, 사업자등록번호, 대표자, 지자체장
2. **날짜 정보** (6개): 년/월/일, 승인일, 부착기간
3. **금액 정보** (8개): 공고금액, 보조금, 자부담액, 부가세 포함 금액 등
4. **설치 품목** (7개): 게이트웨이, VPN타입, 전류계, 차압계, 온도계, PH계
5. **방지시설** (반복 배열): 시설명, 용량, 수량

### 데이터 흐름
```
Supabase DB
    ↓
construction_reports 테이블 조회
    ↓
report_data 파싱 및 포맷팅
    ↓
템플릿 파일 읽기 (☆착공신고서 템플릿.docx)
    ↓
플레이스홀더 치환 (docxtemplater)
    ↓
DOCX 파일 생성
    ↓
브라우저 다운로드
```

## 템플릿 파일 위치

### 현재 상태
```
/Users/mh.c/claude/facility-manager/
└── 양식/
    ├── @_발주서(에코센스_KT무선)_250701.xlsx  (기존)
    └── ☆착공신고서 템플릿.docx              (사용자 생성 대기)
```

### 템플릿 파일 요구사항
- **파일명**: `☆착공신고서 템플릿.docx` (정확히 이 이름)
- **형식**: Word 문서 (.docx)
- **내용**: 플레이스홀더가 포함된 레이아웃
- **위치**: 프로젝트 루트의 `양식` 폴더

## 사용 방법

### 템플릿 작성
1. Word에서 새 문서 생성
2. 원하는 레이아웃 구성 (표, 텍스트, 스타일)
3. 데이터 위치에 `{{placeholder_name}}` 삽입
4. `☆착공신고서 템플릿.docx`로 저장
5. `양식` 폴더에 저장

### 다운로드 테스트
1. 브라우저에서 관리자 페이지 접속
2. 문서 자동화 → 착공신고서 목록
3. 다운로드 버튼 클릭
4. 생성된 파일 열어서 확인

## 장점

### 비개발자 친화적
✅ Word에서 직접 레이아웃 편집
✅ 개발 지식 불필요
✅ 표, 폰트, 색상 자유롭게 설정
✅ 실제 인쇄물과 동일한 미리보기

### 개발 효율성
✅ 코드 84% 감소 (1,078줄 → 177줄)
✅ 유지보수 간편
✅ 레이아웃 변경 시 코드 수정 불필요
✅ 버그 발생 가능성 감소

### 확장성
✅ 새 문서 추가 용이
✅ 다국어 지원 가능
✅ 다양한 양식 재사용 가능
✅ 브랜딩 변경 쉬움

## 제약사항 및 해결

### 현재 구현 범위
❗ **1페이지만 구현됨** (착공신고서)
- Page 2: 계약서 (지자체 제출용) - 미구현
- Page 3: 계약서 (사업장 보관용) - 미구현
- Page 4: 개선계획서 - 미구현

### 해결 방법
**옵션 1**: 단일 템플릿 (권장)
- 4페이지를 하나의 Word 파일에 모두 작성
- 페이지 구분은 Word의 페이지 나누기 사용

**옵션 2**: 개별 템플릿
- 각 페이지별로 별도 파일 생성
- API에서 4개 파일을 순서대로 읽어서 병합

## 향후 작업

### 즉시 필요
1. ☆착공신고서 템플릿.docx 파일 작성
2. 다운로드 기능 테스트
3. 레이아웃 및 데이터 확인

### 추가 구현 가능
1. 나머지 3페이지 템플릿 작성
2. 템플릿 버전 관리
3. 다중 템플릿 지원 (지역별 양식 등)
4. 템플릿 미리보기 기능

## 기술 세부사항

### docxtemplater 설정
```typescript
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,  // 반복 영역 지원
  linebreaks: true,     // 줄바꿈 지원
})
```

### 파일 읽기
```typescript
const templatePath = path.join(process.cwd(), '양식', '☆착공신고서 템플릿.docx')
const content = fs.readFileSync(templatePath, 'binary')
const zip = new PizZip(content)
```

### 데이터 렌더링
```typescript
doc.render(templateData)  // 플레이스홀더 치환
const buffer = doc.getZip().generate({
  type: 'nodebuffer',
  compression: 'DEFLATE'
})
```

## 참고 문서

1. **플레이스홀더 가이드**: `/claudedocs/construction-report-placeholders.md`
   - 전체 플레이스홀더 목록
   - 사용 예시
   - 포맷팅 규칙

2. **구현 가이드**: `/claudedocs/construction-report-template-guide.md`
   - 템플릿 작성 방법
   - 테스트 방법
   - 추가 개발 가이드

3. **React 컴포넌트 참고**:
   - `/app/admin/document-automation/components/construction-report/ConstructionReportTemplate.tsx`
   - `/app/admin/document-automation/components/construction-report/ContractGovernmentTemplate.tsx`
   - `/app/admin/document-automation/components/construction-report/ContractBusinessTemplate.tsx`
   - `/app/admin/document-automation/components/construction-report/ImprovementPlanTemplate.tsx`

## 빌드 상태

✅ **빌드 성공**
- 타입스크립트 오류 없음
- 런타임 테스트 준비 완료

## 주의사항

⚠️ **템플릿 파일 경로**: 정확히 `양식/☆착공신고서 템플릿.docx` 이어야 함
⚠️ **플레이스홀더 형식**: 반드시 `{{name}}` 형식 (중괄호 2개)
⚠️ **파일 인코딩**: UTF-8 권장
⚠️ **Word 버전**: .docx 형식만 지원 (.doc 구형식 불가)

## 성공 기준

✅ 템플릿 파일이 `/양식` 폴더에 존재
✅ 다운로드 시 오류 없이 DOCX 파일 생성
✅ 모든 플레이스홀더가 올바른 데이터로 치환
✅ 레이아웃이 템플릿대로 유지
✅ 숫자 포맷팅 (콤마), 날짜 포맷팅 정상 작동
