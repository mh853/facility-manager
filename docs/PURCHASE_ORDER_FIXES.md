# 발주서 시스템 수정 사항

## 수정 일시
2025-11-03

## 수정 내용

### 0-1. Supabase Storage 파일명 문제 해결 ⚠️⚠️

**문제**: 엑셀 다운로드 시 500 에러 발생
```
StorageApiError: Invalid key: documents/purchase-orders/.../발주서_고려산업 주식회사(당진)_2025-11-03T02-06-21-912Z.xlsx
```

**원인**:
- Supabase Storage는 파일 경로에 **한글, 공백, 특수문자**를 허용하지 않음
- `발주서_고려산업 주식회사(당진)_...` ← 한글과 공백 모두 문제
- 영문, 숫자, 하이픈(-), 언더스코어(_), 슬래시(/)만 허용

**수정 사항**:
- 스토리지 저장용 파일명: business_id + timestamp (영문/숫자만)
  - 예: `purchase_order_3516bac3-dad5-4dea-87d8-a240945c4a30_2025-11-03T02-11-54-278Z.xlsx`
- 사용자 표시용 파일명: 한글 원본 유지
  - 예: `발주서_고려산업 주식회사(당진)_2025-11-03T02-11-54-278Z.xlsx`

**코드 수정**:
```typescript
// 스토리지용: business_id와 timestamp만 사용 (한글 제외)
const fileName = `purchase_order_${body.business_id}_${timestamp}.${fileExtension}`

// 사용자에게 보여줄 한글 파일명
const displayFileName = `발주서_${body.data.business_name}_${timestamp}.${fileExtension}`
```

**영향 받는 파일**:
- `/app/api/document-automation/purchase-order/route.ts:281-290`
- `/app/api/document-automation/purchase-order/route.ts:318` (DB 저장시 displayFileName 사용)
- `/app/api/document-automation/purchase-order/route.ts:344` (응답시 displayFileName 사용)

### 0-2. CSRF 보호 제외 설정 추가 ⚠️

**문제**: 엑셀 다운로드 버튼 클릭 시 CSRF validation 실패

**에러 로그**:
```
[SECURITY] CSRF validation failed for undefined on /api/document-automation/purchase-order
```

**원인**: document-automation API가 CSRF 보호 제외 목록에 없었음

**수정 사항**:
- `lib/security/csrf-protection.ts`의 `excludePatterns`에 `/api/document-automation/*` 추가
- JWT 인증을 사용하는 다른 API들과 동일하게 CSRF 보호 제외 처리

**영향 받는 파일**:
- `/lib/security/csrf-protection.ts:122`

**기술적 배경**:
- document-automation API는 JWT 토큰 기반 인증 사용 (`checkUserPermission`)
- CSRF 보호는 쿠키 기반 세션에 필요하지만, JWT는 자체적으로 안전
- 다른 JWT 기반 API들(order-management, facility-tasks 등)과 동일한 방식으로 처리

### 1. 다중 굴뚝(multiple_stack) 항목 제거

**문제**: 발주서에 다중 굴뚝 항목이 필요하지 않음

**수정 사항**:
- `app/api/document-automation/purchase-order/route.ts`에서 `multiple_stack` 제거
- `types/document-automation.ts`에서 `multiple_stack` 타입 제거

**영향 받는 파일**:
- `/app/api/document-automation/purchase-order/route.ts:113`
- `/types/document-automation.ts:98`

### 2. 제조사별 원가 정보 연동

**문제**: 하드코딩된 단가를 사용하여 실제 원가 정보와 금액이 다름

**수정 사항**:
- `manufacturer_pricing` 테이블에서 제조사별 실제 원가 조회
- 사업장의 제조사에 따라 동적으로 단가 적용
- 현재 적용 중인 가격만 조회 (`effective_to IS NULL`)

**구현 로직**:
```typescript
// manufacturer_pricing 테이블에서 제조사별 원가 조회
const { data: pricingData, error: pricingError } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('equipment_type, cost_price')
  .eq('manufacturer', business.manufacturer)
  .is('effective_to', null) // 현재 적용중인 가격만
```

**영향 받는 파일**:
- `/app/api/document-automation/purchase-order/route.ts:157-180`

### 3. 품목명 매핑 개선

**문제**: 품목명이 데이터베이스와 일치하지 않음

**수정 사항**:
- `equipmentTypeMapping`: API 키 → 데이터베이스 컬럼명 매핑
- `equipmentNames`: 품목 한글명 통일 (manufacturer_pricing 테이블과 일치)

**수정된 품목명**:
| 기존 | 수정 후 |
|------|---------|
| 배출 CT | 배출전류계 |
| 송풍 CT | 송풍전류계 |
| 펌프 CT | 펌프전류계 |
| VPN 라우터 (유선) | VPN(유선) |
| VPN 라우터 (무선) | VPN(무선) |
| 방폭 차압계 (국산) | 방폭차압계(국산) |
| 방폭 온도계 (국산) | 방폭온도계(국산) |
| 확장 장치 | 확장디바이스 |
| 릴레이 8채널 | 중계기(8채널) |
| 릴레이 16채널 | 중계기(16채널) |
| 메인보드 교체 | 메인보드교체 |

## 테스트 방법

1. 개발 서버 접속: `http://localhost:3001/admin/document-automation`
2. "발주서 관리" 탭 클릭
3. 사업장 선택 (예: "고려산업 주식회사(양지)")
4. 발주서 모달에서 확인:
   - ✅ 다중 굴뚝 항목이 표시되지 않음
   - ✅ 품목명이 올바르게 표시됨
   - ✅ 단가가 제조사별 원가와 일치함
5. 브라우저 콘솔에서 로그 확인:
   ```
   [PURCHASE-ORDER] 조회된 단가: {
     manufacturer: 'ecosense',
     pricesCount: 9,
     prices: { ph_meter: 800000, ... }
   }
   ```

## 제조사별 원가 예시

### ecosense
- PH센서: 800,000원
- 차압계: 320,000원
- 온도계: 400,000원
- 게이트웨이: 1,280,000원
- VPN(유선): 320,000원
- VPN(무선): 320,000원

### cleanearth
- PH센서: 850,000원
- 차압계: 340,000원
- 온도계: 420,000원
- 게이트웨이: 1,350,000원
- VPN(유선): 340,000원
- VPN(무선): 340,000원

### gaia_cns
- PH센서: 820,000원
- 차압계: 330,000원
- 온도계: 410,000원
- 게이트웨이: 1,300,000원
- VPN(유선): 330,000원
- VPN(무선): 330,000원

### evs
- PH센서: 780,000원
- 차압계: 310,000원
- 온도계: 390,000원
- 게이트웨이: 1,250,000원
- VPN(유선): 310,000원
- VPN(무선): 310,000원

## PDF 한글 폰트 문제

### 문제
- jsPDF는 기본적으로 한글 폰트를 지원하지 않음
- PDF 생성 시 한글이 깨져서 표시됨 (`¼ Èü Á`, `ÅÐÏTÁ<Â¤` 등)

### 해결 방법
1. **단기 해결**: PDF 버튼 비활성화, Excel 사용 권장
   - Excel은 한글 완벽 지원
   - 실무에서 수정 가능한 Excel이 더 실용적

2. **장기 해결** (향후 개선):
   - 한글 폰트 파일을 base64로 변환하여 jsPDF에 추가
   - `jspdf-font-converter` 도구 사용
   - Noto Sans KR 또는 Malgun Gothic 폰트 적용
   - 파일 크기 증가 및 빌드 시간 고려 필요

### 현재 상태
- PDF 다운로드 버튼: 비활성화 ("준비중" 표시)
- Excel 다운로드: 정상 작동 (권장)

## 참고

- 원가 정보는 `manufacturer_pricing` 테이블에서 관리됨
- 가격 변경 시 `effective_to` 컬럼을 업데이트하여 이력 관리
- 현재 적용 중인 가격은 `effective_to IS NULL`로 조회
- **발주서는 Excel 형식 사용 권장** (한글 지원, 수정 가능)
