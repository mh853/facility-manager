# 사진 표시 안됨 문제 해결 (facility_info)
**날짜**: 2025-11-13
**문제**: DB에 사진이 있지만 business/[사업장명] 페이지에서 표시되지 않음

---

## 🔍 문제 분석

### 사용자 리포트
- DB에 사진 1장 존재 확인
- API가 파일 1개 정상 반환
- 하지만 business/(유)태현환경 페이지에서는 사진이 **전혀 표시되지 않음**

### 근본 원인 발견

#### 1차 진단: API 응답 확인
```javascript
// /api/facility-photos 응답
{
  success: true,
  data: {
    files: [1개 파일],
    statistics: {
      totalPhotos: 0,  // ❌ 0!
      totalFacilities: 0  // ❌ 0!
    }
  }
}
```

파일은 반환되지만 **통계가 모두 0**

#### 2차 진단: photoTracker 분석
```typescript
// utils/facility-photo-tracker.ts
photoTracker.buildFromUploadedFiles(files);
const statistics = photoTracker.getStatistics();
// → totalPhotos: 0
```

`photoTracker`가 파일을 처리했지만 시설로 분류하지 못함

#### 3차 진단: facility_info 값 확인
```sql
SELECT filename, facility_info
FROM uploaded_files
WHERE business_id = '727c5a4d...';

-- 결과
filename: u8758981314...png
facility_info: NULL  ❌
```

**facility_info가 NULL!**

#### 4차 진단: photoTracker 파싱 로직
```typescript
// facility-photo-tracker.ts:302
if (file.facilityInfo) {
  // "prevention_1_1" 형식 파싱
  const facilityInfoMatch = file.facilityInfo.match(
    /^(discharge|prevention)_(\d+)_(\d+)$/
  );

  if (facilityInfoMatch) {
    // ✅ 시설 정보 추출 성공
  }
}
```

photoTracker는 다음 형식만 파싱 가능:
- `"prevention_1_1"` ✅
- `"discharge_2_3"` ✅
- `"basic_gateway"` ✅

하지만 실제 DB 값:
- `NULL` ❌ (파싱 불가)

---

## 🔧 해결 과정

### 1단계: facility_info 값 설정 시도

```javascript
// 경로: biz_be7599f8/presurvey/prevention/outlet_1/prevention_1/...
// 추출: 배출구 1/방지시설 1
```

경로에서 정보를 추출하여 `"배출구 1/방지시설 1"` 형식으로 저장

**결과**: ❌ photoTracker가 여전히 파싱하지 못함

### 2단계: 올바른 형식으로 변경

photoTracker가 인식 가능한 형식으로 변경:
```javascript
// 변경 전
facility_info: "배출구 1/방지시설 1"  ❌

// 변경 후
facility_info: "prevention_1_1"  ✅
```

**형식**: `{type}_{outletNumber}_{facilityNumber}`

---

## ✅ 최종 수정 사항

### SQL 업데이트

```sql
UPDATE uploaded_files
SET facility_info = 'prevention_1_1'
WHERE id = '3ee64a21-17b6-4e42-8c24-5d2e710a6db5';
```

### 파일 경로 분석 로직

```javascript
const pathParts = file.file_path.split('/');

// 타입 추출
if (pathParts.includes('prevention')) {
  const outletMatch = pathParts.find(p => p.startsWith('outlet_'));
  const preventionMatch = pathParts.find(p => p.startsWith('prevention_'));

  const outletNum = parseInt(outletMatch.replace('outlet_', ''));
  const preventionNum = parseInt(preventionMatch.replace('prevention_', ''));

  // "prevention_1_1" 형식 생성
  facilityInfo = `prevention_${outletNum}_${preventionNum}`;
}
```

---

## 📊 검증 결과

### API 응답 (수정 후)

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "3ee64a21...",
        "name": "u8758981314...png",
        "facilityInfo": "prevention_1_1"
      }
    ],
    "statistics": {
      "totalFacilities": 1,
      "totalPhotos": 1,
      "preventionFacilities": 1,
      "dischargeFacilities": 0,
      "basicCategories": 0,
      "averagePhotosPerFacility": 1
    },
    "facilities": {
      "prevention": [
        {
          "facilityId": "prevention-1-1",
          "displayName": "방1",
          "photos": [1개]
        }
      ]
    }
  }
}
```

✅ **모든 통계가 정상!**

---

## 📝 facility_info 형식 가이드

### 방지시설/배출시설
```
형식: {type}_{outletNumber}_{facilityNumber}

예시:
- prevention_1_1  (배출구 1/방지시설 1)
- prevention_1_2  (배출구 1/방지시설 2)
- discharge_1_1   (배출구 1/배출시설 1)
- discharge_2_3   (배출구 2/배출시설 3)
```

### 기본사진
```
형식: basic_{category}

예시:
- basic_gateway       (게이트웨이)
- basic_entrance      (입구)
- basic_facility      (시설전경)
- basic_measurement   (측정기기)
```

---

## 🎯 파일 경로와 facility_info 매핑

| 파일 경로 | facility_info | 표시명 |
|----------|---------------|---------|
| `.../presurvey/prevention/outlet_1/prevention_1/...` | `prevention_1_1` | 방1 |
| `.../presurvey/discharge/outlet_1/discharge_2/...` | `discharge_1_2` | 배2 |
| `.../presurvey/basic/gateway/...` | `basic_gateway` | 게이트웨이 |

---

## 🚨 업로드 API 수정 필요

**문제**: 현재 업로드 API가 `facility_info`를 NULL로 저장

**위치**: `/app/api/upload-supabase/route.ts`, `/app/api/facility-photos/route.ts`

**수정 필요**:
```typescript
// 파일 업로드 시 facility_info 자동 설정
const facility_info = `${facilityType}_${outletNumber}_${facilityNumber}`;

await supabaseAdmin
  .from('uploaded_files')
  .insert({
    filename,
    file_path,
    facility_info,  // ✅ 추가 필요
    // ...
  });
```

---

## 🔗 관련 문서

- [photo-deletion-fix-2025-11-12.md](./photo-deletion-fix-2025-11-12.md) - 사진 삭제 API 수정
- [final-migration-report-2025-11-12.md](./final-migration-report-2025-11-12.md) - 테이블 마이그레이션

---

## 💡 학습 포인트

### photoTracker의 의존성
- photoTracker는 `facility_info` 값에 **전적으로 의존**
- NULL이거나 잘못된 형식이면 분류 실패 → 표시 안됨
- 정확한 형식: `{type}_{outlet}_{number}`

### 경로 vs DB 컬럼
- 파일 경로에는 정보가 있지만 DB 컬럼은 NULL
- photoTracker는 DB 컬럼만 사용
- 경로에서 추출 로직이 업로드 API에 필요

### 디버깅 순서
1. API 응답 확인 (파일 개수 vs 통계)
2. photoTracker 로직 확인
3. DB 컬럼 값 확인
4. 파싱 형식 일치 여부 확인

---

**작성자**: Claude Code
**해결 시간**: ~1시간
**최종 상태**: ✅ 해결 완료
