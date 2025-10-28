# 주간 리포트 시스템 설정 가이드

## 🚨 중요: 데이터베이스 테이블 생성 필요

현재 `weekly_reports` 테이블이 Supabase에 생성되지 않아 다음 오류가 발생합니다:

```
⚠️ [WEEKLY-REPORTS] DB 저장 실패: {
  code: 'PGRST205',
  message: "Could not find the table 'public.weekly_reports' in the schema cache"
}
```

## ✅ 해결 방법: Supabase에서 테이블 생성

### 1단계: Supabase 대시보드 접속

1. https://supabase.com 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: SQL 스크립트 실행

1. **New Query** 버튼 클릭
2. 아래 파일의 전체 내용을 복사하여 붙여넣기:
   ```
   sql/weekly_reports_table.sql
   ```

3. **Run** 버튼 클릭 (또는 Ctrl/Cmd + Enter)

### 3단계: 실행 확인

성공 메시지가 표시되어야 합니다:
```
✅ weekly_reports 테이블 생성 완료
✅ 인덱스 생성 완료
✅ RLS 정책 설정 완료
✅ 트리거 설정 완료
```

### 4단계: 테이블 생성 확인

1. Supabase 대시보드에서 **Table Editor** 클릭
2. `weekly_reports` 테이블이 목록에 나타나는지 확인

## 📋 테이블 구조

생성되는 테이블에는 다음 컬럼이 포함됩니다:

### 기본 정보
- `id`: UUID (Primary Key)
- `user_id`: 사용자 ID (employees 참조)
- `user_name`: 사용자 이름
- `week_start`: 주간 시작일
- `week_end`: 주간 종료일

### 업무 통계
- `total_tasks`: 총 업무
- `completed_tasks`: 완료 업무
- `in_progress_tasks`: 진행중 업무
- `pending_tasks`: 대기 업무
- `completion_rate`: 완료율 (%)

### 업무 타입별
- `self_tasks`: 자체 업무
- `subsidy_tasks`: 보조 업무

### 우선순위별
- `high_priority_completed`: 높음 완료
- `medium_priority_completed`: 보통 완료
- `low_priority_completed`: 낮음 완료

### 성과 지표
- `average_completion_time_days`: 평균 완료 시간 (일)
- `overdue_tasks`: 연체 업무

### 상세 데이터 (JSONB)
- `completed_task_details`: 완료 업무 상세 (JSON 배열)
- `pending_task_details`: 미완료 업무 상세 (JSON 배열)

### 메타데이터
- `generated_at`: 생성 시각
- `is_auto_generated`: 자동 생성 여부
- `created_at`: 레코드 생성일
- `updated_at`: 레코드 수정일

## 🔒 RLS (Row Level Security) 정책

테이블에는 다음 보안 정책이 자동으로 적용됩니다:

1. **사용자**: 본인의 리포트만 조회 가능
2. **관리자** (권한 3+): 모든 리포트 조회 가능
3. **시스템**: 서버에서만 생성/수정 가능

## 🔄 테이블 생성 후 즉시 사용 가능

테이블 생성 후:
- ✅ 개인 리포트 페이지에서 "리포트 조회" 버튼 작동
- ✅ "재생성" 버튼으로 리포트 저장
- ✅ 관리자 "전체 생성" 버튼 작동
- ✅ 매주 금요일 17:00 자동 생성 (Cron Job)

## ⚠️ 주의사항

### unique constraint 설정

테이블에는 `user_id` + `week_start` 조합에 대한 unique constraint가 필요합니다.
SQL 스크립트에는 포함되어 있지 않으니, 필요시 추가:

```sql
ALTER TABLE weekly_reports
ADD CONSTRAINT weekly_reports_user_week_unique
UNIQUE (user_id, week_start);
```

이렇게 하면 같은 사용자의 같은 주간 리포트가 중복 생성되지 않습니다.

## 🎯 테스트 방법

1. **개인 리포트 페이지 테스트**
   - `/weekly-reports` 접속
   - 주간 선택 후 "리포트 조회" 클릭
   - 리포트가 정상적으로 생성되고 저장되는지 확인

2. **관리자 페이지 테스트**
   - `/admin/weekly-reports/admin` 접속 (권한 3+ 필요)
   - "전체 생성" 버튼 클릭
   - 모든 사용자의 리포트가 생성되는지 확인

3. **데이터 확인**
   - Supabase Table Editor에서 `weekly_reports` 테이블 확인
   - 레코드가 정상적으로 저장되었는지 확인

## 📞 문제 해결

### 오류: "Could not find the table"
→ SQL 스크립트를 Supabase에서 실행했는지 확인

### 오류: "permission denied"
→ RLS 정책이 올바르게 설정되었는지 확인
→ 사용자가 `employees` 테이블에 존재하는지 확인

### 오류: "duplicate key value"
→ 같은 주간에 리포트를 여러 번 생성하려고 할 때 발생
→ upsert 로직이 작동하므로 정상 (업데이트됨)

## ✅ 완료 체크리스트

- [ ] Supabase SQL Editor에서 스크립트 실행
- [ ] `weekly_reports` 테이블 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] unique constraint 추가 (선택)
- [ ] 개인 리포트 페이지 테스트
- [ ] 관리자 페이지 테스트
- [ ] Cron Job 설정 확인 (Vercel 배포 후)
