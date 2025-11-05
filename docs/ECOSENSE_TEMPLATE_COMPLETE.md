# 에코센스 발주서 - Excel 템플릿 기반 구현 완료

## 📅 구현 일시
2025-11-03

## ✅ 완료된 작업

### 방식 변경: 코드 생성 → 템플릿 기반

**이전 방식**: ExcelJS로 처음부터 발주서 레이아웃을 코드로 생성
**새로운 방식**: 기존 Excel 템플릿 파일을 열어서 데이터만 채우기

**장점**:
- ✅ 템플릿 레이아웃 100% 유지
- ✅ 구현 난이도 대폭 감소
- ✅ 템플릿 수정이 쉬움 (Excel에서 직접 편집)
- ✅ 복잡한 셀 병합, 서식 유지
- ✅ 수식 자동 계산 가능

## 📂 구현 파일

### 1. Excel 템플릿 기반 생성기 ✅
**파일**: `lib/document-generators/excel-generator-ecosense-template.ts`

**기능**:
- `양식/@_발주서(에코센스_KT무선)_250701.xlsx` 템플릿 로드
- DB 데이터를 정확한 셀 위치에 삽입
- 체크박스 처리 (☑/☐)
- 자동 날짜 계산 (설치 희망일: 오늘 +7일)

### 2. API 업데이트 ✅
**파일**: `app/api/document-automation/purchase-order/route.ts`

**변경사항**:
```typescript
// 에코센스 제조사 감지 시 템플릿 기반 생성기 사용
if (body.data.manufacturer === 'ecosense') {
  fileBuffer = await generateEcosensePurchaseOrderFromTemplate(
    body.data as PurchaseOrderDataEcosense
  )
}
```

## 📋 셀 매핑 정보

| 셀 위치 | 데이터 항목 | 데이터 소스 |
|---------|------------|------------|
| **AF3** | 블루온 담당자명 | "김문수" (고정) |
| **K53** | 블루온 담당자명 | "김문수" (고정) |
| **U53** | 블루온 담당자 연락처 | manager_contact 또는 "010-4320-3521" |
| **AJ53** | 블루온 담당자 이메일 | manager_email 또는 "seoh1521@gmail.com" |
| **H12** | 품목명 1 | equipment 중 수량 > 0인 항목 |
| **N12** | 품목명 2 | ... |
| **T12** | 품목명 3 | ... |
| **Z12** | 품목명 4 | ... |
| **AF12** | 품목명 5 | ... |
| **AL12** | 품목명 6 | ... |
| **AR12** | 품목명 7 | ... |
| **H13** | 품목 수량 1 | 12행 항목과 매칭 |
| **N13** | 품목 수량 2 | ... |
| **T13** | 품목 수량 3 | ... |
| **U19** | 설치 희망일자 | 오늘 +7일 (자동 계산) |
| **K21** | 사업장명 | factory_name / business_name |
| **U21** | 담당자명 | manager_name |
| **AE21** | 연락처 | manager_contact |
| **AO21** | 이메일 | manager_email |
| **U22** | 사업장 주소 | factory_address / address |
| **U23** | 택배 주소 | delivery_full_address |
| **U38** | VPN 유선 체크 | vpn_type === 'wired' → ☑ |
| **AJ38** | VPN 무선 체크 | vpn_type === 'wireless' → ☑ |
| **U41** | 송풍+펌프 전류계 (16L) | fan_ct + pump_ct |
| **AE41** | 송풍+펌프 전류계 (24L) | 0 (기본값) |
| **AO41** | 송풍+펌프 전류계 (36L) | 0 (기본값) |
| **U42** | 배출 전류계 (16L) | discharge_ct |
| **AE42** | 배출 전류계 (24L) | 0 (기본값) |
| **AO42** | 배출 전류계 (36L) | 0 (기본값) |
| **U44** | 기본 체크박스 | ☑ (기본값) |
| **AJ44** | 체크박스 | ☐ |

## 🔧 구현 상세

### 품목 항목 동적 처리

```typescript
const equipmentItems = [
  { col: 'H', name: 'PH센서', count: data.equipment.ph_sensor || 0 },
  { col: 'N', name: '차압계', count: data.equipment.differential_pressure_meter || 0 },
  { col: 'T', name: '온도계', count: data.equipment.temperature_meter || 0 },
  { col: 'Z', name: '게이트웨이', count: data.equipment.gateway || 0 },
  { col: 'AF', name: 'VPN(유선)', count: data.equipment.vpn_router_wired || 0 },
  { col: 'AL', name: 'VPN(무선)', count: data.equipment.vpn_router_wireless || 0 },
  { col: 'AR', name: '확장디바이스', count: data.equipment.expansion_device || 0 }
]

// 수량이 있는 항목만 표시
equipmentItems.forEach(item => {
  if (item.count > 0) {
    worksheet.getCell(`${item.col}12`).value = item.name  // 항목명
    worksheet.getCell(`${item.col}13`).value = item.count // 수량
  }
})
```

### 설치 희망일자 자동 계산

```typescript
const today = new Date()
const installationDate = new Date(today)
installationDate.setDate(today.getDate() + 7)  // 오늘 +7일

worksheet.getCell('U19').value = data.installation_desired_date
  || installationDate.toISOString().split('T')[0]
```

### VPN 체크박스 처리

```typescript
const vpnType = data.vpn_type?.toLowerCase() || 'wired'

if (vpnType === 'wired' || vpnType === 'lan') {
  worksheet.getCell('U38').value = '☑'  // 유선 체크
  worksheet.getCell('AJ38').value = '☐'  // 무선 미체크
} else if (vpnType === 'wireless' || vpnType === 'lte') {
  worksheet.getCell('U38').value = '☐'  // 유선 미체크
  worksheet.getCell('AJ38').value = '☑'  // 무선 체크
}
```

### 전류계 굵기 배정

```typescript
// 송풍전류계 + 펌프전류계
const fanPumpTotal = (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)

if (fanPumpTotal > 0) {
  worksheet.getCell('U41').value = fanPumpTotal  // 16L에 모두 배정
  worksheet.getCell('AE41').value = 0            // 24L
  worksheet.getCell('AO41').value = 0            // 36L
}

// 배출전류계
const dischargeCt = data.equipment.discharge_ct || 0

if (dischargeCt > 0) {
  worksheet.getCell('U42').value = dischargeCt   // 16L에 모두 배정
  worksheet.getCell('AE42').value = 0            // 24L
  worksheet.getCell('AO42').value = 0            // 36L
}
```

## 🔄 데이터 흐름

```
1. 사용자: 에코센스 사업장 발주서 생성 버튼 클릭
   ↓
2. GET API: 사업장 데이터 조회
   - manufacturer === 'ecosense' 감지
   - 필요한 모든 필드 준비
   ↓
3. POST API: 발주서 생성
   - generateEcosensePurchaseOrderFromTemplate() 호출
   ↓
4. 템플릿 생성기:
   - 양식/@_발주서(에코센스_KT무선)_250701.xlsx 로드
   - 각 셀에 데이터 삽입
   - 체크박스 처리
   - 날짜 계산
   ↓
5. Supabase Storage 업로드
   ↓
6. 파일 다운로드 (Blob 방식)
```

## 🐛 추가 수정 사항

### 2025-11-03 버그 수정

**문제 1: 12행 품목명이 출력되지 않음**
- **원인**: `data.equipment` 값이 문자열로 저장되어 있어 `count > 0` 조건 실패
- **해결**: `Number()` 변환 추가
```typescript
{ col: 'Z', name: '게이트웨이', count: Number(data.equipment.gateway) || 0 }
```

**문제 2: AO21 이메일이 출력되지 않음**
- **원인**: API GET endpoint에서 `manager_email: undefined`로 설정, DB의 `business.email` 사용하지 않음
- **해결**: API에서 `business.email` 사용하도록 수정
```typescript
// API route.ts:238
manager_email: business.email || 'seoh1521@gmail.com',
```

**문제 3: 12행 항목명이 템플릿 기본값 그대로 출력됨**
- **원인**: 템플릿에 미리 입력된 값이 있어서 덮어쓰지 못함
- **해결**: 품목 셀을 먼저 `null`로 초기화한 후 DB 데이터 입력
```typescript
// 템플릿 기본값 제거
const allColumns = ['H', 'N', 'T', 'Z', 'AF', 'AL', 'AR']
allColumns.forEach(col => {
  worksheet.getCell(`${col}12`).value = null
  worksheet.getCell(`${col}13`).value = null
})

// 그 다음 DB 데이터로 채우기
equipmentItems.forEach(item => {
  if (item.count > 0) {
    worksheet.getCell(`${item.col}12`).value = item.name
    worksheet.getCell(`${item.col}13`).value = item.count
  }
})
```

**문제 4: 사업장 담당자 정보 매핑 개선**
- **원인**: `data.manager_name` 대신 `data.factory_manager` 사용 필요
- **해결**: 우선순위 체인 추가
```typescript
worksheet.getCell('U21').value = data.factory_manager || data.manager_name || ''
worksheet.getCell('AE21').value = data.factory_contact || data.manager_contact || ''
```

## 🧪 테스트 방법

### 1. 에코센스 사업장 발주서 생성

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서
http://localhost:3000/admin/document-automation

# 단계:
1. "발주서 관리" 탭 선택
2. 제조사가 "에코센스"인 사업장 선택
3. 발주서 생성 버튼 클릭
4. 다운로드된 Excel 파일 확인
```

### 2. 확인 사항

- [ ] 템플릿 레이아웃 유지
- [ ] 블루온 담당자 정보 (AF3, K53, U53, AJ53)
- [ ] 품목 항목 및 수량 (12-13행)
- [ ] 설치 희망일자 (U19) = 오늘 +7일
- [ ] 사업장 정보 (K21, U21, AE21, AO21)
- [ ] 주소 정보 (U22, U23)
- [ ] VPN 체크박스 (U38 또는 AJ38)
- [ ] 전류계 굵기 (U41, U42)
- [ ] 기본 체크박스 (U44)

### 3. 다른 제조사 테스트

```bash
# 가이아씨앤에스, 크린어스, EVS 사업장 선택
# 기본 템플릿 사용되는지 확인
```

## 🌐 웹 UI로 템플릿 렌더링

**질문**: "템플릿을 그대로 시스템에 ui로 그려서 웹에서 바로 보여주게 할 수 있어?"

**답변**: 가능합니다! 여러 방법이 있습니다:

### 방법 1: SheetJS (추천)
```bash
npm install xlsx
```

```typescript
import * as XLSX from 'xlsx'

// Excel 파일을 HTML로 변환
const workbook = XLSX.readFile('템플릿.xlsx')
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const html = XLSX.utils.sheet_to_html(worksheet)

// 또는 JSON으로 변환하여 React 컴포넌트로 렌더링
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
```

### 방법 2: react-spreadsheet / x-spreadsheet
```bash
npm install react-spreadsheet
```

- Excel과 유사한 UI로 렌더링
- 편집 기능 포함 가능
- 셀 병합, 스타일 지원

### 방법 3: ExcelJS로 HTML 생성 (현재 시스템 활용)
```typescript
// 템플릿 생성 후 미리보기용 HTML 변환
const buffer = await generateEcosensePurchaseOrderFromTemplate(data)
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(buffer)
const worksheet = workbook.getWorksheet(1)

// HTML 테이블로 변환
const html = convertWorksheetToHtml(worksheet)
```

### 구현 방향 제안
1. **미리보기 기능**: 다운로드 전 웹에서 미리보기
2. **편집 기능**: 웹에서 직접 수정 후 저장
3. **실시간 미리보기**: 입력 폼 작성 시 실시간으로 템플릿 반영

구현이 필요하시면 말씀해주세요!

## 💡 향후 개선 가능 사항

### 1. 전류계 굵기 자동 배분

현재는 모든 전류계를 16L로 고정 배정하지만, 향후 비즈니스 로직에 따라 자동 배분 가능:

```typescript
function distributeCtSizes(count: number) {
  // 예: 4개 이하는 16L, 5-8개는 24L에도 배분, 9개 이상은 36L 사용
  if (count <= 4) {
    return { size16L: count, size24L: 0, size36L: 0 }
  } else if (count <= 8) {
    return { size16L: 4, size24L: count - 4, size36L: 0 }
  } else {
    return { size16L: 4, size24L: 4, size36L: count - 8 }
  }
}
```

### 2. 템플릿 버전 관리

여러 버전의 템플릿 지원:

```typescript
const templateVersion = data.template_version || 'v1'
const templatePath = `양식/발주서_에코센스_${templateVersion}.xlsx`
```

### 3. 다른 제조사 템플릿 추가

```typescript
const templateMap = {
  ecosense: '양식/@_발주서(에코센스_KT무선)_250701.xlsx',
  gaia_cns: '양식/발주서_가이아씨앤에스.xlsx',
  cleanearth: '양식/발주서_크린어스.xlsx',
  evs: '양식/발주서_EVS.xlsx'
}
```

## 📝 관련 문서

- 이전 구현: `docs/ECOSENSE_IMPLEMENTATION_COMPLETE.md` (코드 생성 방식)
- 발주서 수정 이력: `docs/PURCHASE_ORDER_FIXES.md`
- 택배 주소 시스템: `sql/delivery_addresses.sql`

## ✨ 구현 완료 체크리스트

- [x] Excel 템플릿 파일 확인 (`양식/@_발주서(에코센스_KT무선)_250701.xlsx`)
- [x] 셀 매핑 분석 완료
- [x] 템플릿 기반 생성기 구현
- [x] API 업데이트 (제조사별 분기)
- [x] 타입 체크 통과
- [x] 데이터 채우기 로직 구현:
  - [x] 블루온 담당자 정보
  - [x] 품목 항목 및 수량 (동적)
  - [x] 설치 희망일자 (자동 계산)
  - [x] 사업장 및 담당자 정보
  - [x] 주소 정보
  - [x] VPN 체크박스
  - [x] 전류계 굵기
  - [x] 기본 체크박스

## 🎉 성과

1. **구현 난이도 대폭 감소** - 복잡한 Excel 레이아웃 코드 불필요
2. **템플릿 레이아웃 100% 유지** - 기존 양식 그대로 사용
3. **유지보수 용이** - 템플릿 수정은 Excel에서 직접
4. **확장 가능한 구조** - 다른 제조사 템플릿 추가 용이
5. **자동 데이터 채우기** - DB에서 데이터 자동 로드 및 삽입

## 🚀 다음 세션 시작 가이드

새 세션에서 작업을 계속하려면:

```
에코센스 발주서 템플릿 기반 구현이 완료되었습니다.
docs/ECOSENSE_TEMPLATE_COMPLETE.md 파일을 확인하세요.

완료된 작업:
1. Excel 템플릿 기반 생성기 (양식/@_발주서(에코센스_KT무선)_250701.xlsx 사용)
2. 셀 매핑 및 데이터 자동 채우기
3. API 업데이트 (제조사별 분기)

테스트:
http://localhost:3000/admin/document-automation
→ 발주서 관리 탭 → 에코센스 사업장 선택 → 발주서 생성
```
