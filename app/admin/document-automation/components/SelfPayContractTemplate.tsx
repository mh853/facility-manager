// app/admin/document-automation/components/SelfPayContractTemplate.tsx
'use client'

import React from 'react'
import { ContractData } from '@/utils/contractPdfGenerator'

interface Props {
  data: ContractData
}

export default function SelfPayContractTemplate({ data }: Props) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}년 ${month}월 ${day}일`
  }

  const formatNameWithSpaces = (name: string) => {
    return name.split('').join(' ')
  }

  // 설치 종료일 계산 (계약일로부터 1달 후)
  const calculateInstallationEndDate = (startDateStr: string) => {
    const startDate = new Date(startDateStr)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const month = endDate.getMonth() + 1
    const day = endDate.getDate()
    return `${month}월 ${day}일`
  }

  // 대금 결제 비율 (기본값 50/50) - 최종 매출 기준
  const finalAmount = data.final_amount || data.total_amount
  const advanceRatio = data.payment_advance_ratio || 50
  const balanceRatio = data.payment_balance_ratio || 50
  const advanceAmount = Math.round((finalAmount * advanceRatio) / 100)
  const balanceAmount = Math.round((finalAmount * balanceRatio) / 100)

  // 장비 수량 (기본값 0)
  const equipment = data.equipment_counts || {
    ph_meter: 0,
    differential_pressure_meter: 0,
    temperature_meter: 0,
    discharge_current_meter: 0,
    fan_current_meter: 0,
    pump_current_meter: 0,
    gateway: 0,
    vpn: 0
  }

  // 송풍전류계+펌프전류계 합계
  const fanPumpTotal = equipment.fan_current_meter + equipment.pump_current_meter

  return (
    <div className="contract-template bg-white max-w-[210mm] mx-auto" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 페이지 1 - 공급계약서 표 */}
      <div className="page-1 p-4">
        {/* 제목 및 갑/을 정보 통합 테이블 */}
        <table className="w-full border-2 border-black border-collapse text-sm">
          <tbody>
            {/* 제목 행 */}
            <tr>
              <td colSpan={3} className="border-b-2 border-black py-4">
                <h1 className="text-2xl font-bold text-center">공급계약서</h1>
              </td>
            </tr>

            {/* 갑 정보 */}
            <tr>
              <td rowSpan={6} className="border-r-2 border-b border-black w-16 text-center font-bold align-middle bg-gray-50">갑</td>
              <td className="border-r border-b border-black px-3 py-2 w-32 bg-gray-50">상호</td>
              <td className="border-b border-black px-3 py-2">{data.business_name}</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">주소</td>
              <td className="border-b border-black px-3 py-2">{data.business_address}</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">성명</td>
              <td className="border-b border-black px-3 py-2">{formatNameWithSpaces(data.business_representative)}</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">사업자등록번호</td>
              <td className="border-b border-black px-3 py-2">{data.business_registration_number || '000-00-00000'}</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">전화번호</td>
              <td className="border-b border-black px-3 py-2">{data.business_phone || '000-0000-0000'}</td>
            </tr>
            <tr>
              <td className="border-r border-b-2 border-black px-3 py-2 bg-gray-50">팩스번호</td>
              <td className="border-b-2 border-black px-3 py-2">{data.business_fax || '000-0000-0000'}</td>
            </tr>

            {/* 을 정보 */}
            <tr>
              <td rowSpan={6} className="border-r-2 border-b border-black text-center font-bold align-middle bg-gray-50">을</td>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">상호</td>
              <td className="border-b border-black px-3 py-2">주식회사 블루온</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">주소</td>
              <td className="border-b border-black px-3 py-2">경상북도 고령군 대가야읍 낫질로 285</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">성명</td>
              <td className="border-b border-black px-3 py-2">{formatNameWithSpaces(data.supplier_representative)}</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">사업자등록번호</td>
              <td className="border-b border-black px-3 py-2">679-86-02827</td>
            </tr>
            <tr>
              <td className="border-r border-b border-black px-3 py-2 bg-gray-50">전화번호</td>
              <td className="border-b border-black px-3 py-2">1661-5543</td>
            </tr>
            <tr>
              <td className="border-r border-black px-3 py-2 bg-gray-50">팩스번호</td>
              <td className="px-3 py-2">031-8077-2054</td>
            </tr>
          </tbody>
        </table>

        {/* 계약 조건 및 날짜 통합 칸 */}
        <table className="w-full border-2 border-black border-t-0 border-collapse text-sm">
          <tbody>
            <tr>
              <td className="px-4 py-3">
                <div className="space-y-2">
                  <p>1. 무선통신 1기 적용조건(KT 5년 약정, 14,000원 부가세 별도)</p>
                  <p>2. 선금금 {advanceRatio}%(<span className="text-red-600">입금 확인 후 발주 진행</span>), 부착완료 후 {balanceRatio}%</p>
                  <p>3. 부착완료신고서 및 그린링크 전송확인서는 설치완료(<span className="text-red-600">입금 확인 후</span>) 7일 이내 제출</p>
                  <div className="mt-4 text-right text-base">
                    <p>{formatDate(data.contract_date)}</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 서명란 */}
        <table className="w-full border-2 border-black border-t-0 border-collapse">
          <tbody>
            <tr className="border-b border-black">
              <td className="border-r-2 border-black w-16 text-center py-4 font-bold">"갑"</td>
              <td className="text-center py-4 font-bold">{data.business_name}</td>
              <td className="border-l-2 border-black w-16 text-center py-4 font-bold">"을"</td>
              <td className="text-center py-4 font-bold">{data.supplier_company_name}</td>
            </tr>
            <tr>
              <td className="border-r-2 border-black text-center py-6 font-bold">성명</td>
              <td className="text-center py-6">
                <span className="text-lg">{formatNameWithSpaces(data.business_representative)}</span>
                <span className="ml-4">(인)</span>
              </td>
              <td className="border-l-2 border-black text-center py-6 font-bold">성명</td>
              <td className="text-center py-6">
                <span className="text-lg">{formatNameWithSpaces(data.supplier_representative)}</span>
                <span className="ml-4 text-red-600">(인)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="page-break"></div>

      {/* 페이지 2 - 계약 조항 */}
      <div className="page-2 p-4">
        {/* 제목 */}
        <h1 className="text-2xl font-bold text-center mb-8">공급계약서</h1>

        {/* 서문 */}
        <p className="mb-8 text-base leading-relaxed">
          <strong>{data.business_name}</strong> (이하 "갑"이라 함) 과 <strong>{data.supplier_company_name}</strong>(이하 "을"이라 함)은 제품 설치
          계약을 상호 이익 준중 및 신의 신뢰와 성실 및 헌책에 따라 다음과 같이 이행한다.
        </p>

        {/* 제1조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 1조 ( 목적 )</h2>
          <p className="text-base leading-relaxed ml-4">
            1. "갑"이 구매를 의뢰하여 "을"이 제작하여 "갑"에게 설치 공급하고 상호 협조를 통하여
            하기의 본 계약사항 같이 성실히 준수하여, 상호 회사의 이익과 발전에 이바지함을
            목적으로 한다.
          </p>
        </div>

        {/* 제2조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 2조 ( 계약 내용 및 납품 설치기간 )</h2>
          <div className="ml-4 space-y-2">
            <p className="text-base leading-relaxed">
              1. "을"은 "갑"이 의뢰한 방지시설 IoT 설비의 납품 및 제작 설치를 수행한다.
            </p>
            <p className="text-base leading-relaxed">
              2. 설치는 {formatDate(data.contract_date)}부터 {calculateInstallationEndDate(data.contract_date)}까지 하며,
              구체 일정은 쌍방의 협의에 맞게 협의한다.
            </p>
          </div>
        </div>

        {/* 제3조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 3조 ( 금액 )</h2>
          <p className="text-base mb-3 ml-4">
            IoT 장비 설치관련 총 금액은 <span className="text-red-600 font-bold">₩{formatCurrency(data.final_amount || data.total_amount)}</span> 원으로 다음과 같다.<span className="text-red-600">(VAT 별도)</span>
          </p>
          <table className="w-full border-collapse border border-black ml-4" style={{ width: 'calc(100% - 1rem)' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border-r border-black px-2 py-2 text-sm">IoT 구성</th>
                <th className="border-r border-black px-2 py-2 text-sm">PH계</th>
                <th className="border-r border-black px-2 py-2 text-sm">차압계</th>
                <th className="border-r border-black px-2 py-2 text-sm">온도계</th>
                <th className="border-r border-black px-2 py-2 text-sm">배출전류계</th>
                <th className="border-r border-black px-2 py-2 text-sm">송풍전류계+펌프전류계</th>
                <th className="border-r border-black px-2 py-2 text-sm">게이트웨이</th>
                <th className="border-r border-black px-2 py-2 text-sm">VPN</th>
                <th className="px-2 py-2 text-sm">금액 계</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black px-2 py-2 text-center text-sm">수량</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.ph_meter}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.differential_pressure_meter}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.temperature_meter}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.discharge_current_meter}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{fanPumpTotal}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.gateway}</td>
                <td className="border-r border-black px-2 py-2 text-center text-sm">{equipment.vpn}</td>
                <td className="px-2 py-2 text-center text-sm font-bold text-red-600">₩{formatCurrency(data.total_amount)}</td>
              </tr>
              <tr className="border-b border-black">
                <td colSpan={8} className="border-r border-black px-2 py-2 text-sm">추가공사비</td>
                <td className="px-2 py-2 text-center text-sm">₩{formatCurrency(data.additional_cost || 0)}</td>
              </tr>
              <tr>
                <td colSpan={8} className="border-r border-black px-2 py-2 text-sm">협의사항(네고)</td>
                <td className="px-2 py-2 text-center text-sm">₩{formatCurrency(data.negotiation_cost || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 제4조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 4조 ( 대금 결제 )</h2>
          <div className="ml-4 space-y-3">
            <p className="text-base leading-relaxed">
              1. "갑"은 "을"에게 발주 시 <span className="text-red-600 font-bold">₩{formatCurrency(advanceAmount)}</span> 지급하고,
              부착완료 후 잔금 <span className="text-red-600 font-bold">₩{formatCurrency(balanceAmount)}</span> 을 7일 이내 지급한다.
              <span className="text-red-600">(VAT 별도)</span>
            </p>
            <p className="text-blue-600 font-bold">[기업은행 336-101191-04015 {data.supplier_company_name}]</p>
            <p className="text-base leading-relaxed">
              2. "을"은 설치 완료(입금확인 후)일로부터 7일 이내에 아래 보고서류를 "갑"에게 제출한다.
            </p>
          </div>
        </div>
      </div>

      <div className="page-break"></div>

      {/* 페이지 3 - 나머지 조항 */}
      <div className="page-3 p-4">
        <div className="ml-8 space-y-2 mb-6 text-sm">
          <p>(1) 신호기기 부착완료 신고서</p>
          <p>(2) 그린링크 전송확인서</p>
        </div>

        {/* 제5조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 5조 ( 하자 보증 )</h2>
          <div className="ml-4 space-y-2">
            <p className="text-base leading-relaxed">
              1. 무상하자 보증 기간은 납품일로부터 24개월로 정한다.
            </p>
            <p className="text-base leading-relaxed">
              2. 보증기간 내에 발생되는 하자에 대하여 수리 및 교환을 하며, 사용상 부주의 및 "갑"의
              책임에 의한 하자, 천재 지변은 유상 수리한다.
            </p>
          </div>
        </div>

        {/* 제6조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 6조 ( 권리 약무사항 )</h2>
          <p className="text-base leading-relaxed ml-4">
            1. 본 계약의 이행에 의한 성과물의 소유권은 "갑"에게 귀속된다.
          </p>
        </div>

        {/* 제7조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 7조 ( 계약 해지 )</h2>
          <div className="ml-4 space-y-2">
            <p className="text-base leading-relaxed">
              "갑" 또는 "을"은 상대방이 다음의 각 항목 중 하나에 해당할 때에는 어떤 최고통지를 하지
              않고 곧 바로 본 계약을 해지할 수 있다.
            </p>
            <p className="text-base leading-relaxed ml-4">
              1. 파산, 화의 또는 회사정리의 신청을 하거나 이들의 신청이 이루어졌을 때
            </p>
            <p className="text-base leading-relaxed ml-4">
              2. 타회사의 합병 등의 사유로 물품 대금 결재할 수 없을 때
            </p>
          </div>
        </div>

        {/* 제8조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 8조 ( 계약 유효 기간 )</h2>
          <p className="text-base leading-relaxed ml-4">
            1. 본 계약의 유효기간은 계약 체결 일로부터 12개월로 한다.
          </p>
        </div>

        {/* 제9조 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">제 9조 ( 기타 사항 )</h2>
          <p className="text-base leading-relaxed ml-4">
            1. 본 계약상에 명시되지 않은 사항 또는 계약 조항 해석에 이의가 있을 때는 "갑"과 "을"이
            협의하여 결정하고 협의가 이루어지지 않을 때는 일반 관례에 따른다.
          </p>
        </div>

        {/* 계약 확정 문구 */}
        <div className="mt-8 text-base leading-relaxed">
          <p>
            본 계약을 확정하기 위하여 2부를 작성 상호 날인하여 날인 시점을 확정 시점으로 하고, 이를
            증거하기 위하여 각기 1부씩 보관하도록 한다. 끝.
          </p>
        </div>
      </div>
    </div>
  )
}
