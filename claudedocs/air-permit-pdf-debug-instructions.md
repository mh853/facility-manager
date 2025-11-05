# Air Permit PDF Generation Debug Instructions

## 변경 일시
2025-11-04

## 문제 상황
`/admin/air-permit-detail` 페이지에서 PDF 출력이 작동하지 않음

## 수행된 작업

### 1. 코드 분석
다음 파일들을 분석하여 PDF 생성 프로세스 확인:
- `app/admin/air-permit-detail/page.tsx` (lines 908-955) - PDF 생성 함수
- `app/api/air-permit-pdf/route.ts` - PDF 데이터 준비 API
- `utils/korean-pdf-generator.ts` - 한글 지원 PDF 생성 유틸리티

### 2. 디버깅 로그 추가
`app/admin/air-permit-detail/page.tsx`의 `generatePDF` 함수에 상세한 로그 추가 (lines 908-987)

**추가된 로그 포인트:**
- ✅ PDF 생성 시작 확인
- ✅ permitDetail 존재 확인
- ✅ API 호출 시작
- ✅ API 응답 상태 확인
- ✅ 응답 데이터 구조 확인
- ✅ PDF 라이브러리 로딩 확인
- ✅ Blob 생성 확인
- ✅ 다운로드 시작 확인
- ✅ 오류 상세 정보 (name, message, stack)
- ✅ 프로세스 종료 확인

## 다음 단계: 사용자 액션 필요

### 테스트 수행 방법

1. **개발 서버 실행**
   ```bash
   npm run dev
   ```

2. **페이지 접속**
   - URL: `http://localhost:3000/admin/air-permit-detail`
   - 대기필증 상세 정보가 있는 페이지로 이동

3. **브라우저 개발자 도구 열기**
   - Chrome/Edge: `F12` 또는 `Ctrl+Shift+I`
   - Firefox: `F12`
   - Safari: `Cmd+Option+I` (Mac)

4. **Console 탭 확인**
   - Console 탭으로 이동
   - 기존 로그 삭제 (Clear console)

5. **PDF 생성 버튼 클릭**
   - "PDF 다운로드" 또는 "대기필증 PDF 출력" 버튼 클릭

6. **로그 확인**
   - Console에 나타나는 모든 로그 메시지 확인
   - 특히 다음 기호가 포함된 메시지 주목:
     - 📄 - PDF 생성 시작
     - 🔄 - 진행 중인 작업
     - ✅ - 성공한 단계
     - ❌ - 실패한 단계
     - 💥 - 오류 발생

### 예상 로그 흐름 (정상 작동 시)

```
📄 PDF 생성 시작 - permitId: abc-123-def
🔄 API 호출 중...
📡 API 응답: 200 true
📋 API 응답 데이터: {success: true, data: {...}}
✅ PDF 데이터 수신 완료
🔄 PDF 생성 라이브러리 로딩 중...
✅ PDF 생성 라이브러리 로드 완료
🔄 PDF Blob 생성 중...
✅ PDF Blob 생성 완료: 123456 bytes
📥 PDF 다운로드 시작: 대기필증_사업장명_2025-11-04.pdf
✅ PDF 생성 및 다운로드 완료
🏁 PDF 생성 프로세스 종료
```

### 오류 발생 시 확인 사항

로그에서 다음 정보를 찾아주세요:

1. **어느 단계에서 멈췄는지**
   - 마지막으로 출력된 ✅ 또는 🔄 메시지 확인

2. **오류 메시지**
   - ❌ 또는 💥 기호가 있는 메시지
   - 오류 상세 정보 (name, message, stack)

3. **API 응답 상태**
   - 200이 아닌 경우 실제 응답 상태 코드
   - API 오류 응답 내용

4. **데이터 구조 문제**
   - API 응답 데이터가 비어있는지
   - permitId가 올바르게 전달되는지

## 가능한 오류 시나리오별 원인

### 1. permitDetail이 없습니다
**원인**: 페이지에 대기필증 데이터가 로드되지 않음
**확인**: 페이지에 대기필증 정보가 표시되는지 확인

### 2. API 호출 실패
**원인**:
- 네트워크 문제
- API 라우트 오류
- 데이터베이스 연결 문제

**확인**:
- Network 탭에서 `/api/air-permit-pdf` 요청 확인
- 서버 터미널에 오류 메시지가 있는지 확인

### 3. PDF 라이브러리 로딩 실패
**원인**:
- `html2canvas` 또는 `jspdf` 패키지 문제
- 동적 import 실패

**확인**:
```bash
npm list html2canvas jspdf
```

### 4. PDF Blob 생성 실패
**원인**:
- HTML 렌더링 문제
- Canvas 변환 오류
- 메모리 부족

**확인**:
- 브라우저 콘솔에 Canvas 관련 오류가 있는지
- 페이지의 DOM 구조가 정상인지

## 디버깅 후 보고 사항

다음 정보를 제공해주세요:

1. **Console 로그 전체 내용** (복사하여 붙여넣기)
2. **멈춘 단계** (마지막 ✅ 메시지)
3. **오류 메시지** (있는 경우)
4. **브라우저 종류 및 버전**
5. **네트워크 탭의 API 요청 상태** (있는 경우)

## 임시 해결 방법

PDF 생성이 계속 실패하는 경우 임시 조치:

1. **브라우저 캐시 삭제**
   - `Ctrl+Shift+Delete` → 캐시 삭제

2. **다른 브라우저로 테스트**
   - Chrome, Edge, Firefox 등

3. **개발 서버 재시작**
   ```bash
   # 서버 종료 (Ctrl+C)
   npm run dev
   ```

4. **node_modules 재설치**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## 관련 파일

- 페이지: `app/admin/air-permit-detail/page.tsx` (lines 908-987)
- API: `app/api/air-permit-pdf/route.ts`
- PDF 생성기: `utils/korean-pdf-generator.ts`
- 의존성: `html2canvas@1.4.1`, `jspdf@3.0.3`, `jspdf-autotable@5.0.2`

## 기술 정보

### PDF 생성 프로세스

1. **데이터 준비** (API 호출)
   - permitId로 대기필증 상세 정보 조회
   - 배출구, 배출시설, 방지시설 정보 포함
   - PDF 생성에 필요한 구조로 변환

2. **HTML 생성** (PDF Generator)
   - 한글 폰트 지원 HTML 템플릿 생성
   - Noto Sans KR, Malgun Gothic 폰트 스택 사용
   - 테이블, 리스트 등 구조화된 레이아웃

3. **Canvas 변환** (html2canvas)
   - HTML을 Canvas로 렌더링
   - 고해상도 설정 (scale: 2)
   - 한글 폰트 렌더링 대기

4. **PDF 변환** (jsPDF)
   - Canvas를 이미지로 변환
   - A4 페이지에 맞춤
   - 다중 페이지 처리 (필요 시)

5. **다운로드**
   - Blob 생성
   - 파일명: `대기필증_{사업장명}_{날짜}.pdf`
   - 브라우저 다운로드 트리거

### 시스템 요구사항

- 모던 브라우저 (Chrome 90+, Edge 90+, Firefox 88+, Safari 14+)
- JavaScript 활성화
- Canvas API 지원
- 최소 100MB 여유 메모리 (대용량 PDF 생성 시)
