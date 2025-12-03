# API 필드 선택 가이드

## 📋 개요

`/app/api/business-info-direct/route.ts` API는 성능 최적화를 위해 **선택적 필드 조회**를 사용합니다.

- **목적**: 네트워크 페이로드 감소 (2MB → ~850KB, 57% 감소)
- **효과**: 초기 로딩 시간 개선 (5-7초 → 2.5-3.5초)
- **주의**: `SELECT *` 사용 시 모든 최적화 효과 상실

---

## 🎯 현재 필드 구성 (59개)

### 1. 기본 정보 필드 (21개)
**사용 페이지**: `/admin/business` (사업장관리)

```typescript
id,
business_name,          // 사업장명
address,                // 주소
local_government,       // 지자체
manager_name,           // 담당자명
manager_contact,        // 담당자 연락처
manager_position,       // 담당자 직급
business_contact,       // 사업장 연락처
representative_name,    // 대표자명
business_registration_number, // 사업자등록번호
manufacturer,           // 제조사 (에코센스, 크린어스 등)
sales_office,           // 영업점
installation_date,      // 설치일
progress_status,        // 진행상태
project_year,           // 프로젝트 년도
installation_team,      // 설치팀
is_active,              // 활성 상태
is_deleted,             // 삭제 상태
updated_at,             // 수정일
created_at,             // 등록일
additional_info         // 추가 정보 (JSON)
```

### 2. 장비 수량 필드 (17개)
**사용 페이지**: `/admin/revenue` (매출관리)
**사용처**: `calculateBusinessRevenue()` 함수 (Line 345-381)
**계산식**: `totalRevenue += unitRevenue * quantity`

```typescript
ph_meter,                                       // PH센서
differential_pressure_meter,                    // 차압계
temperature_meter,                              // 온도계
discharge_current_meter,                        // 배출전류계
fan_current_meter,                              // 송풍전류계
pump_current_meter,                             // 펌프전류계
gateway,                                        // 게이트웨이
vpn_wired,                                      // VPN 유선
vpn_wireless,                                   // VPN 무선
explosion_proof_differential_pressure_meter_domestic, // 방폭차압계(국산)
explosion_proof_temperature_meter_domestic,     // 방폭온도계(국산)
expansion_device,                               // 확장디바이스
relay_8ch,                                      // 중계기 8채널
relay_16ch,                                     // 중계기 16채널
main_board_replacement,                         // 메인보드 교체
multiple_stack                                  // 복수굴뚝
```

### 3. 금액/비용 필드 (15개)
**사용 페이지**: `/admin/revenue` (매출관리)
**사용처**: Line 386-408 (추가비용), Line 947-956 (미수금 계산)

#### 3-1. 기본 금액 필드 (2개)
```typescript
negotiation,            // 협의사항 (매출 차감)
installation_costs      // 추가 설치비 (비용)
```

#### 3-2. 보조금 사업장 계산서/입금 (8개)
```typescript
invoice_1st_date,       // 1차 계산서 발행일
invoice_1st_amount,     // 1차 계산서 금액
payment_1st_date,       // 1차 입금일
payment_1st_amount,     // 1차 입금액
invoice_2nd_date,       // 2차 계산서 발행일
invoice_2nd_amount,     // 2차 계산서 금액
payment_2nd_date,       // 2차 입금일
payment_2nd_amount      // 2차 입금액
```

#### 3-3. 추가공사비 (3개)
```typescript
invoice_additional_date,     // 추가공사비 계산서 발행일
payment_additional_date,     // 추가공사비 입금일
payment_additional_amount    // 추가공사비 입금액
```

#### 3-4. 자비 사업장 계산서/입금 (8개)
```typescript
invoice_advance_date,   // 선금 계산서 발행일
invoice_advance_amount, // 선금 계산서 금액
payment_advance_date,   // 선금 입금일
payment_advance_amount, // 선금 입금액
invoice_balance_date,   // 잔금 계산서 발행일
invoice_balance_amount, // 잔금 계산서 금액
payment_balance_date,   // 잔금 입금일
payment_balance_amount  // 잔금 입금액
```

### 4. 실사 관리 필드 (6개)
**사용 페이지**: `/admin/revenue` (매출관리)
**사용처**: Line 443-455 (실사비용 계산)
**계산 조건**: 실사일이 존재하고 빈 문자열이 아닌 경우에만 비용 추가

```typescript
estimate_survey_date,           // 견적실사일 (비용 발생 조건)
estimate_survey_manager,        // 견적실사 담당자
pre_construction_survey_date,   // 착공전실사일 (비용 발생 조건)
pre_construction_survey_manager, // 착공전실사 담당자
completion_survey_date,         // 준공실사일 (비용 발생 조건)
completion_survey_manager       // 준공실사 담당자
```

---

## 🔧 새로운 필드 추가 방법

### Step 1: 필드 사용 확인
```bash
# 해당 기능에서 사용하는 필드 검색
cd /Users/mh.c/claude/facility-manager
grep -r "business\.필드명" app/admin/[페이지명]/
```

**예시**:
```bash
# 매출처(revenue_source) 필드가 필요한지 확인
grep -r "business\.revenue_source" app/admin/revenue/
```

### Step 2: API 파일에 필드 추가
**파일**: `/app/api/business-info-direct/route.ts`
**위치**: Line 38-132 (SELECT 쿼리 내부)

```typescript
let query = supabaseAdmin.from('business_info').select(`
  /* 기존 필드들 ... */

  /* === 새로운 기능 필드 추가 === */
  revenue_source,         /* Line XXX: 매출처 필터링 */
  contract_type,          /* Line YYY: 계약 유형 구분 */

  /* ... */
`, { count: 'exact' });
```

**⚠️ 주의사항**:
1. **쉼표(,) 확인**: 마지막 필드를 제외한 모든 필드 뒤에 쉼표 필요
2. **주석 작성**: 사용처 Line 번호와 목적 명시
3. **섹션 구분**: 기능별로 섹션 나누어 정리

### Step 3: 빌드 테스트
```bash
npm run build
```

**오류 발생 시 체크리스트**:
- [ ] 쉼표(,) 누락 확인
- [ ] 백틱(\`) 닫힘 확인
- [ ] 필드명 오타 확인
- [ ] SQL 주석 형식 확인 (`/* */`)

### Step 4: 기능 검증
1. 해당 페이지 접속
2. 새로운 필드가 정상적으로 조회되는지 확인
3. Chrome DevTools → Network 탭에서 페이로드 크기 확인

---

## ⚠️ 롤백 가이드 (SELECT * 복원)

**언제 필요한가**:
- 필드 추가가 너무 많아져서 유지보수가 어려운 경우
- 성능보다 개발 속도가 중요한 경우
- 모든 필드가 필요한 새로운 기능 추가 시

**롤백 방법**:
```typescript
// /app/api/business-info-direct/route.ts Line 38
let query = supabaseAdmin.from('business_info').select('*', { count: 'exact' });
```

**⚠️ 롤백 시 영향**:
- 네트워크 페이로드: 850KB → 2MB (135% 증가)
- 초기 로딩 시간: 2.5-3.5초 → 5-7초 (100% 증가)
- 1단계 최적화 효과 완전 손실

---

## 📊 성능 모니터링

### 네트워크 페이로드 크기 확인
```javascript
// Chrome DevTools → Console
fetch('/api/business-info-direct')
  .then(res => res.json())
  .then(data => {
    const size = new Blob([JSON.stringify(data)]).size;
    console.log(`페이로드 크기: ${(size / 1024).toFixed(2)} KB`);
  });
```

### 목표 기준
- **사업장관리**: < 500KB
- **매출관리**: < 900KB
- **초기 로딩**: < 3.5초

### 경고 기준
- **페이로드 > 1.5MB**: 필드 추가 재검토 필요
- **로딩 > 5초**: SELECT * 롤백 또는 API 분리 검토

---

## 🚀 장기 최적화 전략 (선택사항)

### 방안 1: 페이지별 API 분리
**목표**: 각 페이지가 필요한 필드만 조회

```typescript
// 사업장관리 전용 API (21개 필드)
/app/api/business-list-minimal/route.ts

// 매출관리 전용 API (59개 필드)
/app/api/business-revenue-data/route.ts

// 상세 페이지 전용 API (전체 필드)
/app/api/business-info-full/route.ts
```

**장점**:
- 최대 성능 최적화 (사업장관리 470KB, 매출관리 850KB)
- 기능별 독립성 향상

**단점**:
- 대규모 리팩토링 필요 (2-3일 작업)
- API 엔드포인트 증가 (복잡도 증가)

### 방안 2: GraphQL 도입
**목표**: 클라이언트가 필요한 필드만 쿼리

**장점**:
- 완전한 필드 선택 유연성
- Over-fetching/Under-fetching 해결

**단점**:
- 아키텍처 대규모 변경
- 학습 곡선 및 마이그레이션 비용

---

## 📚 참고 자료

### 관련 파일
- **API 엔드포인트**: `/app/api/business-info-direct/route.ts`
- **사업장관리 페이지**: `/app/admin/business/page.tsx`
- **매출관리 페이지**: `/app/admin/revenue/page.tsx`
- **데이터 훅**: `/app/admin/business/hooks/useBusinessData.ts`

### 성능 최적화 히스토리
- **1단계 완료** (2025-12-03): 기본 필드 21개 선택 조회 (75% 감소)
- **2단계 완료** (2025-12-03): 매출 계산 필드 38개 추가 (57% 감소 유지)

### 추가 개선 가능 항목
- [ ] useBusinessData 훅 클라이언트 변환 간소화 (30% 성능 개선 가능)
- [ ] Response 압축 활성화 (gzip, 추가 30-40% 감소)
- [ ] 페이지별 API 분리 (각 페이지 최적화)

---

## ❓ FAQ

### Q1: 새로운 필드를 추가했는데 매출관리에서 안 나와요
**A**: 해당 필드가 API SELECT 쿼리에 포함되어 있는지 확인하세요.
```bash
grep "필드명" app/api/business-info-direct/route.ts
```

### Q2: SELECT * 로 바꾸면 안 되나요?
**A**: 가능하지만 권장하지 않습니다.
- 네트워크 135% 증가
- 로딩 시간 2배 증가
- 불필요한 140개 필드 전송

### Q3: 페이로드가 너무 커졌어요 (> 1MB)
**A**: 다음 옵션을 검토하세요.
1. 불필요한 필드 제거
2. 페이지별 API 분리
3. Response 압축 활성화

### Q4: 어떤 필드가 실제로 사용되는지 확인하려면?
**A**: Grep 도구로 검색하세요.
```bash
grep -r "business\.필드명" app/admin/
```

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 | 담당자 |
|------|------|-----------|--------|
| 2025-12-03 | 2.0 | 매출 계산 필드 38개 추가 (59개 총) | Claude Code |
| 2025-12-03 | 1.0 | 기본 필드 21개 선택 조회 시작 | Claude Code |

---

**문서 위치**: `/docs/API_FIELD_SELECTION_GUIDE.md`
**마지막 업데이트**: 2025-12-03
**담당자**: Claude Code
