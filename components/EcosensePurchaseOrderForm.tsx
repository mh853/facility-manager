// components/EcosensePurchaseOrderForm.tsx
// 에코센스 발주서 UI 컴포넌트

'use client'

import React from 'react'
import type { PurchaseOrderDataEcosense } from '@/types/document-automation'

interface EcosensePurchaseOrderFormProps {
  data: PurchaseOrderDataEcosense
  showPrintButton?: boolean
}

export default function EcosensePurchaseOrderForm({
  data,
  showPrintButton = true
}: EcosensePurchaseOrderFormProps) {
  // 대기필증 데이터 디버깅
  console.log('[ECOSENSE-FORM] 대기필증 데이터:', {
    hasAirPermit: !!data.air_permit,
    airPermit: data.air_permit,
    business_type: data.air_permit?.business_type,
    first_report_date: data.air_permit?.first_report_date,
    operation_start_date: data.air_permit?.operation_start_date,
    outletsCount: data.air_permit?.outlets?.length || 0
  })

  // 전류계 합산
  const totalCtCount = (data.equipment.discharge_ct || 0) + (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)

  // 품목 항목 필터링 (수량이 0보다 큰 것만)
  const equipmentItems = [
    { name: 'PH센서', count: data.equipment.ph_sensor || 0 },
    { name: '차압계', count: data.equipment.differential_pressure_meter || 0 },
    { name: '온도계', count: data.equipment.temperature_meter || 0 },
    { name: '전류계', count: totalCtCount },  // 전류계 합산값 추가
    { name: '게이트웨이', count: data.equipment.gateway || 0 },
    { name: 'VPN(유선)', count: data.equipment.vpn_router_wired || 0 },
    { name: 'VPN(무선)', count: data.equipment.vpn_router_wireless || 0 },
    { name: '확장디바이스', count: data.equipment.expansion_device || 0 }
  ].filter(item => item.count > 0)

  // 전류계 굵기별 데이터 (기존 로직 유지)
  const fanPumpTotal = (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)
  const dischargeCt = data.equipment.discharge_ct || 0

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="ecosense-purchase-order-container">
      {/* 인쇄 버튼 (화면에만 표시) */}
      {showPrintButton && (
        <div className="print-controls no-print">
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            인쇄하기
          </button>
        </div>
      )}

      {/* 발주서 본문 */}
      <div className="purchase-order-document">
        {/* 헤더 */}
        <div className="document-header">
          <h1 className="document-title">제 품 발 주 서</h1>
          <div className="header-info">
            <div className="header-row">
              <span className="label">담당자:</span>
              <span className="value">{data.manager_name}</span>
            </div>
          </div>
        </div>

        {/* 품목 섹션 */}
        <div className="section">
          <h2 className="section-title">발주 품목</h2>
          <table className="items-table">
            <thead>
              <tr>
                <th>구분</th>
                {equipmentItems.map((item, index) => (
                  <th key={index}>{item.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-header">수량</td>
                {equipmentItems.map((item, index) => (
                  <td key={index} className="text-center">{item.count}</td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* 발주 금액 */}
          {data.subtotal && (
            <div className="amount-section">
              <div className="amount-row">
                <span className="amount-label">소계</span>
                <span className="amount-value">{data.subtotal.toLocaleString()}원</span>
              </div>
              <div className="amount-row">
                <span className="amount-label">부가세 (10%)</span>
                <span className="amount-value">{data.vat?.toLocaleString() || 0}원</span>
              </div>
              <div className="amount-row total-row">
                <span className="amount-label">합계</span>
                <span className="amount-value">{data.grand_total?.toLocaleString() || 0}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 설치 희망일자 */}
        <div className="section">
          <div className="info-row">
            <span className="label">설치(납품) 희망일자:</span>
            <span className="value">{data.installation_desired_date}</span>
          </div>
        </div>

        {/* 사업장 정보 */}
        <div className="section">
          <h2 className="section-title">설치 사업장 정보</h2>
          <table className="info-table">
            <tbody>
              <tr>
                <th>사업장명</th>
                <td>{data.factory_name}</td>
                <th>담당자명</th>
                <td>{data.factory_manager}</td>
              </tr>
              <tr>
                <th>연락처</th>
                <td>{data.factory_contact}</td>
                <th>이메일</th>
                <td>{data.factory_email || ''}</td>
              </tr>
              <tr>
                <th>사업장 주소</th>
                <td colSpan={3}>{data.factory_address}</td>
              </tr>
              <tr>
                <th>택배 주소</th>
                <td colSpan={3}>{data.delivery_full_address || data.delivery_address}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* VPN 정보 */}
        <div className="section">
          <h2 className="section-title">VPN 설정</h2>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.vpn_type === 'wired' || data.vpn_type === 'lan'}
                readOnly
              />
              <span>유선</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.vpn_type === 'wireless' || data.vpn_type === 'lte'}
                readOnly
              />
              <span>무선</span>
            </label>
          </div>
        </div>

        {/* 전류계 타입 */}
        {(fanPumpTotal > 0 || dischargeCt > 0) && (
          <div className="section">
            <h2 className="section-title">전류계 타입</h2>
            <table className="ct-table">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>16L</th>
                  <th>24L</th>
                  <th>36L</th>
                </tr>
              </thead>
              <tbody>
                {fanPumpTotal > 0 && (
                  <tr>
                    <td>송풍+펌프 전류계</td>
                    <td className="text-center">{fanPumpTotal}</td>
                    <td className="text-center">0</td>
                    <td className="text-center">0</td>
                  </tr>
                )}
                {dischargeCt > 0 && (
                  <tr>
                    <td>배출 전류계</td>
                    <td className="text-center">{data.ct_16l || dischargeCt}</td>
                    <td className="text-center">{data.ct_24l || 0}</td>
                    <td className="text-center">{data.ct_36l || 0}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 온도센서 타입 */}
        <div className="section">
          <h2 className="section-title">온도센서 타입</h2>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.temperature_sensor_type === 'flange'}
                readOnly
              />
              <span>프렌지타입</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.temperature_sensor_type === 'nipple'}
                readOnly
              />
              <span>니플(소켓)타입</span>
            </label>
          </div>
        </div>

        {/* 온도센서 길이 */}
        <div className="section">
          <h2 className="section-title">온도센서 길이</h2>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.temperature_sensor_length === '10cm'}
                readOnly
              />
              <span>10CM</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.temperature_sensor_length === '20cm'}
                readOnly
              />
              <span>20CM</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.temperature_sensor_length === '40cm'}
                readOnly
              />
              <span>40CM</span>
            </label>
          </div>
        </div>

        {/* PH 인디게이터 부착위치 */}
        <div className="section">
          <h2 className="section-title">PH 인디게이터 부착위치</h2>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.ph_indicator_location === 'panel'}
                readOnly
              />
              <span>방지시설판넬(타공)</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.ph_indicator_location === 'independent_box'}
                readOnly
              />
              <span>독립형하이박스부착</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.ph_indicator_location === 'none'}
                readOnly
              />
              <span>해당없음</span>
            </label>
          </div>
        </div>

        {/* 결제조건 */}
        <div className="section">
          <h2 className="section-title">결제조건*세금계산서 발행 후 7일 이내</h2>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.payment_terms === 'prepay_5_balance_5'}
                readOnly
              />
              <span>선금5(발주기준) | 잔금5(납품완료기준)</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.payment_terms === 'full_after_delivery'}
                readOnly
              />
              <span>납품 후 완납(납품완료기준)</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={data.payment_terms === 'other_prepaid'}
                readOnly
              />
              <span>기타사항(선입금)</span>
            </label>
          </div>
        </div>

        {/* 하단 정보 */}
        <div className="section footer-section">
          <div className="footer-info">
            <h3 className="info-section-title">블루온 담당자</h3>
            <div className="info-row">
              <span className="label">담당자:</span>
              <span className="value">{data.manager_name}</span>
            </div>
            <div className="info-row">
              <span className="label">연락처:</span>
              <span className="value">{data.manager_contact}</span>
            </div>
            <div className="info-row">
              <span className="label">이메일:</span>
              <span className="value">{data.manager_email}</span>
            </div>
          </div>

          <div className="footer-info" style={{ marginTop: '20px' }}>
            <h3 className="info-section-title">세금계산서 담당자</h3>
            <div className="info-row">
              <span className="label">담당자:</span>
              <span className="value">김경수</span>
            </div>
            <div className="info-row">
              <span className="label">연락처:</span>
              <span className="value">010-2758-4273</span>
            </div>
            <div className="info-row">
              <span className="label">이메일:</span>
              <span className="value">gong4900@naver.com</span>
            </div>
          </div>

          {/* 대기필증 정보 */}
          <div className="air-permit-section" style={{ marginTop: '30px' }}>
            <h3 className="info-section-title">대기배출시설 허가증</h3>

            {data.air_permit ? (
              <>
              {/* 기본 정보 */}
              <div className="permit-basic-info">
                <table className="permit-table">
                  <tbody>
                    <tr>
                      <td className="label-cell">업종</td>
                      <td className="value-cell">{data.air_permit.business_type || '-'}</td>
                      <td className="label-cell">종별</td>
                      <td className="value-cell">{data.air_permit.category || '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">최초신고일</td>
                      <td className="value-cell">{data.air_permit.first_report_date || '-'}</td>
                      <td className="label-cell">가동개시일</td>
                      <td className="value-cell">{data.air_permit.operation_start_date || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 배출구별 시설 정보 */}
              {data.air_permit.outlets && data.air_permit.outlets.length > 0 && (
                <div className="permit-outlets">
                  {data.air_permit.outlets.map((outlet, outletIndex) => (
                    <div key={outletIndex} className="outlet-item">
                      <div className="outlet-header">
                        <h3 className="outlet-title">
                          {outlet.outlet_name} (배출구 #{outlet.outlet_number})
                        </h3>
                        {/* 게이트웨이 정보 - 배출구 제목 옆에 표시 */}
                        {outlet.additional_info?.gateway && (
                          <span className="gateway-badge">
                            게이트웨이: {outlet.additional_info.gateway}
                          </span>
                        )}
                      </div>

                      {/* 배출시설 */}
                      {outlet.discharge_facilities && outlet.discharge_facilities.length > 0 && (
                        <div className="facility-group">
                          <h4 className="facility-title discharge">🏭 배출시설</h4>
                          <table className="facility-table">
                            <thead>
                              <tr>
                                <th>시설번호</th>
                                <th>시설명</th>
                                <th>용량</th>
                                <th>수량</th>
                                <th>그린링크코드</th>
                              </tr>
                            </thead>
                            <tbody>
                              {outlet.discharge_facilities.map((facility, facilityIndex) => (
                                <tr key={facilityIndex}>
                                  <td>{facilityIndex + 1}</td>
                                  <td>{facility.name}</td>
                                  <td>{facility.capacity || '-'}</td>
                                  <td>{facility.quantity}</td>
                                  <td>{facility.green_link_code || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 방지시설 */}
                      {outlet.prevention_facilities && outlet.prevention_facilities.length > 0 && (
                        <div className="facility-group">
                          <h4 className="facility-title prevention">🛡️ 방지시설</h4>
                          <table className="facility-table">
                            <thead>
                              <tr>
                                <th>시설번호</th>
                                <th>시설명</th>
                                <th>용량</th>
                                <th>수량</th>
                                <th>그린링크코드</th>
                              </tr>
                            </thead>
                            <tbody>
                              {outlet.prevention_facilities.map((facility, facilityIndex) => (
                                <tr key={facilityIndex}>
                                  <td>{facilityIndex + 1}</td>
                                  <td>{facility.name}</td>
                                  <td>{facility.capacity || '-'}</td>
                                  <td>{facility.quantity}</td>
                                  <td>{facility.green_link_code || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </>
            ) : (
              <div className="air-permit-empty">
                <div className="empty-icon">📋</div>
                <h3 className="empty-title">대기필증 정보가 없습니다</h3>
                <p className="empty-description">
                  사업장의 대기배출시설 허가증 정보를 등록하면<br />
                  발주서에 자동으로 포함됩니다.
                </p>
                <a
                  href="/admin/air-permit-detail"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="empty-action-button"
                >
                  <span>대기필증 등록하기</span>
                  <svg
                    className="action-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ecosense-purchase-order-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .print-controls {
          margin-bottom: 20px;
          text-align: right;
        }

        .purchase-order-document {
          background: white;
          padding: 40px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }

        .document-header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1f2937;
        }

        .document-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #1f2937;
        }

        .header-info {
          text-align: right;
          font-size: 14px;
        }

        .section {
          margin-bottom: 25px;
        }

        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 12px;
          color: #374151;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 8px;
        }

        .items-table,
        .info-table,
        .ct-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .items-table th,
        .items-table td,
        .info-table th,
        .info-table td,
        .ct-table th,
        .ct-table td {
          border: 1px solid #d1d5db;
          padding: 10px;
          font-size: 14px;
        }

        .items-table th,
        .info-table th,
        .ct-table th {
          background-color: #f3f4f6;
          font-weight: 600;
          text-align: center;
        }

        .items-table th:first-child,
        .items-table .row-header {
          text-align: left;
          background-color: #f3f4f6;
          font-weight: 600;
        }

        .ct-table th,
        .ct-table td {
          text-align: center;
        }

        .text-center {
          text-align: center;
        }

        .amount-section {
          margin-top: 20px;
          padding: 15px;
          background-color: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }

        .amount-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }

        .amount-row.total-row {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 2px solid #374151;
          font-weight: bold;
        }

        .amount-label {
          color: #4b5563;
        }

        .amount-value {
          color: #1f2937;
          font-weight: 600;
        }

        .amount-row.total-row .amount-label,
        .amount-row.total-row .amount-value {
          font-size: 16px;
          color: #2563eb;
        }

        .info-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 14px;
        }

        .label {
          font-weight: 600;
          color: #4b5563;
          min-width: 150px;
        }

        .value {
          color: #1f2937;
        }

        .checkbox-group {
          display: flex;
          gap: 30px;
          padding: 15px;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .checkbox-item input[type='checkbox'] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .footer-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
        }

        .footer-info {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 4px;
        }

        .info-section-title {
          font-size: 16px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #d1d5db;
        }

        /* 대기필증 섹션 스타일 */
        .air-permit-section {
          margin-top: 30px;
          padding: 20px;
          background-color: #f8f9fa;
          border: 2px solid #2563eb;
          border-radius: 6px;
        }

        .air-permit-section .section-title {
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
          font-size: 19px;
        }

        .permit-basic-info {
          margin-bottom: 20px;
        }

        .permit-table {
          width: 100%;
          border-collapse: collapse;
        }

        .permit-table .label-cell {
          background-color: #e5e7eb;
          font-weight: bold;
          padding: 10px;
          border: 1px solid #d1d5db;
          width: 20%;
          color: #374151;
        }

        .permit-table .value-cell {
          padding: 10px;
          border: 1px solid #d1d5db;
          width: 30%;
          background-color: white;
        }

        .permit-outlets {
          margin-top: 20px;
        }

        .outlet-item {
          margin-bottom: 25px;
          padding: 15px;
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }

        .outlet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f3f4f6;
          border-left: 4px solid #2563eb;
        }

        .outlet-title {
          font-size: 15px;
          font-weight: bold;
          color: #374151;
          margin: 0;
        }

        .gateway-badge {
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: #0c4a6e;
          background-color: #e0f2fe;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid #7dd3fc;
          white-space: nowrap;
        }

        .facility-group {
          margin-bottom: 15px;
        }

        .facility-title {
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 10px;
          padding: 8px;
          border-radius: 4px;
        }

        .facility-title.discharge {
          background-color: #fef2f2;
          color: #dc2626;
          border-left: 4px solid #dc2626;
        }

        .facility-title.prevention {
          background-color: #f0fdf4;
          color: #16a34a;
          border-left: 4px solid #16a34a;
        }

        .facility-table {
          width: 100%;
          border-collapse: collapse;
        }

        .facility-table th {
          background-color: #f8f9fa;
          font-weight: bold;
          padding: 8px;
          border: 1px solid #d1d5db;
          text-align: center;
          font-size: 12px;
        }

        .facility-table td {
          padding: 8px;
          border: 1px solid #d1d5db;
          text-align: center;
          font-size: 12px;
        }

        .facility-table th:nth-child(1),
        .facility-table td:nth-child(1) {
          width: 10%;
        }

        .facility-table th:nth-child(2),
        .facility-table td:nth-child(2) {
          width: 38%;
          text-align: left;
        }

        .facility-table th:nth-child(3),
        .facility-table td:nth-child(3) {
          width: 20%;
        }

        .facility-table th:nth-child(4),
        .facility-table td:nth-child(4) {
          width: 10%;
        }

        .facility-table th:nth-child(5),
        .facility-table td:nth-child(5) {
          width: 22%;
        }

        /* 대기필증 빈 상태 스타일 */
        .air-permit-empty {
          padding: 60px 40px;
          text-align: center;
          background-color: white;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 18px;
          font-weight: bold;
          color: #374151;
          margin-bottom: 12px;
        }

        .empty-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .empty-action-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          font-weight: 600;
          font-size: 14px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .empty-action-button:hover {
          background-color: #1d4ed8;
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
          transform: translateY(-1px);
        }

        .empty-action-button:active {
          transform: translateY(0);
        }

        .action-icon {
          width: 18px;
          height: 18px;
        }

        /* 인쇄 스타일 */
        @media print {
          .ecosense-purchase-order-container {
            max-width: 100%;
            padding: 0;
          }

          .no-print,
          .empty-action-button {
            display: none !important;
          }

          .air-permit-empty {
            display: none !important;
          }

          /* 대기필증이 없으면 섹션 자체를 숨김 */
          .air-permit-section:has(.air-permit-empty) {
            display: none !important;
          }

          .purchase-order-document {
            box-shadow: none;
            border: none;
            padding: 20mm;
          }

          @page {
            size: A4;
            margin: 15mm;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}
