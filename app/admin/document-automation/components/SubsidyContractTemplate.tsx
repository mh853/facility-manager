// app/admin/document-automation/components/SubsidyContractTemplate.tsx
'use client'

import React from 'react'
import { ContractData } from '@/utils/contractPdfGenerator'

interface Props {
  data: ContractData
}

export default function SubsidyContractTemplate({ data }: Props) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR')
  }

  const formatNameWithSpaces = (name: string) => {
    return name.split('').join(' ')
  }

  return (
    <div className="contract-template bg-white max-w-[210mm] mx-auto" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 페이지 1 */}
      <div className="page-1 p-4">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-4">소규모 방지시설 IoT 설치 계약서</h1>
          <div className="text-base space-y-1">
            <p>계약번호: {data.contract_number}</p>
            <p>체결일자: {data.contract_date}</p>
          </div>
        </div>

        {/* 제1조 (계약당사자) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제1조(계약당사자)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 본 계약은 다음 각 호의 당사자 간에 체결된다.</p>
            <div className="ml-4">
              <p className="mb-2">갑. (설치:공급자)</p>
              <p className="ml-4">상호: {data.supplier_company_name}</p>
              <p className="ml-4">대표자: {data.supplier_representative}</p>
              <p className="ml-4">소재지: {data.supplier_address}</p>
            </div>
            <div className="ml-4 mt-3">
              <p className="mb-2">을. (수요기관 또는 사업참여자)</p>
              <p className="ml-4">상호: {data.business_name}</p>
              <p className="ml-4">대표자: {data.business_representative}</p>
              <p className="ml-4">소재지: {data.business_address}</p>
            </div>
          </div>
        </div>

        {/* 제2조 (계약의 목적) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제2조(계약의 목적)</h2>
          <p className="text-base leading-relaxed">
            본 계약은 「대기환경보전법」 및 관련 지침에 따른 <strong>소규모 사업장 방지시설 IoT 원격운영관리 시스템</strong>(이하 "본 시스템")<strong>의 설치 및 유지관리를 통한 환경관리 효율화 및 지속적인 기술지원 체제를 구축하기 위한 것이다.</strong>
          </p>
        </div>

        {/* 제3조 (사업 연계 및 효력 유지) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제3조(사업 연계 및 효력 유지)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 본 사업은 정부 및 지방자치단체의 <strong>보조금지원사업</strong>(소규모 사업장 방지시설 지원사업)<strong>과 연계될 수 있다.</strong></p>
            <p>2. 보조금사업의 승인 여부, 예산 확보, 행정절차의 지연 등과 무관하게 본 계약의 효력은 유지되며, 을은 본 계약에 따른 설비 및 납품을 갑과 지속적으로 진행하여야 한다.</p>
            <p>3. 보조금이 승인될 경우, 지원금액은 갑이 지자체로부터 수령하며, 미승인 시에는 을이 전액 부담으로 동일 금액을 납부한다.</p>
            <p>4. 을은 보조금사업 미승인 등을 이유로 본 계약을 일방적으로 해지할 수 없다.</p>
            <p>5. 을은 사업장 폐쇄 및 인허가 변경으로인한 IOT의무설치 제외대상 될 경우 예외로 한다.</p>
          </div>
        </div>

        {/* 제4조 (계약기간) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제4조(계약기간)</h2>
          <p className="text-base leading-relaxed">
            1. 본 계약의 유효기간은 계약체결일로부터 26년12월31일까지 하며, 상호 합의에 따라 연장할 수 있다.
          </p>
        </div>

        {/* 제5조 (공급 및 설치 범위) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제5조(공급 및 설치 범위)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 갑은 본 시스템의 설계, 제작, 납품, 설치, 사용 및 검증을 일괄 수행한다.</p>
            <p>2. 구체적인 구성내역 및 설치 위치는 별첨 [시스템 구성 명세서], <strong>[설치계획서]</strong> 에 따른다.</p>
          </div>
        </div>
      </div>

      <div className="page-break"></div>

      {/* 페이지 2 */}
      <div className="page-2 p-4">
        {/* 제6조 (대금 및 지급조건) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제6조(대금 및 지급조건)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 본 계약의 총 계약금액은 <strong className="text-lg">{formatCurrency(data.total_amount)}원(부가가치세 별도)</strong>으로 한다.</p>
            <p>2. 대금은 계약금, 중도금, 잔금으로 구분하여 지급하며, 지급 일정은 별첨 <strong>[지급일정표]</strong> 에 따른다.</p>
            <p>3. 보조금이 지급되는 경우, 을은 보조금 수령 후 즉시 갑에게 지급하여야 하며, 보조금 미지급 시 을은 자체 부담으로 동일 금액을 납부한다.</p>
            <p>4. 을이 정당한 사유 없이 대금지급을 지연할 경우, 갑은 설치를 중단하거나 계약을 해지할 수 있다.</p>
          </div>
        </div>

        {/* 제7조 (유지보수 및 기술지원) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제7조(유지보수 및 기술지원)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 갑은 설치 완료 후 2년간 무상 유지보수를 제공한다.</p>
            <p>2. 무상 기간 경과 후에는 상호 협의하여 별도의 유지보수계약을 체결하며, 유상으로 관리한다.</p>
            <p>3. 갑은 시스템의 안정적 운용을 위해 원격진단, 프로그램 업데이트, 기술교육 등의 서비스를 제공한다.</p>
          </div>
        </div>

        {/* 제8조 (계약의 해제 및 해지) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제8조(계약의 해제 및 해지)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 을이 정당한 사유 없이 본 계약을 이행하지 않거나 대금지급을 지연할 경우, 갑은 서면통보 후 계약을 해지할 수 있다.</p>
            <p>2. 보조금사업의 미승인, 예산변경, 또는 사업 중단은 계약 해제의 사유가 되지 아니한다.</p>
            <p>3. 계약 해지 시, 이미 남품 또는 설치된 장비의 소유권은 갑에게 귀속되며, 을은 이에 대한 손해배상 책임을 부담한다.</p>
          </div>
        </div>

        {/* 제9조 (비밀유지 및 권리보호) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제9조(비밀유지 및 권리보호)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 을은 본 시스템의 구조, 기술사항, 프로그램 등 갑의 지식재산을 제3자에게 누설하거나 복제·이용할 수 없다.</p>
            <p>2. 본 시스템 관련 지식재산권은 갑에게 귀속된다.</p>
          </div>
        </div>

        {/* 제10조 (손해배상) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제10조(손해배상)</h2>
          <p className="text-base leading-relaxed">
            당사자 일방의 귀책사유로 인하여 계약이행이 불가능하게 된 경우, 해당 당사자는 상대방에게 발생한 손해를 배상하여야 한다.
          </p>
        </div>
      </div>

      <div className="page-break"></div>

      {/* 페이지 3 */}
      <div className="page-3 p-4">
        {/* 제11조 (불가항력) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">제11조(불가항력)</h2>
          <p className="text-base leading-relaxed">
            천재지변, 전쟁, 법령 개정, 정부 정책 변경 등 불가항력적인 사유로 인한 이행 불능 시, 당사자는 상호 협의하여 대체이행 또는 일정 변경을 조정한다.
          </p>
        </div>

        {/* 제12조 (관할법원) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3">제12조(관할법원)</h2>
          <div className="text-base leading-relaxed space-y-2">
            <p>1. 본 계약에 관한 분쟁이 발생할 경우, 갑의 본점 소재지를 관할하는 법원을 관할법원으로 한다.</p>
            <p>2. 본 계약의 중거로써, 계약서 2부를 작성하여 양 당사자가 각각 서명날인 후 1부석 보관한다.</p>
          </div>
        </div>

        {/* 서명란 */}
        <div className="signature-section mt-12 space-y-8">
          <p className="text-center text-lg font-semibold mb-6">갑 : 주식회사 블루온</p>

          <div className="text-center mb-16">
            <p className="text-lg font">대표이사: {formatNameWithSpaces(data.supplier_representative)} (인)</p>
          </div>

          <p className="text-center text-lg font-semibold mb-6">을 : {data.business_name}</p>

          <div className="text-center mt-8">
            <p className="text-lg font">대표이사: {formatNameWithSpaces(data.business_representative)} (인)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
