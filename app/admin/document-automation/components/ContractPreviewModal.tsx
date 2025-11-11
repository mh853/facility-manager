// app/admin/document-automation/components/ContractPreviewModal.tsx
'use client'

import { useState, useRef } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import SubsidyContractTemplate from './SubsidyContractTemplate'
import SelfPayContractTemplate from './SelfPayContractTemplate'
import { generateContractPDF, downloadPDF, ContractData } from '@/utils/contractPdfGenerator'

interface Contract {
  id: string
  business_id: string
  business_name: string
  contract_type: 'subsidy' | 'self_pay'
  contract_number: string
  contract_date: string
  total_amount: number
  base_revenue?: number  // 기본 매출 (기기 합계)
  final_amount?: number  // 최종 매출 (기본 + 추가공사비 - 협의사항)
  business_address?: string
  business_representative?: string
  business_registration_number?: string
  business_phone?: string
  business_fax?: string
  supplier_company_name?: string
  supplier_representative?: string
  supplier_address?: string
  terms_and_conditions?: string
  payment_advance_ratio?: number
  payment_balance_ratio?: number
  additional_cost?: number
  negotiation_cost?: number
  equipment_counts?: {
    ph_meter: number
    differential_pressure_meter: number
    temperature_meter: number
    discharge_current_meter: number
    fan_current_meter: number
    pump_current_meter: number
    gateway: number
    vpn: number
  }
  pdf_file_url?: string
}

interface Props {
  contract: Contract
  isOpen: boolean
  onClose: () => void
}

export default function ContractPreviewModal({ contract, isOpen, onClose }: Props) {
  const [generating, setGenerating] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  // 계약서 데이터 구성 (저장된 템플릿 정보 사용)
  const contractData: ContractData = {
    contract_number: contract.contract_number,
    contract_date: contract.contract_date,
    contract_type: contract.contract_type,
    business_name: contract.business_name,
    business_address: contract.business_address || '',
    business_representative: contract.business_representative || '',
    business_registration_number: contract.business_registration_number || '',
    business_phone: contract.business_phone || '',
    business_fax: contract.business_fax || '',
    total_amount: contract.total_amount,
    base_revenue: contract.base_revenue,
    final_amount: contract.final_amount,
    supplier_company_name: contract.supplier_company_name || '주식회사 블루온',
    supplier_representative: contract.supplier_representative || '김 경 수',
    supplier_address: contract.supplier_address || '경상북도 고령군 대가야읍 낫질로 285',
    payment_advance_ratio: contract.payment_advance_ratio || 50,
    payment_balance_ratio: contract.payment_balance_ratio || 50,
    additional_cost: contract.additional_cost || 0,
    negotiation_cost: contract.negotiation_cost || 0,
    equipment_counts: contract.equipment_counts || {
      ph_meter: 0,
      differential_pressure_meter: 0,
      temperature_meter: 0,
      discharge_current_meter: 0,
      fan_current_meter: 0,
      pump_current_meter: 0,
      gateway: 0,
      vpn: 0
    }
  }

  const handleDownloadPDF = async () => {
    if (!printRef.current) return

    setGenerating(true)
    try {
      // 파일명 형식: 251111_IoT 설치계약서_[사업장명]
      const today = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const filename = `${today}_IoT 설치계약서_${contract.business_name}.pdf`

      const blob = await generateContractPDF(
        printRef.current,
        filename
      )

      downloadPDF(blob, filename)
      alert('PDF 다운로드가 완료되었습니다.')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('PDF 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              계약서 미리보기
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {contract.contract_type === 'subsidy' ? '보조금' : '자비'} 계약서 - {contract.contract_number}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 계약서 내용 */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div ref={printRef} id="print-content" className="bg-white shadow-lg">
            {contract.contract_type === 'subsidy' ? (
              <SubsidyContractTemplate data={contractData} />
            ) : (
              <SelfPayContractTemplate data={contractData} />
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <p>사업장: {contract.business_name}</p>
              <p>계약일자: {contract.contract_date}</p>
            </div>
            <div className="text-right">
              <p>계약금액: {(contract.final_amount || contract.total_amount).toLocaleString()}원</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
