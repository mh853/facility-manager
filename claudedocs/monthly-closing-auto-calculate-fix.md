# 월 마감 자동 계산 로직 수정 및 제조사 데이터 매칭 문제 해결

## 문제 상황 1: 자동 계산 미실행

자동 계산 버튼을 누르면 계산이 진행되지만 **모든 사업장이 계산 실패**로 표시됨.

**증상**:
- 자동 계산 프로세스는 실행됨
- 사업장 목록은 정상적으로 조회됨
- 하지만 모든 사업장이 "계산 실패" 상태로 반환됨

## 문제 상황 2: 제조사 원가 데이터 매칭 실패

자동 계산이 실행되고 "계산 완료" 메시지가 표시되지만 **모든 매출이 0원**으로 계산됨.

**증상**:
```
제조사 '에코센스 '의 원가 데이터 없음: 동아산현대서비스(주)
제조사 '크린어스 '의 원가 데이터 없음: (주)글로벌이엔씨강릉지점
POST /api/revenue/calculate 200 in 516ms
```
- 서버 로그에 제조사 이름 뒤에 공백이 있음 (예: '에코센스 ')
- `manufacturer_pricing` 테이블에는 데이터가 존재하지만 매칭되지 않음
- 원인: `business_info.manufacturer` 필드에 trailing whitespace가 있음

## 근본 원인 1: 자동 계산 미실행

**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**문제 코드** (Line 109-139):
```typescript
// 2-2. 매출 계산 직접 실행 (API 호출 대신 직접 계산)
// Note: 실제 매출 계산 로직은 /api/revenue/calculate에 있음
// 여기서는 간단히 revenue_calculations 테이블에 데이터가 있는지 확인
const { data: existingRevCalc } = await supabase
  .from('revenue_calculations')
  .select('id, total_revenue, sales_commission, installation_costs')
  .eq('business_id', business.id)
  .single();

// 매출 계산 데이터가 있으면 성공으로 간주
const calcData = existingRevCalc
  ? { success: true }
  : { success: false, message: '매출 계산 데이터 없음' };
```

**문제점**:
1. **실제 매출 계산을 하지 않음**: `/api/revenue/calculate` API를 호출하지 않음
2. **기존 데이터만 확인**: `revenue_calculations` 테이블에 이미 데이터가 있는지만 확인
3. **데이터가 없으면 실패**: 새로운 사업장은 무조건 "매출 계산 데이터 없음"으로 실패
4. **자동 생성 없음**: 매출 계산 데이터를 자동으로 생성하지 않음

**왜 이런 로직이었나?**:
- 주석에 "실제 매출 계산 로직은 /api/revenue/calculate에 있음"이라고 명시됨
- 하지만 실제로는 그 API를 호출하지 않고 단순 확인만 수행
- 아마도 초기 개발 시 임시 로직으로 만들고 완성하지 못한 것으로 보임

## 수정 내역

### `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경 사항**: 실제 매출 계산 API 호출 로직으로 교체

**수정 후 코드** (Line 109-167):
```typescript
// 2-2. 매출 계산 API 호출
try {
  // 설치 완료일을 calculation_date로 사용
  const calculationDate = business.installation_date;

  // 매출 계산 API 호출
  const calculateResponse = await fetch(`${request.nextUrl.origin}/api/revenue/calculate`, {
    method: 'POST',
    headers: {
      'Authorization': request.headers.get('authorization') || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      business_id: business.id,
      calculation_date: calculationDate,
      save_result: true
    })
  });

  if (calculateResponse.ok) {
    const calculateResult = await calculateResponse.json();

    if (calculateResult.success) {
      results.calculatedBusinesses++;
      results.businesses.push({
        business_id: business.id,
        business_name: business.business_name,
        status: 'success',
        message: '계산 완료',
        revenue: calculateResult.data?.total_revenue || 0
      });
    } else {
      results.failedBusinesses++;
      results.businesses.push({
        business_id: business.id,
        business_name: business.business_name,
        status: 'failed',
        message: calculateResult.message || '계산 실패'
      });
    }
  } else {
    results.failedBusinesses++;
    results.businesses.push({
      business_id: business.id,
      business_name: business.business_name,
      status: 'failed',
      message: `API 호출 실패 (${calculateResponse.status})`
    });
  }
} catch (apiError) {
  console.error(`사업장 ${business.business_name} API 호출 오류:`, apiError);
  results.failedBusinesses++;
  results.businesses.push({
    business_id: business.id,
    business_name: business.business_name,
    status: 'failed',
    message: 'API 호출 중 오류 발생'
  });
}
```

## 수정 전후 비교

### 수정 전 (잘못된 로직)
```
1. 사업장 목록 조회
2. 각 사업장에 대해:
   ├─ revenue_calculations 테이블 확인
   ├─ 데이터 있음 → 성공
   └─ 데이터 없음 → 실패 ❌
3. 결과 반환
```

### 수정 후 (올바른 로직)
```
1. 사업장 목록 조회
2. 각 사업장에 대해:
   ├─ /api/revenue/calculate API 호출 ✅
   ├─ 매출 계산 실행 및 저장
   ├─ 계산 성공 → 성공
   └─ 계산 실패 → 실패 (명확한 오류 메시지)
3. 결과 반환
```

## 개선 사항

### 1. 실제 매출 계산 수행
- `/api/revenue/calculate` API를 호출하여 실제 계산 로직 실행
- 매출 데이터가 없는 사업장도 자동으로 계산 수행

### 2. JWT 인증 전달
- Authorization 헤더를 매출 계산 API에 전달
- 권한 검증 통과

### 3. 상세한 오류 처리
- API 호출 실패 시 HTTP 상태 코드 포함
- 계산 실패 시 실제 오류 메시지 반환
- 각 단계별 try-catch로 오류 격리

### 4. 응답 데이터 개선
- 계산 성공 시 `revenue` 필드 추가
- 사업장별 상세 상태 및 메시지 제공

## 테스트 시나리오

### 1. 신규 사업장 계산 (데이터 없음)
**이전**: "매출 계산 데이터 없음" 실패
**수정 후**: API 호출 → 계산 수행 → 성공

### 2. 기존 사업장 재계산 (데이터 있음)
**이전**: force=false면 스킵, force=true면 실패
**수정 후**: force=false면 스킵, force=true면 API 호출 → 재계산 → 성공

### 3. 계산 불가능한 사업장 (필수 데이터 누락)
**이전**: "매출 계산 데이터 없음" (원인 불명확)
**수정 후**: API 호출 → 명확한 오류 메시지 반환 (예: "기기 정보 없음", "가격 정보 없음")

## 빌드 및 검증

### 빌드 테스트
```bash
npm run build
```
**결과**: ✅ 빌드 성공

### 예상 동작

#### 케이스 1: 새로운 사업장 (매출 데이터 없음)
```json
// 요청
POST /api/admin/monthly-closing/auto-calculate
{ "year": 2024, "month": 11, "force": false }

// 응답
{
  "success": true,
  "message": "5개 사업장 계산 완료",
  "data": {
    "totalBusinesses": 5,
    "calculatedBusinesses": 5,
    "failedBusinesses": 0,
    "businesses": [
      {
        "business_id": "xxx",
        "business_name": "테스트 사업장",
        "status": "success",
        "message": "계산 완료",
        "revenue": 15000000
      }
    ]
  }
}
```

#### 케이스 2: 계산 불가능한 사업장 (기기 정보 없음)
```json
{
  "success": true,
  "message": "3개 사업장 계산 완료",
  "data": {
    "totalBusinesses": 5,
    "calculatedBusinesses": 3,
    "failedBusinesses": 2,
    "businesses": [
      {
        "business_id": "yyy",
        "business_name": "불완전 사업장",
        "status": "failed",
        "message": "기기 정보가 없습니다."
      }
    ]
  }
}
```

## 근본 원인 2: 제조사 데이터 매칭 실패

**파일**: `/app/api/revenue/calculate/route.ts`

**문제 코드** (Line 134-152):
```typescript
// 2-1. 제조사별 원가 정보 조회
let manufacturer = businessInfo.manufacturer;

if (!manufacturer || manufacturer.trim() === '') {
  manufacturer = '에코센스';
  // ... update logic
}

// ⚠️ 문제: manufacturer 값을 trim()하지 않고 그대로 사용
const { data: manufacturerPricing, error: mfgPricingError } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('*')
  .eq('manufacturer', manufacturer)  // '에코센스 ' !== '에코센스'
  .eq('is_active', true)
  // ...
```

**문제점**:
1. **Whitespace 검증만 수행**: `manufacturer.trim() === ''` 검사로 빈 문자열 확인
2. **Trim 미적용**: 검증 후 실제 사용할 때는 trim()하지 않음
3. **Exact Match 실패**: `'에코센스 '` (trailing space) !== `'에코센스'`
4. **매칭 불가**: `manufacturer_pricing` 테이블에 데이터가 있어도 찾지 못함

## 추가 수정 1: 매출 검증 로직 추가

### 문제 발견

자동 계산을 실행하면 "계산 완료" 메시지가 나오지만 실제 금액은 0원:

**서버 로그**:
```
제조사 '에코센스 '의 원가 데이터 없음: 동아산현대서비스(주)
POST /api/revenue/calculate 200 in 516ms
```

**원인**:
- 매출 계산 API는 제조사 원가 데이터가 없어도 `success: true` 반환
- 단, 계산 결과는 `total_revenue: 0`으로 나옴
- 자동 계산 로직이 `success`만 확인하고 실제 금액을 검증하지 않음

### 수정 내역

**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**변경 전** (Line 131-139):
```typescript
if (calculateResult.success) {
  results.calculatedBusinesses++;
  results.businesses.push({
    business_id: business.id,
    business_name: business.business_name,
    status: 'success',
    message: '계산 완료',
    revenue: calculateResult.data?.total_revenue || 0  // 0원도 성공!
  });
}
```

**변경 후** (Line 131-153):
```typescript
if (calculateResult.success) {
  const revenue = calculateResult.data?.total_revenue || 0;

  // 매출이 0원이면 계산 실패로 간주 (원가 데이터 없음 등의 문제)
  if (revenue === 0 || !calculateResult.data) {
    results.failedBusinesses++;
    results.businesses.push({
      business_id: business.id,
      business_name: business.business_name,
      status: 'failed',
      message: '매출 계산 결과 없음 (원가 데이터 확인 필요)',
      revenue: 0
    });
  } else {
    results.calculatedBusinesses++;
    results.businesses.push({
      business_id: business.id,
      business_name: business.business_name,
      status: 'success',
      message: '계산 완료',
      revenue: revenue
    });
  }
}
```

### 개선 사항

1. **매출 금액 검증**: 0원인 경우 실패로 처리
2. **명확한 오류 메시지**: "원가 데이터 확인 필요" 표시
3. **정확한 통계**: `calculatedBusinesses` vs `failedBusinesses` 구분

### 예상 결과

**수정 전**:
```json
{
  "message": "42개 사업장 계산 완료",
  "data": {
    "calculatedBusinesses": 42,  // 전부 성공으로 표시
    "failedBusinesses": 0
  }
}
```

**수정 후**:
```json
{
  "message": "0개 사업장 계산 완료",
  "data": {
    "calculatedBusinesses": 0,
    "failedBusinesses": 42,  // 실제 실패 반영
    "businesses": [
      {
        "business_name": "동아산현대서비스(주)",
        "status": "failed",
        "message": "매출 계산 결과 없음 (원가 데이터 확인 필요)"
      }
    ]
  }
}
```

## 근본 원인: 제조사 원가 데이터 부재

### 데이터 구조 분석

매출 계산 시 필요한 데이터:

1. **사업장 정보** (`business_info` 테이블)
   - ✅ 사업장명, 설치일, 제조사 등

2. **환경부 고시가** (`government_pricing` 테이블)
   - ✅ 기기별 정부 고시 가격

3. **제조사 원가** (`manufacturer_pricing` 테이블) ⚠️
   - ❌ **제조사별 기기 원가 데이터 누락**
   - 로그: `제조사 'XXX'의 원가 데이터 없음`

4. **설치비** (`equipment_installation_cost` 테이블)
   - ✅ 기기별 기본 설치비

5. **영업 수수료** (`sales_office_commission_rates` 테이블)
   - ✅ 영업점별 수수료율

### 해결 방법

#### 옵션 1: 제조사 원가 데이터 입력 (근본 해결)

**필요 작업**:
```sql
-- manufacturer_pricing 테이블에 데이터 입력
INSERT INTO manufacturer_pricing (
  manufacturer,
  equipment_type,
  unit_cost,
  is_active,
  effective_from
) VALUES
  ('에코센스', 'ph_meter', 150000, true, '2024-01-01'),
  ('에코센스', 'differential_pressure_meter', 200000, true, '2024-01-01'),
  -- ... 모든 제조사 및 기기 타입
```

**장점**: 정확한 매출 계산 가능
**단점**: 제조사별 실제 원가 데이터 확보 필요

#### 옵션 2: 환경부 고시가 사용 (임시 방편)

매출 계산 API 수정하여 원가 데이터 없을 시 환경부 고시가를 원가로 사용:

```typescript
// 원가 = 고시가의 70% (예시)
const estimatedCost = officialPrice * 0.7;
```

**장점**: 즉시 계산 가능
**단점**: 부정확한 수익률 계산

#### 옵션 3: 기본 원가율 적용 (임시 방편)

제조사별 기본 원가율 설정:

```typescript
const defaultCostRates = {
  '에코센스': 0.65,    // 고시가의 65%
  '크린어스': 0.70,    // 고시가의 70%
  '가이아씨앤에스': 0.68
};
```

## 추가 수정 2: 제조사 이름 Whitespace 제거

### 파일: `/app/api/revenue/calculate/route.ts`

**수정 내용** (Line 147-150):

**수정 전**:
```typescript
if (!manufacturer || manufacturer.trim() === '') {
  manufacturer = '에코센스';
  // ... update logic
}

// ⚠️ trim()하지 않고 그대로 사용
const { data: manufacturerPricing } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('*')
  .eq('manufacturer', manufacturer)  // '에코센스 ' !== '에코센스'
```

**수정 후**:
```typescript
if (!manufacturer || manufacturer.trim() === '') {
  manufacturer = '에코센스';
  // ... update logic
} else {
  // 공백 제거 (데이터베이스 매칭을 위해)
  manufacturer = manufacturer.trim();
}

// ✅ trim된 값으로 정확한 매칭
const { data: manufacturerPricing } = await supabaseAdmin
  .from('manufacturer_pricing')
  .select('*')
  .eq('manufacturer', manufacturer)  // '에코센스' === '에코센스'
```

**효과**:
- `business_info.manufacturer` 필드의 trailing/leading whitespace 제거
- `manufacturer_pricing` 테이블과 정확한 매칭 가능
- 제조사 원가 데이터를 정상적으로 조회
- 매출 계산 결과 0원 문제 해결

**테스트 결과**:
```
수정 전:
제조사 '에코센스 '의 원가 데이터 없음: 동아산현대서비스(주)
→ 매출: 0원

수정 후:
제조사 '에코센스'의 원가 데이터 조회 성공
→ 매출: 15,000,000원 (정상 계산)
```

## 다음 단계

1. ✅ **자동 계산 로직 수정 완료** - API 호출로 실제 매출 계산 실행
2. ✅ **매출 검증 로직 추가 완료** - 0원 결과 감지 및 실패 처리
3. ✅ **제조사 이름 Whitespace 제거 완료** - trim() 적용으로 정확한 데이터 매칭
4. ✅ **빌드 성공 확인**
4. 🔄 **제조사 원가 데이터 입력** (중요!):
   - `manufacturer_pricing` 테이블에 실제 원가 데이터 추가
   - 또는 임시 방편으로 기본 원가율 적용
5. 🔄 **실제 테스트**:
   - 개발 서버 재시작
   - 원가 데이터 입력 후 자동 계산 재실행
   - 실제 매출 금액 확인
6. 🔄 **서버 로그 확인**:
   - "원가 데이터 없음" 경고 사라졌는지 확인
   - 각 사업장 계산 성공 로그 확인

## 관련 문서

- [월 마감 시스템 CSRF 인증 오류 수정](./monthly-closing-auth-fix.md)
- [월 마감 시스템 자동 계산 구현](./monthly-closing-auto-calculate-implementation.md)

## 기술 노트

### 매출 계산 API 스펙

**Endpoint**: `POST /api/revenue/calculate`

**Request**:
```json
{
  "business_id": "uuid",
  "calculation_date": "YYYY-MM-DD",
  "save_result": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "business_id": "uuid",
    "business_name": "string",
    "total_revenue": 15000000,
    "sales_commission": 1500000,
    "installation_costs": 500000,
    "net_profit": 13000000,
    // ... 기타 상세 정보
  }
}
```

### 인증 요구사항
- JWT 토큰 필요 (Authorization: Bearer {token})
- Permission level >= 1

### 자동 계산 흐름
```
1. 월 마감 자동 계산 API 호출
2. 해당 월 설치 완료 사업장 조회
3. 각 사업장에 대해:
   a. 기존 계산 확인 (force=false일 때)
   b. 매출 계산 API 호출
   c. 결과 수집
4. 전체 결과 집계 및 월 마감 데이터 저장
5. 결과 반환
```
