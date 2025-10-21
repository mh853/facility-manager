# 대리점 가격 관리 시스템 - 구현 상태

## ✅ 완료된 사항

### 1. 데이터베이스 & API (100% 완료)
- ✅ `sql/dealer_pricing_system.sql` - 테이블 스키마 (role 수정 완료)
- ✅ `sql/dealer_pricing_sample_data.sql` - 16개 샘플 항목
- ✅ `app/api/revenue/dealer-pricing/route.ts` - CRUD API 완성
- ✅ `app/api/revenue/manufacturer-pricing/` - 제조사별 원가 API (기존)
- ✅ `app/api/revenue/installation-cost/` - 설치비 API (기존)

### 2. UI - 기본 구조 (70% 완료)
- ✅ 인터페이스 정의: `ManufacturerPricing`, `InstallationCost`, `DealerPricing`
- ✅ 상태 추가: `manufacturerPricing`, `installationCosts`, `dealerPricing`
- ✅ Load 함수: `loadManufacturerPricing()`, `loadInstallationCosts()`, `loadDealerPricing()`
- ✅ `loadAllData()` 수정 - 3개 함수 추가
- ✅ `handleEdit()` type 확장
- ✅ `handleSave()` switch 확장
- ✅ Tabs 배열 업데이트 (6개 탭)
- ✅ 통계 카드 업데이트 (4개 카드)

### 3. UI - 추가 작업 필요 (30% 미완)
- ⏳ **대리점 탭 UI** - 스니펫 파일 제공 (`dealer-pricing-tab-ui-snippet.txt`)
- ⏳ **폼 필드** - 스니펫 파일 제공 (`dealer-pricing-form-snippet.txt`)
- ⏳ **모달 제목** - EditForm type prop 및 title 수정 필요
- ⏳ 제조사별 원가 탭 (선택)
- ⏳ 설치비 탭 (선택)

## 📋 남은 작업

### 필수 (대리점 가격만)
1. **탭 UI 추가** (5분)
   - `claudedocs/dealer-pricing-tab-ui-snippet.txt` 내용 복사
   - `pricing/page.tsx` line 550 근처 ({activeTab === 'survey' ... }) 다음에 붙여넣기

2. **폼 필드 추가** (5분)
   - `claudedocs/dealer-pricing-form-snippet.txt` 내용 복사
   - `pricing/page.tsx` line 650 근처 (EditForm의 {type === 'survey' ... }) 다음에 붙여넣기

3. **EditForm type prop 수정** (1분)
   - Line 620 근처:
   ```typescript
   function EditForm({ item, type, onSave, saving }: {
     item: any;
     type: 'government' | 'sales' | 'survey' | 'manufacturer' | 'installation' | 'dealer';
     onSave: (data: any) => void;
     saving: boolean;
   }) {
   ```

4. **모달 제목 수정** (1분)
   - Line 590 근처:
   ```typescript
   title={`${editingItem ? '수정' : '추가'} - ${
     editType === 'government' ? '환경부 고시가' :
     editType === 'manufacturer' ? '제조사별 원가' :
     editType === 'installation' ? '기본 설치비' :
     editType === 'dealer' ? '대리점 가격' :
     editType === 'sales' ? '영업점 설정' : '실사비용'
   }`}
   ```

### 선택 (나중에)
- 제조사별 원가 탭 UI
- 설치비 탭 UI

## 🚀 테스트 절차

1. **SQL 실행**
   ```sql
   -- Supabase SQL 에디터
   -- 1. sql/dealer_pricing_system.sql
   -- 2. sql/dealer_pricing_sample_data.sql
   ```

2. **개발 서버 확인**
   - URL: `http://localhost:3001/admin/revenue/pricing`
   - "대리점 가격" 탭 클릭
   - 샘플 데이터 16개 확인

3. **CRUD 테스트**
   - 새 대리점 가격 추가
   - 마진율 자동 계산 확인
   - 수정 기능 테스트
   - 삭제 (소프트) 테스트

## 📁 파일 위치

### 완성된 파일
```
sql/
  dealer_pricing_system.sql          ✅ 테이블 스키마
  dealer_pricing_sample_data.sql     ✅ 16개 샘플 데이터

app/api/revenue/
  dealer-pricing/route.ts            ✅ CRUD API

app/admin/revenue/pricing/
  page.tsx                           🟡 70% 완성
```

### 스니펫 파일
```
claudedocs/
  dealer-pricing-tab-ui-snippet.txt       ⏳ 탭 UI 코드
  dealer-pricing-form-snippet.txt         ⏳ 폼 필드 코드
  dealer-pricing-ui-recovery-guide.md     📚 상세 가이드
  dealer-pricing-test-guide.md            📚 테스트 가이드
  sql-error-fix-summary.md                📚 SQL 오류 수정 내역
```

## ⚠️ 알려진 이슈

1. **Git Restore 사고**
   - 이전에 작성한 대리점 UI가 `git restore`로 삭제됨
   - API와 SQL은 살아있음 (untracked files)
   - UI는 스니펫으로 재구현 필요

2. **제조사별 원가/설치비 API**
   - API는 존재하지만 UI 미완성
   - 필요시 대리점 탭과 유사하게 구현

## 💡 추천 작업 순서

**최소 구현 (10분)**:
1. 대리점 탭 UI 스니펫 붙여넣기
2. 폼 필드 스니펫 붙여넣기
3. type prop & 모달 제목 수정
4. SQL 2개 실행
5. 테스트

**전체 구현 (30분)**:
1. 최소 구현 완료
2. 제조사별 원가 탭 추가
3. 설치비 탭 추가
4. 모든 폼 필드 완성
5. 통합 테스트
