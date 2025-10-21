# 대리점 가격 UI 복구 가이드

## 현재 상황
- ✅ API: `app/api/revenue/dealer-pricing/route.ts` 완성
- ✅ SQL: `sql/dealer_pricing_system.sql` (role 수정 완료)
- ✅ 샘플 데이터: `sql/dealer_pricing_sample_data.sql`
- ❌ UI: `app/admin/revenue/pricing/page.tsx` (이전 버전으로 되돌려짐)

## 필요한 작업

### 1단계: SQL 실행
```sql
-- Supabase SQL 에디터에서 순서대로 실행
1. sql/dealer_pricing_system.sql
2. sql/dealer_pricing_sample_data.sql
```

### 2단계: UI 파일 수정

현재 `app/admin/revenue/pricing/page.tsx` 파일에 다음 내용 추가 필요:

#### A) 인터페이스 추가 (완료)
```typescript
interface ManufacturerPricing { ... }
interface InstallationCost { ... }
interface DealerPricing { ... }
```

#### B) 상태 추가 (완료)
```typescript
const [manufacturerPricing, setManufacturerPricing] = useState<ManufacturerPricing[]>([]);
const [installationCosts, setInstallationCosts] = useState<InstallationCost[]>([]);
const [dealerPricing, setDealerPricing] = useState<DealerPricing[]>([]);
```

#### C) Load 함수 추가 (필요)

파일 line 120 근처, `loadSurveyCosts()` 다음에 추가:

```typescript
  const loadManufacturerPricing = async () => {
    try {
      const response = await fetch('/api/revenue/manufacturer-pricing', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setManufacturerPricing(data.data.pricing || []);
      }
    } catch (error) {
      console.error('제조사별 원가 로드 오류:', error);
    }
  };

  const loadInstallationCosts = async () => {
    try {
      const response = await fetch('/api/revenue/installation-cost', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setInstallationCosts(data.data.costs || []);
      }
    } catch (error) {
      console.error('기본 설치비 로드 오류:', error);
    }
  };

  const loadDealerPricing = async () => {
    try {
      const response = await fetch('/api/revenue/dealer-pricing', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setDealerPricing(data.data || []);
      }
    } catch (error) {
      console.error('대리점 가격 로드 오류:', error);
    }
  };
```

#### D) loadAllData 수정 (필요)

Line 127 근처, `loadAllData` 함수 내부 수정:

```typescript
  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadGovernmentPricing(),
        loadSalesOfficeSettings(),
        loadSurveyCosts(),
        loadManufacturerPricing(),      // 추가
        loadInstallationCosts(),         // 추가
        loadDealerPricing()              // 추가
      ]);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };
```

#### E) handleEdit 함수 수정 (필요)

```typescript
  const handleEdit = (item: any, type: 'government' | 'sales' | 'survey' | 'manufacturer' | 'installation' | 'dealer') => {
    setEditingItem(item);
    setEditType(type);
    setIsEditModalOpen(true);
  };
```

#### F) handleSave switch 문 추가 (필요)

`handleSave` 함수의 switch 문에 추가:

```typescript
      switch (editType) {
        case 'government':
          endpoint = '/api/revenue/government-pricing';
          break;
        case 'sales':
          endpoint = '/api/revenue/sales-office-settings';
          break;
        case 'survey':
          endpoint = '/api/revenue/survey-costs';
          break;
        case 'manufacturer':                        // 추가
          endpoint = '/api/revenue/manufacturer-pricing';
          method = isEditMode ? 'PATCH' : 'POST';
          break;
        case 'installation':                        // 추가
          endpoint = '/api/revenue/installation-cost';
          method = isEditMode ? 'PUT' : 'POST';
          break;
        case 'dealer':                              // 추가
          endpoint = '/api/revenue/dealer-pricing';
          method = isEditMode ? 'PUT' : 'POST';
          break;
      }
```

#### G) tabs 배열 수정 (필요)

Line 323 근처:

```typescript
  const tabs = [
    { id: 'government', label: '환경부 고시가', icon: FileText },
    { id: 'manufacturer', label: '제조사별 원가', icon: Settings },      // 추가
    { id: 'installation', label: '기본 설치비', icon: DollarSign },      // 추가
    { id: 'dealer', label: '대리점 가격', icon: Building2 },             // 추가
    { id: 'sales', label: '영업점 설정', icon: Building2 },
    { id: 'survey', label: '실사비용', icon: Calculator }
  ];
```

#### H) 통계 카드 추가 (필요)

```typescript
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title="활성 기기 종류"
            value={`${governmentPricing.filter(p => p.is_active).length}개`}
            icon={FileText}
            color="blue"
          />
          <StatsCard                                                    // 추가
            title="제조사별 원가"
            value={`${manufacturerPricing.filter(p => p.is_active).length}개`}
            icon={Settings}
            color="orange"
          />
          <StatsCard                                                    // 추가
            title="대리점 가격"
            value={`${dealerPricing.filter(p => p.is_active).length}개`}
            icon={Building2}
            color="green"
          />
          <StatsCard
            title="영업점 수"
            value={`${salesOfficeSettings.length}개`}
            icon={Building2}
            color="green"
          />
        </div>
```

## 간편 복구 방법

시간이 너무 오래 걸린다면:

1. **대리점 가격만 최소한으로 구현**
   - 기존 파일에 대리점 탭만 추가
   - 제조사별 원가/설치비는 나중에

2. **별도 페이지로 분리**
   - `app/admin/revenue/dealer-pricing/page.tsx` 신규 생성
   - 독립적인 페이지로 관리

3. **API 직접 테스트**
   - Postman/브라우저 콘솔에서 API 직접 호출
   - UI는 나중에 천천히 구현

## 추천 방법

**Option A: 단계별 복구** (추천)
1. Load 함수들 추가
2. 탭 추가
3. 각 탭 UI 구현
4. 폼 필드 추가

**Option B: Git 활용**
```bash
# 대리점 UI가 있던 커밋 찾기
git log --all --oneline --grep="dealer"

# 특정 커밋의 파일만 가져오기
git show <commit-hash>:app/admin/revenue/pricing/page.tsx > temp.tsx
```

**Option C: 최소 구현**
- 대리점 탭만 빠르게 추가
- 나머지는 향후 업데이트
