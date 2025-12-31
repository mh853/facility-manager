-- ============================================================
-- Subsidy Crawler Monitoring System - Database Schema
-- ============================================================
-- Purpose: Track crawling schedules, results, AI verification, and URL health
-- Created: 2025-12-23
-- ============================================================

-- 1. Crawl Runs Table - Track each crawling execution
CREATE TABLE IF NOT EXISTS crawl_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Run identification
    run_id TEXT UNIQUE NOT NULL, -- e.g., "run_2025-12-23_21:00"
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Run context
    trigger_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'retry'
    github_run_id TEXT, -- GitHub Actions run ID for reference
    total_batches INTEGER NOT NULL DEFAULT 0,
    completed_batches INTEGER NOT NULL DEFAULT 0,

    -- Aggregate statistics
    total_urls_crawled INTEGER NOT NULL DEFAULT 0,
    successful_urls INTEGER NOT NULL DEFAULT 0,
    failed_urls INTEGER NOT NULL DEFAULT 0,
    total_announcements INTEGER NOT NULL DEFAULT 0,
    new_announcements INTEGER NOT NULL DEFAULT 0,
    relevant_announcements INTEGER NOT NULL DEFAULT 0, -- keyword matched
    ai_verified_announcements INTEGER NOT NULL DEFAULT 0, -- AI verified

    -- Performance metrics
    avg_response_time_ms INTEGER,
    total_processing_time_seconds INTEGER,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'partial'
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for crawl_runs
CREATE INDEX idx_crawl_runs_started_at ON crawl_runs(started_at DESC);
CREATE INDEX idx_crawl_runs_status ON crawl_runs(status);
CREATE INDEX idx_crawl_runs_trigger_type ON crawl_runs(trigger_type);
CREATE INDEX idx_crawl_runs_github_run_id ON crawl_runs(github_run_id);

-- 2. Crawl Batch Results Table - Track individual batch performance
CREATE TABLE IF NOT EXISTS crawl_batch_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationship to crawl run
    run_id TEXT NOT NULL REFERENCES crawl_runs(run_id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,

    -- Batch details
    url_ids UUID[] NOT NULL, -- Array of direct_url_sources.id
    urls_in_batch INTEGER NOT NULL,

    -- Execution timeline
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_time_seconds INTEGER,

    -- Results
    successful_urls INTEGER NOT NULL DEFAULT 0,
    failed_urls INTEGER NOT NULL DEFAULT 0,
    total_announcements INTEGER NOT NULL DEFAULT 0,
    new_announcements INTEGER NOT NULL DEFAULT 0,
    relevant_announcements INTEGER NOT NULL DEFAULT 0,
    ai_verified_announcements INTEGER NOT NULL DEFAULT 0,

    -- Performance
    avg_response_time_ms INTEGER,

    -- Status
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT,

    -- Raw results (optional, for debugging)
    raw_results JSONB,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique batch per run
    UNIQUE(run_id, batch_number)
);

-- Indexes for crawl_batch_results
CREATE INDEX idx_crawl_batch_results_run_id ON crawl_batch_results(run_id);
CREATE INDEX idx_crawl_batch_results_batch_number ON crawl_batch_results(batch_number);
CREATE INDEX idx_crawl_batch_results_status ON crawl_batch_results(status);
CREATE INDEX idx_crawl_batch_results_started_at ON crawl_batch_results(started_at DESC);

-- 3. AI Verification Log Table - Track Gemini AI verification results
CREATE TABLE IF NOT EXISTS ai_verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationship to crawl run
    run_id TEXT NOT NULL REFERENCES crawl_runs(run_id) ON DELETE CASCADE,
    batch_number INTEGER,

    -- Announcement details
    announcement_url TEXT NOT NULL,
    announcement_title TEXT NOT NULL,
    announcement_content TEXT,
    source_url TEXT NOT NULL, -- From direct_url_sources

    -- Keyword analysis (existing system)
    keyword_matched BOOLEAN NOT NULL DEFAULT false,
    matched_keywords TEXT[],
    keyword_score NUMERIC(3,2), -- 0.00 to 1.00

    -- AI verification (Gemini)
    ai_verified BOOLEAN NOT NULL DEFAULT false,
    ai_confidence NUMERIC(3,2), -- 0.00 to 1.00
    ai_reasoning TEXT, -- Why AI thinks it's relevant/not relevant

    -- AI technical details
    gemini_model TEXT DEFAULT 'gemini-1.5-flash',
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    api_cost_usd NUMERIC(10,8), -- Track actual cost

    -- Disagreement tracking
    disagreement BOOLEAN GENERATED ALWAYS AS (keyword_matched != ai_verified) STORED,

    -- Timing
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_time_ms INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ai_verification_log
CREATE INDEX idx_ai_verification_run_id ON ai_verification_log(run_id);
CREATE INDEX idx_ai_verification_disagreement ON ai_verification_log(disagreement) WHERE disagreement = true;
CREATE INDEX idx_ai_verification_verified_at ON ai_verification_log(verified_at DESC);
CREATE INDEX idx_ai_verification_announcement_url ON ai_verification_log(announcement_url);
CREATE INDEX idx_ai_verification_ai_verified ON ai_verification_log(ai_verified);
CREATE INDEX idx_ai_verification_keyword_matched ON ai_verification_log(keyword_matched);

-- 4. URL Health Metrics Table - Track individual URL performance over time
CREATE TABLE IF NOT EXISTS url_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- URL reference
    url_id UUID NOT NULL REFERENCES direct_url_sources(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL, -- Denormalized for quick queries

    -- Health tracking period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Success metrics
    total_attempts INTEGER NOT NULL DEFAULT 0,
    successful_crawls INTEGER NOT NULL DEFAULT 0,
    failed_crawls INTEGER NOT NULL DEFAULT 0,
    success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_attempts > 0
            THEN (successful_crawls::NUMERIC / total_attempts::NUMERIC * 100)
            ELSE 0
        END
    ) STORED,

    -- Performance metrics
    avg_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    min_response_time_ms INTEGER,

    -- Results quality
    total_announcements_found INTEGER NOT NULL DEFAULT 0,
    relevant_announcements_found INTEGER NOT NULL DEFAULT 0,
    ai_verified_announcements_found INTEGER NOT NULL DEFAULT 0,
    relevance_rate NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_announcements_found > 0
            THEN (relevant_announcements_found::NUMERIC / total_announcements_found::NUMERIC * 100)
            ELSE 0
        END
    ) STORED,

    -- Error tracking
    last_error_message TEXT,
    last_error_at TIMESTAMPTZ,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,

    -- Health status (computed from base columns to avoid generated column dependency)
    is_healthy BOOLEAN GENERATED ALWAYS AS (
        CASE
            WHEN total_attempts > 0
            THEN (successful_crawls::NUMERIC / total_attempts::NUMERIC * 100) >= 80 AND consecutive_failures < 3
            ELSE consecutive_failures < 3
        END
    ) STORED,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one metric per URL per period
    UNIQUE(url_id, period_start, period_end)
);

-- Indexes for url_health_metrics
CREATE INDEX idx_url_health_metrics_url_id ON url_health_metrics(url_id);
CREATE INDEX idx_url_health_metrics_period ON url_health_metrics(period_start DESC, period_end DESC);
CREATE INDEX idx_url_health_metrics_is_healthy ON url_health_metrics(is_healthy);
CREATE INDEX idx_url_health_metrics_success_rate ON url_health_metrics(success_rate);
CREATE INDEX idx_url_health_metrics_consecutive_failures ON url_health_metrics(consecutive_failures) WHERE consecutive_failures >= 3;

-- ============================================================
-- Views for easier querying
-- ============================================================

-- View: Recent crawl runs with summary
CREATE OR REPLACE VIEW vw_recent_crawl_runs AS
SELECT
    r.id,
    r.run_id,
    r.started_at,
    r.completed_at,
    r.trigger_type,
    r.status,
    r.total_urls_crawled,
    r.successful_urls,
    r.failed_urls,
    r.total_announcements,
    r.new_announcements,
    r.relevant_announcements,
    r.ai_verified_announcements,
    ROUND((r.relevant_announcements::NUMERIC / NULLIF(r.total_announcements, 0)::NUMERIC * 100), 2) as relevance_rate,
    ROUND((r.ai_verified_announcements::NUMERIC / NULLIF(r.total_announcements, 0)::NUMERIC * 100), 2) as ai_verification_rate,
    ROUND((r.successful_urls::NUMERIC / NULLIF(r.total_urls_crawled, 0)::NUMERIC * 100), 2) as success_rate,
    r.total_processing_time_seconds,
    r.completed_batches,
    r.total_batches
FROM crawl_runs r
ORDER BY r.started_at DESC;

-- View: URL health summary
CREATE OR REPLACE VIEW vw_url_health_summary AS
SELECT
    url_id,
    source_url,
    success_rate,
    relevance_rate,
    consecutive_failures,
    is_healthy,
    total_attempts,
    successful_crawls,
    failed_crawls,
    total_announcements_found,
    relevant_announcements_found,
    ai_verified_announcements_found,
    avg_response_time_ms,
    last_error_message,
    last_error_at,
    period_start,
    period_end
FROM url_health_metrics
WHERE period_end >= NOW() - INTERVAL '30 days'
ORDER BY is_healthy ASC, success_rate ASC, consecutive_failures DESC;

-- View: AI verification disagreements
CREATE OR REPLACE VIEW vw_ai_disagreements AS
SELECT
    av.id,
    av.run_id,
    av.announcement_title,
    av.announcement_url,
    av.source_url,
    av.keyword_matched,
    av.matched_keywords,
    av.keyword_score,
    av.ai_verified,
    av.ai_confidence,
    av.ai_reasoning,
    av.verified_at,
    CASE
        WHEN av.keyword_matched AND NOT av.ai_verified THEN 'keyword_only'
        WHEN NOT av.keyword_matched AND av.ai_verified THEN 'ai_only'
        ELSE 'agreement'
    END as disagreement_type
FROM ai_verification_log av
WHERE av.disagreement = true
ORDER BY av.verified_at DESC;

-- ============================================================
-- Functions for automatic updates
-- ============================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_crawl_runs_updated_at
    BEFORE UPDATE ON crawl_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crawl_batch_results_updated_at
    BEFORE UPDATE ON crawl_batch_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_url_health_metrics_updated_at
    BEFORE UPDATE ON url_health_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_batch_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_health_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated service role full access
CREATE POLICY "Service role has full access to crawl_runs"
    ON crawl_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to crawl_batch_results"
    ON crawl_batch_results
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_verification_log"
    ON ai_verification_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to url_health_metrics"
    ON url_health_metrics
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow authenticated users read access only
CREATE POLICY "Authenticated users can read crawl_runs"
    ON crawl_runs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read crawl_batch_results"
    ON crawl_batch_results
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read ai_verification_log"
    ON ai_verification_log
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read url_health_metrics"
    ON url_health_metrics
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================
-- Comments for documentation
-- ============================================================

COMMENT ON TABLE crawl_runs IS 'Tracks each subsidy crawler execution with aggregate statistics';
COMMENT ON TABLE crawl_batch_results IS 'Tracks individual batch performance within each crawl run';
COMMENT ON TABLE ai_verification_log IS 'Logs Gemini AI verification results for announcements';
COMMENT ON TABLE url_health_metrics IS 'Tracks URL performance and health metrics over time';

COMMENT ON COLUMN crawl_runs.run_id IS 'Unique identifier for each crawl run (e.g., run_2025-12-23_21:00)';
COMMENT ON COLUMN crawl_runs.trigger_type IS 'How the crawl was initiated: scheduled, manual, or retry';
COMMENT ON COLUMN crawl_runs.ai_verified_announcements IS 'Number of announcements verified as relevant by Gemini AI';

COMMENT ON COLUMN ai_verification_log.disagreement IS 'Auto-computed: true when keyword matching and AI disagree';
COMMENT ON COLUMN ai_verification_log.ai_reasoning IS 'Gemini AI explanation for its relevance determination';

COMMENT ON COLUMN url_health_metrics.is_healthy IS 'Auto-computed: true if success_rate >= 80% and consecutive_failures < 3';
COMMENT ON COLUMN url_health_metrics.relevance_rate IS 'Auto-computed: percentage of announcements found that are relevant';
