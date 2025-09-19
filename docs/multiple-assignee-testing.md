# 담당자 다중 선택 시스템 테스트 가이드

## 🎯 테스트 개요

담당자 다중 선택 시스템의 구현 완료 후 검증을 위한 테스트 가이드입니다.

## 🔧 구현된 기능

### 1. 데이터베이스 스키마 변경
- ✅ `assignees` JSONB 컬럼 추가
- ✅ `primary_assignee_id` 컬럼 추가
- ✅ 기존 데이터 마이그레이션 지원
- ✅ 검색 인덱스 및 트리거 생성

### 2. API 업데이트
- ✅ `/api/users/employees` - 직원 목록 조회 API
- ✅ `/api/facility-tasks` - 다중 담당자 지원 업데이트

### 3. UI 컴포넌트
- ✅ `MultiAssigneeSelector` - 다중 선택 컴포넌트
- ✅ 칸반보드 다중 담당자 표시
- ✅ 테이블 뷰 다중 담당자 표시

## 🧪 테스트 시나리오

### A. 데이터베이스 테스트

#### A1. 스키마 업데이트 확인
```sql
-- 1. 새 컬럼 존재 확인
\d facility_tasks

-- 2. 인덱스 생성 확인
\di facility_tasks*

-- 3. 기존 데이터 마이그레이션 확인
SELECT id, assignee, assignees, primary_assignee_id
FROM facility_tasks
WHERE assignee IS NOT NULL
LIMIT 5;
```

#### A2. 다중 담당자 데이터 삽입 테스트
```sql
-- 다중 담당자 업무 생성 테스트
INSERT INTO facility_tasks (title, business_name, task_type, assignees)
VALUES (
  '테스트 업무',
  '테스트 사업장',
  'self',
  '[
    {"id": "1", "name": "김철수", "position": "대리", "email": "kim@test.com"},
    {"id": "2", "name": "박영희", "position": "과장", "email": "park@test.com"}
  ]'::jsonb
);
```

### B. API 테스트

#### B1. 직원 목록 API 테스트
```bash
# 전체 직원 목록 조회
curl -X GET "http://localhost:3000/api/users/employees?limit=10"

# 이름으로 검색
curl -X GET "http://localhost:3000/api/users/employees?search=김철수"

# 부서별 필터링
curl -X GET "http://localhost:3000/api/users/employees?department=개발팀"
```

**예상 응답:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "1",
        "name": "김철수",
        "email": "kim@company.com",
        "position": "대리",
        "department": "개발팀",
        "is_active": true
      }
    ],
    "metadata": {
      "totalCount": 1,
      "activeCount": 1,
      "searchTerm": "김철수"
    }
  }
}
```

#### B2. 업무 생성 API 테스트 (다중 담당자)
```bash
curl -X POST "http://localhost:3000/api/facility-tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "다중 담당자 테스트 업무",
    "business_name": "테스트 사업장",
    "task_type": "self",
    "assignees": [
      {
        "id": "1",
        "name": "김철수",
        "position": "대리",
        "email": "kim@test.com"
      },
      {
        "id": "2",
        "name": "박영희",
        "position": "과장",
        "email": "park@test.com"
      }
    ]
  }'
```

#### B3. 업무 수정 API 테스트
```bash
curl -X PUT "http://localhost:3000/api/facility-tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "업무ID",
    "assignees": [
      {
        "id": "3",
        "name": "이민수",
        "position": "주임",
        "email": "lee@test.com"
      }
    ]
  }'
```

### C. UI 컴포넌트 테스트

#### C1. MultiAssigneeSelector 컴포넌트
**테스트 케이스:**

1. **기본 동작**
   - [ ] 컴포넌트 렌더링 확인
   - [ ] 검색 입력 필드 동작
   - [ ] 드롭다운 열기/닫기

2. **검색 기능**
   - [ ] 2글자 이상 입력 시 검색 시작
   - [ ] 실시간 검색 결과 표시
   - [ ] 검색 결과 없을 때 메시지 표시

3. **선택 기능**
   - [ ] 클릭으로 담당자 선택
   - [ ] 키보드 네비게이션 (화살표, Enter, Esc)
   - [ ] 선택된 담당자 태그 표시
   - [ ] 중복 선택 방지

4. **제거 기능**
   - [ ] X 버튼으로 개별 제거
   - [ ] Backspace로 마지막 항목 제거

5. **제한 사항**
   - [ ] 최대 선택 개수 제한 (예: 5명)
   - [ ] 제한 초과 시 오류 메시지

#### C2. 칸반보드 UI
**테스트 케이스:**

1. **카드 표시**
   - [ ] 다중 담당자 태그 표시
   - [ ] 2명까지 표시, 초과 시 "+N명"
   - [ ] 호버 시 전체 정보 표시

2. **모달 창**
   - [ ] 새 업무 생성 시 다중 선택 가능
   - [ ] 업무 수정 시 기존 담당자 표시
   - [ ] 담당자 추가/제거 가능

#### C3. 테이블 뷰
**테스트 케이스:**

1. **담당자 컬럼**
   - [ ] 다중 담당자 태그 표시
   - [ ] 3명까지 표시, 초과 시 "+N명"
   - [ ] 호버 시 직급 정보 표시

### D. 통합 테스트

#### D1. 전체 워크플로우
1. **새 업무 생성**
   - [ ] 다중 담당자 선택하여 업무 생성
   - [ ] 데이터베이스에 정확히 저장되는지 확인
   - [ ] 칸반보드와 테이블에 올바르게 표시

2. **업무 수정**
   - [ ] 기존 업무의 담당자 수정
   - [ ] 담당자 추가/제거
   - [ ] 변경사항 실시간 반영

3. **호환성 테스트**
   - [ ] 기존 단일 담당자 업무 정상 표시
   - [ ] 새 다중 담당자와 기존 단일 담당자 혼재 환경

#### D2. 성능 테스트
1. **대량 데이터**
   - [ ] 직원 100명 이상 환경에서 검색 성능
   - [ ] 업무 1000개 이상 환경에서 로딩 성능

2. **동시 사용자**
   - [ ] 여러 사용자 동시 담당자 수정
   - [ ] 동시성 문제 없이 데이터 일관성 유지

### E. 에러 처리 테스트

#### E1. API 에러
- [ ] 잘못된 담당자 ID로 요청
- [ ] 존재하지 않는 업무 수정 시도
- [ ] 네트워크 오류 상황

#### E2. UI 에러
- [ ] API 응답 지연 시 로딩 표시
- [ ] 검색 결과 없을 때 적절한 메시지
- [ ] 최대 선택 개수 초과 시 경고

## ✅ 검증 체크리스트

### 기능 요구사항
- [ ] ✅ 담당자 다중 선택 가능
- [ ] ✅ 검색 가능한 선택 목록
- [ ] ✅ 이름 + 직급 정보 표시
- [ ] ✅ 로그인한 계정이 기본값
- [ ] ✅ 모든 사용자가 담당자 지정 가능

### 기술적 요구사항
- [ ] ✅ 기존 데이터 호환성 유지
- [ ] ✅ 성능 저하 없음
- [ ] ✅ 모바일 반응형 지원
- [ ] ✅ 접근성 (키보드 네비게이션)

### 사용자 경험
- [ ] ✅ 직관적인 UI/UX
- [ ] ✅ 빠른 검색 응답
- [ ] ✅ 명확한 피드백
- [ ] ✅ 오류 상황 적절히 처리

## 🚀 배포 전 최종 확인

1. **데이터베이스 백업** - 스키마 변경 전 반드시 백업
2. **Supabase SQL 실행** - `sql/add_multiple_assignees.sql` 실행
3. **API 테스트** - 모든 엔드포인트 정상 동작 확인
4. **UI 테스트** - 주요 브라우저에서 테스트
5. **성능 모니터링** - 배포 후 성능 지표 확인

## 📝 알려진 제한사항

1. **최대 담당자 수**: 컴포넌트별로 5명 제한
2. **검색 최소 길이**: 2글자 이상 입력 시 검색 시작
3. **브라우저 호환성**: Chrome, Firefox, Safari, Edge 최신 버전

## 🔧 문제 해결

### 자주 발생하는 문제
1. **검색 결과가 나오지 않음**
   - 직원 데이터가 employees 테이블에 있는지 확인
   - API 엔드포인트 응답 상태 확인

2. **담당자 저장이 안됨**
   - 네트워크 탭에서 API 요청/응답 확인
   - 콘솔에서 JavaScript 오류 확인

3. **기존 업무가 표시되지 않음**
   - 데이터베이스 마이그레이션 정상 실행 확인
   - assignees 컬럼에 올바른 JSON 형식 저장 확인