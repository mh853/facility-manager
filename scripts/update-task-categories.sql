-- 업무 프로세스 기반 카테고리 업데이트
-- 시설관리 업무 프로세스에 따른 카테고리 구성

-- 기존 카테고리 비활성화
UPDATE task_categories SET is_active = false WHERE is_active = true;

-- 자비 진행 업무 카테고리
INSERT INTO task_categories (name, description, color, icon, sort_order, min_permission_level, is_active) VALUES
('고객 상담', '초기 연락 및 거래 의사 확인', '#3B82F6', 'users', 1, 1, true),
('현장 실사', '시설 현황 확인 및 조사', '#10B981', 'search', 2, 1, true),
('견적 작성', '견적서 작성 및 발송', '#F59E0B', 'file-text', 3, 1, true),
('계약 체결', '계약서 작성 및 계약금 수령', '#8B5CF6', 'file-signature', 4, 2, true),
('제품 발주', '제품 주문 및 출고 관리', '#06B6D4', 'package', 5, 2, true),
('설치 진행', '설치 일정 조율 및 시공', '#EF4444', 'wrench', 6, 1, true),
('잔금 정산', '잔금 수령 및 완료 서류 발송', '#84CC16', 'dollar-sign', 7, 2, true),

-- 보조금 지원 업무 카테고리 (추가 단계)
('지원 신청', '부착지원신청서 지자체 제출', '#F97316', 'file-plus', 8, 2, true),
('서류 보완', '지자체 서류 보완 요청 대응', '#6366F1', 'file-edit', 9, 1, true),
('착공 전 실사', '지자체 담당자와 공동 실사', '#14B8A6', 'clipboard-check', 10, 2, true),
('착공 실사 보완', '착공 전 실사 보완 사항 처리', '#F43F5E', 'alert-triangle', 11, 1, true),
('준공 실사', '지자체와 공동 준공 실사', '#22C55E', 'check-circle', 12, 2, true),
('준공 보완', '준공 실사 보완 사항 처리', '#A855F7', 'refresh-cw', 13, 1, true),
('서류 제출', '그린링크전송확인서, 부착완료통보서, 보조금지급신청서 제출', '#0EA5E9', 'upload', 14, 2, true),
('보조금 수령', '지자체 입금 확인 및 완료', '#16A34A', 'check-circle-2', 15, 2, true),

-- 공통 업무 카테고리
('기타', '기타 업무', '#6B7280', 'more-horizontal', 99, 1, true);

-- 업무 상태 기본값 확인 및 추가
INSERT INTO task_statuses (name, description, color, icon, status_type, sort_order, is_active)
SELECT * FROM (
  SELECT '신규' as name, '새로 생성된 업무' as description, '#3B82F6' as color, 'clock' as icon, 'pending' as status_type, 1 as sort_order, true as is_active
  UNION ALL
  SELECT '진행 중', '현재 작업 중인 업무', '#F59E0B', 'play-circle', 'active', 2, true
  UNION ALL
  SELECT '검토 중', '검토가 필요한 업무', '#8B5CF6', 'eye', 'active', 3, true
  UNION ALL
  SELECT '보류', '일시 중단된 업무', '#6B7280', 'pause-circle', 'on_hold', 4, true
  UNION ALL
  SELECT '완료', '성공적으로 완료된 업무', '#10B981', 'check-circle', 'completed', 5, true
  UNION ALL
  SELECT '취소', '취소된 업무', '#EF4444', 'x-circle', 'cancelled', 6, true
) AS new_statuses
WHERE NOT EXISTS (
  SELECT 1 FROM task_statuses WHERE name = new_statuses.name
);