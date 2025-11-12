# 계약서 측정기기 미출력 문제 수정

## 📋 문제 요약

**증상**: 문서 자동화 > 계약서 관리 탭에서 자비 계약서 생성 시, 미리보기에서 측정기기 수량이 모두 0으로 표시됨

**발견 날짜**: 2025-11-11

---

## 🔍 근본 원인 분석

### 1. 데이터 모델 불일치

**문제점**:
- `business_info` 테이블: `id` (UUID) 기반 설계
- `discharge_facilities` 테이블: `business_name` (문자열) 기반 설계
- `prevention_facilities` 테이블: `business_name` (문자열) 기반 설계

**결과**:
- 외래 키(FK) 관계 없음 → 데이터 무결성 보장 불가
- 문자열 매칭 의존 → 사업장명 불일치 시 조회 실패

### 2. 구체적 실패 사례

**조회 시도한 사업장**: `(주)영빈산업(방2)` (business_info에서 조회)

**실제 테이블의 사업장명**:
```
discharge_facilities: ['(유)태현환경', '(주)경동물산', '(주)계산', ...]
prevention_facilities: ['(유)태현환경', '(주)경동물산', '(주)계산', ...]
```

**조회 결과**:
```javascript
discharge_facilities: { count: 0, data: [] }  // ❌ 매칭 실패
prevention_facilities: { count: 0, data: [] } // ❌ 매칭 실패
equipment_counts: { 모든 값 0 }              // ❌ 계약서에 미출력
```

---

## ✅ 적용된 해결 방안

### 옵션 3: business_info 테이블 데이터 직접 사용 (권장, 적용됨)

**근거**:
- `business_info` 테이블에는 이미 장비 수량 컬럼이 존재
- 즉시 적용 가능하며 별도 마이그레이션 불필요
- 데이터 일관성 보장

**수정 위치**: `app/api/document-automation/contract/route.ts`

**변경 내용**:

#### Before (기존 로직):
```typescript
// discharge_facilities와 prevention_facilities 테이블에서 조회
const { data: dischargeFacilities } = await supabaseAdmin
  .from('discharge_facilities')
  .select('discharge_ct, business_name')
  .eq('business_name', business.business_name);  // ⚠️ 사업장명 불일치로 실패

const { data: preventionFacilities } = await supabaseAdmin
  .from('prevention_facilities')
  .select('ph, pressure, temperature, pump, fan, business_name')
  .eq('business_name', business.business_name);  // ⚠️ 사업장명 불일치로 실패

// 복잡한 계산 로직 (70+ 줄)
```

#### After (개선된 로직):
```typescript
// business_info 테이블에서 장비 수량 필드 직접 조회
const { data: business } = await supabaseAdmin
  .from('business_info')
  .select(`
    ...,
    ph_meter,
    differential_pressure_meter,
    temperature_meter,
    discharge_current_meter,
    fan_current_meter,
    pump_current_meter,
    gateway,
    vpn_wired,
    vpn_wireless
  `)
  .eq('id', business_id)
  .single();

// 간단한 추출 로직
const phCount = business.ph_meter || 0;
const pressureCount = business.differential_pressure_meter || 0;
const temperatureCount = business.temperature_meter || 0;
const dischargeCtCount = business.discharge_current_meter || 0;
const fanCtCount = business.fan_current_meter || 0;
const pumpCtCount = business.pump_current_meter || 0;
const gatewayCount = business.gateway || 0;
const vpnCount = (business.vpn_wired || 0) + (business.vpn_wireless || 0);
```

**장점**:
- ✅ 즉시 작동 (마이그레이션 불필요)
- ✅ 코드 간소화 (70+ 줄 → 10줄)
- ✅ 성능 향상 (DB 조회 3회 → 1회)
- ✅ 데이터 일관성 보장 (UUID 기반 조회)

---

## 📁 수정된 파일

### 1. `app/api/document-automation/contract/route.ts`
- **Line 94-117**: business_info SELECT에 장비 수량 컬럼 추가
- **Line 138-178**: 장비 수량 조회 로직을 business_info 직접 사용으로 변경
- **백업 파일**: `route.ts.backup` (원본 보존)

---

## 🧪 테스트 체크리스트

- [ ] 자비 계약서 생성 시 측정기기 수량 정상 표시
- [ ] 보조금 계약서 생성 시 측정기기 수량 정상 표시
- [ ] 장비 수량이 0인 사업장에서도 계약서 정상 생성
- [ ] PDF 다운로드 시 측정기기 표가 정상 출력
- [ ] 계약서 이력 조회 시 equipment_counts 정상 저장

---

## 🚨 추가 발견 사항

### CSRF 보안 경고
```
[SECURITY] CSRF validation failed for undefined on /api/upload
```

**원인**: `/api/upload` 엔드포인트에서 CSRF 토큰 검증 실패
**영향**: 파일 업로드 보안 취약점 가능성
**권장**: CSRF 미들웨어 설정 점검 필요 (별도 이슈로 처리)

---

## 🔮 향후 개선 방안 (선택 사항)

### 옵션 1: business_id 기반 조회 추가 (단기)
```sql
ALTER TABLE discharge_facilities ADD COLUMN business_id UUID;
ALTER TABLE prevention_facilities ADD COLUMN business_id UUID;

-- 기존 데이터 마이그레이션
UPDATE discharge_facilities df
SET business_id = bi.id
FROM business_info bi
WHERE df.business_name = bi.business_name;
```

### 옵션 2: 외래 키(FK) 제약조건 추가 (중기)
```sql
ALTER TABLE discharge_facilities
ADD CONSTRAINT fk_discharge_business
FOREIGN KEY (business_id) REFERENCES business_info(id);

ALTER TABLE prevention_facilities
ADD CONSTRAINT fk_prevention_business
FOREIGN KEY (business_id) REFERENCES business_info(id);
```

**장점**: 데이터 무결성 보장, 사업장명 변경 시에도 안전

---

## 📊 영향 범위

**영향받는 기능**:
- ✅ 문서 자동화 > 계약서 생성
- ✅ 계약서 미리보기 > 측정기기 표
- ✅ 계약서 PDF 다운로드

**영향받지 않는 기능**:
- ✅ 견적서 생성 (별도 로직)
- ✅ 실행이력 조회
- ✅ 사업장 목록 조회

---

## 📝 참고 링크

- 원본 이슈 로그: 서버 로그 참조
- 관련 테이블 스키마: `sql/contract_tables.sql`
- 테스트 쿼리: `claudedocs/find-businesses-with-equipment.sql`

---

**작성일**: 2025-11-11
**작성자**: Claude Code
**적용 상태**: ✅ 완료 (테스트 대기)
