// app/admin/document-automation/components/construction-report/ContractGovernmentTemplate.tsx
'use client'

interface PreventionFacility {
  id: string
  facility_name: string
  capacity?: string
  quantity: number
}

interface ContractGovernmentTemplateProps {
  data: {
    business_name: string
    address: string
    business_registration_number: string
    representative_name: string
    subsidy_approval_date: string
    government_notice_price: number
    subsidy_amount: number
    self_payment: number
    deposit_amount: number
    prevention_facilities: PreventionFacility[]
    gateway: number
    vpn_type: string
    discharge_current_meter: number
    prevention_current_meter: number
    differential_pressure_meter: number
    temperature_meter: number
    ph_meter: number
    report_date: string
    contract_bond_rate?: string
  }
}

export default function ContractGovernmentTemplate({ data }: ContractGovernmentTemplateProps) {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  const approvalDate = new Date(data.subsidy_approval_date)
  const endDate = new Date(approvalDate)
  endDate.setMonth(endDate.getMonth() + 3)

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  // 성명에 글자 사이 공백 추가 (예: "김유정" → "김 유 정")
  const formatNameWithSpaces = (name: string) => {
    if (!name) return ''
    return name.split('').join(' ')
  }

  const vpnDisplay = data.vpn_type === 'wired' ? '유선' : '무선'
  const governmentPriceWithVat = Math.round(data.government_notice_price * 1.1)

  // 사용자 요청사항에 따른 계산
  const businessVat = Math.round(data.government_notice_price * 0.1) // 사업비의 부가세 = 환경부고시가 × 10%
  const depositAmountIot = data.self_payment + businessVat // IoT 입금액 = 자부담 + 사업비의 부가세

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Malgun Gothic, sans-serif' }}>
      {/* 제목 */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">소규모사업장 방지시설 지원사업 IoT 설치 계약서</h1>
        <p className="text-sm text-gray-600 mt-1">(지자체 제출용)</p>
      </div>

      {/* 서론 */}
      <div className="mb-6 leading-relaxed">
        <p>
          <span className="font-bold">{data.business_name}</span> ( 이하 "갑" 이라 함 )과{' '}
          <span className="font-bold">주식회사 블루온</span> ( 이하 "을" 이라 함 )은 제품 구매 및 설치 계약을
          상호 존중 및 신의와 성실 원칙에 따라 다음과 같이 이행한다.
        </p>
      </div>

      {/* 제 1 조 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3">제 1 조 ( 설치 공사금액 )</h3>
        <p className="mb-3 leading-relaxed pl-4">
          공사금액은 하기와 같으며, 국고지원금을 제외한 자부담은 착공신고서 제출일에 을에게 지급해야 한다.
        </p>

        <table className="w-full border border-black mb-3" style={{ borderCollapse: 'collapse' }}>
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black px-3 py-2 text-sm">구분</th>
              <th className="border border-black px-3 py-2 text-sm">소요금액</th>
              <th className="border border-black px-3 py-2 text-sm">자부담</th>
              <th className="border border-black px-3 py-2 text-sm">사업비의 부가세</th>
              <th className="border border-black px-3 py-2 text-sm text-red-600">보조금지원</th>
              <th className="border border-black px-3 py-2 text-sm text-blue-600">입금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2 text-sm text-center">IoT 보조금</td>
              <td className="border border-black px-3 py-2 text-sm text-right">
                {data.government_notice_price.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right">
                {data.self_payment.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right">
                {businessVat.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right text-red-600">
                {data.subsidy_amount.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right text-blue-600">
                {depositAmountIot.toLocaleString()}
              </td>
            </tr>
            <tr className="bg-yellow-50">
              <td className="border border-black px-3 py-2 text-sm text-center font-bold">계</td>
              <td className="border border-black px-3 py-2 text-sm text-right font-bold">
                {data.government_notice_price.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right font-bold">
                {data.self_payment.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right font-bold">
                {businessVat.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right font-bold text-red-600">
                {data.subsidy_amount.toLocaleString()}
              </td>
              <td className="border border-black px-3 py-2 text-sm text-right font-bold text-blue-600">
                {depositAmountIot.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-center text-red-600 font-semibold">
          ※ 예금주 : 주식회사 블루온 / 기업은행 : 336-101191-04-015
        </p>
      </div>

      {/* 제 2 조 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3">제 2 조 ( 설치 공사내역 ) 설치내역은 하기와 같다.</h3>

        <table className="w-full border border-black" style={{ borderCollapse: 'collapse' }}>
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black px-2 py-2 text-xs" rowSpan={2}>구분/수량</th>
              <th className="border border-black px-2 py-2 text-xs" rowSpan={2}>게이트웨이(VPN)</th>
              <th className="border border-black px-2 py-2 text-xs" colSpan={2}>전류계</th>
              <th className="border border-black px-2 py-2 text-xs" rowSpan={2}>차압계</th>
              <th className="border border-black px-2 py-2 text-xs" rowSpan={2}>온도계</th>
              <th className="border border-black px-2 py-2 text-xs" rowSpan={2}>PH계</th>
            </tr>
            <tr>
              <th className="border border-black px-2 py-1 text-xs">배출</th>
              <th className="border border-black px-2 py-1 text-xs">방지</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-2 text-xs">
                <div className="space-y-1">
                  {data.prevention_facilities && data.prevention_facilities.length > 0 ? (
                    data.prevention_facilities.map((facility, index) => (
                      <div key={facility.id || index}>
                        {facility.facility_name}
                        {facility.capacity && ` (${facility.capacity})`}
                        {facility.quantity > 0 && ` × ${facility.quantity}대`}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-xs">방지시설 정보 없음</div>
                  )}
                </div>
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.gateway}({vpnDisplay})
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.discharge_current_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.prevention_current_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.differential_pressure_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.temperature_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center">
                {data.ph_meter}
              </td>
            </tr>
            <tr className="bg-yellow-50">
              <td className="border border-black px-2 py-2 text-xs font-bold text-center">계</td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.gateway}({vpnDisplay})
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.discharge_current_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.prevention_current_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.differential_pressure_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.temperature_meter}
              </td>
              <td className="border border-black px-2 py-2 text-xs text-center font-bold">
                {data.ph_meter}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 제 3 조 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3">제 3 조 ( 설치 공사기간 )</h3>
        <p className="pl-4 leading-relaxed">
          지자체 승인 후 30일 이내에 착공신고서를 제출하고, 공사 기간은{' '}
          <span className="font-semibold">{formatDate(approvalDate)}</span>
          {' ~ '}
          <span className="font-semibold">{formatDate(endDate)}</span>일 이내 공사를 완료하며,
          설치 일정은 상호 협의하여 정한다.
        </p>
      </div>

      {/* 제 4 조 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3">제 4 조 ( 계약이행보증보험 )</h3>
        <p className="pl-4 leading-relaxed">
          납품의 책임을 다하기 위해 계약이행보증보험을 발급하며 그 비율은 국가계약법에 의거하여
          10%의 비율로 정한다.
          <span className="text-blue-600 font-semibold">
            (부가세포함 ₩{governmentPriceWithVat.toLocaleString()})
          </span>
        </p>
      </div>

      {/* 제 5 조 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3">제 5 조 ( 품질보증 )</h3>
        <p className="pl-4 leading-relaxed">
          보증기간은 설치일로부터 2년간이며, 사용자의 귀책 및 천재지변에 의한 사항은 보증하지 아니한다.
          (총 공사금액 VAT 포함, 2년, {data.contract_bond_rate || '5'}%)
        </p>
      </div>

      {/* 결어 */}
      <div className="mb-8 leading-relaxed">
        <p>
          본 계약을 확정하기 위하여 2부를 작성 상호 날인하며, 날인 시점을 확정 시점으로 하고,
          이를 증거하기 위하여 각기 1부씩 보관하도록 한다.
        </p>
      </div>

      {/* 날짜 */}
      <div className="text-center mb-8">
        <p className="text-lg font-bold">{year}년 {month}월 {day}일</p>
      </div>

      {/* 서명란 */}
      <div className="grid grid-cols-2 gap-8">
        {/* 발주자(갑) */}
        <div>
          <h4 className="font-bold text-center mb-4">발주자(갑)</h4>
          <div className="space-y-2">
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">{data.address}</span>
            </div>
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">{data.business_registration_number}</span>
            </div>
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1 font-bold">{data.business_name}</span>
            </div>
            <div className="flex items-center">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">
                <span className="font-bold">{formatNameWithSpaces(data.representative_name)}</span>
                <span className="ml-4 text-red-600">(인)</span>
              </span>
            </div>
          </div>
        </div>

        {/* 시공자(을) */}
        <div>
          <h4 className="font-bold text-center mb-4">시공자(을)</h4>
          <div className="space-y-2">
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">경상북도 고령군 대가야읍 낫질로 285</span>
            </div>
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">679-86-02827</span>
            </div>
            <div className="flex">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1 font-bold">주식회사 블루온</span>
            </div>
            <div className="flex items-center">
              <span className="w-4/12 font-semibold"></span>
              <span className="flex-1">
                <span className="font-bold">김 경 수</span>
                <span className="ml-4 text-red-600">(인)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
