# 매출 관리 통합 API 가이드

## 개요

기존 시설 관리 시스템에 매출 관리 기능을 통합한 새로운 API입니다. 기존 API들을 안전하게 재사용하면서 사업장별 매출 데이터를 일괄 조회하고 관리할 수 있습니다.

## API 엔드포인트

### 기본 정보
- **Base URL**: `/api/revenue/business-summary`
- **인증**: JWT Bearer Token 필요
- **권한**: 레벨 2 이상 (매출 조회), 레벨 3 이상 (재계산)

## API 메서드

### 1. GET - 사업장별 매출 통합 조회

#### 엔드포인트
```
GET /api/revenue/business-summary
```

#### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `sales_office` | string | 아니오 | - | 영업점별 필터링 |
| `include_revenue` | boolean | 아니오 | true | 매출 계산 포함 여부 |
| `force_refresh` | boolean | 아니오 | false | 캐시 강제 새로고침 |
| `limit` | number | 아니오 | 100 | 조회 결과 제한 |
| `offset` | number | 아니오 | 0 | 조회 시작 위치 |

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "businesses": [
      {
        "business_id": "uuid-123",
        "business_name": "ABC 제조업체",
        "sales_office": "서울지점",
        "address": "서울시 강남구...",
        "manager_name": "김담당",
        "manager_contact": "010-1234-5678",
        "task_categories": {
          "self_tasks": 3,
          "subsidy_tasks": 2,
          "total_tasks": 5
        },
        "equipment_summary": {
          "total_equipment_count": 15,
          "equipment_breakdown": {
            "ph_meter": 3,
            "differential_pressure_meter": 4,
            "temperature_meter": 2,
            "gateway": 1,
            // ... 기타 측정기기
          }
        },
        "revenue_calculation": {
          "calculation_date": "2024-12-29",
          "total_revenue": 45000000,
          "total_cost": 30000000,
          "gross_profit": 15000000,
          "sales_commission": 1350000,
          "survey_costs": 450000,
          "installation_costs": 2000000,
          "net_profit": 11200000,
          "profit_margin_percentage": 24.89,
          "calculation_status": "success",
          "last_calculated": "2024-12-29T10:30:00Z"
        }
      }
    ],
    "summary_stats": {
      "total_businesses": 150,
      "businesses_with_revenue_data": 142,
      "total_tasks": 567,
      "total_equipment": 2340,
      "aggregate_revenue": 6750000000,
      "aggregate_profit": 1520000000
    },
    "calculation_status": {
      "successful_calculations": 142,
      "failed_calculations": 8,
      "pending_calculations": 0
    }
  },
  "message": "사업장별 매출 통합 조회가 완료되었습니다."
}
```

### 2. POST - 특정 사업장 매출 재계산

#### 엔드포인트
```
POST /api/revenue/business-summary
```

#### 요청 바디
```json
{
  "business_id": "uuid-123",
  "force_refresh": true
}
```

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "calculation": {
      "business_id": "uuid-123",
      "business_name": "ABC 제조업체",
      "sales_office": "서울지점",
      "calculation_date": "2024-12-29",
      "total_revenue": 45000000,
      "total_cost": 30000000,
      "gross_profit": 15000000,
      "sales_commission": 1350000,
      "survey_costs": 450000,
      "installation_costs": 2000000,
      "net_profit": 11200000
    }
  },
  "message": "매출 재계산이 완료되었습니다."
}
```

## 주요 특징

### 1. 기존 API 재사용
- `/api/business-list`: 사업장 목록 로직 재사용
- `/api/facility-tasks`: 업무 카테고리 분류 로직 재사용
- `/api/revenue/calculate`: 매출 계산 로직 재사용
- 기존 코드 안정성 보장 및 중복 최소화

### 2. 성능 최적화
- **메모리 캐시**: 30분 TTL로 계산 결과 캐시
- **배치 처리**: 여러 사업장 매출을 효율적으로 일괄 계산
- **부분 실패 대응**: 일부 계산 실패 시에도 나머지 결과 반환
- **선택적 매출 계산**: `include_revenue=false`로 빠른 기본 정보만 조회 가능

### 3. 안전한 통합
- 기존 API 수정 없이 새로운 엔드포인트 추가
- 기존 권한 시스템 재사용
- 에러 격리: 매출 계산 실패가 전체 시스템에 영향 없음

## 사용 시나리오

### 시나리오 1: 일반적인 매출 현황 조회
```bash
curl -H "Authorization: Bearer your-token" \
     "http://localhost:3000/api/revenue/business-summary?limit=50&include_revenue=true"
```

### 시나리오 2: 특정 영업점 매출 분석
```bash
curl -H "Authorization: Bearer your-token" \
     "http://localhost:3000/api/revenue/business-summary?sales_office=서울지점"
```

### 시나리오 3: 빠른 사업장 현황 파악 (매출 계산 제외)
```bash
curl -H "Authorization: Bearer your-token" \
     "http://localhost:3000/api/revenue/business-summary?include_revenue=false&limit=200"
```

### 시나리오 4: 특정 사업장 매출 재계산
```bash
curl -X POST \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"business_id":"uuid-123","force_refresh":true}' \
     "http://localhost:3000/api/revenue/business-summary"
```

## 캐시 관리

### 캐시 정책
- **캐시 기간**: 30분 (1,800초)
- **캐시 키**: business_id 기준
- **캐시 무효화**: `force_refresh=true` 또는 POST 재계산 요청

### 캐시 최적화 팁
1. **첫 조회**: `include_revenue=false`로 빠른 리스트 확인
2. **선택적 상세 조회**: 필요한 사업장만 재계산 요청
3. **정기 새로고침**: 중요 사업장은 주기적으로 `force_refresh=true` 사용

## 오류 처리

### 일반적인 오류 코드
- `401`: 인증 실패 (토큰 없음 또는 만료)
- `403`: 권한 부족 (레벨 2 미만)
- `400`: 잘못된 요청 (필수 파라미터 누락)
- `500`: 서버 오류

### 부분 실패 처리
매출 계산 실패 시에도 기본 정보는 반환:
```json
{
  "business_id": "uuid-456",
  "business_name": "XYZ 회사",
  // ... 기본 정보
  "calculation_error": "가격 정보 조회에 실패했습니다."
}
```

## 데이터 구조

### 사업장 정보
- **기본 정보**: business_info 테이블 기반
- **업무 통계**: facility_tasks 테이블 집계
- **매출 계산**: 기존 revenue/calculate 로직 재사용

### 측정기기 분석
16가지 측정기기 타입별 수량 및 매출 기여도:
- pH 센서, 차압계, 온도계
- 방전전류계, 송풍CT, 펌프CT
- 게이트웨이, VPN 장비
- 방폭형 센서, 확장 장비
- 릴레이, 메인보드 등

## 성능 가이드

### 대량 조회 최적화
```typescript
// 1단계: 빠른 기본 정보 조회
const basic = await fetch('/api/revenue/business-summary?include_revenue=false&limit=100');

// 2단계: 중요 사업장만 선택적 매출 계산
const important = topBusinesses.map(b =>
  fetch('/api/revenue/business-summary', {
    method: 'POST',
    body: JSON.stringify({ business_id: b.id })
  })
);

const results = await Promise.all(important);
```

### 실시간 업데이트
- 매출 데이터 변경 시 해당 business_id 캐시 무효화
- 정기적인 배치 재계산 스케줄링 권장
- 중요 사업장은 실시간 모니터링 설정

## 기존 시스템과의 호환성

### 기존 API 유지
- `/api/revenue/calculate`: 개별 계산용으로 계속 사용
- `/api/business-list`: 단순 목록용으로 계속 사용
- `/api/facility-tasks`: 업무 관리용으로 계속 사용

### 점진적 마이그레이션
1. 새로운 통합 API로 대시보드 개발
2. 기존 개별 API는 유지하면서 병행 운영
3. 안정성 검증 후 점진적 전환

이 API는 기존 시설 관리 시스템을 안전하게 확장하여 포괄적인 매출 관리 기능을 제공합니다.