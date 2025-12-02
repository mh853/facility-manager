# PDF 정렬 문제 심층 분석

## 📸 스크린샷 분석

제공하신 이미지를 보면:
- **구비서류** 섹션이 표시됨
- 번호가 1, 2, 3, 4, 5로 나열됨
- 각 항목이 적절히 정렬되어 보임

## 🔍 가능한 원인들

### 1. 브라우저 기본 스타일 충돌
**문제**: `list-style-position: outside`가 PDF 렌더링에서 예상과 다르게 작동
**증상**: 번호가 텍스트와 다른 baseline에 렌더링됨

### 2. 폰트 메트릭 문제
**문제**: 'Malgun Gothic' 폰트의 숫자와 한글 baseline이 다름
**증상**: 같은 line-height여도 수직 위치가 다름

### 3. CSS 상속 문제
**문제**: 테이블 셀의 CSS가 `<ol>`/`<li>`에 제대로 상속되지 않음
**증상**: baseStyles의 설정이 무시됨

### 4. PDF 렌더러 특성
**문제**: Playwright의 Chromium이 list-style을 특이하게 처리
**증상**: 브라우저에선 정상이지만 PDF에선 깨짐

## 🎯 정확한 진단이 필요한 정보

다음 정보가 필요합니다:

1. **정확한 증상**:
   - 번호가 위로 올라가 있나요? 아래로 내려가 있나요?
   - 번호와 텍스트 사이 간격이 문제인가요?
   - 특정 번호만 문제인가요? (예: 1번만, 또는 모든 번호)

2. **환경 정보**:
   - PDF를 어떤 뷰어로 보고 계신가요? (Preview, Acrobat, Chrome)
   - 브라우저에서 인쇄 미리보기는 어떻게 보이나요?

3. **비교 테스트**:
   - DOCX 버전은 정상인가요?
   - 다른 PDF 뷰어에서도 같은 문제가 발생하나요?

## 💡 대안 솔루션들

### Solution A: CSS Counter 사용
**장점**: 완벽한 제어 가능
**단점**: 복잡한 CSS

```html
<div style="counter-reset: item;">
  <div style="counter-increment: item; display: flex;">
    <span style="width: 30px;">::before { content: counter(item) ". "; }</span>
    <span>텍스트 내용</span>
  </div>
</div>
```

### Solution B: Flexbox 레이아웃
**장점**: 정확한 정렬 보장
**단점**: 테이블과 혼용 시 복잡

```html
<div style="display: flex; margin-bottom: 6px;">
  <span style="flex: 0 0 30px; font-size: 14px;">1.</span>
  <span style="flex: 1; font-size: 14px;">대기배출시설 설치 허가(신고)증 사본 1부.</span>
</div>
```

### Solution C: Grid 레이아웃
**장점**: 모던하고 안정적
**단점**: PDF 지원 불확실

```html
<div style="display: grid; grid-template-columns: 30px 1fr; gap: 4px; margin-bottom: 6px;">
  <span>1.</span>
  <span>대기배출시설 설치 허가(신고)증 사본 1부.</span>
</div>
```

### Solution D: Inline-Block
**장점**: 가장 안전하고 호환성 높음
**단점**: 수평 정렬만 보장

```html
<div style="margin-bottom: 6px; font-size: 14px; line-height: 1.8;">
  <span style="display: inline-block; width: 30px; vertical-align: top;">1.</span>
  <span style="display: inline-block; width: calc(100% - 34px); vertical-align: top;">대기배출시설 설치 허가(신고)증 사본 1부.</span>
</div>
```

### Solution E: Pre-formatted Text
**장점**: 완전한 제어
**단점**: 유지보수 어려움

```html
<pre style="font-family: 'Malgun Gothic', sans-serif; margin: 0; white-space: pre-wrap; font-size: 14px;">1.  대기배출시설 설치 허가(신고)증 사본 1부.
2.  계약서(사본) 1부.
3.  자부담금 입금 확인증 1부.</pre>
```

## 🧪 디버깅 단계

### 1단계: 문제 재현 및 확인
```bash
# 1. 현재 서버가 최신 코드를 사용하는지 확인
tail -20 /tmp/dev-server-new.log

# 2. PDF 생성 로그 확인
# 착공신고서 다운로드 후 로그 확인

# 3. 브라우저 인쇄 미리보기 테스트
# http://localhost:3002에서 Cmd+P 눌러 확인
```

### 2단계: HTML 직접 확인
```bash
# 생성된 HTML을 파일로 저장해서 확인
# PDF API route에 임시 코드 추가:
# fs.writeFileSync('/tmp/debug-report.html', html, 'utf-8')
```

### 3단계: 폰트 확인
```bash
# 시스템에 Malgun Gothic이 제대로 설치되어 있는지 확인
fc-list | grep -i malgun

# 폰트가 없으면 대체 폰트 사용
# font-family: Arial, Helvetica, sans-serif;
```

## 📊 체크리스트

현재 상태 확인:
- [ ] 서버가 최신 코드로 재시작되었는가?
- [ ] 브라우저 캐시를 지웠는가?
- [ ] 새로운 PDF를 생성했는가? (이전 다운로드가 아님)
- [ ] PDF 뷰어를 변경해서 테스트했는가?
- [ ] 브라우저 인쇄 미리보기도 같은 문제가 있는가?

## 🎯 권장 조치

1. **즉시**: 위 체크리스트 확인
2. **정확한 스크린샷**: 문제가 보이는 PDF의 정확한 스크린샷 제공
3. **대안 시도**: Solution D (Inline-Block) 구현 테스트
4. **폰트 변경**: Arial 폰트로 테스트

## 📝 다음 단계

사용자에게 다음 정보를 요청:
1. 정확히 어떤 부분이 정렬되지 않는지 설명
2. PDF 뷰어 정보
3. 브라우저 인쇄 미리보기 결과
4. 스크린샷에서 빨간 동그라미나 화살표로 문제 부분 표시
