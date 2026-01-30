# Employee 계정 완전 삭제 가이드

## 문제 상황
employees 테이블에서 계정을 삭제하려고 할 때 외래 키 제약 조건(Foreign Key Constraint) 오류가 발생하는 경우

## 해결 프로세스

### 1단계: 참조 테이블 확인
```sql
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'employees'
  AND ccu.column_name = 'id';
```

### 2단계: 트리거 확인 및 제거
```sql
-- 트리거 찾기
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'contract_history';

-- 트리거 삭제
DROP TRIGGER IF EXISTS contract_history_changes_trigger ON contract_history;
```

### 3단계: 참조 데이터 삭제
현재 시스템에서 employees를 참조하는 테이블 (38개):
- subsidy_announcements
- business_additional_installation_cost
- contract_history (created_by, deleted_by)
- delivery_addresses
- document_history
- document_templates (created_by, updated_by)
- equipment_installation_cost
- estimate_history
- estimate_templates
- facility_tasks (created_by, last_modified_by)
- social_accounts (user_id, employee_id)
- government_pricing
- login_attempts
- manufacturer_pricing
- operating_cost_adjustments (created_by, updated_by)
- order_management (created_by, updated_by)
- order_management_history
- pricing_change_history
- revenue_audit_log
- revenue_calculations
- sales_office_cost_settings
- survey_cost_adjustments
- survey_cost_settings
- task_attachments
- task_categories (created_by, updated_by)
- task_history
- tasks (assigned_to, created_by, deleted_by, updated_by)
- weekly_reports

### 4단계: 실행 순서
1. 트리거 삭제 (data_history 오류 방지)
2. 모든 참조 테이블에서 해당 사용자 데이터 삭제
3. employees 테이블에서 계정 삭제
4. 삭제 확인

## 템플릿 SQL

```sql
-- 1. 트리거 삭제
DROP TRIGGER IF EXISTS contract_history_changes_trigger ON contract_history;

-- 2. 참조 데이터 삭제 (사용자 이메일로 필터링)
DELETE FROM [테이블명] WHERE [컬럼명] IN (
  SELECT id FROM employees WHERE email LIKE '[이메일]%'
);

-- 3. 계정 삭제
DELETE FROM employees WHERE email LIKE '[이메일]%';

-- 4. 확인
SELECT COUNT(*) FROM employees WHERE email LIKE '[이메일]%';
```

## 주의사항

### 트리거 문제
- `data_history` 테이블이 없으면 트리거가 실패함
- 삭제 전 반드시 관련 트리거 제거 필요
- 트리거 이름: `contract_history_changes_trigger`

### 데이터 손실
- 모든 참조 데이터가 함께 삭제됨 (계약 이력, 업무 기록, 주문 이력 등)
- 복구 불가능하므로 신중하게 실행
- 필요시 소프트 삭제(is_deleted = true) 먼저 고려

### 소프트 삭제 대안
```sql
UPDATE employees 
SET 
  is_deleted = true,
  is_active = false,
  email = '[이메일].deleted_' || NOW()::text,
  updated_at = NOW()
WHERE email = '[이메일]';
```

## 자동화 스크립트

참고 파일:
- `database/find-all-references.sql` - 참조 테이블 찾기
- `database/find-triggers.sql` - 트리거 찾기
- `database/correct-trigger-delete.sql` - 완전 삭제 템플릿

## 트러블슈팅

### 오류: relation "data_history" does not exist
→ 트리거 제거 필요: `DROP TRIGGER IF EXISTS contract_history_changes_trigger ON contract_history;`

### 오류: violates foreign key constraint
→ 참조 테이블에서 먼저 데이터 삭제 필요

### 오류: permission denied: is a system trigger
→ 시스템 트리거는 삭제 불가, 데이터만 삭제 후 계정 삭제
