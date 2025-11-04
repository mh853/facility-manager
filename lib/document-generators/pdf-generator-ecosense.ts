// lib/document-generators/pdf-generator-ecosense.ts
// 에코센스 발주서 PDF 생성기 (한글 지원 - HTML to Canvas 방식)

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { PurchaseOrderDataEcosense } from '@/types/document-automation'

export async function generateEcosensePurchaseOrderPDF(
  data: PurchaseOrderDataEcosense
): Promise<Buffer> {
  try {
    // PDF 생성
    const doc = new jsPDF('p', 'mm', 'a4')
    const margin = 10
    const pageWidth = 210 - (margin * 2)
    const pageHeight = 297 - (margin * 2)

    // 1. 메인 발주서 컨텐츠 생성 (대기필증 제외)
    const mainHtmlContent = generatePurchaseOrderHtml(data, false)
    const mainCanvas = await renderHtmlToCanvas(mainHtmlContent)

    // 메인 컨텐츠를 PDF에 추가
    await addCanvasToPdf(doc, mainCanvas, margin, pageWidth, pageHeight, false)

    // 2. 대기필증이 있으면 별도 페이지에 추가
    if (data.air_permit) {
      const airPermitHtml = generateAirPermitHtml(data)
      const airPermitCanvas = await renderHtmlToCanvas(airPermitHtml)

      // 새 페이지 추가
      doc.addPage()

      // 대기필증을 새 페이지에 추가
      await addCanvasToPdf(doc, airPermitCanvas, margin, pageWidth, pageHeight, true)
    }

    // Buffer로 변환
    const pdfBlob = doc.output('arraybuffer')
    return Buffer.from(pdfBlob)

  } catch (error) {
    console.error('[ECOSENSE-PDF] PDF 생성 오류:', error)
    throw error
  }
}

// HTML을 Canvas로 렌더링하는 헬퍼 함수
async function renderHtmlToCanvas(htmlContent: string): Promise<HTMLCanvasElement> {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  tempDiv.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    background-color: #ffffff !important;
    padding: 20px;
    font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.35;
    color: #000000 !important;
    font-weight: 400;
    letter-spacing: -0.02em;
    box-sizing: border-box;
  `

  document.body.appendChild(tempDiv)

  // 폰트 로딩 대기
  await new Promise(resolve => setTimeout(resolve, 500))

  // Canvas로 변환
  const canvas = await html2canvas(tempDiv, {
    scale: 2,
    useCORS: false,
    backgroundColor: '#ffffff',
    logging: false,
    width: 794,
    height: tempDiv.offsetHeight || 1123,
    allowTaint: false,
    foreignObjectRendering: false,
    removeContainer: false,
    imageTimeout: 30000,
    onclone: (clonedDoc) => {
      const clonedDiv = clonedDoc.querySelector('div')
      if (clonedDiv) {
        clonedDiv.style.cssText = `
          position: static !important;
          left: auto !important;
          width: 794px !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          padding: 20px !important;
          margin: 0 !important;
          font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif !important;
        `
      }
    }
  })

  // DOM 요소 제거
  document.body.removeChild(tempDiv)

  return canvas
}

// Canvas를 PDF에 추가하는 헬퍼 함수 (여러 페이지 지원)
async function addCanvasToPdf(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  isNewSection: boolean
): Promise<void> {
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let remainingHeight = imgHeight
  let yPosition = 0
  let isFirstPage = true

  while (remainingHeight > 0) {
    const currentPageHeight = Math.min(pageHeight, remainingHeight)

    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')

    if (cropCtx) {
      const cropRatio = currentPageHeight / imgHeight
      cropCanvas.width = canvas.width
      cropCanvas.height = canvas.height * cropRatio

      cropCtx.drawImage(
        canvas,
        0, yPosition * (canvas.height / imgHeight),
        canvas.width, canvas.height * cropRatio,
        0, 0,
        canvas.width, canvas.height * cropRatio
      )

      const cropImgData = cropCanvas.toDataURL('image/jpeg', 0.95)

      doc.addImage(
        cropImgData,
        'JPEG',
        margin,
        margin,
        imgWidth,
        currentPageHeight
      )
    }

    remainingHeight -= currentPageHeight
    yPosition += currentPageHeight

    // 다음 페이지가 필요하면 추가 (단, 새 섹션의 첫 페이지가 아닐 때만)
    if (remainingHeight > 0) {
      doc.addPage()
    }

    isFirstPage = false
  }
}

function generatePurchaseOrderHtml(data: PurchaseOrderDataEcosense, includeAirPermit: boolean = true): string {
  // 전류계 합산
  const totalCtCount = (data.equipment.discharge_ct || 0) + (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)

  // 품목 필터링 (수량 > 0)
  const equipmentItems = [
    { name: 'PH센서', count: data.equipment.ph_sensor || 0 },
    { name: '차압계', count: data.equipment.differential_pressure_meter || 0 },
    { name: '온도계', count: data.equipment.temperature_meter || 0 },
    { name: '전류계', count: totalCtCount },
    { name: '게이트웨이', count: data.equipment.gateway || 0 },
    { name: 'VPN(유선)', count: data.equipment.vpn_router_wired || 0 },
    { name: 'VPN(무선)', count: data.equipment.vpn_router_wireless || 0 },
    { name: '확장디바이스', count: data.equipment.expansion_device || 0 }
  ].filter(item => item.count > 0)

  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 20px; line-height: 1.35; background-color: #ffffff; color: #000000;">
      <!-- 제목 -->
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        <h1 style="font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #1a1a1a;">발 주 서</h1>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">${data.business_name}</p>
      </div>

      <!-- 담당자 정보 (블루온 담당자 & 세금계산서 담당자) -->
      <div style="margin-bottom: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td colspan="4" style="border: 1px solid #ddd; padding: 7px; background-color: #2563eb; color: #ffffff; font-weight: bold; text-align: center; vertical-align: middle; height: 35px;">담당자 정보</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">블루온 담당자</td>
            <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle; height: 35px;">${escapeHtml(data.manager_name || '')} | ${escapeHtml(data.manager_contact || '')}${data.manager_email ? ' | ' + escapeHtml(data.manager_email) : ''}</td>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">세금계산서 담당자</td>
            <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle; height: 35px;">김경수 | 010-2758-4273 | gong4900@naver.com</td>
          </tr>
        </table>
      </div>

      <!-- 품목 정보 -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">품목 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #2563eb; color: #ffffff;">
              <th style="border: 1px solid #2563eb; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">구분</th>
              ${equipmentItems.map(item => `<th style="border: 1px solid #2563eb; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${escapeHtml(item.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; text-align: center; vertical-align: middle; height: 35px;">수량</td>
              ${equipmentItems.map(item => `<td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${item.count}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 설치 정보 -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">설치(납품) 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 20%; vertical-align: middle; height: 35px;">희망일자</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${escapeHtml(data.installation_desired_date || '')}</td>
          </tr>
        </table>
      </div>

      <!-- 사업장 정보 -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">사업장 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">사업장명</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${escapeHtml(data.factory_name || data.business_name)}</td>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">담당자명</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${escapeHtml(data.factory_manager || '')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">연락처</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${escapeHtml(data.factory_contact || '')}</td>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">이메일</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${escapeHtml(data.factory_email || '')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">사업장 주소</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;" colspan="3">${escapeHtml(data.factory_address || data.address)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">택배 주소</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;" colspan="3">${escapeHtml(data.delivery_full_address || data.delivery_address || '')}</td>
          </tr>
        </table>
      </div>

      <!-- 설정 정보 (2열 레이아웃) -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">장비 설정</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">VPN 설정</td>
            <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle; height: 35px;">${data.vpn_type === 'wired' || data.vpn_type === 'lan' ? '☑ 유선 ☐ 무선' : '☐ 유선 ☑ 무선'}</td>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle; height: 35px;">온도센서 타입</td>
            <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle; height: 35px;">${data.temperature_sensor_type === 'flange' ? '☑ 프렌지타입 ☐ 니플(소켓)타입' : data.temperature_sensor_type === 'nipple' ? '☐ 프렌지타입 ☑ 니플(소켓)타입' : '☑ 프렌지타입 ☐ 니플(소켓)타입'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">온도센서 길이</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${data.temperature_sensor_length === '10cm' || !data.temperature_sensor_length ? '☑ 10CM ☐ 20CM ☐ 40CM' : data.temperature_sensor_length === '20cm' ? '☐ 10CM ☑ 20CM ☐ 40CM' : '☐ 10CM ☐ 20CM ☑ 40CM'}</td>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">PH 인디게이터</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${data.ph_indicator_location === 'panel' ? '☑ 판넬(타공) ☐ 독립형하이박스 ☐ 해당없음' : data.ph_indicator_location === 'independent_box' || !data.ph_indicator_location ? '☐ 판넬(타공) ☑ 독립형하이박스 ☐ 해당없음' : '☐ 판넬(타공) ☐ 독립형하이박스 ☑ 해당없음'}</td>
          </tr>
        </table>
      </div>

      <!-- 전류계 타입 -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">전류계 타입</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">구분</th>
              <th style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">16L</th>
              <th style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">24L</th>
              <th style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">36L</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">송풍+펌프 전류계</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${(data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)}</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">-</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">-</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">배출 전류계</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${data.ct_16l || 0}</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${data.ct_24l || 0}</td>
              <td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">${data.ct_36l || 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 발주 금액 및 결제조건 -->
      <div style="margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">발주 금액 및 결제조건</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 30%; vertical-align: middle; height: 35px;">공급가액</td>
            <td style="border: 1px solid #ddd; padding: 7px; text-align: right; vertical-align: middle; height: 35px;">${(data.subtotal || 0).toLocaleString()}원</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">부가세 (10%)</td>
            <td style="border: 1px solid #ddd; padding: 7px; text-align: right; vertical-align: middle; height: 35px;">${(data.vat || 0).toLocaleString()}원</td>
          </tr>
          <tr style="background-color: #2563eb; color: #ffffff; font-weight: bold;">
            <td style="border: 1px solid #2563eb; padding: 7px; vertical-align: middle; height: 35px;">합계</td>
            <td style="border: 1px solid #2563eb; padding: 7px; text-align: right; vertical-align: middle; height: 35px;">${(data.grand_total || 0).toLocaleString()}원</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle; height: 35px;">결제조건</td>
            <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle; height: 35px;">${
              data.payment_terms === 'prepay_5_balance_5' ? '☑ 선금5(발주기준)|잔금5(납품완료기준) ☐ 납품 후 완납 ☐ 기타사항(선입금)' :
              data.payment_terms === 'full_after_delivery' ? '☐ 선금5(발주기준)|잔금5(납품완료기준) ☑ 납품 후 완납 ☐ 기타사항(선입금)' :
              '☐ 선금5(발주기준)|잔금5(납품완료기준) ☐ 납품 후 완납 ☑ 기타사항(선입금)'
            }<br/><span style="font-size: 10px; color: #6b7280;">* 세금계산서 발행 후 7일 이내</span></td>
          </tr>
        </table>
      </div>

      <!-- 하단 정보 -->
      <div style="margin-top: 18px; padding-top: 12px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">
        <p style="margin: 3px 0;">생성일시: ${new Date().toLocaleString('ko-KR')}</p>
        <p style="margin: 3px 0;">문서번호: PO-${Date.now()}</p>
      </div>
    </div>
  `
}

// 대기필증 HTML 생성 함수 (별도 페이지용)
function generateAirPermitHtml(data: PurchaseOrderDataEcosense): string {
  if (!data.air_permit) return ''

  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 20px; line-height: 1.35; background-color: #ffffff; color: #000000;">
      <!-- 대기필증 제목 -->
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        <h1 style="font-size: 20px; font-weight: bold; margin: 0 0 6px 0; color: #1a1a1a;">대기배출시설 허가증</h1>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">${data.business_name}</p>
      </div>

      <!-- 기본 정보 테이블 -->
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">기본 정보</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle;">업종</td>
              <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle;">${escapeHtml(data.air_permit.business_type || '-')}</td>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; width: 15%; vertical-align: middle;">종별</td>
              <td style="border: 1px solid #ddd; padding: 7px; width: 35%; vertical-align: middle;">${escapeHtml(data.air_permit.category || '-')}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle;">최초신고일</td>
              <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle;">${escapeHtml(data.air_permit.first_report_date || '-')}</td>
              <td style="border: 1px solid #ddd; padding: 7px; background-color: #f8f9fa; font-weight: bold; vertical-align: middle;">가동개시일</td>
              <td style="border: 1px solid #ddd; padding: 7px; vertical-align: middle;">${escapeHtml(data.air_permit.operation_start_date || '-')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 배출구별 시설 정보 -->
      ${data.air_permit.outlets && data.air_permit.outlets.length > 0 ? `
      <div style="margin-top: 20px;">
        <h2 style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 9px; border-left: 3px solid #2563eb; padding-left: 7px;">배출구 및 시설 정보</h2>
        ${data.air_permit.outlets.map((outlet, outletIndex) => `
          <div style="margin-bottom: 20px; ${outletIndex > 0 ? 'margin-top: 25px;' : ''}">
            <h3 style="font-size: 13px; font-weight: bold; color: #1a1a1a; margin-bottom: 12px; background-color: #f8f9fa; padding: 8px; border-left: 3px solid #2563eb;">
              ${escapeHtml(outlet.outlet_name)} (배출구 #${outlet.outlet_number})
            </h3>

            ${outlet.discharge_facilities && outlet.discharge_facilities.length > 0 ? `
            <!-- 배출시설 -->
            <div style="margin-bottom: 15px;">
              <h4 style="font-size: 12px; font-weight: bold; color: #dc2626; margin-bottom: 8px; background-color: #fef2f2; padding: 6px; border-left: 3px solid #dc2626;">
                🏭 배출시설
              </h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="background-color: #fee2e2;">
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 10%;">시설번호</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 38%;">시설명</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 20%;">용량</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 10%;">수량</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 22%;">그린링크코드</th>
                  </tr>
                </thead>
                <tbody>
                  ${outlet.discharge_facilities.map((facility, idx) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${escapeHtml(facility.name)}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${escapeHtml(facility.capacity || '-')}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${facility.quantity || 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${escapeHtml(facility.green_link_code || '-')}</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            ${outlet.prevention_facilities && outlet.prevention_facilities.length > 0 ? `
            <!-- 방지시설 -->
            <div style="margin-bottom: 15px;">
              <h4 style="font-size: 12px; font-weight: bold; color: #16a34a; margin-bottom: 8px; background-color: #f0fdf4; padding: 6px; border-left: 3px solid #16a34a;">
                🛡️ 방지시설
              </h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="background-color: #dcfce7;">
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 10%;">시설번호</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 38%;">시설명</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 20%;">용량</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 10%;">수량</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 22%;">그린링크코드</th>
                  </tr>
                </thead>
                <tbody>
                  ${outlet.prevention_facilities.map((facility, idx) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${escapeHtml(facility.name)}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${escapeHtml(facility.capacity || '-')}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${facility.quantity || 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${escapeHtml(facility.green_link_code || '-')}</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
