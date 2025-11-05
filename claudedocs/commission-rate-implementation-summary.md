# 제조사별 수수료율 관리 시스템 구현 완료

## 구현 날짜
2025-11-05

## 구현 개요
영업점별로 제조사마다 다른 수수료율을 설정하고 관리할 수 있는 완전한 시스템을 구현했습니다.

## 구현 완료 항목

### 1. 데이터베이스 스키마 ✅
**파일**: `sql/commission_rates_schema.sql`

- **테이블**: `sales_office_commission_rates`
  - 영업점별, 제조사별 수수료율 저장
  - 시간 기반 이력 관리 (effective_from, effective_to)
  - 변경 사유 및 생성자 추적

- **뷰**:
  - `current_commission_rates`: 현재 유효한 수수료율만 조회
  - `commission_rate_history`: 변경 이력을 생성자 정보와 함께 조회

- **트리거**: `updated_at` 자동 갱신

- **초기 데이터**: 원에너지 영업점 4개 제조사 수수료율 설정

### 2. TypeScript 타입 정의 ✅
**파일**: `types/commission.ts`

- `Manufacturer` 타입 및 라벨
- `CommissionRate` 인터페이스
- `CommissionRateHistory` 인터페이스
- `CommissionRateUpdateRequest` 인터페이스
- `BulkCommissionRateUpdate` 인터페이스
- API 응답 타입들

### 3. 백엔드 API 구현 ✅

#### 수수료율 조회/업데이트 API
**파일**: `app/api/revenue/commission-rates/route.ts`

- **GET**: 영업점별 현재 수수료율 조회
  - 특정 영업점 또는 전체 영업점 조회 가능
  - 영업점별로 그룹화된 데이터 반환

- **PUT**: 수수료율 업데이트
  - 이전 수수료율 자동 종료 (effective_to 설정)
  - 새로운 수수료율 추가
  - 트랜잭션으로 처리

#### 이력 조회 API
**파일**: `app/api/revenue/commission-rates/history/route.ts`

- **GET**: 수수료율 변경 이력 조회
  - 영업점, 제조사, 날짜 범위별 필터링
  - 현재 적용중인 수수료율만 조회 옵션
  - 페이지네이션 지원
  - 생성자 정보 포함

#### 대량 업데이트 API
**파일**: `app/api/revenue/commission-rates/bulk/route.ts`

- **POST**: 특정 제조사의 수수료율을 여러 영업점에 일괄 적용
  - 지정된 영업점 또는 모든 영업점 대상
  - 이전 수수료율 자동 종료
  - 상세한 업데이트 내역 반환 (영업점별 이전/신규 수수료율)

### 4. 프론트엔드 UI 구현 ✅

#### 수수료율 관리 컴포넌트
**파일**: `components/CommissionRateManager.tsx`

**주요 기능**:
- 영업점 선택
- 제조사별 수수료율 표시 및 수정
  - 에코센스 (ecosense)
  - 가이아씨앤에스 (gaia_cns)
  - 크린어스 (cleanearth)
  - 이브이에스 (evs)
- 적용 시작일 설정
- 변경 사유 입력
- 수정/저장/취소 기능
- 변경 이력 조회 모달

**이력 조회 모달**:
- 제조사별 수수료율 변경 이력
- 적용 기간 표시
- 생성자 정보
- 변경 사유
- 현재 적용 여부 표시

#### 원가 관리 페이지 통합
**파일**: `app/admin/revenue/pricing/page.tsx`

- 새로운 탭 추가: "제조사별 수수료율"
- Percent 아이콘으로 시각적 구분
- 기존 탭들과 일관된 디자인
- 권한 레벨 3 이상만 접근 가능

**탭 순서**:
1. 환경부 고시가
2. 제조사별 원가
3. 기본 설치비
4. 대리점 가격
5. 영업점 설정
6. **제조사별 수수료율** ← 새로 추가
7. 실사비용

## 시스템 특징

### 1. 유연한 수수료율 관리
- 각 영업점이 제조사마다 다른 수수료율 설정 가능
- 예: 원에너지는 에코센스 15%, 가이아씨앤에스 20%

### 2. 완전한 이력 관리
- 모든 변경사항 자동 기록
- effective_from/effective_to로 시간 기반 추적
- 변경 사유 및 생성자 정보 보관

### 3. 안전한 업데이트
- 트랜잭션으로 데이터 일관성 보장
- 이전 수수료율 자동 종료
- 새로운 수수료율 적용일 설정

### 4. 권한 기반 접근 제어
- 권한 레벨 3 이상만 조회/수정 가능
- API 레벨에서 권한 검증

### 5. 확장 가능한 구조
- 새로운 제조사 추가 용이
- 새로운 영업점 추가 자동 지원
- 대량 업데이트 API로 효율적인 관리

## 접근 방법

1. **웹 UI**:
   - URL: `/admin/revenue/pricing`
   - "제조사별 수수료율" 탭 클릭
   - 영업점 선택 후 수정 버튼 클릭
   - 수수료율 입력 후 저장

2. **API**:
   ```typescript
   // 현재 수수료율 조회
   GET /api/revenue/commission-rates?sales_office=원에너지

   // 수수료율 업데이트
   PUT /api/revenue/commission-rates
   Body: {
     sales_office: "원에너지",
     effective_from: "2025-01-01",
     rates: [
       { manufacturer: "ecosense", commission_rate: 15 },
       { manufacturer: "gaia_cns", commission_rate: 20 }
     ]
   }

   // 이력 조회
   GET /api/revenue/commission-rates/history?sales_office=원에너지

   // 대량 업데이트
   POST /api/revenue/commission-rates/bulk
   Body: {
     manufacturer: "ecosense",
     commission_rate: 16,
     effective_from: "2025-02-01",
     sales_offices: ["원에너지", "푸른에너지"]
   }
   ```

## 데이터베이스 설정

스키마 적용:
```sql
-- SQL 스크립트 실행
psql -h your-host -d your-db -f sql/commission_rates_schema.sql
```

## 기술 스택

- **Backend**: Next.js API Routes, Supabase PostgreSQL
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons
- **Auth**: JWT 기반 권한 검증
- **Database**: PostgreSQL Views, Triggers

## 구현 완료 체크리스트

- [x] 데이터베이스 스키마 생성
- [x] TypeScript 타입 정의
- [x] 수수료율 조회 API (GET)
- [x] 수수료율 업데이트 API (PUT)
- [x] 이력 조회 API (GET)
- [x] 대량 업데이트 API (POST)
- [x] 수수료율 관리 UI 컴포넌트
- [x] 이력 조회 모달 UI
- [x] 원가 관리 페이지 통합
- [x] 타입 체크 통과
- [x] 권한 레벨 검증

## 향후 개선 가능 사항

1. **대량 업데이트 UI**:
   - 여러 영업점에 동시에 수수료율 적용하는 UI
   - 미리보기 기능

2. **수수료 계산 통합**:
   - 매출 관리에서 제조사별 수수료율 자동 적용
   - 계산 결과에 사용된 수수료율 표시

3. **알림 기능**:
   - 수수료율 변경 시 관련자에게 알림
   - 수수료율 적용 전 사전 알림

4. **통계 및 분석**:
   - 영업점별/제조사별 평균 수수료율
   - 수수료율 변경 빈도 분석
   - 수수료율 트렌드 차트

## 참고 문서

- 상세 구현 가이드: `claudedocs/commission-rate-management-implementation.md`
- 데이터베이스 스키마: `sql/commission_rates_schema.sql`
- 타입 정의: `types/commission.ts`
