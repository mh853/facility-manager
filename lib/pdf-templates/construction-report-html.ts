// lib/pdf-templates/construction-report-html.ts
// 착공신고서 HTML 템플릿 생성 함수

interface ConstructionReportData {
  business_name: string
  address: string
  business_contact: string
  fax_number: string
  subsidy_approval_date: string
  government_notice_price: number
  subsidy_amount: number
  self_payment: number
  local_government_head: string
  representative_name: string
  report_date: string
  business_registration_number: string
  gateway: number
  vpn_type: string
  discharge_current_meter: number
  prevention_current_meter: number
  differential_pressure_meter: number
  temperature_meter: number
  ph_meter: number
  prevention_facilities?: Array<{
    facility_name: string
    capacity?: string
    quantity: number
  }>
  deposit_amount: number
  additional_cost?: number
  negotiation_cost?: number
}

const baseStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #000;
    background: white;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm;
    margin: 0 auto;
    background: white;
    page-break-after: always;
  }
  .page:last-child {
    page-break-after: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    table-layout: fixed;
  }
  table, th, td {
    border: 1px solid #000;
  }
  th, td {
    padding: 8px;
    text-align: left;
    vertical-align: top;
    line-height: 20px;
  }
  th {
    background-color: #f0f0f0;
    font-weight: bold;
    text-align: center;
  }
  ol, ul {
    margin: 0;
    padding: 0;
    padding-left: 20px;
  }
  li {
    margin-bottom: 6px;
    line-height: 1.8;
  }
  li:last-child {
    margin-bottom: 0;
  }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-bold { font-weight: bold; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; }
  .mb-8 { margin-bottom: 32px; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .text-red { color: #ff0000; }
  .text-blue { color: #0000ff; }
  .bg-gray { background-color: #f0f0f0; }
  .bg-pink { background-color: #ffe6e6; }
  .bg-lightblue { background-color: #e6e6ff; }
  h1 { font-size: 24px; font-weight: bold; margin-bottom: 12px; }
  h2 { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
  h3 { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
`

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function formatNameWithSpaces(name: string): string {
  if (!name) return ''
  return name.split('').join(' ')
}

// Page 1: 착공신고서
export function generatePage1HTML(data: ConstructionReportData): string {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  const approvalDate = new Date(data.subsidy_approval_date)
  const endDate = new Date(approvalDate)
  endDate.setMonth(endDate.getMonth() + 3)

  return `
    <div class="page">
      <!-- 전체를 하나의 큰 표로 구성 (템플릿과 동일) -->
      <table style="width: 100%; border: 2px solid #000; border-collapse: collapse;">
        <tbody>
          <!-- 제목 행 -->
          <tr>
            <td colspan="4" style="padding: 16px; border: 1px solid #000; text-align: center;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">사물인터넷(IoT) 측정기기 부착지원 사업</div>
              <div style="font-size: 24px; font-weight: bold;">착 공 신 고 서</div>
            </td>
          </tr>

          <!-- 사업장명 -->
          <tr>
            <td style="width: 25%; padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              사 업 장 명
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; text-align: center;">
              ${data.business_name}
            </td>
          </tr>

          <!-- 사업장소재지 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              사업장소재지
            </td>
            <td colspan="2" style="padding: 12px 16px; border: 1px solid #000;">
              ${data.address}
            </td>
            <td rowspan="2" style="padding: 12px 16px; border: 1px solid #000; vertical-align: top;">
              <div style="padding-top: 8px;">
                <div style="margin-bottom: 4px;">
                  <span style="font-weight: 600; width: 60px; display: inline-block;">전 화</span>
                  <span>${data.business_contact}</span>
                </div>
                <div>
                  <span style="font-weight: 600; width: 60px; display: inline-block;">팩 스</span>
                  <span>${data.fax_number}</span>
                </div>
              </div>
            </td>
          </tr>

          <!-- 설치업체명 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              설치업체명
            </td>
            <td colspan="2" style="padding: 12px 16px; border: 1px solid #000; text-align: center;">
              주식회사 블루온
            </td>
          </tr>

          <!-- 시공업체 소재지 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              시공업체 소재지
            </td>
            <td colspan="2" style="padding: 12px 16px; border: 1px solid #000;">
              경상북도 고령군 대가야읍 낫질로 285
            </td>
            <td style="padding: 12px 16px; border: 1px solid #000; vertical-align: top;">
              <div style="padding-top: 8px;">
                <div style="margin-bottom: 4px;">
                  <span style="font-weight: 600; width: 60px; display: inline-block;">전 화</span>
                  <span>1661-5543</span>
                </div>
                <div>
                  <span style="font-weight: 600; width: 60px; display: inline-block;">팩 스</span>
                  <span>031-8077-2054</span>
                </div>
              </div>
            </td>
          </tr>

          <!-- 부착기간 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              부 착 기 간
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; text-align: center;">
              ${formatDate(data.subsidy_approval_date)} 부터 ${formatDate(endDate.toISOString())} 까지
            </td>
          </tr>

          <!-- 총 소요금액 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              총 소요금액
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; text-align: right;">
              ${data.government_notice_price.toLocaleString()} 원
            </td>
          </tr>

          <!-- 보조금 승인액 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              보조금 승인액
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; text-align: right;">
              ${data.subsidy_amount.toLocaleString()} 원
            </td>
          </tr>

          <!-- 자체부담액 -->
          <tr>
            <td style="padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              자체부담액
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; text-align: right;">
              ${data.self_payment.toLocaleString()} 원
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td colspan="4" style="padding: 24px 16px; border-top: 1px solid #000; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: none; text-align: center;">
              소규모 사업장 사물인터넷(IoT) 측정기기 부착지원 사업에 대하여 착공신고서를 제출합니다.
            </td>
          </tr>

          <!-- 날짜 및 서명 -->
          <tr>
            <td colspan="4" style="padding: 24px 16px; border-left: 1px solid #000; border-right: 1px solid #000; border-top: none; border-bottom: none; text-align: center;">
              <div style="margin-bottom: 24px;">${year} 년 ${month} 월 ${day} 일</div>
              <div style="margin-bottom: 16px;">
                신청인(대표자) ${data.business_name} ${formatNameWithSpaces(data.representative_name)} (인감도장)
              </div>
            </td>
          </tr>

          <!-- 수신자 -->
          <tr>
            <td colspan="4" style="padding: 16px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; border-top: none; font-weight: bold; text-align: left;">
              ${data.local_government_head} 귀하
            </td>
          </tr>

          <!-- 구비서류 -->
          <tr>
            <td style="width: 25%; padding: 12px 16px; border: 1px solid #000; background-color: #f3f4f6; font-weight: 600; text-align: center; vertical-align: top;">
              구비서류
            </td>
            <td colspan="3" style="padding: 12px 16px; border: 1px solid #000; vertical-align: top; font-size: 14px; line-height: 1.8;">
              <div style="margin-bottom: 6px;">1.대기배출시설 설치 허가(신고)증 사본 1부.</div>
              <div style="margin-bottom: 6px;">2.계약서(사본) 1부.</div>
              <div style="margin-bottom: 6px;">3.자부담금 입금 확인증 1부.</div>
              <div style="margin-bottom: 6px;">4.계약이행보증보험 1부.</div>
              <div style="margin-bottom: 0;">5.개선계획서(최종, 보완사항 포함) 1부.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
}

// Page 2: 계약서 (지자체 제출용)
export function generatePage2HTML(data: ConstructionReportData): string {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  const approvalDate = new Date(data.subsidy_approval_date)
  const endDate = new Date(approvalDate)
  endDate.setMonth(endDate.getMonth() + 3)

  const governmentPriceWithVat = Math.round(data.government_notice_price * 1.1)
  const selfPaymentWithVat = governmentPriceWithVat - data.subsidy_amount

  return `
    <div class="page">
      <div class="text-center mb-6">
        <h1 class="mb-2">소규모사업장 방지시설 지원사업 IoT 설치 계약서</h1>
        <p>(지자체 제출용)</p>
      </div>

      <p class="mb-4"><strong>${data.business_name}</strong> ( 이하 "갑" 이라 함 )과 <strong>주식회사 블루온</strong> ( 이하 "을" 이라 함 )은 제품 구매 및 설치 계약을 상호 존중 및 신의와 성실 원칙에 따라 다음과 같이 이행한다.</p>

      <h3 class="mt-4 mb-2">제 1 조 ( 설치 공사금액 )</h3>
      <p class="mb-2">공사금액은 하기와 같으며, 국고지원금을 제외한 자부담은 착공신고서 제출일에 을에게 지급해야 한다.</p>

      <table>
        <tr>
          <th>구분</th>
          <th>소요금액</th>
          <th>자부담</th>
          <th>사업비의 부가세</th>
          <th class="bg-pink">보조금지원</th>
          <th class="bg-lightblue">입금액</th>
        </tr>
        <tr>
          <td class="text-center">IoT 보조금</td>
          <td class="text-right">${data.government_notice_price.toLocaleString()}</td>
          <td class="text-right">${(data.government_notice_price - data.subsidy_amount).toLocaleString()}</td>
          <td class="text-right">${selfPaymentWithVat.toLocaleString()}</td>
          <td class="text-right bg-pink">${data.subsidy_amount.toLocaleString()}</td>
          <td class="text-right bg-lightblue">${data.deposit_amount.toLocaleString()}</td>
        </tr>
      </table>

      <p class="text-red mt-2 mb-4">※ 예금주 : 주식회사 블루온 / 기업은행 : 336-101191-04-015</p>

      <h3 class="mb-2">제 2 조 ( 설치 공사내역 )</h3>
      <p class="mb-2">설치내역은 하기와 같다.</p>

      <table>
        <tr>
          <th colspan="2">구분</th>
          <th>수량</th>
          <th>비고</th>
        </tr>
        <tr>
          <td colspan="2" class="text-center">Gateway</td>
          <td class="text-center">${data.gateway}대</td>
          <td class="text-center">${data.vpn_type === 'wired' ? '유선' : '무선'}</td>
        </tr>
        <tr>
          <td rowspan="2" class="text-center bg-gray" style="vertical-align: middle;">배출시설</td>
          <td class="text-center">전류계</td>
          <td class="text-center">${data.discharge_current_meter}대</td>
          <td></td>
        </tr>
        <tr>
          <td class="text-center">기타</td>
          <td class="text-center">0대</td>
          <td></td>
        </tr>
        <tr>
          <td rowspan="4" class="text-center bg-gray" style="vertical-align: middle;">방지시설</td>
          <td class="text-center">전류계</td>
          <td class="text-center">${data.prevention_current_meter}대</td>
          <td></td>
        </tr>
        <tr>
          <td class="text-center">차압계</td>
          <td class="text-center">${data.differential_pressure_meter}대</td>
          <td></td>
        </tr>
        <tr>
          <td class="text-center">온도계</td>
          <td class="text-center">${data.temperature_meter}대</td>
          <td></td>
        </tr>
        <tr>
          <td class="text-center">PH계</td>
          <td class="text-center">${data.ph_meter}대</td>
          <td></td>
        </tr>
      </table>

      ${data.prevention_facilities && data.prevention_facilities.length > 0 ? `
        <div class="mt-2 mb-4">
          <p class="text-bold">• 방지시설 정보:</p>
          ${data.prevention_facilities.map(f => `<p style="margin-left: 20px;">- ${f.facility_name}${f.capacity ? ` (${f.capacity})` : ''}${f.quantity > 0 ? ` × ${f.quantity}대` : ''}</p>`).join('')}
        </div>
      ` : ''}

      <h3 class="mb-2">제 3 조 ( 설치 공사기간 )</h3>
      <p class="mb-4">지자체 승인 후 30일 이내에 착공신고서를 제출하고, 공사 기간은 ${formatDate(data.subsidy_approval_date)} ~ ${formatDate(endDate.toISOString())}일 이내 공사를 완료하며, 설치 일정은 상호 협의하여 정한다.</p>

      <h3 class="mb-2">제 4 조 ( 계약이행보증보험 )</h3>
      <p class="mb-4">납품의 책임을 다하기 위해 계약이행보증보험을 발급하며 그 비율은 국가계약법에 의거하여 10%의 비율로 정한다.(부가세포함 <span class="text-blue">₩${governmentPriceWithVat.toLocaleString()})</span></p>

      <h3 class="mb-2">제 5 조 ( 품질보증 )</h3>
      <p class="mb-4">보증기간은 설치일로부터 2년간이며, 사용자의 귀책 및 천재지변에 의한 사항은 보증하지 아니한다.(총 공사금액 VAT 포함, 2년, 5%)</p>

      <p class="mb-6">본 계약을 확정하기 위하여 2부를 작성 상호 날인하며, 날인 시점을 확정 시점으로 하고, 이를 증거하기 위하여 각기 1부씩 보관하도록 한다.</p>

      <div class="text-center mb-6">
        <p>${year}년 ${month}월 ${day}일</p>
      </div>

      <table style="width: 100%; border: none; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 40px; border: none;">
            <p class="text-bold text-center mb-4">발주자(갑)</p>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>${data.address}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>${data.business_registration_number}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>${data.business_name}</strong>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>${formatNameWithSpaces(data.representative_name)}</strong>
              <span class="text-red" style="margin-left: 16px;">(인)</span>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 40px; border: none;">
            <p class="text-bold text-center mb-4">시공자(을)</p>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>경상북도 고령군 대가야읍 낫질로 285</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>679-86-02827</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>주식회사 블루온</strong>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>김 경 수</strong>
              <span class="text-red" style="margin-left: 16px;">(인)</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `
}

// Page 3: 계약서 (사업장 보관용)
export function generatePage3HTML(data: ConstructionReportData): string {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  const approvalDate = new Date(data.subsidy_approval_date)
  const endDate = new Date(approvalDate)
  endDate.setMonth(endDate.getMonth() + 3)

  const governmentPriceWithVat = Math.round(data.government_notice_price * 1.1)
  const selfPaymentWithVat = governmentPriceWithVat - data.subsidy_amount

  const facilityName = data.prevention_facilities && data.prevention_facilities.length > 0
    ? data.prevention_facilities[0].facility_name
    : '방지시설명'

  return `
    <div class="page">
      <div class="text-center mb-6">
        <h1 class="mb-2">소규모사업장 방지시설 지원사업 IoT 설치 계약서</h1>
        <p>(사업장 보관용)</p>
      </div>

      <p class="mb-4"><strong>${data.business_name}</strong> ( 이하 "갑" 이라 함 )과 <strong>주식회사 블루온</strong> ( 이하 "을" 이라 함 )은 제품 구매 및 설치 계약을 상호 존중 및 신의와 성실 원칙에 따라 다음과 같이 이행한다.</p>

      <h3 class="mt-4 mb-2">제 1 조 ( 설치 공사금액 )</h3>
      <p class="mb-2">공사금액은 하기와 같으며, 국고지원금을 제외한 자부담은 착공신고서 제출일에 을에게 지급해야 한다. <span class="text-blue">(자체 투자비와 공사비 및 자재비는 공사전 입금을 원칙으로 함.)</span></p>

      <table>
        <tr>
          <th>구분</th>
          <th>공급금액</th>
          <th>부가세</th>
          <th class="bg-pink">보조금지원</th>
          <th class="bg-lightblue">입금액</th>
        </tr>
        <tr>
          <td class="text-center">IoT 보조금</td>
          <td class="text-right">${data.government_notice_price.toLocaleString()}</td>
          <td class="text-right">${selfPaymentWithVat.toLocaleString()}</td>
          <td class="text-right bg-pink">${data.subsidy_amount.toLocaleString()}</td>
          <td class="text-right bg-lightblue">${data.deposit_amount.toLocaleString()}</td>
        </tr>
        ${data.additional_cost && data.additional_cost > 0 ? `
        <tr>
          <td class="text-center">추가비용</td>
          <td class="text-right">${data.additional_cost.toLocaleString()}</td>
          <td class="text-right">${Math.round(data.additional_cost * 0.1).toLocaleString()}</td>
          <td class="text-center">-</td>
          <td class="text-right bg-lightblue">${(data.additional_cost + Math.round(data.additional_cost * 0.1)).toLocaleString()}</td>
        </tr>
        ` : ''}
        ${data.negotiation_cost && data.negotiation_cost > 0 ? `
        <tr>
          <td class="text-center">네고금액</td>
          <td class="text-right">${data.negotiation_cost.toLocaleString()}</td>
          <td class="text-right">${Math.round(data.negotiation_cost * 0.1).toLocaleString()}</td>
          <td class="text-center">-</td>
          <td class="text-right bg-lightblue">${(data.negotiation_cost + Math.round(data.negotiation_cost * 0.1)).toLocaleString()}</td>
        </tr>
        ` : ''}
      </table>

      <p class="text-red mt-2">※ 예금주 : 주식회사 블루온 / 기업은행 : 336-101191-04-015</p>
      <p class="text-blue mb-4">(입금시 보조금 자부담+부가세 비용과 / 기타비용 따로 입금, 자부담 입금 확인증 필요)</p>

      <h3 class="mb-2">제 2 조 ( 설치 공사내역 )</h3>
      <p class="mb-2">설치내역은 하기와 같다.</p>

      <table>
        <tr>
          <th>구분/수량</th>
          <th>게이트웨이(VPN)</th>
          <th colspan="2" class="text-bold">전류계</th>
          <th>차압계</th>
          <th>온도계</th>
          <th>PH계</th>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <th class="bg-gray">배출</th>
          <th class="bg-gray">방지</th>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="text-center">${facilityName}</td>
          <td class="text-center">${data.gateway}대(${data.vpn_type === 'wired' ? '유선' : '무선'})</td>
          <td class="text-center">${data.discharge_current_meter}대</td>
          <td class="text-center">${data.prevention_current_meter}대</td>
          <td class="text-center">${data.differential_pressure_meter}대</td>
          <td class="text-center">${data.temperature_meter}대</td>
          <td class="text-center">${data.ph_meter}대</td>
        </tr>
        <tr>
          <td class="text-center">계</td>
          <td class="text-center">${data.gateway}대(${data.vpn_type === 'wired' ? '유선' : '무선'})</td>
          <td class="text-center">${data.discharge_current_meter}대</td>
          <td class="text-center">${data.prevention_current_meter}대</td>
          <td class="text-center">${data.differential_pressure_meter}대</td>
          <td class="text-center">${data.temperature_meter}대</td>
          <td class="text-center">${data.ph_meter}대</td>
        </tr>
      </table>

      <h3 class="mb-2 mt-4">제 3 조 ( 설치 공사기간 )</h3>
      <p class="mb-4">지자체 승인 후 30일 이내에 착공신고서를 제출하고, 공사 기간은 ${formatDate(data.subsidy_approval_date)} ~ ${formatDate(endDate.toISOString())}일 이내 공사를 완료하며, 설치 일정은 상호 협의하여 정한다.</p>

      <h3 class="mb-2">제 4 조 ( 계약이행보증보험 )</h3>
      <p class="mb-4">납품의 책임을 다하기 위해 계약이행보증보험을 발급하며 그 비율은 국가계약법에 의거하여 10%의 비율로 정한다.</p>

      <h3 class="mb-2">제 5 조 ( 품질보증 )</h3>
      <p class="mb-4">보증기간은 설치일로부터 2년간이며, 사용자의 귀책 및 천재지변에 의한 사항은 보증하지 아니한다.</p>

      <p class="mb-6">본 계약을 확정하기 위하여 2부를 작성 상호 날인하며, 날인 시점을 확정 시점으로 하고, 이를 증거하기 위하여 각기 1부씩 보관하도록 한다.</p>

      <div class="text-center mb-6">
        <p>${year}년 ${month}월 ${day}일</p>
      </div>

      <table style="width: 100%; border: none; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 40px; border: none;">
            <p class="text-bold text-center mb-4">발주자(갑)</p>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>${data.address}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>${data.business_registration_number}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>${data.business_name}</strong>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>${formatNameWithSpaces(data.representative_name)}</strong>
              <span class="text-red" style="margin-left: 16px;">(인)</span>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 40px; border: none;">
            <p class="text-bold text-center mb-4">시공자(을)</p>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>경상북도 고령군 대가야읍 낫질로 285</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <span>679-86-02827</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>주식회사 블루온</strong>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 33%;"></span>
              <strong>김 경 수</strong>
              <span class="text-red" style="margin-left: 16px;">(인)</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `
}

// Page 4: 개선계획서
export function generatePage4HTML(data: ConstructionReportData): string {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  return `
    <div class="page">
      <!-- 전체를 하나의 큰 테이블로 구성 -->
      <table style="width: 100%; border: none; border-collapse: collapse;">
        <tbody>
          <!-- 제목 행 -->
          <tr>
            <td colspan="5" style="border-top: none; border-left: none; border-right: none; border-bottom: 1px solid #000; padding: 24px 16px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">개선 계획서</h1>
            </td>
          </tr>

          <!-- 기본 정보 행 1 -->
          <tr>
            <th style="width: 18%; border: 1px solid #000; padding: 12px 16px; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              신청(배출)업체
            </th>
            <td style="width: 25%; border: 1px solid #000; padding: 12px 16px; text-align: center;">
              ${data.business_name}
            </td>
            <th rowspan="2" style="width: 18%; border: 1px solid #000; padding: 12px 16px; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              총 소요금액<br/>(보조금)
            </th>
            <td style="width: 27%; border: 1px solid #000; padding: 12px 16px; text-align: center;">
              ${data.government_notice_price.toLocaleString()}원
            </td>
            <th rowspan="2" style="width: 12%; border: 1px solid #000; padding: 12px 16px; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              (vat<br/>제외)
            </th>
          </tr>

          <!-- 기본 정보 행 2 -->
          <tr>
            <th style="border: 1px solid #000; padding: 12px 16px; background-color: #f3f4f6; font-weight: 600; text-align: center;">
              환경전문공사업체
            </th>
            <td style="border: 1px solid #000; padding: 12px 16px; text-align: center;">
              주식회사 블루온
            </td>
            <td style="border: 1px solid #000; padding: 12px 16px; text-align: center; background-color: #fffacd;">
              <span style="font-weight: bold;">${data.subsidy_amount.toLocaleString()}원</span>
            </td>
          </tr>

          <!-- 본문 내용 행 (전체 셀 병합) - 좌우 테두리 표시 -->
          <tr>
            <td colspan="5" style="padding: 24px; border-top: none; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: none;">
              <div style="line-height: 1.6;">
                <!-- 1. 설치 전 -->
                <div style="margin-bottom: 24px;">
                  <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 12px;">1. 사물인터넷(IoT) 측정기기 설치 전</h3>
                  <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">방지시설 가동여부 : 배출시설 업체에 기록된 적산 전력량 기록지 확인</li>
                    <li>방지시설 상태정보 : 육안 식별 및 청각 식별(현장 방문 후 필터 및 활성탄)</li>
                  </ul>
                </div>

                <!-- 2. 설치 후 -->
                <div style="margin-bottom: 24px;">
                  <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 12px;">2. 사물인터넷(IoT) 측정기기 설치 후</h3>
                  <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">
                      방지시설 가동여부: 송풍기 전류계 설치로 데이터 전송
                      <br />
                      <span style="margin-left: 24px; font-size: 13px; color: #666;">
                        (환경공단 소규모 대기배출시설관리시스템(greenlink.or.kr)확인 가능
                      </span>
                    </li>
                    <li>
                      방지시설 상태정보 : 차압계 설치, 배출닥트 출구 온도계 설치로 데이터 전송
                      <br />
                      <span style="margin-left: 24px; font-size: 13px; color: #666;">
                        (환경공단 소규모대기배출시설관리시스템(greenlink.or.kr)확인 가능
                      </span>
                    </li>
                  </ul>
                </div>

                <!-- 3. 추가 조치 -->
                <div>
                  <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 12px;">3. 추가 조치 사항</h3>
                  <p style="padding-left: 16px; line-height: 1.6; margin: 0;">
                    사물인터넷(IoT) 측정기기를 현장조사 후 적정 설치할 것이며 추가 및 변경사항
                    (데이터 전송, 측정기기 추가 설치 등) 발생 시, 환경전문공사업체 측에서 소요금액 부담 및
                    추가 조치토록 하겠습니다.
                  </p>
                </div>
              </div>
            </td>
          </tr>

          <!-- 날짜 행 -->
          <tr>
            <td colspan="5" style="padding: 32px 16px; text-align: center; border-top: none; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: none;">
              <p style="font-size: 18px; font-weight: bold; margin: 0;">${year}. ${month}. ${day}.</p>
            </td>
          </tr>

          <!-- 서명란 행 1 -->
          <tr>
            <td colspan="5" style="padding: 24px; border-top: none; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: none;">
              <div style="display: flex; align-items: center;">
                <span style="width: 192px; font-weight: 600;">신청(배출)업체 :</span>
                <span style="flex: 1;">
                  <span style="font-weight: bold;">${data.business_name}</span>
                  <span style="margin-left: 16px;">대표</span>
                  <span style="margin-left: 8px; font-weight: bold;">${formatNameWithSpaces(data.representative_name)}</span>
                  <span style="margin-left: 16px; color: #ff0000;">(인)</span>
                </span>
              </div>
            </td>
          </tr>

          <!-- 서명란 행 2 -->
          <tr>
            <td colspan="5" style="padding: 24px; border-top: none; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: none;">
              <div style="display: flex; align-items: center;">
                <span style="width: 192px; font-weight: 600;">환경전문공사업체 :</span>
                <span style="flex: 1;">
                  <span style="font-weight: bold;">주식회사 블루온</span>
                  <span style="margin-left: 16px;">대표</span>
                  <span style="margin-left: 8px; font-weight: bold;">김 경 수</span>
                  <span style="margin-left: 16px; color: #ff0000;">(인)</span>
                </span>
              </div>
            </td>
          </tr>

          <!-- 수신자 행 -->
          <tr>
            <td colspan="5" style="padding: 32px 24px; border-top: none; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000;">
              <p style="font-weight: bold; font-size: 18px; margin: 0;">${data.local_government_head} 귀하</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
}

// 전체 HTML 문서 생성
export function generateFullHTML(data: ConstructionReportData): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>착공신고서 - ${data.business_name}</title>
  <style>
    ${baseStyles}
    @media print {
      .page {
        page-break-after: always;
      }
      .page:last-child {
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  ${generatePage1HTML(data)}
  ${generatePage2HTML(data)}
  ${generatePage3HTML(data)}
  ${generatePage4HTML(data)}
</body>
</html>
  `
}
