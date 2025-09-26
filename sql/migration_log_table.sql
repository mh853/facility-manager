-- 마이그레이션 추적 테이블 생성
-- 향후 데이터베이스 변경사항 추적을 위한 기본 인프라

CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(100) UNIQUE NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    executed_by VARCHAR(100) DEFAULT CURRENT_USER,
    rollback_script TEXT,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_migration_log_name ON migration_log(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON migration_log(executed_at);
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON migration_log(status);

-- 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_migration_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_migration_log_updated_at
    BEFORE UPDATE ON migration_log
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_log_updated_at();