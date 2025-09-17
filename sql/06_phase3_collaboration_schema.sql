-- Phase 3: 협업 기능 확장 스키마
-- 댓글 및 멘션 시스템 추가

-- 댓글 시스템 확장
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES employees(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES task_comments(id) ON DELETE CASCADE, -- 대댓글 지원
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 멘션 시스템
CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES employees(id),
  mentioning_user_id UUID NOT NULL REFERENCES employees(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 업무 관찰자 (워처) 시스템
CREATE TABLE IF NOT EXISTS task_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, user_id)
);

-- 업무 파일 첨부
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE, -- 댓글에 첨부된 파일
  user_id UUID NOT NULL REFERENCES employees(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 업무 활동 로그 확장
ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES task_comments(id),
ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES task_attachments(id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent_id ON task_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

CREATE INDEX IF NOT EXISTS idx_mentions_comment_id ON mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user_id ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_is_read ON mentions(is_read);

CREATE INDEX IF NOT EXISTS idx_task_watchers_task_id ON task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user_id ON task_watchers(user_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_comment_id ON task_attachments(comment_id);

-- 댓글 생성 시 알림 트리거
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- 업무 담당자에게 알림
  IF EXISTS (SELECT 1 FROM tasks WHERE id = NEW.task_id AND assigned_to IS NOT NULL AND assigned_to != NEW.user_id) THEN
    INSERT INTO notifications (user_id, type, title, message, related_task_id, related_comment_id)
    SELECT
      t.assigned_to,
      'task_comment',
      '새 댓글',
      (SELECT name FROM employees WHERE id = NEW.user_id) || '님이 댓글을 남겼습니다: ' || LEFT(NEW.content, 100),
      NEW.task_id,
      NEW.id
    FROM tasks t
    WHERE t.id = NEW.task_id;
  END IF;

  -- 업무 관찰자들에게 알림
  INSERT INTO notifications (user_id, type, title, message, related_task_id, related_comment_id)
  SELECT
    tw.user_id,
    'task_comment',
    '새 댓글',
    (SELECT name FROM employees WHERE id = NEW.user_id) || '님이 댓글을 남겼습니다: ' || LEFT(NEW.content, 100),
    NEW.task_id,
    NEW.id
  FROM task_watchers tw
  WHERE tw.task_id = NEW.task_id AND tw.user_id != NEW.user_id;

  -- 활동 로그 기록
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, comment_id, details)
  VALUES (
    NEW.user_id,
    'comment_created',
    'task',
    NEW.task_id,
    NEW.id,
    jsonb_build_object(
      'comment_content', LEFT(NEW.content, 200),
      'task_title', (SELECT title FROM tasks WHERE id = NEW.task_id)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 멘션 생성 시 알림 트리거
CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
BEGIN
  -- 멘션된 사용자에게 알림
  INSERT INTO notifications (user_id, type, title, message, related_task_id, related_comment_id)
  SELECT
    NEW.mentioned_user_id,
    'mention',
    '멘션',
    (SELECT name FROM employees WHERE id = NEW.mentioning_user_id) || '님이 당신을 멘션했습니다',
    (SELECT task_id FROM task_comments WHERE id = NEW.comment_id),
    NEW.comment_id
  WHERE NEW.mentioned_user_id != NEW.mentioning_user_id;

  -- 활동 로그 기록
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, comment_id, details)
  VALUES (
    NEW.mentioning_user_id,
    'user_mentioned',
    'task',
    (SELECT task_id FROM task_comments WHERE id = NEW.comment_id),
    NEW.comment_id,
    jsonb_build_object(
      'mentioned_user', (SELECT name FROM employees WHERE id = NEW.mentioned_user_id),
      'task_title', (SELECT t.title FROM tasks t JOIN task_comments tc ON t.id = tc.task_id WHERE tc.id = NEW.comment_id)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_notify_task_comment ON task_comments;
CREATE TRIGGER trigger_notify_task_comment
  AFTER INSERT ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_comment();

DROP TRIGGER IF EXISTS trigger_notify_mention ON mentions;
CREATE TRIGGER trigger_notify_mention
  AFTER INSERT ON mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mention();

-- 댓글 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_timestamp ON task_comments;
CREATE TRIGGER trigger_update_comment_timestamp
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_timestamp();

-- 업무 생성 시 자동으로 생성자를 관찰자로 추가
CREATE OR REPLACE FUNCTION auto_add_task_watcher()
RETURNS TRIGGER AS $$
BEGIN
  -- 업무 생성자를 관찰자로 추가
  INSERT INTO task_watchers (task_id, user_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (task_id, user_id) DO NOTHING;

  -- 담당자가 있고 생성자와 다르면 담당자도 관찰자로 추가
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
    INSERT INTO task_watchers (task_id, user_id)
    VALUES (NEW.id, NEW.assigned_to)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_add_task_watcher ON tasks;
CREATE TRIGGER trigger_auto_add_task_watcher
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_task_watcher();

-- 댓글과 관련된 뷰 생성
CREATE OR REPLACE VIEW task_comments_with_users AS
SELECT
  tc.*,
  e.name as user_name,
  e.position as user_position,
  e.profile_image_url as user_avatar,
  COALESCE(
    (SELECT COUNT(*) FROM task_comments replies WHERE replies.parent_id = tc.id AND replies.is_deleted = false),
    0
  ) as reply_count
FROM task_comments tc
JOIN employees e ON tc.user_id = e.id
WHERE tc.is_deleted = false;

-- 멘션 검색을 위한 함수
CREATE OR REPLACE FUNCTION extract_mentions(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
  mentions TEXT[];
BEGIN
  -- @username 패턴을 찾아서 배열로 반환
  SELECT array_agg(DISTINCT match[1])
  INTO mentions
  FROM regexp_split_to_table(content, '\s+') AS word,
       LATERAL regexp_match(word, '^@([a-zA-Z0-9_가-힣]+)') AS match
  WHERE match IS NOT NULL;

  RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- 권한 설정
GRANT SELECT, INSERT, UPDATE, DELETE ON task_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON mentions TO authenticated;
GRANT SELECT, INSERT, DELETE ON task_watchers TO authenticated;
GRANT SELECT, INSERT, DELETE ON task_attachments TO authenticated;
GRANT SELECT ON task_comments_with_users TO authenticated;