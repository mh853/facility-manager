# 대기필증 데이터베이스 검증 가이드

## 🚨 중요: 올바른 테이블 확인 방법

### 문제 상황
- UI에는 `P0501`이 표시됨
- DB에서 확인한 `additional_info`에는 `green_link_code: null`

### 원인 분석
**잘못된 테이블을 확인하신 것 같습니다!**

`green_link_code`는 **방지시설(prevention_facilities) 테이블**의 `additional_info`에 저장됩니다.
대기필증(air_permit_info) 테이블의 `additional_info`는 **다른 용도**입니다.

---

## ✅ 올바른 확인 방법

### 1. Supabase 대시보드에서 확인

#### Step 1: prevention_facilities 테이블 열기
```
Supabase Dashboard
→ Table Editor
→ prevention_facilities 테이블 선택
```

#### Step 2: 방지시설 레코드 찾기
```sql
SELECT id, facility_name, additional_info
FROM prevention_facilities
WHERE facility_name = '여과집진시설'
ORDER BY updated_at DESC
LIMIT 1;
```

**예상 결과**:
```json
{
  "id": "53d875ca-04c4-413d-a49c-521eddc224e8",
  "facility_name": "여과집진시설",
  "additional_info": {
    "green_link_code": "P0501"  ← 이것이 있어야 정상!
  }
}
```

### 2. SQL 쿼리로 직접 확인

```sql
-- 방지시설의 green_link_code 확인
SELECT
  pf.id,
  pf.facility_name,
  pf.additional_info->>'green_link_code' AS green_link_code,
  pf.updated_at,
  do.outlet_name,
  bi.business_name
FROM prevention_facilities pf
JOIN discharge_outlets do ON pf.outlet_id = do.id
JOIN air_permit_info api ON do.air_permit_id = api.id
JOIN business_info bi ON api.business_id = bi.id
WHERE bi.business_name = '주포산업(주)'
ORDER BY pf.updated_at DESC;
```

**예상 결과**:
| facility_name | green_link_code | updated_at | outlet_name | business_name |
|---------------|-----------------|------------|-------------|---------------|
| 여과집진시설 | P0501 | 2025-11-04 08:45:08 | 배출구 1 | 주포산업(주) |

---

## 🔍 잘못 확인한 테이블

### air_permit_info 테이블의 additional_info
```sql
SELECT additional_info
FROM air_permit_info
WHERE business_id = (SELECT id FROM business_info WHERE business_name = '주포산업(주)');
```

**결과**:
```json
{
  "category": "5종",
  "pollutants": [],
  "business_name": null,
  "facility_number": null,
  "green_link_code": null  ← 이것은 대기필증용 필드 (사용 안 함)
}
```

**이것은 대기필증(air_permit_info) 테이블의 `additional_info`입니다!**
- 대기필증 수준의 메타데이터 저장용
- 시설별 green_link_code와는 **무관**합니다

---

## 📋 테이블 구조 정리

### 테이블 계층 구조
```
business_info (사업장)
  └─ air_permit_info (대기필증)
      └─ discharge_outlets (배출구)
          ├─ discharge_facilities (배출시설)
          │   └─ additional_info.green_link_code  ← 배출시설 그린링크 코드
          └─ prevention_facilities (방지시설)
              └─ additional_info.green_link_code  ← 방지시설 그린링크 코드
```

### additional_info 용도 구분

| 테이블 | additional_info 용도 | green_link_code 저장 |
|--------|----------------------|---------------------|
| air_permit_info | 대기필증 메타데이터 | ❌ 저장 안 함 |
| discharge_outlets | 배출구 메타데이터 (게이트웨이 등) | ❌ 저장 안 함 |
| discharge_facilities | **배출시설 상세 정보** | ✅ 여기에 저장 |
| prevention_facilities | **방지시설 상세 정보** | ✅ 여기에 저장 |

---

## 🧪 검증 방법

### 서버 로그로 확인

최근 저장 로그를 보면:
```
✅ [OUTLET-FACILITY] 방지시설 업데이트 완료: {
  id: '53d875ca-04c4-413d-a49c-521eddc224e8',
  outlet_id: 'a3b0bef8-2b07-452f-a4de-6d84c1b89646',
  facility_name: '여과집진시설',
  additional_info: { green_link_code: 'P0501' },  ← 정상 저장됨!
  updated_at: '2025-11-04T08:45:08.668298+00:00'
}

✅ [DB] getPreventionFacilities 결과: 1개
   - 여과집진시설: green_link_code = "P0501"  ← 정상 조회됨!
```

**이 로그는 데이터가 정상적으로 저장되었음을 증명합니다!**

---

## ✅ 다시 확인해주세요

### 확인할 테이블
```sql
-- 이 쿼리를 실행해주세요
SELECT
  facility_name,
  additional_info,
  updated_at
FROM prevention_facilities
WHERE id = '53d875ca-04c4-413d-a49c-521eddc224e8';
```

**예상 결과**:
```json
{
  "facility_name": "여과집진시설",
  "additional_info": {
    "green_link_code": "P0501"
  },
  "updated_at": "2025-11-04T08:45:08.668298+00:00"
}
```

### 만약 여전히 null이라면

1. **브라우저 캐시 문제**:
   - Supabase Dashboard에서 F5 새로고침
   - 또는 브라우저 캐시 완전 삭제

2. **다른 레코드 확인 중**:
   - `id = '53d875ca-04c4-413d-a49c-521eddc224e8'` 확인
   - 최신 `updated_at` 레코드 확인

3. **실제 DB 불일치**:
   - 서버 로그 재확인
   - API 응답과 DB 실제값 비교

---

## 📞 다음 단계

### 1. 올바른 테이블 확인 후 결과 공유
```
prevention_facilities 테이블의
id = '53d875ca-04c4-413d-a49c-521eddc224e8' 레코드의
additional_info 값을 공유해주세요
```

### 2. 여전히 null이면
```
실제 DB 불일치 문제이므로
추가 디버깅이 필요합니다
```

### 3. P0501이 있으면
```
문제 해결!
다른 페이지에서도 정상 조회될 것입니다
```
