# Realtime 연결 오류 해결 방법

## 문제 상황
- 브라우저에서 "Realtime 연결 실패 - 테이블 미존재로 인한 것으로 추정, graceful degradation 적용" 오류 발생
- `task_notifications` 테이블이 Supabase Realtime publication에 추가되지 않음

## 해결 방법 1: Supabase Dashboard에서 Realtime 활성화

1. Supabase Dashboard 접속:
   https://supabase.com/dashboard/project/qdfqoykhmuiambtrrlnf

2. **Database > Replication** 메뉴로 이동

3. 다음 테이블들을 Realtime publication에 추가:
   - ✅ `notifications`
   - ✅ `task_notifications` ← **중요! 이 테이블이 누락됨**
   - ✅ `facility_tasks`
   - ✅ `business_info`
   - ✅ `uploaded_files`

4. 각 테이블 옆의 "Enable Realtime" 토글 활성화

## 해결 방법 2: SQL Editor에서 수동 실행

Supabase Dashboard > **SQL Editor**에서 다음 쿼리 실행:

```sql
-- Realtime publication에 테이블 추가
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE task_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE facility_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE business_info;
ALTER PUBLICATION supabase_realtime ADD TABLE uploaded_files;

-- 설정 확인
SELECT schemaname, tablename,
       has_table_privilege(tablename, 'SELECT') as can_select,
       has_table_privilege(tablename, 'INSERT') as can_insert
FROM pg_tables
WHERE tablename IN ('notifications', 'task_notifications', 'facility_tasks', 'business_info', 'uploaded_files')
AND schemaname = 'public';

-- Publication 상태 확인
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

## 해결 방법 3: Row Level Security (RLS) 정책 확인

테이블에 RLS가 활성화되어 있다면, 익명 사용자도 읽을 수 있는 정책 필요:

```sql
-- task_notifications 테이블 RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'task_notifications';

-- 필요시 읽기 권한 정책 추가 (이미 있다면 생략)
CREATE POLICY "Allow anonymous read access" ON task_notifications
FOR SELECT TO anon USING (true);
```

## 예상 결과

설정 완료 후:
- 브라우저 콘솔에서 "✅ [REALTIME] 연결 성공" 메시지 확인
- 알림 읽음 처리 시 실시간으로 UI 업데이트
- 새 알림 생성 시 실시간 알림 받기

## 확인 방법

로컬 서버 실행 후 브라우저 개발자 도구에서:
```javascript
// Realtime 연결 상태 확인
console.log('Realtime status:', window.supabase?.realtime?.channels);
```

---

**중요**: `task_notifications` 테이블이 Realtime publication에 추가되지 않은 것이 주요 원인으로 보입니다.