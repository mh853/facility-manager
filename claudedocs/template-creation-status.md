# 착공신고서 템플릿 생성 - 현재 상태

## 📅 작성일
2025년 11월 26일

## 🔍 문제 요약

착공신고서 DOCX 다운로드 시스템에서 템플릿 기반 방식으로 전환 중 **Korean placeholder 파싱 오류** 발생

## ⚠️ 핵심 문제

### 원래 문제
사용자가 만든 템플릿 파일에서 플레이스홀더가 Word XML 구조상 여러 `<w:t>` 태그로 분할되어 docxtemplater가 파싱 실패

### 시도한 해결방법들

1. ✅ **Python-docx로 템플릿 생성** → 동일한 XML 분할 문제 발생
2. ✅ **XML 직접 작성** → 생성 시에는 정상이나 ZIP/읽기 과정에서 문제 발생
3. ✅ **XML 주석 제거** → 변화 없음
4. ❌ **모든 방법에서 동일한 "Duplicate open/close tag" 오류**

### 오류 패턴

```
Error: Duplicate open tag, expected one open tag
  xtag: "{{사업장명"
  context: "{{사업장명"
  offset: 40
  explanation: "The tag beginning with \"{{사업장명\" has duplicate open tags"
```

모든 한글 플레이스홀더에서 발생:
- `{{사업장명}}` ❌
- `{{주소}}` ❌
- `{{회사연락처}}` ❌
- `{{팩스번호}}` ❌
- 등등...

### 생성된 파일

| 파일명 | 상태 | 설명 |
|-------|------|------|
| `☆착공신고서 템플릿.docx` | ❌ 오류 | 사용자 원본 (XML 분할) |
| `☆착공신고서 템플릿_깨끗한버전.docx` | ❌ 오류 | python-docx 생성 |
| `☆착공신고서 템플릿_최종.docx` | ❌ 오류 | XML 직접 작성 |
| `☆착공신고서 템플릿_최종_주석제거.docx` | ❌ 오류 | XML 주석 제거 |

## 💡 추정 원인

Korean 문자 처리 시 ZIP 라이브러리나 docxtemplater lexer에서 **multi-byte 문자 인코딩 문제** 가능성:

1. 한글은 UTF-8에서 3바이트 문자
2. ZIP 압축/해제 과정에서 바이트 레벨 처리 시 분할 가능
3. docxtemplater가 텍스트를 읽을 때 Korean 문자를 올바르게 처리 못함

## 🔧 대안 솔루션

### Option A: 영어 플레이스홀더 사용 (권장)
```xml
<!-- 한글 대신 영어 사용 -->
<w:t>{{business_name}}</w:t>
<w:t>{{address}}</w:t>
<w:t>{{company_phone}}</w:t>
```

**장점**:
- ASCII 문자로 인코딩 문제 회피
- 대부분의 docxtemplater 예제가 영어 사용
- 검증된 안정적인 방식

**단점**:
- API 코드에서 영어 키로 매핑 필요

### Option B: 다른 템플릿 라이브러리 사용
- `docx-templates` - 다른 템플릿 엔진
- `easy-template-x` - 또 다른 대안
- `carbone` - 상용 솔루션

### Option C: 프로그래매틱 방식 유지
- 기존 코드 사용 (1,078 줄)
- 레이아웃 완벽 제어 가능
- 템플릿 파일 불필요

## 📋 다음 단계

### 1. 영어 플레이스홀더로 재시도
```typescript
// API 코드
const templateData = {
  business_name: data.business_name || '',
  address: data.address || '',
  company_phone: data.business_contact || '',
  // ...
}
```

```xml
<!-- 템플릿 파일 -->
<w:t>{{business_name}}</w:t>
<w:t>{{address}}</w:t>
```

### 2. 테스트 절차
1. 영어 플레이스홀더로 템플릿 재생성
2. docxtemplater로 파싱 테스트
3. 실제 데이터로 렌더링 테스트
4. 다운로드 기능 통합 테스트

## 📦 생성된 스크립트

- ✅ `scripts/create_clean_template.py` - python-docx 템플릿 생성
- ✅ `scripts/create_minimal_template.py` - XML 직접 작성
- ✅ `scripts/fix_template_xml.py` - XML 수정 시도 (실패)
- ✅ `scripts/remove_comments_from_template.py` - XML 주석 제거
- ✅ `scripts/verify_clean_template.js` - 템플릿 검증

## 🎯 결론

**한글 플레이스홀더는 현재 docxtemplater + pizzip 조합에서 정상 작동하지 않음**

→ **영어 플레이스홀더로 전환 필요**
