'use client';

import React from 'react';
import { InvoiceDisplay } from './InvoiceDisplay';

interface BusinessRevenueModalProps {
  business: any;
  isOpen: boolean;
  onClose: () => void;
  userPermission: number;
}

export default function BusinessRevenueModal({
  business,
  isOpen,
  onClose,
  userPermission
}: BusinessRevenueModalProps) {
  if (!isOpen || !business) return null;

  const formatCurrency = (amount: number) => {
    return `₩${amount.toLocaleString()}`;
  };

  const isReadOnly = userPermission < 2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">
            {business.business_name || business.사업장명} - 기기 상세 정보
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 사업장 기본 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">영업점:</span>
                <span className="ml-2 text-sm text-gray-900">{business.sales_office || business.영업점 || '미배정'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">진행 구분:</span>
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  business.category === '보조금' || business.category === '보조금 동시진행'
                    ? 'bg-purple-100 text-purple-800' :
                  business.category === '자비' ? 'bg-green-100 text-green-800' :
                  business.category === 'AS' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {business.category || business.진행구분 || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">제조사:</span>
                <span className="ml-2 text-sm text-gray-900">{business.manufacturer || business.제조사 || '미지정'}</span>
              </div>
            </div>
            {(business.address || business.주소) && (
              <div>
                <span className="text-sm font-medium text-gray-600">주소:</span>
                <span className="ml-2 text-sm text-gray-900">{business.address || business.주소}</span>
              </div>
            )}
          </div>

          {/* 매출/매입/이익 정보 */}
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs font-medium text-green-600 mb-1">매출금액</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(business.total_revenue || 0)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs font-medium text-red-600 mb-1">매입금액</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(business.total_cost || 0)}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${(business.net_profit || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className={`text-xs font-medium mb-1 ${(business.net_profit || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>이익금액</p>
                <p className={`text-lg font-bold ${(business.net_profit || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(business.net_profit || 0)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs font-medium text-purple-600 mb-1">이익률</p>
                <p className="text-lg font-bold text-purple-700">
                  {business.total_revenue > 0
                    ? (((business.net_profit || 0) / business.total_revenue) * 100).toFixed(1)
                    : '0'}%
                </p>
              </div>
            </div>

            {/* 추가공사비 및 협의사항 */}
            {(business.additional_cost || business.negotiation) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">매출 조정 내역</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {business.additional_cost > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">추가공사비 (+):</span>
                      <span className="text-sm font-semibold text-green-700">
                        +{formatCurrency(business.additional_cost)}
                      </span>
                    </div>
                  )}
                  {business.negotiation > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">협의사항/네고 (-):</span>
                      <span className="text-sm font-semibold text-red-700">
                        -{formatCurrency(business.negotiation)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 매출 계산식 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-gray-800 mb-3">💰 최종 매출금액 계산식</h5>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <span>기본 매출 (기기 합계)</span>
                  <span className="font-mono">{formatCurrency(
                    (business.total_revenue || 0) -
                    (business.additional_cost || 0) +
                    (business.negotiation || 0)
                  )}</span>
                </div>
                {business.additional_cost > 0 && (
                  <div className="flex items-center justify-between text-green-700">
                    <span>+ 추가공사비</span>
                    <span className="font-mono">+{formatCurrency(business.additional_cost)}</span>
                  </div>
                )}
                {business.negotiation > 0 && (
                  <div className="flex items-center justify-between text-red-700">
                    <span>- 협의사항/네고</span>
                    <span className="font-mono">-{formatCurrency(business.negotiation)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t-2 border-blue-300 pt-2 font-bold text-blue-900">
                  <span>= 최종 매출금액</span>
                  <span className="font-mono text-lg">{formatCurrency(business.total_revenue || 0)}</span>
                </div>
              </div>
            </div>
          </>

          {/* 설치 기기 목록 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">설치 기기 목록</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">기기명</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">수량</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">단가 (원)</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">합계 (원)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const equipmentFields = [
                      { key: 'ph_meter', name: 'PH센서' },
                      { key: 'differential_pressure_meter', name: '차압계' },
                      { key: 'temperature_meter', name: '온도계' },
                      { key: 'discharge_current_meter', name: '배출전류계' },
                      { key: 'fan_current_meter', name: '송풍전류계' },
                      { key: 'pump_current_meter', name: '펌프전류계' },
                      { key: 'gateway', name: '게이트웨이' },
                      { key: 'vpn_wired', name: 'VPN(유선)' },
                      { key: 'vpn_wireless', name: 'VPN(무선)' },
                      { key: 'explosion_proof_differential_pressure_meter_domestic', name: '방폭차압계(국산)' },
                      { key: 'explosion_proof_temperature_meter_domestic', name: '방폭온도계(국산)' },
                      { key: 'expansion_device', name: '확장디바이스' },
                      { key: 'relay_8ch', name: '중계기(8채널)' },
                      { key: 'relay_16ch', name: '중계기(16채널)' },
                      { key: 'main_board_replacement', name: '메인보드교체' },
                      { key: 'multiple_stack', name: '복수굴뚝' }
                    ];

                    const equipmentList = equipmentFields
                      .filter(field => {
                        const quantity = business[field.key];
                        return quantity && quantity > 0;
                      })
                      .map(field => {
                        const quantity = business[field.key];
                        const estimatedPrices: Record<string, number> = {
                          'ph_meter': 1000000,
                          'differential_pressure_meter': 400000,
                          'temperature_meter': 500000,
                          'discharge_current_meter': 300000,
                          'fan_current_meter': 300000,
                          'pump_current_meter': 300000,
                          'gateway': 1600000,
                          'vpn_wired': 400000,
                          'vpn_wireless': 400000,
                          'explosion_proof_differential_pressure_meter_domestic': 800000,
                          'explosion_proof_temperature_meter_domestic': 1500000,
                          'expansion_device': 800000,
                          'relay_8ch': 300000,
                          'relay_16ch': 1600000,
                          'main_board_replacement': 350000,
                          'multiple_stack': 480000
                        };
                        const unitPrice = estimatedPrices[field.key] || 0;
                        const total = unitPrice * quantity;

                        return (
                          <tr key={field.key} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{field.name}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center font-medium">{quantity}대</td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {unitPrice.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono font-medium">
                              {total.toLocaleString()}
                            </td>
                          </tr>
                        );
                      });

                    if (equipmentList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="border border-gray-300 px-4 py-6 text-center text-gray-500">
                            등록된 기기 정보가 없습니다.
                          </td>
                        </tr>
                      );
                    }

                    const totalEquipment = equipmentFields.reduce((sum, field) => {
                      return sum + (business[field.key] || 0);
                    }, 0);

                    const totalAmount = equipmentFields.reduce((sum, field) => {
                      const quantity = business[field.key] || 0;
                      const estimatedPrices: Record<string, number> = {
                        'ph_meter': 1000000,
                        'differential_pressure_meter': 400000,
                        'temperature_meter': 500000,
                        'discharge_current_meter': 300000,
                        'fan_current_meter': 300000,
                        'pump_current_meter': 300000,
                        'gateway': 1600000,
                        'vpn_wired': 400000,
                        'vpn_wireless': 400000,
                        'explosion_proof_differential_pressure_meter_domestic': 800000,
                        'explosion_proof_temperature_meter_domestic': 1500000,
                        'expansion_device': 800000,
                        'relay_8ch': 300000,
                        'relay_16ch': 1600000,
                        'main_board_replacement': 350000,
                        'multiple_stack': 480000
                      };
                      const unitPrice = estimatedPrices[field.key] || 0;
                      return sum + (unitPrice * quantity);
                    }, 0);

                    return (
                      <>
                        {equipmentList}
                        <tr className="bg-blue-50 font-bold">
                          <td className="border border-gray-300 px-4 py-2" colSpan={3}>합계</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-mono text-blue-600">
                            {totalAmount.toLocaleString()}원
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 단가는 환경부 고시가 기준 추정 금액이며, 실제 매출 계산 시 최신 고시가가 적용됩니다.
            </p>
          </div>

          {/* 추가 비용 정보 */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">추가 비용 정보</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">추가공사비</span>
                <span className="text-base font-semibold text-green-700">
                  {business.additional_cost
                    ? `+${formatCurrency(business.additional_cost)}`
                    : '₩0'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700">협의사항 (할인 금액)</span>
                <span className="text-base font-semibold text-red-700">
                  {business.negotiation
                    ? `-${formatCurrency(business.negotiation)}`
                    : '₩0'}
                </span>
              </div>
            </div>
          </div>

          {/* 비용 상세 내역 */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">💰 비용 상세 내역</h4>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 영업비용 */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">💼 영업비용</span>
                    <span className="text-xs text-gray-500">
                      {business.sales_office || '미배정'} 영업점
                    </span>
                  </div>
                  <p className="text-xl font-bold text-orange-700">
                    {formatCurrency(business.sales_commission || 0)}
                  </p>
                  {business.cost_breakdown?.sales_commission_type && (
                    <p className="text-xs text-gray-500 mt-1">
                      {business.cost_breakdown.sales_commission_type === 'percentage'
                        ? `수수료율 ${business.cost_breakdown.sales_commission_rate}%`
                        : `대당 ${formatCurrency(business.cost_breakdown.sales_commission_rate)}`}
                    </p>
                  )}
                </div>

                {/* 실사비용 */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">📋 실사비용</span>
                  </div>
                  <p className="text-xl font-bold text-purple-700">
                    {formatCurrency(business.survey_costs || 0)}
                  </p>
                  {business.cost_breakdown?.survey_costs && (
                    <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                      <div>• 견적 실사: {formatCurrency(business.cost_breakdown.survey_costs.estimate)}</div>
                      <div>• 착공 실사: {formatCurrency(business.cost_breakdown.survey_costs.pre_construction)}</div>
                      <div>• 준공 실사: {formatCurrency(business.cost_breakdown.survey_costs.completion)}</div>
                      {business.cost_breakdown.survey_costs.adjustments !== 0 && (
                        <div className="text-red-600">• 조정: {formatCurrency(business.cost_breakdown.survey_costs.adjustments)}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 설치비 */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">🔧 설치비용</span>
                  </div>
                  <p className="text-xl font-bold text-cyan-700">
                    {formatCurrency(business.installation_costs || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    기본 설치비 + 추가 설치비
                  </p>
                </div>

                {/* 총 비용 */}
                <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg p-4 shadow-md text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">📊 총 비용 합계</span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(
                      (business.sales_commission || 0) +
                      (business.survey_costs || 0) +
                      (business.installation_costs || 0)
                    )}
                  </p>
                  <p className="text-xs opacity-80 mt-1">
                    영업비용 + 실사비용 + 설치비
                  </p>
                </div>
              </div>

              {/* 최종 이익 계산 공식 */}
              <div className="mt-4 bg-white rounded-lg p-4 border-2 border-blue-300">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">📐 순이익 계산 공식</h5>
                <div className="text-sm text-gray-700 space-y-2 font-mono">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>매출금액</span>
                    <span className="font-bold text-green-700">{formatCurrency(business.total_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 매입금액</span>
                    <span className="font-bold text-red-700">-{formatCurrency(business.total_cost || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 영업비용</span>
                    <span className="font-bold text-orange-700">-{formatCurrency(business.sales_commission || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 실사비용</span>
                    <span className="font-bold text-purple-700">-{formatCurrency(business.survey_costs || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 설치비용</span>
                    <span className="font-bold text-cyan-700">-{formatCurrency(business.installation_costs || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-blue-400 pt-3">
                    <span className="font-bold text-lg">= 순이익</span>
                    <span className={`font-bold text-lg ${business.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatCurrency(business.net_profit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 계산서 및 입금 현황 */}
          {business.id && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 md:p-6 border border-purple-200">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-600 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-slate-800">계산서 및 입금 현황 (미수금 관리)</h3>
              </div>
              <InvoiceDisplay
                businessId={business.id}
                businessCategory={business.category || business.business_category || business.progress_status}
                additionalCost={business.additional_cost}
              />
            </div>
          )}

          {/* 읽기 전용 안내 (권한 0-1) */}
          {isReadOnly && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ℹ️ 현재 읽기 전용 모드입니다. 정보 수정은 권한 레벨 2 이상이 필요합니다.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
