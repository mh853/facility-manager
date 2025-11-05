# 대기필증 DB 업데이트 오류 및 날짜 입력 검증 수정

## 📋 문제 요약

### 문제 1: 데이터베이스 스키마 불일치 오류
**증상**: 대기필증 수정 시 다음 오류 발생
```
Could not find the 'facility_number' column of 'air_permit_info' in the schema cache
Code: PGRST204
```

**원인**: `app/api/air-permit/route.ts:236-237`에서 데이터베이스 테이블에 존재하지 않는 컬럼(`facility_number`, `green_link_code`)을 직접 업데이트하려고 시도

**영향**: 업종, 종별, 최초신고일, 가동개시일 수정 시 DB 업데이트 및 저장 실패

### 문제 2: 날짜 입력 필드 연도 자릿수 제한 없음
**증상**: 날짜 입력 시 6자리 이상 연도 입력 가능
**원인**: HTML5 `type="date"` 기본 동작에 연도 자릿수 제한 없음
**요구사항**: 4자리 연도만 허용 (1000-9999)

---

## ✅ 해결 방법

### 수정 1: 데이터베이스 업데이트 구조 수정

**파일**: `app/api/air-permit/route.ts`
**라인**: 233-248

#### 변경 전
```typescript
updateData = {
  business_type: rawUpdateData.business_type || null,
  facility_number: rawUpdateData.facility_number || null,  // ❌ 테이블에 없는 컬럼
  green_link_code: rawUpdateData.green_link_code || null,  // ❌ 테이블에 없는 컬럼
  first_report_date: validatedFirstReportDate,
  operation_start_date: validatedOperationStartDate,
  additional_info: {
    ...rawUpdateData.additional_info || {},
    category: rawUpdateData.additional_info?.category || rawUpdateData.category || null,
    business_name: rawUpdateData.additional_info?.business_name || rawUpdateData.business_name || null,
    pollutants: rawUpdateData.additional_info?.pollutants || (Array.isArray(rawUpdateData.pollutants) ? rawUpdateData.pollutants : [])
  }
}
```

#### 변경 후
```typescript
updateData = {
  // 직접 테이블 컬럼 업데이트 (스키마에 정의된 실제 필드)
  business_type: rawUpdateData.business_type || null,
  first_report_date: validatedFirstReportDate,
  operation_start_date: validatedOperationStartDate,
  // additional_info에 나머지 정보 저장 (배출구 정보는 별도 테이블에서 관리)
  additional_info: {
    ...rawUpdateData.additional_info || {},
    category: rawUpdateData.additional_info?.category || rawUpdateData.category || null,
    business_name: rawUpdateData.additional_info?.business_name || rawUpdateData.business_name || null,
    pollutants: rawUpdateData.additional_info?.pollutants || (Array.isArray(rawUpdateData.pollutants) ? rawUpdateData.pollutants : []),
    // ✅ PDF 출력용 필드는 additional_info에 저장
    facility_number: rawUpdateData.facility_number || null,
    green_link_code: rawUpdateData.green_link_code || null
  }
}
```

**핵심 변경사항**:
- `facility_number`와 `green_link_code`를 테이블 컬럼에서 제거
- 해당 필드들을 `additional_info` JSONB 컬럼 내부로 이동
- 실제 테이블 스키마와 일치하도록 수정

---

### 수정 2: TypeScript 인터페이스 업데이트

**파일**: `lib/database-service.ts`
**라인**: 136-162

#### 변경 전
```typescript
export interface AirPermitInfo {
  id: string
  business_id: string
  created_at: string
  updated_at: string
  business_type: string | null
  annual_emission_amount: number | null
  facility_number?: string | null // PDF 출력용 시설번호
  green_link_code?: string | null // PDF 출력용 그린링크코드
  memo?: string | null // PDF 출력용 메모
  additional_info: Record<string, any>
  is_active: boolean
  is_deleted: boolean

  // UI에서 사용하는 추가 필드들 (optional)
  category?: string | null
  business_name?: string | null
  pollutants?: (string | { type: string; amount: number | null })[]
  outlets?: (DischargeOutlet | {
    outlet_number: number;
    outlet_name: string;
    discharge_facilities: any[];
    prevention_facilities: any[];
  })[]
}
```

#### 변경 후
```typescript
export interface AirPermitInfo {
  id: string
  business_id: string
  created_at: string
  updated_at: string
  business_type: string | null
  annual_emission_amount: number | null
  first_report_date?: string | null // ✅ 최초신고일 (테이블 컬럼)
  operation_start_date?: string | null // ✅ 가동개시일 (테이블 컬럼)
  additional_info: Record<string, any>
  is_active: boolean
  is_deleted: boolean

  // UI에서 사용하는 추가 필드들 (optional)
  category?: string | null
  business_name?: string | null
  pollutants?: (string | { type: string; amount: number | null })[]
  outlets?: (DischargeOutlet | {
    outlet_number: number;
    outlet_name: string;
    discharge_facilities: any[];
    prevention_facilities: any[];
  })[]
  facility_number?: string | null // ✅ PDF 출력용 시설번호 (additional_info에 저장됨)
  green_link_code?: string | null // ✅ PDF 출력용 그린링크코드 (additional_info에 저장됨)
  memo?: string | null // PDF 출력용 메모 (additional_info에 저장됨)
}
```

**핵심 변경사항**:
- `first_report_date`, `operation_start_date` 속성 추가 (실제 테이블 컬럼)
- `facility_number`, `green_link_code`, `memo`는 UI 전용 필드로 유지 (실제로는 additional_info에 저장됨)
- 각 필드에 명확한 주석 추가

---

### 수정 3: 날짜 입력 필드 검증 추가

**파일**: `app/admin/air-permit-detail/page.tsx`
**라인**: 1209-1254

#### 변경 전
```tsx
<div>
  <span className="text-sm text-gray-500">최초신고일</span>
  <input
    type="date"
    value={permitDetail.first_report_date || ''}
    onChange={(e) => handleBasicInfoChange('first_report_date', e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
  />
</div>
<div>
  <span className="text-sm text-gray-500">가동개시일</span>
  <input
    type="date"
    value={permitDetail.operation_start_date || ''}
    onChange={(e) => handleBasicInfoChange('operation_start_date', e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
  />
</div>
```

#### 변경 후
```tsx
<div>
  <span className="text-sm text-gray-500">최초신고일</span>
  <input
    type="date"
    value={permitDetail.first_report_date || ''}
    onChange={(e) => handleBasicInfoChange('first_report_date', e.target.value)}
    min="1000-01-01"
    max="9999-12-31"
    onInput={(e) => {
      const input = e.target as HTMLInputElement
      const value = input.value
      if (value) {
        const year = parseInt(value.split('-')[0])
        if (year < 1000 || year > 9999) {
          input.setCustomValidity('연도는 4자리 숫자(1000-9999)로 입력해주세요')
        } else {
          input.setCustomValidity('')
        }
      }
    }}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
  />
</div>
<div>
  <span className="text-sm text-gray-500">가동개시일</span>
  <input
    type="date"
    value={permitDetail.operation_start_date || ''}
    onChange={(e) => handleBasicInfoChange('operation_start_date', e.target.value)}
    min="1000-01-01"
    max="9999-12-31"
    onInput={(e) => {
      const input = e.target as HTMLInputElement
      const value = input.value
      if (value) {
        const year = parseInt(value.split('-')[0])
        if (year < 1000 || year > 9999) {
          input.setCustomValidity('연도는 4자리 숫자(1000-9999)로 입력해주세요')
        } else {
          input.setCustomValidity('')
        }
      }
    }}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
  />
</div>
```

**추가된 검증 기능**:
1. **min/max 속성**: HTML5 네이티브 범위 제한 (1000-01-01 ~ 9999-12-31)
2. **onInput 핸들러**: 실시간 연도 검증
   - 연도 추출 및 파싱
   - 1000 미만 또는 9999 초과 시 커스텀 에러 메시지 표시
   - 유효한 경우 에러 메시지 제거
3. **사용자 친화적 에러 메시지**: "연도는 4자리 숫자(1000-9999)로 입력해주세요"

---

## 🗂️ 데이터베이스 스키마 구조

### air_permit_info 테이블
```sql
CREATE TABLE air_permit_info (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES business_info(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  business_type TEXT,
  annual_emission_amount NUMERIC,
  first_report_date DATE,           -- ✅ 실제 테이블 컬럼
  operation_start_date DATE,        -- ✅ 실제 테이블 컬럼
  additional_info JSONB,            -- ✅ facility_number, green_link_code, memo 저장
  is_active BOOLEAN,
  is_deleted BOOLEAN
);
```

### additional_info JSONB 구조
```json
{
  "category": "5종",
  "business_name": "사업장명",
  "pollutants": [],
  "facility_number": "시설번호",      // PDF 출력용
  "green_link_code": "그린링크코드",  // PDF 출력용
  "memo": "메모 내용"                // PDF 출력용
}
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 대기필증 수정
1. 대기필증 상세 페이지 접속
2. 업종, 종별, 최초신고일, 가동개시일 수정
3. 저장 버튼 클릭
4. **예상 결과**: ✅ DB 업데이트 성공, 수정사항 반영 확인

### 시나리오 2: 날짜 입력 검증
1. 최초신고일 또는 가동개시일 입력 필드 클릭
2. 6자리 연도 입력 시도 (예: 199212)
3. **예상 결과**: ✅ 브라우저 검증 에러 메시지 표시
4. 4자리 연도로 수정 (예: 1992-08-13)
5. **예상 결과**: ✅ 정상 입력 및 저장

---

## 📊 영향 범위

### 수정된 파일
1. ✅ `app/api/air-permit/route.ts` - DB 업데이트 로직 수정
2. ✅ `lib/database-service.ts` - TypeScript 인터페이스 업데이트
3. ✅ `app/admin/air-permit-detail/page.tsx` - 날짜 입력 검증 추가

### 영향받는 기능
- ✅ 대기필증 수정 기능 (업종, 종별, 최초신고일, 가동개시일)
- ✅ PDF 생성 기능 (facility_number, green_link_code 필드 사용)
- ✅ 날짜 입력 UI/UX

### 호환성
- ✅ 기존 데이터와 완전 호환
- ✅ 데이터베이스 마이그레이션 불필요
- ✅ API 하위 호환성 유지

---

## 🔍 근본 원인 분석

### 왜 이런 오류가 발생했는가?

1. **스키마 불일치**
   - TypeScript 인터페이스에는 `facility_number`, `green_link_code`가 top-level 속성으로 정의됨
   - 실제 Supabase 테이블에는 해당 컬럼이 존재하지 않음
   - 이 필드들은 `additional_info` JSONB 컬럼 내부에 저장되어야 함

2. **타입 시스템과 실제 스키마의 괴리**
   - TypeScript는 컴파일 타임에만 작동하여 런타임 데이터베이스 스키마 불일치를 감지하지 못함
   - Supabase PostgREST API는 실제 테이블 스키마 기반으로 작동하여 오류 발생

3. **날짜 입력 검증 누락**
   - HTML5 `type="date"`는 기본적으로 연도 자릿수 제한이 없음
   - 명시적인 `min`, `max`, `onInput` 핸들러가 필요

---

## ✅ 해결 확인

### 수정 후 예상 동작
1. ✅ 대기필증 수정 시 DB 업데이트 정상 작동
2. ✅ facility_number, green_link_code는 additional_info에 저장
3. ✅ first_report_date, operation_start_date는 테이블 컬럼에 직접 저장
4. ✅ 날짜 입력 시 4자리 연도만 허용
5. ✅ 6자리 연도 입력 시 검증 에러 메시지 표시

### 검증 방법
```bash
# 1. 개발 서버 시작
npm run dev

# 2. 대기필증 상세 페이지 접속
http://localhost:3000/admin/air-permit-detail?permitId=<permit-id>

# 3. 업종, 종별, 최초신고일, 가동개시일 수정 후 저장
# 4. 브라우저 개발자 도구 Console에서 오류 확인
#    ✅ 예상: 오류 없이 성공 메시지만 표시
```

---

## 📝 후속 조치

### 권장사항
1. ✅ **데이터베이스 스키마 문서화**
   - `air_permit_info` 테이블의 실제 컬럼 구조 명확히 문서화
   - `additional_info` JSONB 필드의 표준 구조 정의

2. ✅ **타입 정의 개선**
   - 실제 테이블 컬럼과 UI 전용 필드를 명확히 구분
   - 주석으로 각 필드의 저장 위치 명시

3. ✅ **유사 오류 방지**
   - 데이터베이스 업데이트 전 스키마 검증 로직 추가 고려
   - TypeScript 타입과 실제 스키마 동기화 자동화 도구 검토

---

## 📌 참고사항

### 관련 문서
- [Supabase JSONB 가이드](https://supabase.com/docs/guides/database/json)
- [HTML5 Date Input Validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date)
- [PostgREST Error Codes](https://postgrest.org/en/stable/errors.html)

### 에러 코드 설명
- **PGRST204**: Column not found in schema cache
  - Supabase의 PostgREST API가 테이블 스키마 캐시에서 요청된 컬럼을 찾을 수 없을 때 발생
  - 일반적으로 존재하지 않는 컬럼에 대한 INSERT/UPDATE 시도 시 발생

---

**수정 완료일**: 2025-11-04
**작성자**: Claude Code
**관련 이슈**: 대기필증 수정 DB 업데이트 오류 및 날짜 입력 검증
