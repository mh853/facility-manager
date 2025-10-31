# 발주 관리 시스템 요구사항 정의서 (PRD)

## 📋 프로젝트 개요

### 목적
업무 단계가 '제품 발주'인 사업장의 발주 진행상황을 체계적으로 관리하고 추적하는 시스템 구축

### 범위
- 발주 대상 사업장 자동 필터링 및 목록 관리
- 발주 진행 단계별 날짜 기록 및 추적
- 제조사별 차등 워크플로우 적용
- 발주 완료 시 사업장 정보 자동 업데이트

---

## 1️⃣ 기능 요구사항

### 1.1 사업장 목록 관리

#### 필터링 조건
```typescript
- 업무 단계 = '제품 발주' (product_order)
- facility_tasks 테이블에서 status가 'product_order'인 사업장 조회
- business_info 테이블과 JOIN하여 상세 정보 표시
```

#### 표시 정보
```
기본 정보:
- 사업장명
- 주소
- 제조사
- 진행 상태 (미시작/진행중/완료)
- 최종 업데이트 일자
```

#### 검색 및 필터
```
검색: 사업장명
필터:
- 제조사 (전체/에코센스/가이아씨앤에스/크린어스/EVS)
- 진행 상태 (전체/미시작/진행중/완료)
- 정렬 (최신순/사업장명순/업데이트순)
```

---

### 1.2 발주 상세 모달

#### 사업장 정보 표시 (business_info)
```typescript
interface BusinessDisplayInfo {
  business_name: string          // 사업장명
  address: string                 // 주소
  manager_name: string            // 담당자
  manager_position: string        // 직급
  manager_contact: string         // 연락처
  manufacturer: Manufacturer      // 제조사
  vpn: 'wired' | 'wireless'      // VPN
  greenlink_id: string            // 그린링크 ID
  greenlink_pw: string            // 그린링크 PW
}
```

#### 발주 진행 단계 (제조사별 차등)

**공통 단계 (모든 제조사)**
```typescript
1. 레이아웃 작성 (layout_date: Date | null)
2. 발주서 작성 (order_form_date: Date | null)
```

**추가 단계 (가이아씨앤에스, 크린어스만)**
```typescript
3. IP 요청 (ip_request_date: Date | null)
4. 그린링크에 IP 세팅 (greenlink_ip_setting_date: Date | null)
5. 라우터 요청 (router_request_date: Date | null)
```

**제조사별 워크플로우**
```
- ecosense (에코센스): 1~2단계만
- gaia_cns (가이아씨앤에스): 1~5단계 전체
- cleanearth (크린어스): 1~5단계 전체
- evs (EVS): 1~5단계 전체 (확장성 고려)
```

#### UI 구성
```
┌─────────────────────────────────────────────┐
│ 📦 사업장명 발주 관리                        │
├─────────────────────────────────────────────┤
│                                             │
│ 🏢 사업장 정보                              │
│ ├─ 주소: ○○시 ○○구...                      │
│ ├─ 담당자: 홍길동 (팀장)                    │
│ ├─ 연락처: 010-1234-5678                    │
│ ├─ 제조사: 가이아씨앤에스                   │
│ ├─ VPN: 유선                                │
│ ├─ 그린링크 ID: example_id                  │
│ └─ 그린링크 PW: ********                    │
│                                             │
│ 📋 발주 진행 단계                           │
│                                             │
│ ☑️ 1. 레이아웃 작성                         │
│    └─ 완료일: 2024-01-15 [날짜 선택]       │
│                                             │
│ ☑️ 2. 발주서 작성                           │
│    └─ 완료일: 2024-01-17 [날짜 선택]       │
│                                             │
│ ☐ 3. IP 요청                                │
│    └─ 완료일: [날짜 선택]                   │
│                                             │
│ ☐ 4. 그린링크에 IP 세팅                     │
│    └─ 완료일: [날짜 선택]                   │
│                                             │
│ ☐ 5. 라우터 요청                            │
│    └─ 완료일: [날짜 선택]                   │
│                                             │
│ [저장] [발주 완료]                          │
└─────────────────────────────────────────────┘
```

---

### 1.3 발주 완료 처리

#### 동작
```typescript
"발주 완료" 버튼 클릭 시:
1. 모든 필수 단계 완료 여부 검증
   - 에코센스: 1~2단계 완료 확인
   - 가이아씨앤에스/크린어스: 1~5단계 완료 확인

2. business_info 테이블 업데이트
   - order_date = 현재 날짜 (자동 입력)

3. facility_tasks 테이블 업데이트
   - status를 다음 단계로 변경 (product_order → 다음 단계)

4. order_management 테이블 업데이트
   - completed_at = 현재 날짜
   - status = 'completed'
```

#### 검증 규칙
```
- 필수 단계 미완료 시 경고 메시지 표시
- "레이아웃 작성과 발주서 작성은 필수입니다"
- "IP 요청, 그린링크 IP 세팅, 라우터 요청을 완료해주세요" (가이아/크린어스)
```

---

## 2️⃣ 데이터베이스 스키마

### 2.1 신규 테이블: order_management

```sql
CREATE TABLE order_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  task_id UUID REFERENCES facility_tasks(id) ON DELETE SET NULL,

  -- 발주 진행 단계 (날짜 기록)
  layout_date DATE,                      -- 레이아웃 작성일
  order_form_date DATE,                  -- 발주서 작성일
  ip_request_date DATE,                  -- IP 요청일
  greenlink_ip_setting_date DATE,        -- 그린링크 IP 세팅일
  router_request_date DATE,              -- 라우터 요청일

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'in_progress',  -- in_progress, completed
  completed_at TIMESTAMP,                -- 발주 완료 시각

  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),

  -- 제약조건
  CONSTRAINT valid_status CHECK (status IN ('in_progress', 'completed'))
);

-- 인덱스
CREATE INDEX idx_order_management_business_id ON order_management(business_id);
CREATE INDEX idx_order_management_task_id ON order_management(task_id);
CREATE INDEX idx_order_management_status ON order_management(status);
CREATE INDEX idx_order_management_completed_at ON order_management(completed_at);

-- 트리거: 업데이트 시각 자동 갱신
CREATE OR REPLACE FUNCTION update_order_management_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_management_updated_at
  BEFORE UPDATE ON order_management
  FOR EACH ROW
  EXECUTE FUNCTION update_order_management_timestamp();
```

### 2.2 기존 테이블 확장

#### business_info 테이블
```sql
-- 발주일 필드 추가 (이미 존재할 수 있음)
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS order_date DATE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_business_info_order_date
ON business_info(order_date);
```

---

## 3️⃣ API 엔드포인트 설계

### 3.1 GET /api/order-management

#### 목적
발주 대상 사업장 목록 조회

#### 요청
```typescript
Query Parameters:
- search?: string          // 사업장명 검색
- manufacturer?: string    // 제조사 필터
- status?: string          // 진행 상태 필터
- sort?: string            // 정렬 (latest, name, updated)
- page?: number            // 페이지 번호
- limit?: number           // 페이지 크기
```

#### 응답
```typescript
{
  success: boolean
  data: {
    orders: Array<{
      id: string
      business_id: string
      business_name: string
      address: string
      manufacturer: Manufacturer
      status: 'in_progress' | 'completed'
      progress_percentage: number    // 진행률 (%)
      last_updated: string

      // 진행 단계 요약
      steps_completed: number
      steps_total: number

      // 최근 활동
      latest_step: string | null
      latest_step_date: string | null
    }>

    pagination: {
      total: number
      page: number
      limit: number
      total_pages: number
    }

    summary: {
      total_orders: number
      in_progress: number
      completed: number
      by_manufacturer: {
        ecosense: number
        gaia_cns: number
        cleanearth: number
        evs: number
      }
    }
  }
}
```

---

### 3.2 GET /api/order-management/[businessId]

#### 목적
특정 사업장의 발주 상세 정보 조회

#### 응답
```typescript
{
  success: boolean
  data: {
    // 사업장 정보
    business: {
      id: string
      business_name: string
      address: string
      manager_name: string
      manager_position: string
      manager_contact: string
      manufacturer: Manufacturer
      vpn: 'wired' | 'wireless'
      greenlink_id: string
      greenlink_pw: string
    }

    // 발주 진행 정보
    order: {
      id: string
      layout_date: string | null
      order_form_date: string | null
      ip_request_date: string | null
      greenlink_ip_setting_date: string | null
      router_request_date: string | null
      status: 'in_progress' | 'completed'
      completed_at: string | null
      created_at: string
      updated_at: string
    }

    // 워크플로우 정보
    workflow: {
      manufacturer: Manufacturer
      total_steps: number
      completed_steps: number
      required_steps: string[]  // ['layout', 'order_form'] or [..., 'ip_request', 'greenlink_ip_setting', 'router_request']
      progress_percentage: number
    }
  }
}
```

---

### 3.3 PUT /api/order-management/[businessId]

#### 목적
발주 진행 단계 업데이트

#### 요청
```typescript
{
  layout_date?: string | null
  order_form_date?: string | null
  ip_request_date?: string | null
  greenlink_ip_setting_date?: string | null
  router_request_date?: string | null
}
```

#### 응답
```typescript
{
  success: boolean
  data: {
    order: { ... }  // 업데이트된 발주 정보
    message: string
  }
}
```

---

### 3.4 POST /api/order-management/[businessId]/complete

#### 목적
발주 완료 처리

#### 요청
```typescript
{} // 본문 없음, businessId로 처리
```

#### 응답
```typescript
{
  success: boolean
  data: {
    business_id: string
    order_date: string          // 발주일
    completed_at: string        // 완료 시각
    message: string
  }
}
```

#### 처리 로직
```typescript
1. 필수 단계 완료 검증
2. order_management.status = 'completed'
3. order_management.completed_at = NOW()
4. business_info.order_date = CURRENT_DATE
5. facility_tasks.status 업데이트 (다음 단계로)
```

---

## 4️⃣ UI/UX 컴포넌트 설계

### 4.1 페이지 구조

```
/admin/order-management
├─ OrderManagementPage (메인 페이지)
│  ├─ OrderFilters (검색 및 필터)
│  ├─ OrderStats (통계 요약)
│  ├─ OrderList (사업장 목록)
│  └─ OrderDetailModal (상세 모달)
│     ├─ BusinessInfoSection
│     ├─ OrderProgressSection
│     └─ OrderActions
```

### 4.2 컴포넌트 상세

#### OrderFilters
```typescript
기능:
- 사업장명 검색 (실시간 검색)
- 제조사 필터 (전체/에코센스/가이아씨앤에스/크린어스/EVS)
- 진행 상태 필터 (전체/진행중/완료)
- 정렬 옵션 (최신순/사업장명순/업데이트순)
```

#### OrderStats
```typescript
표시 정보:
- 전체 발주 건수
- 진행 중 건수
- 완료 건수
- 제조사별 분포 (차트)
```

#### OrderList
```typescript
테이블 컬럼:
- 사업장명
- 주소
- 제조사
- 진행률 (프로그레스 바)
- 최종 업데이트
- 상태 (뱃지)
- 작업 (상세보기 버튼)

기능:
- 페이지네이션
- 행 클릭 시 상세 모달 열기
- 상태별 색상 구분
```

#### OrderDetailModal
```typescript
섹션 구성:
1. BusinessInfoSection
   - 사업장 기본 정보 표시 (읽기 전용)

2. OrderProgressSection
   - 제조사별 단계 표시
   - 체크박스 + 날짜 선택
   - 진행률 표시

3. OrderActions
   - [저장] 버튼: 단계별 날짜 저장
   - [발주 완료] 버튼: 발주 완료 처리
```

---

## 5️⃣ 제조사별 워크플로우 매핑

```typescript
const MANUFACTURER_WORKFLOWS = {
  ecosense: {
    name: '에코센스',
    steps: [
      { key: 'layout', label: '레이아웃 작성', field: 'layout_date' },
      { key: 'order_form', label: '발주서 작성', field: 'order_form_date' }
    ]
  },

  gaia_cns: {
    name: '가이아씨앤에스',
    steps: [
      { key: 'layout', label: '레이아웃 작성', field: 'layout_date' },
      { key: 'order_form', label: '발주서 작성', field: 'order_form_date' },
      { key: 'ip_request', label: 'IP 요청', field: 'ip_request_date' },
      { key: 'greenlink_ip_setting', label: '그린링크에 IP 세팅', field: 'greenlink_ip_setting_date' },
      { key: 'router_request', label: '라우터 요청', field: 'router_request_date' }
    ]
  },

  cleanearth: {
    name: '크린어스',
    steps: [
      { key: 'layout', label: '레이아웃 작성', field: 'layout_date' },
      { key: 'order_form', label: '발주서 작성', field: 'order_form_date' },
      { key: 'ip_request', label: 'IP 요청', field: 'ip_request_date' },
      { key: 'greenlink_ip_setting', label: '그린링크에 IP 세팅', field: 'greenlink_ip_setting_date' },
      { key: 'router_request', label: '라우터 요청', field: 'router_request_date' }
    ]
  },

  evs: {
    name: 'EVS',
    steps: [
      { key: 'layout', label: '레이아웃 작성', field: 'layout_date' },
      { key: 'order_form', label: '발주서 작성', field: 'order_form_date' },
      { key: 'ip_request', label: 'IP 요청', field: 'ip_request_date' },
      { key: 'greenlink_ip_setting', label: '그린링크에 IP 세팅', field: 'greenlink_ip_setting_date' },
      { key: 'router_request', label: '라우터 요청', field: 'router_request_date' }
    ]
  }
}
```

---

## 6️⃣ 구현 우선순위

### Phase 1: 핵심 기능 (필수)
1. ✅ 데이터베이스 스키마 생성
2. ✅ API 엔드포인트 구현
3. ✅ 발주 목록 페이지
4. ✅ 발주 상세 모달
5. ✅ 제조사별 워크플로우 적용

### Phase 2: 고급 기능
1. ⏳ 검색 및 필터링
2. ⏳ 통계 대시보드
3. ⏳ 진행률 시각화

### Phase 3: 최적화
1. ⏳ 페이지네이션
2. ⏳ 실시간 검색
3. ⏳ 성능 최적화

---

## 7️⃣ 보안 및 권한

### 접근 권한
```
발주 관리 접근:
- 권한 레벨 2 이상 (일반 사용자)
- 읽기: 모든 사용자
- 쓰기: 권한 레벨 3 이상 (팀장)
- 발주 완료: 권한 레벨 4 이상 (관리자)
```

### 데이터 보안
```
- 그린링크 PW: 마스킹 처리 (********)
- 업데이트 로그: created_by, updated_by 기록
- JWT 인증 필수
```

---

## 8️⃣ 테스트 시나리오

### 8.1 발주 진행 테스트
```
1. 에코센스 사업장 발주
   - 레이아웃 작성 완료
   - 발주서 작성 완료
   - 발주 완료 → 성공

2. 가이아씨앤에스 사업장 발주
   - 레이아웃 작성 완료
   - 발주서 작성 완료
   - 발주 완료 시도 → 실패 (3-5단계 미완료)
   - 나머지 단계 완료
   - 발주 완료 → 성공
```

### 8.2 데이터 무결성 테스트
```
- 발주 완료 시 business_info.order_date 자동 입력 확인
- 발주 완료 후 사업장 정보에서 수정 가능 확인
- 중복 발주 방지 확인
```

---

## 9️⃣ 성공 지표 (KPI)

```
- 발주 처리 시간 단축: 기존 대비 50% 감소
- 데이터 정확도: 99% 이상
- 사용자 만족도: 4.5/5 이상
- 시스템 응답 시간: <2초
```

---

## 🔟 향후 확장 계획

1. 발주 이력 추적 (변경 로그)
2. 발주 알림 시스템 (이메일/푸시)
3. 발주서 자동 생성 (PDF)
4. 발주 통계 및 리포트
5. 모바일 앱 지원
