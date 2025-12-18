# 매출 계산 누락 사업장 처리 가이드

## 상황 분석

**174개 사업장**이 `project_year = 2025`이지만 매출 계산이 없음:
- **전체 project_year = 2025**: 1,320개
- **매출 계산 있음**: 1,146개
- **매출 계산 없음**: 174개

## 원인 파악

### 1. 신규 설치 사업장
- 2025년에 설치되었지만 아직 매출 계산이 한 번도 실행되지 않음
- 설치 후 계산 작업이 누락됨

### 2. 계산 오류
- 계산 시도했지만 실패한 경우
- 데이터 불완전 (기기 정보, 가격 정보 등 누락)

### 3. 의도적 미계산
- 테스트 사업장
- 계약 해지 또는 보류 중인 사업장

## 해결 방법

### 방법 1: 매출관리 페이지에서 개별 계산 ⭐ 권장

#### 단계:
1. **매출관리 페이지 접속** (`/admin/revenue`)
2. **2025년 필터 적용**
3. **테이블에서 매출 계산이 없는 사업장 찾기**:
   - 매출금액이 비어있거나 0원인 행 확인
4. **각 행의 "계산" 버튼 클릭**
5. **계산 완료 알림 확인**

#### 장점:
- ✅ 개별 사업장 선택 가능
- ✅ 오류 발생 시 즉시 확인
- ✅ 계산 불필요한 사업장 제외 가능

#### 단점:
- ❌ 174개를 하나씩 해야 함 (시간 소요)

---

### 방법 2: 일괄 계산 기능 활성화 (코드 수정 필요)

현재 코드에 `calculateAllBusinesses` 함수가 있지만 UI에서 호출되지 않습니다.

#### 구현 단계:

**Step 1: UI 버튼 추가**

매출관리 페이지 헤더에 "일괄 계산" 버튼을 추가합니다.

**파일**: `/app/admin/revenue/page.tsx`

**위치**: Line 1099 근처 (헤더 버튼 영역)

```typescript
{/* 기존 버튼들 */}
<button
  onClick={() => setShowFilters(!showFilters)}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
>
  필터 {showFilters ? '숨기기' : '보기'}
</button>

{/* 새로 추가: 일괄 계산 버튼 */}
{userPermission >= 3 && (
  <button
    onClick={calculateAllBusinesses}
    disabled={isCalculating}
    className={`
      px-4 py-2 rounded-lg font-medium transition-colors
      ${isCalculating
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : 'bg-green-600 text-white hover:bg-green-700'
      }
    `}
  >
    {isCalculating ? '계산 중...' : '미계산 사업장 일괄 계산'}
  </button>
)}
```

**Step 2: 작동 방식**

버튼 클릭 시:
1. **자동 필터링**: `calculations` 배열에 없는 `businesses`만 추출
2. **순차 계산**: 174개 사업장을 하나씩 계산 (서버 부하 방지)
3. **진행 상황**: 콘솔에서 실시간 확인 가능
4. **완료 알림**: 성공/실패/건너뜀 건수 표시

#### 예상 결과:
```
일괄 계산 완료

✅ 성공: 170건
❌ 실패: 4건
⏭️ 건너뜀: 1146건
```

#### 계산 시간:
- 사업장당 약 100ms 지연 (서버 부하 방지)
- 174개 × 100ms = 약 17초
- 실제 API 호출 시간 포함 → **약 30-60초**

---

### 방법 3: SQL 직접 실행 (고급 사용자 전용)

#### 미계산 사업장 목록 확인:
```sql
-- 174개 사업장 ID 및 이름 조회
SELECT b.id, b.business_name, b.project_year
FROM business_info b
WHERE b.project_year = 2025
  AND NOT EXISTS (
    SELECT 1
    FROM revenue_calculations r
    WHERE r.business_id = b.id
  )
ORDER BY b.business_name;
```

#### API 호출 스크립트 (Node.js):
```javascript
// calculate_missing.js
const businesses = [/* SQL 결과 174개 ID */];

for (const businessId of businesses) {
  const response = await fetch('http://localhost:3000/api/revenue/calculate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      business_id: businessId,
      calculation_date: '2024-12-16',
      save_result: true
    })
  });

  const result = await response.json();
  console.log(`${businessId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  // 서버 부하 방지
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

---

## 권장 워크플로우

### ⭐ 프로덕션 환경 권장 순서:

#### 1단계: 샘플 테스트 (5개 사업장)
```
목적: 계산 로직 검증
방법: 개별 계산 버튼 사용
확인: 매출, 이익, 비용 항목 정확성
```

#### 2단계: 일괄 계산 (방법 2 구현)
```
목적: 남은 169개 일괄 처리
방법: "미계산 사업장 일괄 계산" 버튼
시간: 약 1분
```

#### 3단계: 결과 검증
```sql
-- 계산 완료 확인
SELECT COUNT(*)
FROM business_info b
WHERE b.project_year = 2025
  AND NOT EXISTS (
    SELECT 1 FROM revenue_calculations r WHERE r.business_id = b.id
  );
-- 결과: 0개 (모두 계산 완료)
```

#### 4단계: 통계 확인
```
매출관리 페이지 → 2025년 필터
예상 결과:
- 총 사업장: 1,320개 (174 + 1,146)
- 총 매출: 업데이트된 정확한 값
```

---

## 자동화 제안

### 향후 개선: 자동 매출 계산 스케줄러

**목적**: 신규 설치 사업장의 매출 자동 계산

**구현 방식**:
1. **cron job** 또는 **Vercel Cron**
2. 매일 자정 실행
3. 매출 계산이 없는 사업장 자동 감지
4. 자동 계산 실행
5. 실패 시 관리자 알림

**예시 코드**:
```typescript
// app/api/cron/auto-calculate/route.ts
export async function GET() {
  // 매출 계산 없는 사업장 조회
  const uncalculatedBusinesses = await supabase
    .from('business_info')
    .select('id')
    .filter('id', 'not.in', '(SELECT business_id FROM revenue_calculations)');

  // 자동 계산
  for (const business of uncalculatedBusinesses.data) {
    await calculateRevenue(business.id);
  }

  return NextResponse.json({ success: true });
}
```

**Vercel Cron 설정**:
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/auto-calculate",
    "schedule": "0 0 * * *"
  }]
}
```

---

## 체크리스트

### 계산 전 확인사항:
- [ ] 사업장의 기기 정보가 모두 입력되었는가?
- [ ] 가격 설정이 완료되었는가? (제조사별, 기기별)
- [ ] 영업점 설정이 있는가?
- [ ] 설치일자가 입력되었는가?

### 계산 실패 시 확인사항:
- [ ] 브라우저 콘솔에서 오류 메시지 확인
- [ ] 서버 로그에서 상세 오류 확인
- [ ] 사업장 데이터 완전성 검증
- [ ] API 권한 확인

---

## 다음 단계

### 즉시 실행 가능:
1. ✅ **방법 1** 사용하여 5개 샘플 계산
2. 🔄 결과 검증 및 데이터 정확성 확인

### 코드 수정 후 실행:
1. ✅ **방법 2** UI 버튼 추가 구현
2. ✅ 빌드 및 배포
3. 🔄 일괄 계산 실행 (174개)
4. ✅ 통계 재확인

### 장기 개선:
1. 🔄 자동 계산 스케줄러 구현
2. 🔄 신규 설치 시 자동 계산 트리거
3. 🔄 계산 실패 알림 시스템
