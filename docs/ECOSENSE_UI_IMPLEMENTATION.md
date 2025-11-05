# 에코센스 발주서 - UI 구현 완료

## 📅 구현 일시
2025-11-03

## ✅ 완료된 작업

### 방식 전환: Excel 템플릿 → HTML/CSS UI

**이전 방식**: ExcelJS로 템플릿 파일을 열어서 셀 값 수정
**새로운 방식**: HTML/CSS로 발주서 폼을 직접 구현하여 웹에서 표시

**장점**:
- ✅ 완전한 제어와 안정성
- ✅ 실시간 미리보기 가능
- ✅ 프린트/PDF 최적화
- ✅ 데이터 바인딩 명확
- ✅ 유지보수 용이

## 📂 구현 파일

### 1. 발주서 UI 컴포넌트 ✅
**파일**: `components/EcosensePurchaseOrderForm.tsx`

**기능**:
- React 컴포넌트로 발주서 폼 구현
- 데이터 바인딩 (`PurchaseOrderDataEcosense` 타입)
- 품목 필터링 (수량 > 0인 항목만 표시)
- 전류계 굵기 자동 계산
- 프린트 최적화 CSS 내장

**주요 섹션**:
```typescript
- 헤더 (제품 발주서)
- 품목 섹션 (동적 테이블)
- 설치 희망일자
- 사업장 정보 테이블
- VPN 설정 체크박스
- 전류계 굵기 테이블
- 하단 블루온 담당자 정보
```

### 2. 미리보기 페이지 ✅
**파일**: `app/admin/document-automation/purchase-order-preview/[businessId]/page.tsx`

**기능**:
- 사업장 ID로 발주서 데이터 조회
- 발주서 컴포넌트 렌더링
- 인쇄하기 버튼
- PDF로 저장 버튼
- 로딩 및 에러 처리

**라우트**: `/admin/document-automation/purchase-order-preview/[businessId]`

### 3. 문서 자동화 페이지 업데이트 ✅
**파일**: `app/admin/document-automation/page.tsx`

**변경사항**:
- "미리보기" 버튼 추가 (녹색)
- 새 탭으로 미리보기 페이지 열기
- Eye 아이콘 추가

```typescript
<button onClick={() => window.open(`/admin/document-automation/purchase-order-preview/${business.business_id}`, '_blank')}>
  <Eye className="w-4 h-4" />
  미리보기
</button>
```

## 🎨 UI 레이아웃

### 화면 구성
```
┌─────────────────────────────────────────┐
│         제 품 발 주 서                     │
│         담당자: 김문수                     │
├─────────────────────────────────────────┤
│ 발주 품목                                 │
│ ┌───────────┬─────┐                      │
│ │ 항목명     │ 수량 │                      │
│ ├───────────┼─────┤                      │
│ │ PH센서     │  2  │                      │
│ │ 게이트웨이  │  1  │                      │
│ └───────────┴─────┘                      │
├─────────────────────────────────────────┤
│ 설치(납품) 희망일자: 2025-11-10           │
├─────────────────────────────────────────┤
│ 설치 사업장 정보                          │
│ ┌──────────┬──────────┬────────┬────────┐│
│ │사업장명   │ 담당자명 │ 연락처  │ 이메일 ││
│ ├──────────┼──────────┼────────┼────────┤│
│ │ 주소     │                            ││
│ └──────────┴────────────────────────────┘│
├─────────────────────────────────────────┤
│ VPN 설정                                 │
│ ☑ 유선    ☐ 무선                         │
├─────────────────────────────────────────┤
│ 전류계 굵기                               │
│ ┌──────────┬────┬────┬────┐              │
│ │ 구분      │16L │24L │36L │              │
│ ├──────────┼────┼────┼────┤              │
│ │송풍+펌프  │ 3  │ 0  │ 0  │              │
│ └──────────┴────┴────┴────┘              │
├─────────────────────────────────────────┤
│ 블루온 담당자: 김문수                      │
│ 연락처: 010-4320-3521                     │
│ 이메일: seoh1521@gmail.com                │
└─────────────────────────────────────────┘
```

## 🖨️ 프린트 최적화

### CSS 설정
```css
@media print {
  @page {
    size: A4;
    margin: 15mm;
  }

  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .no-print {
    display: none !important;
  }
}
```

### 프린트 기능
1. **브라우저 인쇄**: `window.print()`
2. **PDF 저장**: 브라우저 인쇄 다이얼로그 → "PDF로 저장" 선택
3. **인쇄 프리뷰**: 자동으로 A4 용지 크기에 맞춤

## 📋 데이터 흐름

```
1. 사용자: "미리보기" 버튼 클릭
   ↓
2. 새 탭 열림: /admin/document-automation/purchase-order-preview/[businessId]
   ↓
3. GET API 호출: /api/document-automation/purchase-order?business_id=[businessId]
   ↓
4. 데이터 조회:
   - business_info 테이블에서 사업장 정보
   - equipment 수량 정보
   - 담당자 정보 (manager_name, email 등)
   ↓
5. EcosensePurchaseOrderForm 컴포넌트 렌더링
   - 품목 필터링 (수량 > 0)
   - 전류계 계산
   - 체크박스 설정
   ↓
6. 사용자 액션:
   - "인쇄하기" 버튼 → window.print()
   - "PDF로 저장" 버튼 → 인쇄 다이얼로그 → PDF 선택
```

## 🔧 주요 로직

### 품목 필터링
```typescript
const equipmentItems = [
  { name: 'PH센서', count: data.equipment.ph_sensor || 0 },
  { name: '차압계', count: data.equipment.differential_pressure_meter || 0 },
  { name: '온도계', count: data.equipment.temperature_meter || 0 },
  { name: '게이트웨이', count: data.equipment.gateway || 0 },
  { name: 'VPN(유선)', count: data.equipment.vpn_router_wired || 0 },
  { name: 'VPN(무선)', count: data.equipment.vpn_router_wireless || 0 },
  { name: '확장디바이스', count: data.equipment.expansion_device || 0 }
].filter(item => item.count > 0)
```

### 전류계 계산
```typescript
const fanPumpTotal = (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)
const dischargeCt = data.equipment.discharge_ct || 0
```

### VPN 체크박스
```typescript
<input
  type="checkbox"
  checked={data.vpn_type === 'wired' || data.vpn_type === 'lan'}
  readOnly
/>
```

## 🧪 테스트 방법

### 1. 미리보기 테스트

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서
http://localhost:3001/admin/document-automation

# 단계:
1. "발주서 관리" 탭 선택
2. 에코센스 사업장 찾기
3. "미리보기" 버튼 클릭 (녹색)
4. 새 탭에서 발주서 확인
```

### 2. 인쇄/PDF 테스트

```bash
# 미리보기 페이지에서:
1. "인쇄하기" 버튼 클릭
2. 브라우저 인쇄 다이얼로그 확인
3. "PDF로 저장" 선택
4. 저장된 PDF 파일 확인
```

### 3. 확인 사항

- [ ] 품목 항목이 DB 데이터로 정확히 표시
- [ ] 수량이 0인 품목은 숨김 처리
- [ ] 사업장 정보 (이름, 주소, 연락처, 이메일) 정확
- [ ] VPN 체크박스 상태 정확
- [ ] 전류계 굵기 계산 정확
- [ ] 블루온 담당자 정보 표시
- [ ] A4 용지에 맞게 프린트
- [ ] PDF 저장 가능

## 💡 이전 방식과의 차이점

### Excel 템플릿 방식 (이전)
```typescript
// 장점
- 기존 Excel 파일 재사용

// 단점
- 셀 위치 하드코딩 (AF3, U21 등)
- 템플릿 기본값 덮어쓰기 문제
- 디버깅 어려움
- 미리보기 불가 (다운로드 후 확인)
- Excel 파일 의존성
```

### HTML/CSS UI 방식 (현재)
```typescript
// 장점
- 완전한 제어
- 실시간 미리보기
- 명확한 데이터 바인딩
- 쉬운 디버깅
- 프린트 최적화
- 브라우저 PDF 생성

// 단점
- 초기 구현 시간
```

## 🚀 다음 개선 가능 사항

### 1. 편집 가능 모드
```typescript
interface EditableFormProps {
  data: PurchaseOrderDataEcosense
  onSave: (updatedData: PurchaseOrderDataEcosense) => void
}
```

### 2. 다른 제조사 템플릿 추가
```typescript
- GaiaCNSPurchaseOrderForm.tsx
- CleanEarthPurchaseOrderForm.tsx
- EVSPurchaseOrderForm.tsx
```

### 3. 이메일 전송 기능
```typescript
const handleSendEmail = async (email: string) => {
  // PDF 생성
  // 이메일 전송 API 호출
}
```

### 4. 발주서 버전 관리
```typescript
interface PurchaseOrderVersion {
  version: number
  created_at: string
  data: PurchaseOrderDataEcosense
}
```

## 📝 관련 문서

- 이전 구현: `docs/ECOSENSE_TEMPLATE_COMPLETE.md` (Excel 템플릿 방식)
- API 문서: `app/api/document-automation/purchase-order/route.ts`
- 타입 정의: `types/document-automation.ts`

## ✨ 구현 완료 체크리스트

- [x] 발주서 UI 컴포넌트 생성
- [x] 프린트 최적화 CSS 작성
- [x] 미리보기 페이지 생성
- [x] 문서 자동화 페이지에 버튼 추가
- [x] 데이터 바인딩 로직 구현
- [x] 품목 필터링 (수량 > 0)
- [x] 전류계 계산
- [x] VPN 체크박스
- [x] 인쇄/PDF 기능
- [x] 로딩 및 에러 처리
- [x] 반응형 레이아웃

## 🎉 성과

1. **안정성 향상** - Excel 셀 위치 의존성 제거
2. **사용자 경험** - 실시간 미리보기 가능
3. **유지보수성** - 명확한 컴포넌트 구조
4. **확장성** - 다른 제조사 템플릿 추가 용이
5. **디버깅** - 브라우저 개발자 도구 활용 가능

## 🚀 다음 세션 시작 가이드

새 세션에서 작업을 계속하려면:

```
에코센스 발주서 UI 구현이 완료되었습니다.
docs/ECOSENSE_UI_IMPLEMENTATION.md 파일을 확인하세요.

완료된 작업:
1. HTML/CSS 발주서 UI 컴포넌트
2. 미리보기 페이지
3. 인쇄/PDF 기능
4. 데이터 바인딩 및 필터링

테스트:
http://localhost:3001/admin/document-automation
→ 발주서 관리 탭 → 에코센스 사업장 → "미리보기" 버튼 클릭
```
