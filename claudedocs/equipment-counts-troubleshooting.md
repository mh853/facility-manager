# 측정기기 수량 문제 트러블슈팅

## 현재 상황

### 문제 1: 측정기기 수량이 모두 0으로 표시
**로그 분석 결과:**
```
🔧 장비 수량 계산 결과: {
  business_name: '(주)영빈산업(방2)',
  discharge_facilities_count: 0,    ← 배출시설 데이터 없음
  prevention_facilities_count: 0,   ← 방지시설 데이터 없음
  equipment_counts: { 모두 0 }
}
```

### 문제 2: PDF 업로드 실패
```
PDF 업로드 오류: Error: 파일 업로드 실패
PDF 자동 저장 오류: Error: PDF 업로드에 실패했습니다.
```

---

## 해결 방법

### 1단계: 측정기기 데이터 확인

**Supabase SQL 에디터에서 실행:**

```sql
-- 1. 사업장명 정확히 확인
SELECT DISTINCT business_name
FROM business_info
WHERE business_name LIKE '%영빈산업%'
ORDER BY business_name;

-- 2. discharge_facilities 데이터 확인
SELECT
  business_name,
  discharge_ct,
  is_deleted
FROM discharge_facilities
WHERE business_name LIKE '%영빈산업%';

-- 3. prevention_facilities 데이터 확인
SELECT
  business_name,
  ph,
  pressure_differential,
  temperature,
  pump_ct,
  fan_ct,
  is_deleted
FROM prevention_facilities
WHERE business_name LIKE '%영빈산업%';
```

**예상 결과:**
- **Case A**: 데이터가 존재하지만 `business_name`이 약간 다름
  - 예: `(주)영빈산업(방2)` vs `(주) 영빈산업(방2)` (공백 차이)
- **Case B**: 데이터가 전혀 없음 → 측정기기 정보 등록 필요
- **Case C**: 데이터는 있지만 모두 `'면제'` 또는 `'없음'` 상태

### 2단계: 문제별 해결책

#### Case A: business_name 불일치
**원인**: 공백, 특수문자 등으로 정확히 매칭 안됨

**해결책 1 - DB 데이터 수정:**
```sql
-- 사업장명 통일 (business_info의 이름에 맞춤)
UPDATE discharge_facilities
SET business_name = '(주)영빈산업(방2)'
WHERE business_name LIKE '%영빈산업%';

UPDATE prevention_facilities
SET business_name = '(주)영빈산업(방2)'
WHERE business_name LIKE '%영빈산업%';
```

**해결책 2 - API 쿼리 수정 (LIKE 사용):**
현재는 정확히 일치하는 경우만 찾음 → 부분 일치로 변경

#### Case B: 데이터 없음
**해결책**: 사업장 관리 페이지에서 측정기기 정보 등록
1. `/business/[사업장명]` 페이지 접속
2. 배출시설/방지시설 정보 입력
3. 각 시설의 측정기기 정보 등록

#### Case C: 모두 면제/없음
**현상**: 데이터는 있지만 값이 `'면제'` 또는 `'없음'`
**해결책**: 실제 설치된 측정기기가 있다면 값을 업데이트

### 3단계: PDF 업로드 문제 해결

**디버깅 추가 완료** - 다음 계약서 생성 시 브라우저 콘솔에서 확인:
```
📤 PDF 업로드 API 응답: {
  status: XXX,
  ok: true/false,
  data: { ... }
}

❌ PDF 업로드 실패 상세: {
  message: "구체적인 에러 메시지",
  error: { ... }
}
```

**예상 원인:**
1. `/api/upload` 엔드포인트 권한 문제
2. Supabase Storage 버킷 설정 문제
3. 파일 크기 제한 초과
4. 네트워크 타임아웃

---

## 다음 테스트

### 테스트 1: 측정기기가 실제로 등록된 사업장으로 테스트
1. SQL 쿼리로 데이터가 있는 사업장 찾기:
```sql
SELECT DISTINCT business_name
FROM discharge_facilities
WHERE discharge_ct IS NOT NULL
  AND discharge_ct != '면제'
  AND discharge_ct != '없음'
LIMIT 5;
```

2. 해당 사업장으로 계약서 생성
3. 콘솔 로그 확인

### 테스트 2: PDF 업로드 에러 상세 확인
1. 계약서 생성
2. 브라우저 콘솔에서 `📤 PDF 업로드 API 응답` 로그 확인
3. 에러 메시지와 status 코드 공유

---

## 체크리스트

- [ ] SQL 쿼리 실행하여 사업장명 확인
- [ ] discharge_facilities / prevention_facilities 데이터 존재 확인
- [ ] business_name 정확히 일치하는지 확인
- [ ] 측정기기 데이터가 없다면 등록
- [ ] 데이터가 있는 사업장으로 다시 테스트
- [ ] PDF 업로드 에러 로그 확인
- [ ] 서버 콘솔에서 장비 수량 계산 로그 재확인

---

## 파일 위치

**디버깅 SQL 쿼리**: `claudedocs/equipment-debug-query.sql`
**API 로그 추가**: `app/api/document-automation/contract/route.ts` (line 153-168)
**PDF 업로드 로그**: `utils/contractPdfGenerator.ts` (line 162-176)
