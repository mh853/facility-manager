// app/admin/document-automation/components/construction-report/ConstructionReportTemplate.tsx
'use client'

interface ConstructionReportTemplateProps {
  data: {
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
  }
}

export default function ConstructionReportTemplate({ data }: ConstructionReportTemplateProps) {
  // 날짜 파싱
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  // 부착기간 계산 (승인일 + 3개월)
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

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Malgun Gothic, sans-serif' }}>
      {/* 전체를 하나의 큰 표로 구성 (템플릿과 동일) */}
      <table className="w-full border-2 border-black" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {/* 제목 행 */}
          <tr>
            <td className="border border-black px-4 py-4 text-center" colSpan={4}>
              <div className="text-xl font-bold mb-1">사물인터넷(IoT) 측정기기 부착지원 사업</div>
              <div className="text-2xl font-bold">착 공 신 고 서</div>
            </td>
          </tr>

          {/* 사업장명 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center w-1/4">
              사 업 장 명
            </td>
            <td className="border border-black px-4 py-3 text-center" colSpan={3}>
              {data.business_name}
            </td>
          </tr>

          {/* 사업장소재지 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              사업장소재지
            </td>
            <td className="border border-black px-4 py-3" colSpan={2}>
              {data.address}
            </td>
            <td className="border border-black px-4 py-3" style={{ verticalAlign: 'top' }}>
              <div style={{ paddingTop: '8px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, width: '60px', display: 'inline-block' }}>전 화</span>
                  <span>{data.business_contact}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, width: '60px', display: 'inline-block' }}>팩 스</span>
                  <span>{data.fax_number}</span>
                </div>
              </div>
            </td>
          </tr>

          {/* 설치업체명 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              설치업체명
            </td>
            <td className="border border-black px-4 py-3 text-center" colSpan={3}>
              주식회사 블루온
            </td>
          </tr>

          {/* 시공업체 소재지 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              시공업체 소재지
            </td>
            <td className="border border-black px-4 py-3" colSpan={2}>
              경상북도 고령군 대가야읍 낫질로 285
            </td>
            <td className="border border-black px-4 py-3" style={{ verticalAlign: 'top' }}>
              <div style={{ paddingTop: '8px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, width: '60px', display: 'inline-block' }}>전 화</span>
                  <span>1661-5543</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, width: '60px', display: 'inline-block' }}>팩 스</span>
                  <span>031-8077-2054</span>
                </div>
              </div>
            </td>
          </tr>

          {/* 부착기간 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              부 착 기 간
            </td>
            <td className="border border-black px-4 py-3 text-center" colSpan={3}>
              {formatDate(approvalDate)} 부터 {formatDate(endDate)} 까지
            </td>
          </tr>

          {/* 총 소요금액 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              총 소요금액
            </td>
            <td className="border border-black px-4 py-3 text-right" colSpan={3}>
              {data.government_notice_price.toLocaleString()} 원
            </td>
          </tr>

          {/* 보조금 승인액 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              보조금 승인액
            </td>
            <td className="border border-black px-4 py-3 text-right" colSpan={3}>
              {data.subsidy_amount.toLocaleString()} 원
            </td>
          </tr>

          {/* 자체부담액 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center">
              자체부담액
            </td>
            <td className="border border-black px-4 py-3 text-right" colSpan={3}>
              {data.self_payment.toLocaleString()} 원
            </td>
          </tr>

          {/* 본문 */}
          <tr>
            <td className="border-t border-l border-r border-black px-4 py-6 text-center" colSpan={4}>
              소규모 사업장 사물인터넷(IoT) 측정기기 부착지원 사업에 대하여 착공신고서를 제출합니다.
            </td>
          </tr>

          {/* 날짜 및 서명 */}
          <tr>
            <td className="border-l border-r border-black px-4 py-6 text-center" colSpan={4}>
              <div className="mb-6">{year} 년 {month} 월 {day} 일</div>
              <div className="mb-4">
                신청인(대표자) {data.business_name} {formatNameWithSpaces(data.representative_name)} (인감도장)
              </div>
            </td>
          </tr>

          {/* 수신자 */}
          <tr>
            <td className="border-b border-l border-r border-black px-4 py-4 text-left font-bold" colSpan={4}>
              {data.local_government_head} 귀하
            </td>
          </tr>

          {/* 구비서류 */}
          <tr>
            <td className="border border-black px-4 py-3 bg-gray-100 font-semibold text-center w-1/4">
              구비서류
            </td>
            <td className="border border-black px-4 py-3" colSpan={3}>
              <ol className="list-decimal list-inside space-y-1">
                <li>대기배출시설 설치 허가(신고)증 사본 1부.</li>
                <li>계약서(사본) 1부.</li>
                <li>자부담금 입금 확인증 1부.</li>
                <li>계약이행보증보험 1부.</li>
                <li>개선계획서(최종, 보완사항 포함) 1부.</li>
              </ol>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
