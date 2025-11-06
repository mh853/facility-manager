'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceDisplay } from './InvoiceDisplay';
import { TokenManager } from '@/lib/api-client';

interface BusinessRevenueModalProps {
  business: any;
  isOpen: boolean;
  onClose: () => void;
  userPermission: number;
}

interface EquipmentBreakdownItem {
  equipment_type: string;
  equipment_name: string;
  quantity: number;
  unit_official_price: number;
  unit_manufacturer_price: number;
  unit_installation_cost: number;
  total_revenue: number;
  total_cost: number;
  total_installation: number;
  profit: number;
}

interface CalculatedData {
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sales_commission: number;
  survey_costs: number;
  installation_costs: number;
  additional_installation_revenue: number;
  net_profit: number;
  has_calculation: boolean;
  equipment_breakdown?: EquipmentBreakdownItem[];
}

export default function BusinessRevenueModal({
  business,
  isOpen,
  onClose,
  userPermission
}: BusinessRevenueModalProps) {
  const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API에서 최신 계산 결과 가져오기 (Hook은 항상 최상위에서 호출)
  useEffect(() => {
    // 조건 체크는 Hook 내부에서 수행
    if (!isOpen || !business || !business.id) {
      return;
    }

    const fetchLatestCalculation = async () => {
      setIsRefreshing(true);
      setError(null);

      try {
        const token = TokenManager.getToken();
        const response = await fetch('/api/revenue/calculate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            business_id: business.id,
            save_result: false // 조회만 하고 저장하지 않음
          })
        });

        const data = await response.json();
        console.log('🔍 [BusinessRevenueModal] API 응답:', data);

        if (data.success && data.data && data.data.calculation) {
          console.log('✅ [BusinessRevenueModal] calculatedData 설정:', data.data.calculation);
          setCalculatedData(data.data.calculation);
        } else {
          console.error('❌ [BusinessRevenueModal] 응답 실패:', data.message);
          setError(data.message || '계산 결과를 가져올 수 없습니다.');
        }
      } catch (err) {
        console.error('매출 계산 오류:', err);
        setError('계산 중 오류가 발생했습니다.');
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchLatestCalculation();
  }, [isOpen, business?.id]);

  const formatCurrency = (amount: number | string | undefined) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : (amount || 0);
    return `₩${numAmount.toLocaleString()}`;
  };

  const isReadOnly = userPermission < 2;

  // 모달이 닫혀있거나 business 데이터가 없으면 null 반환 (JSX 조건부 렌더링)
  if (!isOpen || !business) {
    return null;
  }

  // 표시할 데이터: API 계산 결과 우선, 없으면 기존 business 객체 사용
  const displayData = calculatedData || {
    total_revenue: business.total_revenue || 0,
    total_cost: business.total_cost || 0,
    gross_profit: business.gross_profit || 0,
    sales_commission: business.sales_commission || 0,
    survey_costs: business.survey_costs || 0,
    installation_costs: business.installation_costs || 0,
    additional_installation_revenue: business.additional_installation_revenue || 0,
    net_profit: business.net_profit || 0,
    has_calculation: false
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">
              {business.business_name || business.사업장명} - 기기 상세 정보
            </h3>
            {isRefreshing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>계산 중...</span>
              </div>
            )}
            {calculatedData && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                최신 계산 완료
              </span>
            )}
          </div>
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
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                ⚠️ {error}
                <br />
                <span className="text-xs text-red-600 mt-1">기존 저장된 데이터를 표시합니다.</span>
              </p>
            </div>
          )}
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
                  {formatCurrency(displayData.total_revenue)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs font-medium text-red-600 mb-1">매입금액</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(displayData.total_cost)}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${displayData.net_profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className={`text-xs font-medium mb-1 ${displayData.net_profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>순이익</p>
                <p className={`text-lg font-bold ${displayData.net_profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(displayData.net_profit)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs font-medium text-purple-600 mb-1">이익률</p>
                <p className="text-lg font-bold text-purple-700">
                  {displayData.total_revenue > 0
                    ? ((displayData.net_profit / displayData.total_revenue) * 100).toFixed(1)
                    : '0'}%
                </p>
              </div>
            </div>

            {/* 추가설치비 (매출에 포함) */}
            {displayData.additional_installation_revenue > 0 && (
              <div className="bg-cyan-50 rounded-lg p-4">
                <p className="text-xs font-medium text-cyan-600 mb-1">추가설치비 (매출 포함)</p>
                <p className="text-lg font-bold text-cyan-700">
                  {formatCurrency(displayData.additional_installation_revenue)}
                </p>
                <p className="text-xs text-cyan-600 mt-1">설치팀 추가 수입 (매출에 반영됨)</p>
              </div>
            )}

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
                    displayData.total_revenue -
                    (business.additional_cost || 0) -
                    (displayData.additional_installation_revenue || 0) +
                    (business.negotiation || 0)
                  )}</span>
                </div>
                {business.additional_cost > 0 && (
                  <div className="flex items-center justify-between text-green-700">
                    <span>+ 추가공사비</span>
                    <span className="font-mono">+{formatCurrency(business.additional_cost)}</span>
                  </div>
                )}
                {displayData.additional_installation_revenue > 0 && (
                  <div className="flex items-center justify-between text-cyan-700">
                    <span>+ 추가설치비</span>
                    <span className="font-mono">+{formatCurrency(displayData.additional_installation_revenue)}</span>
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
                  <span className="font-mono text-lg">{formatCurrency(displayData.total_revenue)}</span>
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
                    <th className="border border-gray-300 px-4 py-2 text-right">매출단가</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">매입단가</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">매출합계</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">매입합계</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // API에서 받은 equipment_breakdown 사용
                    const equipmentBreakdown = displayData.equipment_breakdown || [];

                    if (equipmentBreakdown.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="border border-gray-300 px-4 py-6 text-center text-gray-500">
                            등록된 기기 정보가 없습니다.
                          </td>
                        </tr>
                      );
                    }

                    const totalRevenue = equipmentBreakdown.reduce((sum, item) => sum + (item.total_revenue || 0), 0);
                    const totalCost = equipmentBreakdown.reduce((sum, item) => sum + (item.total_cost || 0), 0);

                    return (
                      <>
                        {equipmentBreakdown.map((item: any) => (
                          <tr key={item.equipment_type} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{item.equipment_name}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center font-medium">{item.quantity}대</td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                              {item.unit_official_price.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono text-red-600">
                              {item.unit_manufacturer_price.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono font-medium">
                              {item.total_revenue.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-mono font-medium text-red-600">
                              {item.total_cost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold">
                          <td className="border border-gray-300 px-4 py-2" colSpan={4}>합계</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-mono text-blue-600">
                            {totalRevenue.toLocaleString()}원
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-mono text-red-600">
                            {totalCost.toLocaleString()}원
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 매출단가는 환경부 고시가, 매입단가는 제조사별 원가가 적용됩니다. {calculatedData ? '최신 DB 가격이 적용되었습니다.' : '저장된 계산 결과입니다.'}
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
                    {formatCurrency(displayData.sales_commission)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {calculatedData ? '최신 계산 적용' : '저장된 값'}
                  </p>
                </div>

                {/* 실사비용 */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">📋 실사비용</span>
                  </div>
                  <p className="text-xl font-bold text-purple-700">
                    {formatCurrency(displayData.survey_costs)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    실사일 기반 동적 계산
                  </p>
                </div>

                {/* 설치비 */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">🔧 기본 설치비</span>
                  </div>
                  <p className="text-xl font-bold text-cyan-700">
                    {formatCurrency(displayData.installation_costs)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    기기별 기본 설치비 합계
                  </p>
                </div>

                {/* 총 비용 */}
                <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg p-4 shadow-md text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">📊 총 비용 합계</span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(
                      displayData.sales_commission +
                      displayData.survey_costs +
                      displayData.installation_costs
                    )}
                  </p>
                  <p className="text-xs opacity-80 mt-1">
                    영업비용 + 실사비용 + 기본설치비
                  </p>
                </div>
              </div>

              {/* 최종 이익 계산 공식 */}
              <div className="mt-4 bg-white rounded-lg p-4 border-2 border-blue-300">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">📐 순이익 계산 공식</h5>
                <div className="text-sm text-gray-700 space-y-2 font-mono">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>매출금액</span>
                    <span className="font-bold text-green-700">{formatCurrency(displayData.total_revenue)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 매입금액</span>
                    <span className="font-bold text-red-700">-{formatCurrency(displayData.total_cost)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>= 총 이익</span>
                    <span className="font-bold text-gray-700">{formatCurrency(displayData.gross_profit)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 영업비용</span>
                    <span className="font-bold text-orange-700">-{formatCurrency(displayData.sales_commission)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 실사비용</span>
                    <span className="font-bold text-purple-700">-{formatCurrency(displayData.survey_costs)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span>- 기본설치비</span>
                    <span className="font-bold text-cyan-700">-{formatCurrency(displayData.installation_costs)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-blue-400 pt-3">
                    <span className="font-bold text-lg">= 순이익</span>
                    <span className={`font-bold text-lg ${displayData.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatCurrency(displayData.net_profit)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  ℹ️ 매출관리 페이지와 동일한 계산 방식 적용
                </p>
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
