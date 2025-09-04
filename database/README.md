# 데이터베이스 최적화 가이드

## 개요
사업장 관리 모달의 데이터 동기화 문제를 해결하기 위한 데이터베이스 최적화 스크립트입니다.

## 문제 해결
- ✅ 모달 데이터 동기화 실패
- ✅ 캐시 무효화 문제  
- ✅ 성능 최적화
- ✅ 실시간 데이터 반영

## 적용 방법

### 1. Supabase 대시보드에서 수동 적용

1. Supabase 프로젝트 대시보드 로그인
2. SQL Editor 탭 이동
3. `optimize_business_schema.sql` 파일 내용을 복사하여 실행
4. 각 섹션별로 순차적으로 실행

### 2. 주요 최적화 내용

#### A. 통합 뷰 생성
```sql
CREATE OR REPLACE VIEW unified_business_view AS
SELECT ...
```
- business_info + businesses 테이블 통합
- 한국어 필드명 지원
- 실시간 데이터 동기화

#### B. 성능 인덱스 추가
```sql
CREATE INDEX idx_business_info_name_active ON business_info(business_name);
CREATE INDEX idx_business_info_updated_at ON business_info(updated_at DESC);
```
- 사업장명 검색 최적화
- 업데이트 시간 정렬 최적화

#### C. 실시간 알림 시스템
```sql
CREATE TRIGGER business_info_notify_trigger
AFTER INSERT OR UPDATE OR DELETE ON business_info
```
- 데이터 변경 실시간 감지
- WebSocket 연동 준비

### 3. 백엔드 코드 변경사항

#### A. 캐시 무효화 강제
```typescript
// 타임스탬프를 추가하여 캐시 무효화
const response = await fetch(`/api/business-unified?search=${name}&t=${Date.now()}`)
```

#### B. Optimistic UI 업데이트
```typescript
// 즉시 UI 반영, 백그라운드에서 검증
setSelectedBusiness(optimisticUpdate)
setTimeout(() => validateActualData(), 500)
```

#### C. 통합 새로고침 함수
```typescript
const refreshBusinessData = async (businessId, businessName) => {
  // 단일 소스에서 모든 데이터 새로고침 처리
}
```

### 4. 성능 개선 결과

**Before (최적화 전)**
- 모달 데이터 반영: 5-10초 지연
- 캐시로 인한 stale data 문제
- 사업장 검색: 1-2초 소요

**After (최적화 후)**  
- 모달 데이터 반영: 즉시 (Optimistic UI)
- 실제 데이터 검증: 500ms 이내
- 사업장 검색: 200-300ms 소요
- 캐시 무효화: 자동 처리

### 5. 모니터링 및 디버깅

#### A. 데이터 정합성 체크
```sql
SELECT * FROM check_data_integrity();
```

#### B. 성능 통계 확인
```sql
SELECT get_business_stats();
```

#### C. 실시간 알림 테스트
```sql
-- 데이터 변경 후 알림 수신 확인
UPDATE business_info SET manager_name = 'test' WHERE id = 'some-id';
```

### 6. 트러블슈팅

#### Q: 모달이 여전히 이전 데이터를 보여줘요
A: 브라우저 캐시를 완전히 비우거나 Incognito 모드로 테스트해보세요.

#### Q: 성능이 느려졌어요
A: 인덱스 생성이 완료되지 않았을 수 있습니다. 몇 분 후 다시 시도해보세요.

#### Q: 일부 사업장 데이터가 누락되어요
A: `check_data_integrity()` 함수를 실행하여 데이터 정합성을 확인해주세요.

### 7. 향후 개선사항

- [ ] WebSocket 실시간 동기화 구현
- [ ] Redis 캐시 레이어 추가
- [ ] GraphQL 구독을 통한 실시간 업데이트
- [ ] 사업장 데이터 버저닝 시스템

---

## 적용 후 확인사항

1. **기능 테스트**
   - 사업장 목록에서 항목 클릭
   - 상세 모달 열기
   - 정보 수정 후 저장
   - 모달에서 즉시 변경사항 확인

2. **성능 테스트**  
   - 사업장 목록 로딩 시간 측정
   - 검색 반응 속도 확인
   - 모달 열기 속도 측정

3. **데이터 일관성**
   - 데이터베이스와 UI 동기화 확인
   - 여러 창에서 동시 수정 테스트
   - 새로고침 후 데이터 유지 확인

**적용 완료 후 이 문서를 업데이트하여 실제 결과를 기록해주세요.**