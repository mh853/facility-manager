# 월 마감 시스템 자동 계산 기능 구현 완료

## ✅ 구현 내용

### 1. 자동 계산 API 엔드포인트
**파일**: `/app/api/admin/monthly-closing/auto-calculate/route.ts`

**기능**:
- 해당 월에 설치 완료된 사업장 자동 조회
- 각 사업장의 매출 계산 데이터 확인
- revenue_calculations 테이블 데이터 집계
- monthly_closings 테이블 자동 업데이트

**API 스펙**:
```typescript
POST /api/admin/monthly-closing/auto-calculate
{
  year: number,
  month: number,
  force?: boolean  // 기존 계산 덮어쓰기 여부
}

// 응답
{
  success: boolean,
  message: string,
  data: {
    totalBusinesses: number,
    calculatedBusinesses: number,
    failedBusinesses: number,
    businesses: Array<{
      business_id: string,
      business_name: string,
      status: 'success' | 'failed' | 'skipped' | 'error',
      message: string
    }>
  }
}
```

**로직 흐름**:
```
1. 해당 월 설치 완료 사업장 조회 (business_info.installation_date 기준)
   ↓
2. 각 사업장의 revenue_calculations 데이터 확인
   - 데이터 있음: calculatedBusinesses++
   - 데이터 없음: failedBusinesses++ (안내 메시지)
   ↓
3. revenue_calculations 테이블에서 해당 월 데이터 집계
   - total_revenue, sales_commission, installation_costs 합산
   - adjusted_sales_commission, installation_extra_cost 반영
   ↓
4. 기존 기타 비용 조회 및 합산
   ↓
5. monthly_closings 테이블에 upsert (year, month 기준)
   ↓
6. 결과 반환 (성공/실패 사업장 목록)
```

### 2. 프론트엔드 UI 개선
**파일**: `/app/admin/monthly-closing/page.tsx`

**추가된 기능**:

#### A. 자동 계산 버튼
```tsx
<button onClick={() => handleAutoCalculate(selectedYear, selectedMonth)}>
  자동 계산
</button>
```
- 월 선택 필수 (미선택 시 알림)
- 계산 중 버튼 비활성화
- 로딩 스피너 표시

#### B. 진행 상황 표시
```tsx
{autoCalculating && calculationProgress.total > 0 && (
  <div className="bg-blue-50 border border-blue-200 ...">
    <div className="progress-bar">
      {calculationProgress.current} / {calculationProgress.total}
    </div>
  </div>
)}
```
- 프로그레스 바 (파란색)
- 현재/총 개수 표시
- 진행 메시지 표시

#### C. 데이터 없을 때 안내
```tsx
{closings.length === 0 && selectedMonth && (
  <div>
    📊 "{year}년 {month}월" 데이터를 생성하려면:
    - 위 "자동 계산" 버튼을 클릭하세요
    - 해당 월의 사업장 매출이 자동으로 계산됩니다
  </div>
)}
```

### 3. 상태 관리
```typescript
const [autoCalculating, setAutoCalculating] = useState(false);
const [calculationProgress, setCalculationProgress] = useState({
  current: 0,
  total: 0,
  message: ''
});
```

## 🎯 사용자 워크플로우

### 시나리오 1: 데이터가 없는 경우
1. 월 마감 페이지 접속
2. "마감 데이터가 없습니다" 메시지 표시
3. 월 선택 (예: 2024년 12월)
4. "자동 계산" 버튼 클릭
5. 진행 상황 표시 (예: 3/15 완료)
6. 완료 알림: "✅ 3개 사업장 계산 완료"
7. 데이터 자동 표시

### 시나리오 2: 이미 데이터가 있는 경우
1. 월 선택
2. 기존 데이터 표시
3. "자동 계산" 버튼 클릭
4. 기존 계산 건너뛰기 (force=false)
5. 새로운 사업장만 계산
6. 업데이트된 데이터 표시

## 📊 데이터 흐름

```
business_info (설치일)
    ↓
    ↓ installation_date 필터링
    ↓
해당 월 사업장 목록
    ↓
    ↓ 각 사업장 확인
    ↓
revenue_calculations (매출 계산 데이터)
    ↓
    ↓ 데이터 있음
    ↓
월별 집계 (sum)
    ↓
    ↓ total_revenue, sales_commission, installation_costs
    ↓
기타 비용 조회 (miscellaneous_costs)
    ↓
    ↓ 합산
    ↓
순이익 계산
    ↓
    ↓ total_revenue - sales_commission - installation_costs - misc_costs
    ↓
monthly_closings 저장 (upsert)
    ↓
    ↓ 완료
    ↓
UI 업데이트
```

## 🔑 핵심 개선사항

### 1. 완전 자동화
- **이전**: 매출 관리 → 계산 실행 → 월 마감 페이지 → 수동 계산
- **이후**: 월 마감 페이지 → 자동 계산 버튼 클릭 → 완료

### 2. 진행 상황 가시성
- 계산 진행 중 실시간 프로그레스 표시
- 성공/실패 사업장 개수 표시
- 상세 결과 알림

### 3. 사용자 경험 최적화
- 데이터 없을 때 명확한 안내
- 원클릭 자동 계산
- 계산 중 버튼 비활성화로 중복 방지

### 4. 데이터 일관성 보장
- revenue_calculations 테이블 데이터 기반
- adjusted_sales_commission, installation_extra_cost 자동 반영
- 기존 기타 비용 유지

## ⚠️ 주의사항

### 1. 매출 계산 선행 필요
자동 계산은 `revenue_calculations` 테이블의 기존 데이터를 집계합니다.

**데이터 생성 방법**:
- **방법 A**: 매출 관리 페이지(`/admin/revenue`)에서 사업장별 계산 실행
- **방법 B**: 전체 재계산 기능 사용

**현재 자동 계산의 역할**:
- ✅ revenue_calculations 데이터 확인
- ✅ 월별 집계 및 마감
- ❌ 새로운 매출 계산 실행 (별도 작업 필요)

### 2. 데이터 의존성
```
business_info → revenue_calculations → monthly_closings
```
- business_info에 설치일 필수
- revenue_calculations에 매출 데이터 필수
- 누락 시 자동 계산 불가

### 3. 권한 관리
- 자동 계산 API는 인증된 사용자만 접근 가능
- TokenManager를 통한 JWT 토큰 검증

## 🚀 향후 개선 가능 사항

### 1. 완전 자동 매출 계산 통합
현재는 revenue_calculations 데이터를 확인만 하지만, 향후 다음 기능 추가 가능:
- 매출 계산 API 직접 호출
- 사업장별 계산 자동 실행
- 실패 사업장 재시도

### 2. 일괄 재계산 기능
- 여러 월을 한번에 재계산
- 연도 단위 재계산
- 스케줄러 연동 (월말 자동 실행)

### 3. 상세 로그 및 이력
- 계산 이력 테이블 추가
- 성공/실패 상세 로그
- 재계산 사유 기록

### 4. 알림 기능
- 계산 완료 이메일/슬랙 알림
- 오류 발생 시 관리자 알림
- 월말 자동 계산 알림

## 📝 테스트 시나리오

### 테스트 1: 정상 케이스
1. 매출 관리에서 2024년 12월 사업장 3개 계산 완료
2. 월 마감 페이지에서 2024년 12월 선택
3. "자동 계산" 버튼 클릭
4. 예상 결과: "✅ 3개 사업장 계산 완료"

### 테스트 2: 데이터 없는 케이스
1. 2024년 11월 선택 (매출 계산 미실행)
2. "자동 계산" 버튼 클릭
3. 예상 결과: "0개 사업장 계산 완료, 3개 실패"
4. 안내: 매출 관리에서 먼저 계산 실행 필요

### 테스트 3: 기타 비용 반영
1. 2024년 12월 데이터 생성
2. 기타 비용 추가 (예: 광고비 1,000,000원)
3. "자동 계산" 재실행
4. 예상 결과: 순이익에 기타 비용 차감 반영

## 📄 관련 파일

### API
- `/app/api/admin/monthly-closing/auto-calculate/route.ts` (신규)
- `/app/api/admin/monthly-closing/route.ts` (기존)

### UI
- `/app/admin/monthly-closing/page.tsx` (수정)

### 타입
- `/types/index.ts` (MonthlyClosing, MiscellaneousCost)

### 문서
- `/claudedocs/monthly-closing-fix-plan.md` (문제 진단)
- `/claudedocs/monthly-closing-auto-calculate-implementation.md` (본 문서)

## ✅ 구현 완료 체크리스트

- [x] 자동 계산 API 엔드포인트 구현
- [x] 프론트엔드 자동 계산 버튼 추가
- [x] 진행 상황 표시 UI
- [x] 데이터 없을 때 안내 메시지
- [x] 빌드 성공 확인
- [x] 타입 안전성 확보
- [x] 에러 핸들링
- [x] 구현 문서 작성

## 🎉 결론

월 마감 시스템에 완전 자동화 기능이 추가되어, 사용자는 **원클릭으로 월별 재무 데이터를 생성하고 관리**할 수 있게 되었습니다!

**사용자 경험 개선**:
- 복잡한 단계 제거 (3단계 → 1단계)
- 명확한 진행 상황 표시
- 직관적인 안내 메시지

**데이터 정확성**:
- revenue_calculations 테이블 기반
- 조정 항목 자동 반영
- 기존 기타 비용 보존

**시스템 안정성**:
- 빌드 성공
- 타입 안전성
- 에러 핸들링
