# Air Permit PDF CSRF 보호 수정

## 변경 일시
2025-11-04

## 문제 원인
서버 로그에서 발견된 오류:
```
[SECURITY] CSRF validation failed for undefined on /api/air-permit-pdf
```

PDF 출력 버튼이 작동하지 않는 이유는 **CSRF 보호 시스템**이 `/api/air-permit-pdf` 요청을 차단했기 때문입니다.

## 근본 원인 분석

### CSRF 보호 시스템
- 시스템은 POST 요청에 대해 CSRF 토큰 검증을 수행
- JWT 인증을 사용하는 API는 CSRF 보호에서 제외되어야 함
- `/api/air-permit-pdf`가 제외 목록에 없어서 요청이 차단됨

### 왜 제외해야 하는가?
1. **JWT 인증 사용**: 이 API는 JWT 토큰으로 인증하므로 CSRF 공격 위험이 낮음
2. **다른 PDF API와 일관성**: `/api/document-automation/*` (문서 자동화 API)는 이미 제외되어 있음
3. **사용자 경험**: CSRF 토큰 없이도 안전하게 PDF 생성 가능

## 해결 방법

### 변경 파일
`lib/security/csrf-protection.ts`

### 변경 내용

#### 1. excludePaths 배열에 추가 (line 108)
```typescript
// Before
'/api/delivery-addresses'  // 택배 주소 관리 API (JWT 인증 사용)
];

// After
'/api/delivery-addresses',  // 택배 주소 관리 API (JWT 인증 사용)
'/api/air-permit-pdf'  // 대기필증 PDF 생성 API (JWT 인증 사용)
];
```

#### 2. excludePatterns 배열에도 추가 (line 125)
```typescript
// Before
'/api/document-automation/*'  // 문서 자동화 API 전체 제외 (JWT 인증 사용)
];

// After
'/api/document-automation/*',  // 문서 자동화 API 전체 제외 (JWT 인증 사용)
'/api/air-permit-pdf'  // 대기필증 PDF 생성 API (JWT 인증 사용)
];
```

**참고**:
- `excludePaths`는 정확한 경로 매칭
- `excludePatterns`는 패턴 매칭 지원 (현재는 동일한 경로지만 향후 확장 가능성 대비)

## 보안 검토

### 안전성 확인
✅ **JWT 인증 사용**: API는 JWT 토큰으로 사용자 인증
✅ **읽기 전용 작업**: 데이터 조회만 수행, 수정 없음
✅ **권한 검증**: DatabaseService에서 사용자 권한 확인
✅ **입력 검증**: permitId 검증 및 SQL 인젝션 방지

### CSRF 공격 위험 평가
- **위험도**: 낮음
- **이유**:
  1. JWT 토큰 기반 인증으로 세션 기반 공격 불가
  2. 읽기 전용 작업으로 상태 변경 없음
  3. 민감한 데이터 수정 없음

## 테스트 방법

### 1. 서버 재시작
```bash
# 개발 서버 재시작 (Ctrl+C 후)
npm run dev
```

### 2. PDF 생성 테스트
1. 브라우저에서 `/admin/air-permit-detail` 접속
2. 대기필증 상세 페이지 로드
3. "PDF 다운로드" 버튼 클릭
4. PDF 파일 다운로드 확인

### 3. 서버 로그 확인
정상 작동 시 예상 로그:
```
📋 PDF 생성용 데이터 구성 완료: {
  businessName: '사업장명',
  outletCount: 2,
  totalDischargeFacilities: 5,
  totalPreventionFacilities: 3
}
```

오류가 없어야 합니다. 특히 다음과 같은 로그가 나타나면 안 됩니다:
```
❌ [SECURITY] CSRF validation failed for undefined on /api/air-permit-pdf
```

### 4. 브라우저 Console 확인
예상 로그 (이전에 추가한 디버깅 로그):
```
📄 PDF 생성 시작 - permitId: abc-123
🔄 API 호출 중...
📡 API 응답: 200 true
✅ PDF 데이터 수신 완료
✅ PDF Blob 생성 완료: 123456 bytes
📥 PDF 다운로드 시작
✅ PDF 생성 및 다운로드 완료
```

## 관련 API 제외 목록

현재 CSRF 보호에서 제외된 PDF/문서 관련 API:
- `/api/document-automation/*` - 문서 자동화 전체 (발주서 등)
- `/api/air-permit-pdf` - 대기필증 PDF (이번 수정으로 추가)

## 향후 고려사항

### 다른 PDF API 추가 시
새로운 PDF 생성 API를 추가할 때는 다음을 확인:
1. JWT 인증 사용 여부
2. 읽기 전용 작업인지
3. CSRF 제외 목록 추가 필요성

### 패턴 통합 가능성
여러 PDF API가 추가되면 패턴으로 통합 고려:
```typescript
'/api/*/pdf'  // 모든 PDF 생성 API 제외 (패턴)
```

## 변경 이력
- 2025-11-04: `/api/air-permit-pdf`를 CSRF 제외 목록에 추가하여 PDF 생성 오류 해결

## 관련 문서
- `lib/security/csrf-protection.ts` - CSRF 보호 설정
- `app/api/air-permit-pdf/route.ts` - 대기필증 PDF API
- `claudedocs/air-permit-pdf-debug-instructions.md` - PDF 디버깅 가이드
