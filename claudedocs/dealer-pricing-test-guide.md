# 대리점 가격 관리 시스템 테스트 가이드

## 완료된 구현 사항

### 1. 데이터베이스 스키마
**파일**: `sql/dealer_pricing_system.sql`

**테이블 구조**:
- `dealer_pricing` 테이블 생성
- 컬럼: equipment_type, equipment_name, dealer_cost_price, dealer_selling_price, margin_rate, manufacturer, effective_from, effective_to, notes, is_active
- 인덱스: equipment, active, effective dates, manufacturer
- RLS 정책: 슈퍼 관리자만 조회/수정 가능
- 샘플 데이터: PH센서, 차압계, 게이트웨이

### 2. API 라우트
**파일**: `app/api/revenue/dealer-pricing/route.ts`

**엔드포인트**:
- `GET /api/revenue/dealer-pricing` - 전체 목록 조회
- `POST /api/revenue/dealer-pricing` - 새 가격 추가
- `PUT /api/revenue/dealer-pricing` - 가격 수정
- `DELETE /api/revenue/dealer-pricing?id={id}` - 소프트 삭제 (is_active=false)

**주요 기능**:
- 마진율 자동 계산: `((판매가 - 공급가) / 공급가 * 100)`
- 필수 필드 검증
- 에러 핸들링 및 로깅

### 3. UI 컴포넌트
**파일**: `app/admin/revenue/pricing/page.tsx`

**추가 사항**:
- `DealerPricing` 인터페이스 정의 (lines 81-93)
- `dealerPricing` 상태 관리 (line 102)
- 'dealer' 탭 추가 (line 307)
- `loadDealerPricing()` 함수 (lines 237-249)
- 테이블 UI (lines 694-778)
- 수정 모달 폼 (lines 1069-1160)
  - 기기 종류
  - 기기명
  - 공급가 (원가)
  - 판매가
  - 제조사 (선택)
  - 시행일 (필수)
  - 종료일 (선택)
  - 비고

## 테스트 절차

### 사전 준비

1. **데이터베이스 마이그레이션 실행**
   ```sql
   -- Supabase SQL 에디터에서 실행
   -- 파일: sql/dealer_pricing_system.sql
   ```

2. **개발 서버 실행**
   ```bash
   npm run dev
   # 현재 포트: http://localhost:3001
   ```

### 테스트 1: 샘플 데이터 확인

**목적**: SQL 마이그레이션으로 삽입된 샘플 데이터 표시 확인

**단계**:
1. 브라우저에서 `http://localhost:3001/admin/revenue/pricing` 접속
2. "대리점 가격" 탭 클릭
3. 테이블에 3개 샘플 데이터 표시 확인:
   - PH센서 (에코센스) - 공급가: ₩450,000 / 판매가: ₩550,000 / 마진율: 22.22%
   - 차압계 (크린어스) - 공급가: ₩350,000 / 판매가: ₩450,000 / 마진율: 28.57%
   - 게이트웨이 (에코센스) - 공급가: ₩800,000 / 판매가: ₩1,000,000 / 마진율: 25.00%

**예상 결과**:
- 테이블에 3개 행 표시
- 마진율이 초록색 배지로 표시
- 제조사가 색상별 배지로 표시 (에코센스=파랑, 크린어스=초록)
- 상태가 "활성"으로 표시

### 테스트 2: 새 대리점 가격 추가

**목적**: POST API 및 마진율 자동 계산 검증

**단계**:
1. "새 대리점 가격 추가" 버튼 클릭
2. 모달 폼에 다음 입력:
   - 기기 종류: `sensor`
   - 기기명: `DO센서`
   - 공급가: `380000`
   - 판매가: `500000`
   - 제조사: `에코센스`
   - 시행일: `2025-10-21`
   - 비고: `2025년 4분기 신규 가격`
3. "저장" 버튼 클릭

**예상 결과**:
- 성공 메시지 표시
- 테이블에 새 행 추가됨
- 마진율이 자동 계산되어 표시: `31.58%` ((500000-380000)/380000*100)
- 시행일: `2025-10-21`
- 상태: `활성`

**검증 포인트**:
```
마진율 계산 공식 확인:
(500,000 - 380,000) / 380,000 * 100 = 31.58%
```

### 테스트 3: 가격 수정

**목적**: PUT API 및 마진율 재계산 검증

**단계**:
1. PH센서 행의 수정 버튼 (연필 아이콘) 클릭
2. 판매가를 `550000`에서 `600000`으로 변경
3. "저장" 버튼 클릭

**예상 결과**:
- 성공 메시지 표시
- PH센서의 판매가가 ₩600,000으로 업데이트됨
- 마진율이 자동 재계산: `33.33%` ((600000-450000)/450000*100)

**검증 포인트**:
```
수정 전: 450,000 → 550,000 (마진율 22.22%)
수정 후: 450,000 → 600,000 (마진율 33.33%)
```

### 테스트 4: 필수 필드 검증

**목적**: 프론트엔드 및 백엔드 검증 확인

**단계**:
1. "새 대리점 가격 추가" 버튼 클릭
2. 기기명만 입력하고 다른 필드 비워두기
3. "저장" 버튼 클릭

**예상 결과**:
- 브라우저 기본 검증으로 필수 필드 경고 표시
- 서버 요청 전에 차단됨

**단계 2**:
1. 모든 필수 필드 입력하되 시행일 제외
2. "저장" 버튼 클릭

**예상 결과**:
- 프론트엔드 또는 백엔드에서 "필수 항목을 모두 입력해주세요" 오류 메시지

### 테스트 5: API 직접 호출 (선택)

**목적**: API 엔드포인트 독립 검증

**브라우저 콘솔에서 실행**:

```javascript
// 1. 목록 조회
fetch('/api/revenue/dealer-pricing', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log);

// 2. 새 항목 추가
fetch('/api/revenue/dealer-pricing', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    equipment_type: 'sensor',
    equipment_name: 'EC센서',
    dealer_cost_price: 420000,
    dealer_selling_price: 550000,
    manufacturer: '크린어스',
    effective_from: '2025-10-21',
    notes: 'API 테스트'
  })
})
.then(r => r.json())
.then(console.log);
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "equipment_type": "sensor",
    "equipment_name": "EC센서",
    "dealer_cost_price": 420000,
    "dealer_selling_price": 550000,
    "margin_rate": 30.95,
    "manufacturer": "크린어스",
    "effective_from": "2025-10-21",
    "is_active": true,
    "created_at": "2025-10-21T..."
  },
  "message": "대리점 가격이 성공적으로 추가되었습니다"
}
```

### 테스트 6: 마진율 계산 검증

**목적**: 다양한 가격대에서 마진율 정확성 확인

**테스트 케이스**:

| 공급가 | 판매가 | 예상 마진율 | 계산식 |
|--------|--------|-------------|--------|
| 100,000 | 150,000 | 50.00% | (150-100)/100*100 |
| 500,000 | 600,000 | 20.00% | (600-500)/500*100 |
| 1,000,000 | 1,200,000 | 20.00% | (1200-1000)/1000*100 |
| 250,000 | 300,000 | 20.00% | (300-250)/250*100 |

**단계**:
각 케이스별로 새 항목 추가 후 마진율 확인

## 알려진 제한사항

1. **RLS 정책**: 슈퍼 관리자(permission_level >= 3)만 접근 가능
2. **소프트 삭제**: 실제 데이터는 삭제되지 않고 `is_active = false`로 설정
3. **제조사 제한**: UI에서 4개 제조사만 선택 가능 (DB는 제한 없음)

## 문제 해결

### API 호출 실패
- 브라우저 개발자 도구 → Network 탭 확인
- Response에서 오류 메시지 확인
- 서버 로그 확인 (터미널)

### 빈 테이블 표시
1. SQL 마이그레이션 실행 여부 확인
2. 브라우저 콘솔에서 네트워크 오류 확인
3. 인증 토큰 유효성 확인

### 마진율 계산 오류
- API 응답의 `margin_rate` 값 확인
- 수동 계산과 비교: `(판매가 - 공급가) / 공급가 * 100`

## 완료 체크리스트

- [ ] SQL 마이그레이션 성공 실행
- [ ] 샘플 데이터 3개 테이블에 표시
- [ ] 새 가격 추가 성공
- [ ] 마진율 자동 계산 정확성 확인
- [ ] 가격 수정 및 마진율 재계산 확인
- [ ] 필수 필드 검증 동작 확인
- [ ] 제조사 배지 색상 표시 확인
- [ ] 시행일/종료일 입력 및 표시 확인

## 다음 단계

테스트 완료 후:
1. Excel 업로드 재시도 (VARCHAR 오류 수정 확인)
2. 실제 대리점 데이터 입력
3. 기존 정부고시가격/제조사가격과 비교 검증
