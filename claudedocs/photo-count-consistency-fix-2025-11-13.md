# 사진 개수 일관성 문제 해결 (Photo Count Consistency Fix)

**날짜**: 2025-11-13
**문제**: Facility list와 business detail 페이지의 사진 개수 불일치
**해결**: 전체 사진 수 통계 추가 (phase 무관)

---

## 🔍 문제 분석

### 사용자 리포트
> "리스트에서 확인되는 수량에 대한 정보를 business 페이지의 ui에서도 같은 정보를 가지고 출력해주면 안될까? 그러는게 더 좋을거같아."

- **Facility List (`/facility`)**: 항상 정확한 사진 개수 표시
- **Business Detail (`/business/[사업장명]`)**: 강제 새로고침할 때마다 수량이 변경됨
- 예: 2장 삭제 → 리스트는 2장 표시 ✅ → Business 페이지는 3장 → 2장 → 3장 반복 ❌

### 근본 원인

#### 1. Facility List (`/api/business-list`) - 정확함
```typescript
// Lines 280-293
const { data: photoStats } = await supabaseAdmin
  .from('uploaded_files')
  .select('business_id')
  .in('business_id', businessIds);  // ✅ 모든 사진 조회

const photoCountMap = new Map<string, number>();
photoStats.forEach((photo) => {
  const count = photoCountMap.get(photo.business_id) || 0;
  photoCountMap.set(photo.business_id, count + 1);
});
// → 전체 사진 개수 정확하게 카운트
```

**특징**:
- `business_id`로만 필터링
- Phase 무관하게 **모든 사진** 카운트
- DB row 수를 직접 카운트하므로 항상 정확

#### 2. Business Detail (`/api/facility-photos`) - Phase 필터링
```typescript
// Lines 487-517 (수정 전)
let query = supabaseAdmin
  .from('uploaded_files')
  .select('*')
  .eq('business_id', business.id);

// ❌ Phase 필터 적용 - 현재 탭에 맞는 사진만 조회
const phasePrefix = (phase === 'aftersales' || phase === 'postinstall')
  ? 'completion'
  : 'presurvey';
query = query.like('file_path', `%/${phasePrefix}/%`);
// → 현재 phase의 사진만 카운트
```

**특징**:
- `business_id` + **phase 경로** 필터링
- 현재 선택된 탭(phase)의 사진만 표시
- 탭 전환 시 사진 개수가 달라짐

### 불일치 발생 시나리오

1. **사업장에 총 3장 사진** (presurvey: 2장, completion: 1장)
2. **Facility List**:
   - Query: `business_id = X` → 3장 ✅
3. **Business Detail (presurvey 탭)**:
   - Query: `business_id = X AND file_path LIKE '%/presurvey/%'` → 2장 ❌
4. **Business Detail (postinstall 탭)**:
   - Query: `business_id = X AND file_path LIKE '%/completion/%'` → 1장 ❌

**결과**: 페이지 새로고침 시 이전 phase의 캐시가 표시되어 수량이 왔다갔다함

---

## ✅ 해결 방법

### 1. API 수정: `/api/facility-photos/route.ts`

#### A. 전체 사진 개수 조회 추가 (Lines 487-499)
```typescript
// ✅ 전체 사진 개수 조회 (facility list와 동일한 로직 - phase 무관)
const { data: allPhotos } = await supabaseAdmin
  .from('uploaded_files')
  .select('id')
  .eq('business_id', business.id);  // Phase 필터 없음

const totalPhotoCount = allPhotos?.length || 0;

console.log(`📊 [TOTAL-PHOTOS] 전체 사진 수:`, {
  businessName,
  businessId: business.id,
  totalPhotos: totalPhotoCount
});
```

**변경 사항**:
- Phase 필터링 **없이** 전체 사진 카운트
- Facility list와 **동일한 방식**으로 조회
- 별도 쿼리로 성능 영향 최소화

#### B. 응답 데이터 확장 (Lines 576-588)
```typescript
// ✅ 전체 사진 수를 statistics에 추가
const enhancedStatistics = {
  ...statistics,
  totalPhotosAllPhases: totalPhotoCount,     // 모든 phase의 사진 총합
  currentPhasePhotos: formattedFiles.length, // 현재 phase의 사진 수
  currentPhase: phase
};

return NextResponse.json({
  success: true,
  data: {
    files: formattedFiles,
    statistics: enhancedStatistics,  // 확장된 통계
    facilities: { ... }
  }
});
```

**추가된 필드**:
- `totalPhotosAllPhases`: 전체 사진 수 (facility list와 일치)
- `currentPhasePhotos`: 현재 탭의 사진 수
- `currentPhase`: 현재 선택된 phase

### 2. Frontend 수정: `components/ImprovedFacilityPhotoSection.tsx`

#### A. State 추가 (Lines 263-270)
```typescript
const [statistics, setStatistics] = useState({
  totalFacilities: 0,
  totalPhotos: 0,
  totalPhotosAllPhases: 0, // ✅ 새로 추가
  dischargeFacilities: 0,
  preventionFacilities: 0,
  basicCategories: 0
});
```

#### B. API 응답 처리 (Lines 329-335)
```typescript
// ✅ API에서 받은 전체 사진 수 사용
const trackerStats = photoTracker.getStatistics();
setStatistics({
  ...trackerStats,
  totalPhotosAllPhases: result.data.statistics?.totalPhotosAllPhases
    || trackerStats.totalPhotos
});
```

#### C. UI 표시 - 헤더 (Lines 1444-1447)
```typescript
<p className="text-sm text-gray-600">
  총 {statistics.totalFacilities}개 시설,
  전체 {statistics.totalPhotosAllPhases}장
  (현재 단계: {statistics.totalPhotos}장)
</p>
```

#### D. UI 표시 - 통계 카드 (Lines 1524-1536)
```typescript
<div className="bg-purple-50 p-3 md:p-4 rounded-lg ...">
  <div className="flex items-center gap-2">
    <Camera className="w-5 h-5 text-purple-600" />
    <span className="font-medium text-purple-800">총 사진 (전체)</span>
  </div>
  <div className="text-2xl font-bold text-purple-900">
    <AnimatedCounter
      value={statistics.totalPhotosAllPhases}  // ✅ 전체 수 표시
      duration={1000}
    />
  </div>
</div>
```

---

## 📊 데이터 흐름

### Before (불일치 발생)
```
1. Facility List:
   DB Query → business_id = X → 3장 ✅

2. Business Detail (presurvey):
   DB Query → business_id = X + phase filter → 2장 ❌
   photoTracker.getStatistics() → totalPhotos: 2
   UI Display → "총 2장" ❌

3. 강제 새로고침:
   Cache 충돌 → 3장 → 2장 → 3장 반복 ❌
```

### After (일관성 보장)
```
1. Facility List:
   DB Query → business_id = X → 3장 ✅

2. Business Detail (any phase):
   DB Query 1 → business_id = X → 3장 (totalPhotosAllPhases)
   DB Query 2 → business_id = X + phase filter → 2장 (currentPhasePhotos)

   UI Display:
   - 헤더: "전체 3장 (현재 단계: 2장)" ✅
   - 통계 카드: "총 사진 (전체) 3" ✅

3. 강제 새로고침:
   항상 전체 3장 표시 ✅
```

---

## 🎯 검증 방법

### 시나리오 1: 사진 삭제 후 일관성
```bash
# 준비: 3장의 사진 업로드 (presurvey: 2장, completion: 1장)

# 1. Facility List 확인
→ "3장" 표시 ✅

# 2. Business Detail (presurvey 탭)
→ 헤더: "전체 3장 (현재 단계: 2장)" ✅
→ 통계 카드: "총 사진 (전체) 3" ✅

# 3. 사진 1장 삭제 (presurvey)
→ 삭제 성공

# 4. Facility List 재확인
→ "2장" 표시 ✅

# 5. Business Detail 재확인
→ 헤더: "전체 2장 (현재 단계: 1장)" ✅
→ 통계 카드: "총 사진 (전체) 2" ✅

# 6. 강제 새로고침 여러 번
→ 항상 "전체 2장" 유지 ✅
```

### 시나리오 2: Phase 탭 전환
```bash
# 1. presurvey 탭 (2장)
→ 전체: 3장 (현재: 2장) ✅

# 2. postinstall 탭 (1장)
→ 전체: 3장 (현재: 1장) ✅

# 3. aftersales 탭 (0장)
→ 전체: 3장 (현재: 0장) ✅
```

---

## 💡 핵심 개선 사항

### 1. 데이터 정확성
- **Before**: Phase 필터링으로 인한 부분 카운트
- **After**: 전체 사진 수와 현재 phase 사진 수 분리

### 2. 사용자 경험
- **Before**: 수량이 왔다갔다하여 혼란
- **After**: 항상 일관된 전체 수량 + 현재 단계 수량 명시

### 3. 성능
- **Before**: 캐시 충돌로 인한 불필요한 리렌더링
- **After**: 추가 쿼리 1개 (ID만 조회)로 성능 영향 최소

### 4. 코드 일관성
- **Before**: Facility list와 Business detail이 다른 로직
- **After**: 두 페이지 모두 동일한 전체 수 카운팅 방식

---

## 🔗 관련 문서

- [사진 삭제 API 수정](./photo-deletion-fix-2025-11-12.md) - DELETE endpoint 수정
- [사진 표시 문제 해결](./photo-display-facilityinfo-fix-2025-11-13.md) - facility_info 형식 수정
- [최종 마이그레이션 리포트](./final-migration-report-2025-11-12.md) - 테이블 구조 변경

---

## 📝 학습 포인트

### Phase-aware vs Phase-agnostic Queries
- **Phase-aware**: 현재 탭의 데이터만 필요할 때
- **Phase-agnostic**: 전체 통계가 필요할 때
- **두 가지를 함께 제공**: 최상의 UX

### 통계 데이터 설계
```typescript
statistics: {
  // Phase-agnostic (전체 통계)
  totalPhotosAllPhases: number;

  // Phase-aware (현재 탭 통계)
  totalPhotos: number;
  currentPhasePhotos: number;
  currentPhase: string;

  // 시설 통계
  totalFacilities: number;
  dischargeFacilities: number;
  preventionFacilities: number;
}
```

### API 설계 원칙
1. **일관성**: 같은 데이터는 항상 같은 방식으로 조회
2. **투명성**: 필터링 로직을 명확하게 로깅
3. **확장성**: 기존 데이터 구조 확장, 변경하지 않음

### 캐시 관리
- **문제**: Phase별 캐시가 서로 다른 값 저장
- **해결**: Phase 무관한 전체 통계 별도 관리
- **최적화**: 200ms debounce로 불필요한 재조회 방지

---

**작성자**: Claude Code
**해결 시간**: ~45분
**최종 상태**: ✅ 해결 완료 및 검증 완료
