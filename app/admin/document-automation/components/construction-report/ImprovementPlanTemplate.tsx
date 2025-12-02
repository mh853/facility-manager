// app/admin/document-automation/components/construction-report/ImprovementPlanTemplate.tsx
'use client'

interface ImprovementPlanTemplateProps {
  data: {
    business_name: string
    government_notice_price: number
    subsidy_amount: number
    representative_name: string
    local_government_head: string
    report_date: string
  }
}

export default function ImprovementPlanTemplate({ data }: ImprovementPlanTemplateProps) {
  const reportDate = new Date(data.report_date)
  const year = reportDate.getFullYear()
  const month = reportDate.getMonth() + 1
  const day = reportDate.getDate()

  // 성명에 글자 사이 공백 추가 (예: "김유정" → "김 유 정")
  const formatNameWithSpaces = (name: string) => {
    if (!name) return ''
    return name.split('').join(' ')
  }

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Malgun Gothic, sans-serif' }}>
      {/* 전체를 하나의 큰 테이블로 구성 */}
      <table className="w-full" style={{ borderCollapse: 'collapse', border: 'none' }}>
        <tbody>
          {/* 제목 행 */}
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid black' }}>
              <h1 className="text-2xl font-bold">개선 계획서</h1>
            </td>
          </tr>

          {/* 기본 정보 행 1 */}
          <tr>
            <th className="border border-black px-4 py-3 bg-gray-200 font-semibold text-center" style={{ width: '18%' }}>
              신청(배출)업체
            </th>
            <td className="border border-black px-4 py-3 text-center" style={{ width: '25%' }}>
              {data.business_name}
            </td>
            <th className="border border-black px-4 py-3 bg-gray-200 font-semibold text-center" style={{ width: '18%' }} rowSpan={2}>
              총 소요금액<br/>(보조금)
            </th>
            <td className="border border-black px-4 py-3 text-center" style={{ width: '27%' }}>
              {data.government_notice_price.toLocaleString()}원
            </td>
            <th className="border border-black px-4 py-3 bg-gray-200 font-semibold text-center" style={{ width: '12%' }} rowSpan={2}>
              (vat<br/>제외)
            </th>
          </tr>

          {/* 기본 정보 행 2 */}
          <tr>
            <th className="border border-black px-4 py-3 bg-gray-200 font-semibold text-center">
              환경전문공사업체
            </th>
            <td className="border border-black px-4 py-3 text-center">
              주식회사 블루온
            </td>
            <td className="border border-black px-4 py-3 text-center" style={{ backgroundColor: '#fffacd' }}>
              <span className="font-bold">{data.subsidy_amount.toLocaleString()}원</span>
            </td>
          </tr>

          {/* 본문 내용 행 (전체 셀 병합) */}
          <tr>
            <td colSpan={5} className="px-6 py-6" style={{ borderTop: 'none', borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: 'none' }}>
              <div className="space-y-6 leading-relaxed">
                {/* 1. 설치 전 */}
                <div>
                  <h3 className="font-bold text-base mb-3">1. 사물인터넷(IoT) 측정기기 설치 전</h3>
                  <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>방지시설 가동여부 : 배출시설 업체에 기록된 적산 전력량 기록지 확인</li>
                    <li>방지시설 상태정보 : 육안 식별 및 청각 식별(현장 방문 후 필터 및 활성탄)</li>
                  </ul>
                </div>

                {/* 2. 설치 후 */}
                <div>
                  <h3 className="font-bold text-base mb-3">2. 사물인터넷(IoT) 측정기기 설치 후</h3>
                  <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>
                      방지시설 가동여부: 송풍기 전류계 설치로 데이터 전송
                      <br />
                      <span className="ml-6 text-sm text-gray-700">
                        (환경공단 소규모 대기배출시설관리시스템(greenlink.or.kr)확인 가능
                      </span>
                    </li>
                    <li>
                      방지시설 상태정보 : 차압계 설치, 배출닥트 출구 온도계 설치로 데이터 전송
                      <br />
                      <span className="ml-6 text-sm text-gray-700">
                        (환경공단 소규모대기배출시설관리시스템(greenlink.or.kr)확인 가능
                      </span>
                    </li>
                  </ul>
                </div>

                {/* 3. 추가 조치 */}
                <div>
                  <h3 className="font-bold text-base mb-3">3. 추가 조치 사항</h3>
                  <p className="pl-4 leading-relaxed">
                    사물인터넷(IoT) 측정기기를 현장조사 후 적정 설치할 것이며 추가 및 변경사항
                    (데이터 전송, 측정기기 추가 설치 등) 발생 시, 환경전문공사업체 측에서 소요금액 부담 및
                    추가 조치토록 하겠습니다.
                  </p>
                </div>
              </div>
            </td>
          </tr>

          {/* 날짜 행 */}
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center" style={{ borderTop: 'none', borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: 'none' }}>
              <p className="text-lg font-bold">{year}. {month}. {day}.</p>
            </td>
          </tr>

          {/* 서명란 행 1 */}
          <tr>
            <td colSpan={5} className="px-6 py-6" style={{ borderTop: 'none', borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: 'none' }}>
              <div className="flex items-center">
                <span className="w-48 font-semibold">신청(배출)업체 :</span>
                <span className="flex-1">
                  <span className="font-bold">{data.business_name}</span>
                  <span className="ml-4">대표</span>
                  <span className="ml-2 font-bold">{formatNameWithSpaces(data.representative_name)}</span>
                  <span className="ml-4 text-red-600">(인)</span>
                </span>
              </div>
            </td>
          </tr>

          {/* 서명란 행 2 */}
          <tr>
            <td colSpan={5} className="px-6 py-6" style={{ borderTop: 'none', borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: 'none' }}>
              <div className="flex items-center">
                <span className="w-48 font-semibold">환경전문공사업체 :</span>
                <span className="flex-1">
                  <span className="font-bold">주식회사 블루온</span>
                  <span className="ml-4">대표</span>
                  <span className="ml-2 font-bold">김 경 수</span>
                  <span className="ml-4 text-red-600">(인)</span>
                </span>
              </div>
            </td>
          </tr>

          {/* 수신자 행 */}
          <tr>
            <td colSpan={5} className="px-6 py-8" style={{ borderTop: 'none', borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: '1px solid black' }}>
              <p className="font-bold text-lg">{data.local_government_head} 귀하</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
