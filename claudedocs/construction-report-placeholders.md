# 착공신고서 템플릿 플레이스홀더 가이드

Word 템플릿 파일에서 사용할 플레이스홀더 목록입니다.
템플릿에 `{{placeholder_name}}` 형식으로 입력하세요.

## 기본 정보

| 플레이스홀더 | 설명 | 예시 |
|------------|------|------|
| `{{business_name}}` | 사업장명 | 스타일웍스 |
| `{{address}}` | 사업장 소재지 | 경기도 성남시... |
| `{{business_contact}}` | 사업장 전화번호 | 031-123-4567 |
| `{{fax_number}}` | 사업장 팩스번호 | 031-123-4568 |
| `{{business_registration_number}}` | 사업자등록번호 | 123-45-67890 |
| `{{representative_name}}` | 대표자 성명 | 김유정 |
| `{{representative_name_spaced}}` | 대표자 성명 (공백 포함) | 김 유 정 |
| `{{local_government_head}}` | 지자체장 | 경기도지사 |

## 날짜 정보

| 플레이스홀더 | 설명 | 예시 |
|------------|------|------|
| `{{report_year}}` | 신고서 작성 년도 | 2024 |
| `{{report_month}}` | 신고서 작성 월 | 11 |
| `{{report_day}}` | 신고서 작성 일 | 25 |
| `{{subsidy_approval_date}}` | 보조금 승인일 | 2024.11.01 |
| `{{attachment_start_date}}` | 부착 시작일 (승인일) | 2024.11.01 |
| `{{attachment_end_date}}` | 부착 종료일 (승인일 +3개월) | 2025.02.01 |

## 금액 정보

| 플레이스홀더 | 설명 | 예시 |
|------------|------|------|
| `{{government_notice_price}}` | 총 소요금액 (공고금액) | 5,000,000 |
| `{{subsidy_amount}}` | 보조금 승인액 | 4,000,000 |
| `{{self_payment}}` | 자체부담액 | 1,000,000 |
| `{{self_payment_with_vat}}` | 자체부담액 + 부가세 | 1,100,000 |
| `{{government_price_with_vat}}` | 공고금액 + 부가세 (10%) | 5,500,000 |
| `{{deposit_amount}}` | 입금액 | 1,100,000 |
| `{{additional_cost}}` | 추가비용 (있는 경우) | 500,000 |
| `{{negotiation_cost}}` | 네고금액 (있는 경우) | 300,000 |

## 설치 품목 (IoT 측정기기)

| 플레이스홀더 | 설명 | 예시 |
|------------|------|------|
| `{{gateway}}` | 게이트웨이 수량 | 1 |
| `{{vpn_type}}` | VPN 타입 | 유선 or 무선 |
| `{{discharge_current_meter}}` | 배출시설 전류계 | 1 |
| `{{prevention_current_meter}}` | 방지시설 전류계 | 1 |
| `{{differential_pressure_meter}}` | 차압계 | 1 |
| `{{temperature_meter}}` | 온도계 | 1 |
| `{{ph_meter}}` | PH계 | 0 |

## 방지시설 정보 (반복 영역)

방지시설은 여러 개가 있을 수 있으므로, 반복 영역으로 처리합니다.

```
{#prevention_facilities}
  {{facility_name}} ({{capacity}}) × {{quantity}}대
{/prevention_facilities}
```

예시:
- 습식집진기 (10CMM) × 1대
- 활성탄흡착탑 (5CMM) × 2대

## 고정 값 (블루온 정보)

템플릿에 직접 입력하거나 플레이스홀더 사용:

| 항목 | 값 |
|------|-----|
| 설치업체명 | 주식회사 블루온 |
| 시공업체 소재지 | 경상북도 고령군 대가야읍 낫질로 285 |
| 시공업체 전화 | 1661-5543 |
| 시공업체 팩스 | 031-8077-2054 |
| 시공업체 사업자등록번호 | 679-86-02827 |
| 시공업체 대표자 | 김 경 수 |
| 은행 정보 | 기업은행 336-101191-04-015 |

## 사용 예시

Word 템플릿에서:

```
사 업 장 명: {{business_name}}
사업장소재지: {{address}}
전화: {{business_contact}}  팩스: {{fax_number}}

총 소요금액: {{government_notice_price}} 원
보조금 승인액: {{subsidy_amount}} 원
자체부담액: {{self_payment}} 원

{{report_year}} 년 {{report_month}} 월 {{report_day}} 일

신청인(대표자) {{business_name}} {{representative_name_spaced}} (인감도장)

{{local_government_head}} 귀하
```

## 조건부 표시

추가비용이나 네고금액이 있는 경우만 표시:

```
{#additional_cost}
추가비용: {{additional_cost}} 원
{/additional_cost}

{#negotiation_cost}
네고금액: {{negotiation_cost}} 원
{/negotiation_cost}
```

## 숫자 포맷팅

- 모든 금액은 천단위 콤마(,)가 자동으로 추가됩니다
- 날짜는 `YYYY.MM.DD` 형식으로 포맷됩니다

## 주의사항

1. 플레이스홀더는 정확히 `{{name}}` 형식으로 작성해야 합니다 (중괄호 2개)
2. 대소문자를 구분하지 않지만, 소문자 사용 권장
3. 플레이스홀더 앞뒤 공백은 자동으로 제거됩니다
4. 데이터가 없는 경우 빈 문자열로 대체됩니다
