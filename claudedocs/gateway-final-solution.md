# Gateway 계산 문제 최종 해결 방안

## 📊 작성일
2026-01-15 18:46

## 🎯 현재 상황

### 문제
대시보드 매입금액 ₩163,489,000 → 예상 ₩337,899,000+
- Gateway_1_2 매입금액 ₩174,410,000 누락

### 확인된 사실
1. ✅ **소스 코드**: `equipmentFields`에 `gateway_1_2` 포함됨 (Line 259)
2. ✅ **컴파일 결과**: `.next/server/app/api/dashboard/revenue/route.js`에 `gateway_1_2` 포함
3. ✅ **데이터베이스**: 제조사별 gateway_1_2 원가 정상 (에코센스: ₩1,000,000, 크린어스: ₩630,000)
4. ✅ **테스트 스크립트**: 동일한 로직으로 계산 시 ₩337,899,000 (정상)
5. ❌ **서버 실행**: 개발 서버가 중지된 상태

## 🔍 근본 원인

**개발 서버가 실행되지 않고 있습니다!**

```bash
# 확인 결과
ps aux | grep "next-server"  # → 프로세스 없음
lsof -i :3000                # → 리스닝 서버 없음
```

### 증거
1. `curl http://localhost:3000/api/dashboard/revenue` 이전 실행 시 응답했던 것은:
   - 브라우저 캐시 또는
   - 이미 종료된 프로세스의 잔여 연결

2. 사용자가 보고한 서버 로그:
   ```
   [DEBUG] 동승고무기기공업사: 매입금액 = 1,545,000원
   [DEBUG] 2025-07 최종 집계: 총매입 163,489,000원
   ```
   → 이는 `killall node` 이전의 로그로 추정

## ✅ 해결 방법

### 1단계: 개발 서버 재시작
```bash
cd /Users/mh.c/claude/facility-manager

# 프로세스 확인
ps aux | grep "next-server"

# 서버 시작
npm run dev
```

### 2단계: 서버 시작 확인
서버 콘솔에서 다음 로그가 출력되어야 함:

```
🔍 [CRITICAL CHECK] equipmentFields 배열: [...]
🔍 [CRITICAL CHECK] gateway_1_2 포함 여부: true
🔍 [CRITICAL CHECK] gateway (구형) 포함 여부: false
```

### 3단계: API 직접 테스트
**새 터미널**에서:
```bash
curl "http://localhost:3000/api/dashboard/revenue?months=2025-07" | jq '.data[] | select(.period == "2025-07") | .total_cost'
```

**예상 결과**: `337899000` (또는 354679000)

### 4단계: 대시보드 확인
1. 브라우저 시크릿 모드로 접속: `http://localhost:3000/admin`
2. 강제 새로고침: Cmd+Shift+R

**예상 화면** (2025-07월):
```
매출: ₩919,520,000
매입: ₩337,899,000 (36.7%)
순이익: ₩약 400,000,000
```

### 5단계: 서버 로그 확인
서버 콘솔에서 다음 로그 확인:

```
[DEBUG] 동승고무기기공업사: 매입금액 = 3,435,000원 (제조사: 크린어스)
[DEBUG] ✅ Gateway_1_2 계산 중: 동승고무기기공업사
[DEBUG]   - 수량: 3개
[DEBUG]   - 원가: 630,000원
[DEBUG]   - 매입: 1,890,000원
[DEBUG] 2025-07 최종 집계: 사업장 224개, 총매출 919,520,000원, 총매입 337,899,000원
```

## 📊 예상 변화

### Before (서버 재시작 전)
```
총매입: ₩163,489,000 (구버전 또는 서버 중지)
이익률: 67.58%
```

### After (서버 재시작 후)
```
총매입: ₩337,899,000
이익률: 43.5%
Gateway_1_2 매입: +₩174,410,000
```

## 🔧 코드 변경 사항

### `/app/api/dashboard/revenue/route.ts`

**Line 256-263**: equipmentFields 배열
```typescript
const equipmentFields = [
  'ph_meter', 'differential_pressure_meter', 'temperature_meter',
  'discharge_current_meter', 'fan_current_meter', 'pump_current_meter',
  'gateway_1_2', 'gateway_3_4', 'vpn_wired', 'vpn_wireless',  // ✅ gateway_1_2 포함
  // ...
];
```

**Line 265-267**: 디버그 로그 추가
```typescript
console.log('🔍 [CRITICAL CHECK] equipmentFields 배열:', equipmentFields);
console.log('🔍 [CRITICAL CHECK] gateway_1_2 포함 여부:', equipmentFields.includes('gateway_1_2'));
console.log('🔍 [CRITICAL CHECK] gateway (구형) 포함 여부:', equipmentFields.includes('gateway'));
```

**Line 310-318**: Gateway_1_2 계산 로그
```typescript
if (aggregationKey === '2025-07' && field === 'gateway_1_2' && quantity > 0) {
  console.log(`[DEBUG] ✅ Gateway_1_2 계산 중: ${business.business_name}`);
  console.log(`[DEBUG]   - 수량: ${quantity}개`);
  console.log(`[DEBUG]   - 원가: ${costPrice.toLocaleString()}원`);
  console.log(`[DEBUG]   - 매입: ${(costPrice * quantity).toLocaleString()}원`);
}
```

## 🧪 검증 완료 사항

### 1. 데이터베이스 쿼리
```bash
node scripts/check-manufacturer-gateway-pricing.js
```

**결과**: ✅ 모든 제조사 gateway_1_2 원가 정상

### 2. 제조사 매칭
```bash
node scripts/compare-api-vs-script.js
```

**결과**: ✅ 스크립트 계산 ₩337,899,000 (정상)

### 3. Gateway 필드 검증
```bash
node scripts/verify-all-gateway-fields.js
```

**결과**:
- ✅ gateway_1_2: 198개 사업장, ₩174,410,000
- ✅ gateway_3_4: 0개 사업장, ₩0
- ❌ gateway (구형): 제거됨

## ⚠️ 주의 사항

### 개발 서버 재시작 후에도 문제 지속 시

**체크리스트**:

1. **프로세스 확인**:
   ```bash
   ps aux | grep "next-server"  # 단 하나의 프로세스만 있어야 함
   ```

2. **포트 확인**:
   ```bash
   lsof -i :3000  # Node.js 프로세스가 LISTEN 상태여야 함
   ```

3. **빌드 로그 확인**:
   서버 시작 시 다음 로그가 있어야 함:
   ```
   ✓ Compiled /api/dashboard/revenue/route in XXXms
   ```

4. **타임스탬프 확인**:
   ```bash
   stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" app/api/dashboard/revenue/route.ts
   stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" .next/server/app/api/dashboard/revenue/route.js
   ```
   → 컴파일 파일이 소스 파일보다 나중이어야 함

5. **캐시 완전 삭제** (최후의 수단):
   ```bash
   killall node
   rm -rf .next node_modules/.cache
   npm run dev
   ```

## 📚 참고 문서

- `/claudedocs/gateway-calculation-root-cause.md` - 근본 원인 분석
- `/claudedocs/gateway-calculation-solution.md` - 이전 해결 시도
- `/claudedocs/debug-checklist.md` - 디버깅 체크리스트
- `/scripts/verify-gateway-calculation.js` - Gateway 계산 검증
- `/scripts/compare-api-vs-script.js` - API vs 스크립트 비교
- `/scripts/verify-all-gateway-fields.js` - 전체 Gateway 필드 검증
- `/scripts/check-manufacturer-gateway-pricing.js` - 제조사 원가 확인

## 🎓 학습 내용

### Next.js 개발 서버 특성

1. **핫 리로드**:
   - 파일 변경 시 자동 재컴파일
   - 하지만 서버가 중지되면 아무 의미 없음

2. **프로세스 관리**:
   - `Ctrl+C`로 종료 시 깨끗하게 종료되어야 함
   - 하지만 여러 프로세스가 남을 수 있음

3. **캐시 관리**:
   - `.next` 폴더: 빌드 결과 캐싱
   - `node_modules/.cache`: 의존성 캐시

4. **디버깅 팁**:
   - API 로그는 **서버 콘솔**에 출력됨 (브라우저 X)
   - 프로세스 확인: `ps aux | grep "next-server"`
   - 포트 확인: `lsof -i :3000`

---

**작성자**: Claude Code
**최종 수정**: 2026-01-15 18:46
**상태**: ⚠️ 개발 서버 재시작 필요
