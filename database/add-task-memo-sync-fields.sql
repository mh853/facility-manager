-- Business Memos: 업무 메모 동기화 필드 추가
-- Created: 2026-01-29
-- Purpose: facility_tasks의 메모를 business_memos에 이력으로 누적

-- 1. business_memos 테이블에 동기화 필드 추가
ALTER TABLE business_memos
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual' CHECK (source_type IN ('manual', 'task_sync')),
ADD COLUMN IF NOT EXISTS source_id UUID NULL,
ADD COLUMN IF NOT EXISTS task_status VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NULL;

-- 2. 외래키 제약조건 추가 (CASCADE 삭제로 업무 삭제 시 메모도 자동 삭제)
ALTER TABLE business_memos
ADD CONSTRAINT fk_business_memos_source_task
FOREIGN KEY (source_id) REFERENCES facility_tasks(id) ON DELETE CASCADE;

-- 3. 성능 최적화를 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_business_memos_source_type ON business_memos(source_type);
CREATE INDEX IF NOT EXISTS idx_business_memos_source_id ON business_memos(source_id);
CREATE INDEX IF NOT EXISTS idx_business_memos_task_status ON business_memos(task_status);

-- 4. 복합 인덱스 (업무별 메모 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_business_memos_source_lookup
ON business_memos(source_type, source_id, created_at DESC);

-- 5. 컬럼 설명 추가
COMMENT ON COLUMN business_memos.source_type IS '메모 출처: manual(직접 작성), task_sync(업무에서 동기화)';
COMMENT ON COLUMN business_memos.source_id IS '원본 업무 ID (facility_tasks.id 참조)';
COMMENT ON COLUMN business_memos.task_status IS '업무 단계 정보 (한글명 저장, 예: 견적서 작성)';
COMMENT ON COLUMN business_memos.task_type IS '업무 타입 (self: 자가시설, subsidy: 보조금, as: A/S)';

-- 6. 데이터 검증
-- 기존 메모는 모두 'manual' 타입으로 설정됨 (이미 DEFAULT 값으로 처리)
SELECT
  source_type,
  COUNT(*) as count
FROM business_memos
GROUP BY source_type;
