-- =====================================================
-- 대리점 가격 관리 - 샘플 데이터 추가
-- 목적: 제조사별 원가 항목과 동일한 기기 항목으로 샘플 데이터 생성
-- =====================================================

BEGIN;

-- 샘플 데이터 삽입 (제조사별 원가와 동일한 항목)
INSERT INTO dealer_pricing (
    equipment_type,
    equipment_name,
    dealer_cost_price,
    dealer_selling_price,
    margin_rate,
    manufacturer,
    effective_from,
    is_active
) VALUES
-- PH센서
('sensor', 'PH센서', 450000, 550000, 22.22, '에코센스', '2025-01-01', true),
-- 차압계
('sensor', '차압계', 350000, 450000, 28.57, '크린어스', '2025-01-01', true),
-- 온도계
('sensor', '온도계', 400000, 500000, 25.00, '에코센스', '2025-01-01', true),
-- 배출전류계
('meter', '배출전류계', 240000, 300000, 25.00, '에코센스', '2025-01-01', true),
-- 송풍전류계
('meter', '송풍전류계', 240000, 300000, 25.00, '크린어스', '2025-01-01', true),
-- 펌프전류계
('meter', '펌프전류계', 240000, 300000, 25.00, '가이아씨앤에스', '2025-01-01', true),
-- 게이트웨이
('network', '게이트웨이', 800000, 1000000, 25.00, '에코센스', '2025-01-01', true),
-- VPN(유선)
('network', 'VPN(유선)', 320000, 400000, 25.00, '에코센스', '2025-01-01', true),
-- VPN(무선)
('network', 'VPN(무선)', 320000, 400000, 25.00, '크린어스', '2025-01-01', true),
-- 방폭차압계(국산)
('sensor', '방폭차압계(국산)', 550000, 700000, 27.27, '가이아씨앤에스', '2025-01-01', true),
-- 방폭온도계(국산)
('sensor', '방폭온도계(국산)', 600000, 750000, 25.00, '이브이에스', '2025-01-01', true),
-- 확장디바이스
('device', '확장디바이스', 400000, 500000, 25.00, '에코센스', '2025-01-01', true),
-- 중계기(8채널)
('device', '중계기(8채널)', 280000, 350000, 25.00, '크린어스', '2025-01-01', true),
-- 중계기(16채널)
('device', '중계기(16채널)', 450000, 560000, 24.44, '에코센스', '2025-01-01', true),
-- 메인보드교체
('maintenance', '메인보드교체', 350000, 440000, 25.71, '에코센스', '2025-01-01', true),
-- 복수굴뚝
('maintenance', '복수굴뚝', 400000, 500000, 25.00, '크린어스', '2025-01-01', true)
ON CONFLICT DO NOTHING;

COMMIT;

-- 확인 쿼리
SELECT
    '✅ 대리점 가격 샘플 데이터 생성 완료!' as message,
    (SELECT COUNT(*) FROM dealer_pricing WHERE is_active = true) as total_count;

-- 샘플 데이터 확인
SELECT
    equipment_name as 기기명,
    manufacturer as 제조사,
    dealer_cost_price as 공급가,
    dealer_selling_price as 판매가,
    margin_rate as 마진율,
    effective_from as 시행일
FROM dealer_pricing
WHERE is_active = true
ORDER BY equipment_type, equipment_name;
