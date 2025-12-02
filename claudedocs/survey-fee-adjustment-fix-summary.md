# 실사비 조정 기능 수정 완료 요약

## 🔧 수정된 문제점

### 1. 저장 기능 미작동 문제 해결
**문제**: 사업장관리에서 실사비조정 항목에 값을 입력했는데 저장이 안됨

**원인**: `/api/business-info-direct` PUT 메서드에서 `survey_fee_adjustment` 필드 처리 로직 누락

**해결**:
- **파일**: `app/api/business-info-direct/route.ts`
- **라인**: 348-350 (새로 추가)
```typescript
if (updateData.survey_fee_adjustment !== undefined) {
  updateObject.survey_fee_adjustment = parseInt(updateData.survey_fee_adjustment) || null;
}
```

### 2. 매출상세보기 모달에 실사비조정 항목 미표시 문제 해결
**문제**: 사업장관리 상세모달에서 "매출상세보기" 버튼으로 접근하는 모달에 실사비조정 항목이 안보임

**해결**: `components/business/BusinessRevenueModal.tsx`에 대화형 편집 UI 추가
- **상태 관리**: 편집 모드, 폼 데이터, 저장 상태 관리 (라인 35-40)
- **데이터 로드**: useEffect로 초기값 설정 (라인 102-115)
- **저장 핸들러**: API 호출 및 매출 재계산 (라인 239-293)
- **UI 컴포넌트**: 편집/저장/취소 버튼과 입력 필드 (라인 727-809)

## ✅ 테스트 체크리스트

### 데이터베이스 준비
- [ ] SQL 마이그레이션 파일 실행
  ```bash
  # Supabase 대시보드에서 SQL 에디터로 실행
  # 또는 psql로 직접 실행:
  psql [DATABASE_URL] < sql/add_survey_fee_adjustment.sql
  ```
- [ ] `business_info` 테이블에 `survey_fee_adjustment` 컬럼 존재 확인
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'business_info'
    AND column_name = 'survey_fee_adjustment';
  ```

### 사업장 관리 페이지 테스트
- [ ] `/admin/business` 접속
- [ ] 기존 사업장 선택 → "수정" 버튼 클릭
- [ ] 비용 정보 섹션에서 "실사비 조정" 필드 확인
- [ ] 양수 값 입력 (예: 50000) → 저장 → 새로고침 후 값 유지 확인
- [ ] 음수 값 입력 (예: -30000) → 저장 → 새로고침 후 값 유지 확인
- [ ] 값 삭제 (빈 값) → 저장 → null로 저장되는지 확인

### 매출 관리 모달 테스트 (사업장 상세에서 접근)
- [ ] `/admin/business` → 사업장 상세보기 클릭
- [ ] "매출상세보기" 버튼 클릭
- [ ] 실사비용 카드에서 "실사비 조정" 섹션 확인
- [ ] 조정 없음 상태: "조정 없음" 배지 표시 확인
- [ ] "수정" 버튼 클릭 (권한 레벨 2 이상 필요)
- [ ] 조정 금액 입력 (예: 50000)
- [ ] "저장" 버튼 클릭 → 성공 메시지 확인
- [ ] 모달 자동 새로고침 → 조정된 금액 반영 확인
- [ ] "조정됨" 배지로 변경 확인
- [ ] 순이익 계산 공식에 조정 금액 반영 확인

### 매출 관리 페이지 테스트 (직접 접근)
- [ ] `/admin/revenue` 접속
- [ ] 사업장 선택 → "매출 상세보기" 클릭
- [ ] 위와 동일한 테스트 수행

### 계산 로직 검증
- [ ] 실사비 조정 = 0 또는 null
  - 총 실사비용 = 기본 실사비용
  - 순이익에 영향 없음
- [ ] 실사비 조정 = +50,000 (증액)
  - 총 실사비용 = 기본 실사비용 + 50,000
  - 순이익 = 원래 순이익 - 50,000
- [ ] 실사비 조정 = -30,000 (감액)
  - 총 실사비용 = 기본 실사비용 - 30,000
  - 순이익 = 원래 순이익 + 30,000

### Excel 업로드 테스트
- [ ] Excel 템플릿에 "실사비조정" 컬럼 추가
- [ ] 샘플 데이터 입력 (양수, 음수, 빈 값)
- [ ] 업로드 후 저장 확인
- [ ] 데이터베이스에 올바르게 저장되었는지 확인

## 🔄 데이터 흐름 확인

### 입력 → 저장
```
사업장 관리 수정 모달
└─ 실사비 조정 입력 필드
   └─ formData.survey_fee_adjustment 업데이트
      └─ Supabase upsert (라인 2140)
         └─ business_info 테이블 저장
```

### 저장 → 표시 (매출 모달)
```
매출 관리 모달 열기
└─ business 데이터 로드 (survey_fee_adjustment 포함)
   └─ 매출 계산 API 호출 (/api/revenue/calculate)
      └─ survey_fee_adjustment 반영한 총 실사비용 계산
         └─ 모달에 표시:
            - 실사비용 카드 (조정 내역)
            - 순이익 계산 공식 (상세 내역)
```

### 편집 → 저장 (매출 모달 내)
```
매출 모달 "수정" 버튼 클릭
└─ isEditingSurveyFee = true
   └─ 조정 금액 입력
      └─ "저장" 버튼 클릭
         └─ /api/business-info-direct PUT 호출
            └─ business_info 테이블 업데이트
               └─ 매출 재계산 API 호출
                  └─ 모달 자동 갱신
```

## 📝 구현된 파일 목록

1. **types/index.ts** (라인 121, 398-400)
   - BusinessInfo 인터페이스에 survey_fee_adjustment 추가
   - CalculatedData 인터페이스에 조정 관련 필드 추가

2. **app/api/revenue/calculate/route.ts** (라인 441-444, 521-523)
   - 실사비 조정 반영한 총 실사비용 계산
   - 결과 객체에 조정 정보 포함

3. **components/business/BusinessRevenueModal.tsx** (대폭 수정)
   - 라인 35-40: 실사비 조정 편집 상태 관리
   - 라인 102-115: 초기값 로드
   - 라인 239-293: 저장 핸들러
   - 라인 727-809: 대화형 UI (편집/저장/취소)

4. **app/admin/business/page.tsx** (여러 라인 수정)
   - 라인 114: FormData 인터페이스
   - 라인 2386: 폼 초기화
   - 라인 2480: 데이터 로드
   - 라인 2743: Excel 매핑
   - 라인 3150: 서버 동기화
   - 라인 2140: Supabase 저장
   - 라인 4959-4977: UI 입력 필드

5. **app/api/business-info-direct/route.ts** (라인 348-350, 새로 추가)
   - PUT 메서드에 survey_fee_adjustment 처리 로직 추가

6. **sql/add_survey_fee_adjustment.sql** (새 파일)
   - 데이터베이스 마이그레이션 SQL

7. **claudedocs/survey-fee-adjustment-implementation.md** (기존)
   - 전체 구현 상세 문서

8. **claudedocs/survey-fee-adjustment-fix-summary.md** (이 파일)
   - 버그 수정 및 테스트 가이드

## ⚠️ 주의사항

1. **데이터베이스 마이그레이션 필수**: SQL 파일 실행 없이는 저장 불가
2. **권한 확인**: 매출 모달에서 편집은 권한 레벨 2 이상 필요
3. **숫자 형식**: 양수는 증가, 음수는 감소를 의미
4. **null 처리**: 빈 값은 null로 저장되며 계산 시 0으로 처리
5. **자동 재계산**: 저장 후 매출이 자동으로 재계산됨

## 🎉 완료된 기능

✅ 사업장 관리 페이지에서 실사비 조정 입력 및 저장
✅ 매출 관리 모달에서 실사비 조정 표시 및 편집
✅ 실사비 조정이 순이익 계산에 자동 반영
✅ 권한 기반 편집 제어
✅ 대화형 UI (편집/저장/취소)
✅ 조정 상태 시각적 표시 (배지, 색상)
✅ Excel 업로드 지원

## 📅 수정 완료일
2025-12-01
