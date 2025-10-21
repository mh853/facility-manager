# 매출 계산 문제 해결 가이드

## 🎯 문제 요약

매출 관리 페이지에서 계산 버튼을 누른 사업장들의 매출금액, 매입금액, 이익금액이 모두 0원으로 표시되는 문제가 발생했습니다.

### 발견된 원인

1. **제조사 이름 불일치**
   - `business_info` 테이블: '에코센스' (한글)
   - `manufacturer_pricing` 테이블: 'ecosense' (영문)
   - 결과: 원가 데이터를 찾지 못해 매출/매입 계산 실패

2. **NULL 제조사**
   - 일부 사업장의 `manufacturer` 필드가 NULL
   - API에서 400 에러 반환하지만 프론트엔드는 "완료" 메시지 표시

3. **CHECK 제약 조건**
   - `manufacturer_pricing`과 `business_info` 테이블에 영문 제조사명만 허용하는 제약 조건 존재

---

## 📋 해결 단계

### STEP 1: 데이터베이스 수정 (제조사 이름 통일)

**실행 위치:** Supabase Dashboard → SQL Editor

**파일:** `sql/STEP1_fix_manufacturer_constraint_and_data.sql`

**작업 내용:**
1. CHECK 제약 조건 삭제 (영문 → 한글 허용)
2. manufacturer_pricing: 영문 → 한글 변환
   - ecosense → 에코센스
   - cleanearth → 클린어스
   - gaia_cns → 가이아씨앤에스
   - evs → 이브이에스
3. business_info: NULL → '에코센스', 영문 → 한글
4. 새로운 CHECK 제약 조건 추가 (한글 이름만 허용)

**실행 방법:**
```
1. Supabase Dashboard 접속
2. 프로젝트 선택
3. SQL Editor 메뉴 클릭
4. "sql/STEP1_fix_manufacturer_constraint_and_data.sql" 내용 복사
5. "Run" 버튼 클릭
6. 결과 확인 (제조사 분포 표시)
```

**예상 결과:**
```sql
-- business_info 제조사 분포:
에코센스: 738개
가이아씨앤에스: 198개
이브이에스: 9개

-- manufacturer_pricing 제조사 분포:
에코센스: 9개
클린어스: 9개
가이아씨앤에스: 9개
이브이에스: 9개
```

---

### STEP 2: API 로직 개선 (자동 적용)

**파일:** `app/api/revenue/calculate/route.ts`

**개선 사항:**
1. ✅ manufacturer가 NULL이면 자동으로 '에코센스' 설정 및 DB 업데이트
2. ✅ 원가 데이터가 없을 때 상세한 경고 로그 출력
3. ✅ 계산 과정에서 문제 발생 시 사업장명과 기기명 포함된 로그

**변경 내용:**
- manufacturer 검증 로직: 에러 반환 → 기본값 자동 설정
- 로그 개선: 더 자세한 디버깅 정보 포함

---

### STEP 3: 잘못된 계산 결과 재계산 (선택 사항)

**파일:** `STEP2_recalculate_revenue.js`

**작업 내용:**
- revenue_calculations 테이블에서 total_revenue = 0인 데이터 찾기
- 해당 사업장들을 재계산하여 업데이트

**실행 방법:**
```bash
# 개발 서버가 실행 중인지 확인
npm run dev

# 별도 터미널에서 재계산 스크립트 실행
node STEP2_recalculate_revenue.js
```

**주의사항:**
- ⚠️ STEP 1을 먼저 완료한 후 실행해야 합니다
- ⚠️ 개발 서버(localhost:3000)가 실행 중이어야 합니다
- ⚠️ 재계산은 시간이 걸릴 수 있습니다 (사업장당 약 0.2초)

---

## 🔍 테스트 방법

### 1. 제조사 데이터 확인
```javascript
// debug-revenue-data.js 실행
node debug-revenue-data.js
```

**기대 결과:**
- business_info: 모든 사업장의 manufacturer가 한글 (에코센스, 클린어스 등)
- manufacturer_pricing: 모든 제조사명이 한글

### 2. 매출 계산 테스트

1. 매출 관리 페이지 접속: http://localhost:3000/admin/revenue
2. 사업장 선택
3. "계산" 버튼 클릭
4. 개발자 도구 (F12) → Console 탭 확인

**기대 로그:**
```
🧮 [REVENUE-CALCULATE] 계산 시작: { business_id: '...', calcDate: '2025-10-21' }
🔧 [REVENUE-CALCULATE] 제조사: 에코센스, 기기수: 9
✅ [REVENUE-CALCULATE] 계산 완료: {
  business_name: '(주)태광씨엠비',
  total_revenue: 4100000,
  net_profit: 1234567
}
```

**결과 확인:**
- 매출금액: ₩0이 아닌 실제 금액
- 매입금액: ₩0이 아닌 실제 금액
- 이익금액: 계산된 금액
- 이익률: 퍼센트 표시

### 3. 기기 상세 모달 확인

1. 사업장명 클릭
2. 기기 목록 확인
3. 단가와 합계 금액이 올바르게 표시되는지 확인

---

## 🚨 문제 해결

### Q1: STEP 1 실행 시 제약 조건 오류 발생

**증상:**
```
ERROR: new row violates check constraint "manufacturer_pricing_manufacturer_check"
```

**해결:**
- SQL 스크립트를 전체 선택하여 한 번에 실행
- 트랜잭션(BEGIN/COMMIT)이 제대로 동작하는지 확인

### Q2: 재계산 후에도 여전히 0원

**원인:**
1. 사업장에 기기 데이터가 없음
2. 해당 제조사의 원가 데이터가 없음

**확인 방법:**
```javascript
// 사업장의 기기 데이터 확인
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('business_info').select('*').eq('business_name', '사업장명').single();
  const equipmentFields = ['ph_meter', 'differential_pressure_meter', 'temperature_meter', 'gateway'];
  equipmentFields.forEach(f => console.log(f + ': ' + (data[f] || 0)));
})();
"
```

### Q3: 특정 제조사의 원가 데이터가 없음

**해결:**
1. Supabase Dashboard → manufacturer_pricing 테이블
2. 해당 제조사의 모든 기기 원가 데이터 확인
3. 누락된 기기가 있다면 데이터 추가

---

## 📊 예상 개선 효과

### 이전 (문제 상황)
- 매출금액: ₩0
- 매입금액: ₩0
- 이익금액: ₩0 또는 -₩450,000 (실사비만 계산)
- 이익률: 0%

### 이후 (수정 완료)
- 매출금액: ₩4,100,000 (실제 환경부 고시가 기준)
- 매입금액: ₩2,558,000 (제조사 원가 기준)
- 이익금액: ₩1,092,000 (매출 - 매입 - 비용)
- 이익률: 26.6%

---

## 📝 향후 개선 사항

1. **프론트엔드 에러 처리 개선**
   - API 응답에서 실제 계산 성공 여부 확인
   - 실패 시 상세한 에러 메시지 표시

2. **제조사 관리 UI 추가**
   - 사업장 등록/수정 시 제조사 선택 필수
   - 드롭다운으로 제한된 제조사만 선택 가능

3. **원가 데이터 검증**
   - 관리자 페이지에서 제조사별 원가 데이터 완성도 확인
   - 누락된 기기 원가 자동 알림

4. **계산 실패 로그 수집**
   - 계산 실패 케이스를 별도 테이블에 저장
   - 관리자 대시보드에서 확인 가능

---

## ✅ 체크리스트

완료 여부를 체크하세요:

- [ ] STEP 1: SQL 스크립트 실행 완료
- [ ] 제조사 분포 확인 (모두 한글)
- [ ] API 코드 수정 적용 확인 (자동 완료)
- [ ] 개발 서버 재시작
- [ ] 테스트 계산 실행 (1개 사업장)
- [ ] 콘솔 로그 확인 (상세 로그 출력)
- [ ] 결과 확인 (매출/매입 금액 표시)
- [ ] STEP 2: 재계산 스크립트 실행 (선택)
- [ ] 전체 사업장 검증

---

## 📞 추가 지원

문제가 지속되거나 추가 도움이 필요하면:
1. 개발자 도구 콘솔 로그 전체 복사
2. 문제가 발생한 사업장명 확인
3. Supabase Dashboard에서 해당 사업장 데이터 확인
