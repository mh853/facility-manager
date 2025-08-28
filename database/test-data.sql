-- 테스트 데이터 생성 스크립트
-- 실행 전에 반드시 schema.sql을 먼저 실행하세요

-- 기존 테스트 데이터 삭제 (선택사항)
-- DELETE FROM prevention_facilities;
-- DELETE FROM discharge_facilities;
-- DELETE FROM discharge_outlets;
-- DELETE FROM air_permit_info;
-- DELETE FROM business_info WHERE business_name LIKE '테스트%';

-- 1. 테스트 사업장 정보 생성
INSERT INTO business_info (
    business_name,
    local_government,
    address,
    manager_name,
    manager_position,
    manager_contact,
    business_contact,
    fax_number,
    email,
    representative_name,
    representative_birth_date,
    business_registration_number,
    manufacturer,
    ph_meter,
    differential_pressure_meter,
    temperature_meter,
    discharge_ct,
    prevention_ct,
    gateway,
    vpn_wired,
    vpn_wireless,
    multiple_stack
) VALUES 
-- 사업장 1
(
    '테스트화학공업(주)',
    '서울특별시',
    '서울시 강남구 테헤란로 123',
    '김철수',
    '환경담당자',
    '010-1234-5678',
    '02-1234-5678',
    '02-1234-5679',
    'kim@test-chemical.co.kr',
    '이대표',
    '1970-01-01',
    '123-45-67890',
    '한국환경기기',
    true,
    true,
    true,
    'CT-001',
    'CT-002',
    'GW-001',
    true,
    false,
    true
),
-- 사업장 2
(
    '테스트제약(주)',
    '경기도',
    '경기도 성남시 분당구 정자로 456',
    '박영희',
    '품질관리팀장',
    '010-2345-6789',
    '031-2345-6789',
    '031-2345-6790',
    'park@test-pharma.co.kr',
    '최대표',
    '1965-05-15',
    '234-56-78901',
    '삼성환경시설',
    false,
    true,
    true,
    'CT-003',
    'CT-004',
    'GW-002',
    false,
    true,
    false
),
-- 사업장 3
(
    '테스트전자(주)',
    '인천광역시',
    '인천시 연수구 송도대로 789',
    '정민수',
    '시설관리자',
    '010-3456-7890',
    '032-3456-7890',
    '032-3456-7891',
    'jung@test-electronics.co.kr',
    '윤대표',
    '1975-10-20',
    '345-67-89012',
    'LG환경솔루션',
    true,
    false,
    true,
    'CT-005',
    'CT-006',
    'GW-003',
    true,
    true,
    false
);

-- 2. 사업장 ID 조회용 임시 변수 (PostgreSQL에서는 WITH 구문 사용)
-- 대기필증 정보 생성을 위해 방금 생성한 사업장 ID들을 조회

-- 3. 대기필증 정보 생성
WITH business_ids AS (
    SELECT id, business_name 
    FROM business_info 
    WHERE business_name LIKE '테스트%'
)
INSERT INTO air_permit_info (
    business_id,
    business_type,
    annual_pollutant_emission,
    first_report_date,
    operation_start_date
)
SELECT 
    bi.id,
    CASE 
        WHEN bi.business_name = '테스트화학공업(주)' THEN '화학제품 제조업'
        WHEN bi.business_name = '테스트제약(주)' THEN '의약품 제조업'
        WHEN bi.business_name = '테스트전자(주)' THEN '전자부품 제조업'
    END,
    CASE 
        WHEN bi.business_name = '테스트화학공업(주)' THEN 45.5
        WHEN bi.business_name = '테스트제약(주)' THEN 12.3
        WHEN bi.business_name = '테스트전자(주)' THEN 8.7
    END,
    CASE 
        WHEN bi.business_name = '테스트화학공업(주)' THEN '2020-03-15'
        WHEN bi.business_name = '테스트제약(주)' THEN '2019-07-20'
        WHEN bi.business_name = '테스트전자(주)' THEN '2021-01-10'
    END,
    CASE 
        WHEN bi.business_name = '테스트화학공업(주)' THEN '2020-05-01'
        WHEN bi.business_name = '테스트제약(주)' THEN '2019-09-01'
        WHEN bi.business_name = '테스트전자(주)' THEN '2021-03-01'
    END
FROM business_ids bi;

-- 4. 배출구 정보 생성
WITH permit_ids AS (
    SELECT api.id as permit_id, bi.business_name
    FROM air_permit_info api
    JOIN business_info bi ON api.business_id = bi.id
    WHERE bi.business_name LIKE '테스트%'
)
INSERT INTO discharge_outlets (
    air_permit_id,
    outlet_number,
    outlet_name
)
SELECT 
    pi.permit_id,
    outlet_data.outlet_number,
    outlet_data.outlet_name
FROM permit_ids pi
CROSS JOIN (
    VALUES 
        (1, '1호 배출구'),
        (2, '2호 배출구')
) AS outlet_data(outlet_number, outlet_name)
WHERE 
    (pi.business_name = '테스트화학공업(주)') OR
    (pi.business_name = '테스트제약(주)' AND outlet_data.outlet_number = 1) OR
    (pi.business_name = '테스트전자(주)' AND outlet_data.outlet_number = 1);

-- 5. 배출시설 정보 생성
WITH outlet_ids AS (
    SELECT do_table.id as outlet_id, bi.business_name, do_table.outlet_number
    FROM discharge_outlets do_table
    JOIN air_permit_info api ON do_table.air_permit_id = api.id
    JOIN business_info bi ON api.business_id = bi.id
    WHERE bi.business_name LIKE '테스트%'
)
INSERT INTO discharge_facilities (
    outlet_id,
    facility_name,
    capacity,
    quantity
)
SELECT 
    oi.outlet_id,
    facility_data.facility_name,
    facility_data.capacity,
    facility_data.quantity
FROM outlet_ids oi
CROSS JOIN (
    VALUES 
        ('반응기', '100㎥/h', 2),
        ('건조기', '50㎥/h', 1),
        ('분쇄기', '30㎥/h', 3)
) AS facility_data(facility_name, capacity, quantity)
WHERE 
    (oi.business_name = '테스트화학공업(주)') OR
    (oi.business_name = '테스트제약(주)' AND facility_data.facility_name IN ('반응기', '건조기')) OR
    (oi.business_name = '테스트전자(주)' AND facility_data.facility_name = '분쇄기');

-- 6. 방지시설 정보 생성
WITH outlet_ids AS (
    SELECT do_table.id as outlet_id, bi.business_name, do_table.outlet_number
    FROM discharge_outlets do_table
    JOIN air_permit_info api ON do_table.air_permit_id = api.id
    JOIN business_info bi ON api.business_id = bi.id
    WHERE bi.business_name LIKE '테스트%'
)
INSERT INTO prevention_facilities (
    outlet_id,
    facility_name,
    capacity,
    quantity
)
SELECT 
    oi.outlet_id,
    facility_data.facility_name,
    facility_data.capacity,
    facility_data.quantity
FROM outlet_ids oi
CROSS JOIN (
    VALUES 
        ('백필터', '1000㎥/h', 1),
        ('스크러버', '500㎥/h', 1),
        ('활성탄흡착탑', '200㎥/h', 2)
) AS facility_data(facility_name, capacity, quantity)
WHERE 
    (oi.business_name = '테스트화학공업(주)') OR
    (oi.business_name = '테스트제약(주)' AND facility_data.facility_name IN ('백필터', '스크러버')) OR
    (oi.business_name = '테스트전자(주)' AND facility_data.facility_name = '활성탄흡착탑');

-- 7. 테스트 데이터 생성 완료 확인
SELECT 
    '테스트 데이터 생성 완료' as status,
    (SELECT COUNT(*) FROM business_info WHERE business_name LIKE '테스트%') as businesses_created,
    (SELECT COUNT(*) FROM air_permit_info WHERE business_id IN (
        SELECT id FROM business_info WHERE business_name LIKE '테스트%'
    )) as permits_created,
    (SELECT COUNT(*) FROM discharge_outlets WHERE air_permit_id IN (
        SELECT api.id FROM air_permit_info api 
        JOIN business_info bi ON api.business_id = bi.id 
        WHERE bi.business_name LIKE '테스트%'
    )) as outlets_created,
    (SELECT COUNT(*) FROM discharge_facilities WHERE outlet_id IN (
        SELECT do_table.id FROM discharge_outlets do_table
        JOIN air_permit_info api ON do_table.air_permit_id = api.id
        JOIN business_info bi ON api.business_id = bi.id
        WHERE bi.business_name LIKE '테스트%'
    )) as discharge_facilities_created,
    (SELECT COUNT(*) FROM prevention_facilities WHERE outlet_id IN (
        SELECT do_table.id FROM discharge_outlets do_table
        JOIN air_permit_info api ON do_table.air_permit_id = api.id
        JOIN business_info bi ON api.business_id = bi.id
        WHERE bi.business_name LIKE '테스트%'
    )) as prevention_facilities_created;