// utils/korean-pdf-generator.ts - 한글 지원 PDF 생성 유틸리티 (v2.0 - 한 행 레이아웃)
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

// 버전 확인용 (캐시 무효화)
console.log('📄 PDF Generator v2.0 loaded - Single row layout')

interface PermitPdfData {
  permitInfo: {
    id: string
    businessName: string
    businessManagementCode: string
    localGovernment: string
    businessType: string
    memo: string
    firstReportDate: string
    operationStartDate: string
    createdAt: string
    updatedAt: string
    vpnWired: number
    vpnWireless: number
  }
  outlets: Array<{
    outletNumber: number
    outletName: string
    gateway: string
    dischargeFacilities: Array<{
      name: string
      capacity: string
      quantity: number
      defaultFacilityNumber?: string  // 기본 시설번호 (배1, 배2...)
      facilityNumber?: string          // 사용자 입력 시설번호
      greenLinkCode?: string
      memo?: string
    }>
    preventionFacilities: Array<{
      name: string
      capacity: string
      quantity: number
      defaultFacilityNumber?: string  // 기본 시설번호 (방1, 방2...)
      facilityNumber?: string          // 사용자 입력 시설번호
      greenLinkCode?: string
      memo?: string
    }>
  }>
}

export class KoreanAirPermitPdfGenerator {
  private doc: jsPDF
  private readonly pageWidth = 210 // A4 width in mm
  private readonly pageHeight = 297 // A4 height in mm
  private readonly margin = 5 // 여백 최소화: 10mm → 5mm (용지 여백)
  private readonly contentWidth = this.pageWidth - (this.margin * 2)
  private currentY = this.margin

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4')
    this.setupKoreanFont()
  }

  private setupKoreanFont() {
    try {
      // 기본 폰트 설정 (영문과 숫자는 지원)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(10)
    } catch (error) {
      console.warn('폰트 설정 오류:', error)
    }
  }

  async generatePdf(data: PermitPdfData): Promise<Blob> {
    try {
      // HTML 기반 PDF 생성 방식 사용
      const htmlContent = this.generateHtmlContent(data)
      
      // 임시 DOM 요소 생성 및 최적화
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      tempDiv.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 794px;
        background-color: #ffffff !important;
        padding: 25px;
        font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif;
        font-size: 12px;
        line-height: 1.6;
        color: #000000 !important;
        font-weight: 400;
        letter-spacing: -0.02em;
        box-sizing: border-box;
        margin: 0;
        border: none;
        outline: none;
        text-shadow: none;
        box-shadow: none;
        transform: none;
        opacity: 1;
        visibility: visible;
        overflow: visible;
        min-height: auto;
        max-height: none;
        z-index: -1000;
      `
      
      document.body.appendChild(tempDiv)

      // 잠깐 기다린 후 렌더링 (폰트 로딩 완료 대기)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 실제 콘텐츠 높이 측정 (빈 페이지 방지)
      const actualContentHeight = tempDiv.scrollHeight || tempDiv.offsetHeight

      // Canvas로 변환 (최적화된 옵션)
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: actualContentHeight, // 실제 콘텐츠 높이만 사용
        allowTaint: false,
        foreignObjectRendering: false,
        removeContainer: false,
        imageTimeout: 30000,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: actualContentHeight,
        onclone: (clonedDoc) => {
          // 클론된 문서에서 CSS 완전히 리셋 및 강제 적용
          const clonedDiv = clonedDoc.querySelector('div')
          if (clonedDiv) {
            // CSS Reset
            clonedDiv.style.cssText = `
              position: static !important;
              left: auto !important;
              top: auto !important;
              width: 794px !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              padding: 25px !important;
              margin: 0 !important;
              border: none !important;
              outline: none !important;
              box-shadow: none !important;
              text-shadow: none !important;
              transform: none !important;
              opacity: 1 !important;
              visibility: visible !important;
              z-index: auto !important;
              overflow: visible !important;
              font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif !important;
              font-size: 12px !important;
              line-height: 1.6 !important;
              font-weight: 400 !important;
              letter-spacing: -0.02em !important;
              box-sizing: border-box !important;
            `
            
            // 모든 하위 요소에 배경색과 텍스트 색상 강제 적용
            const allElements = clonedDiv.querySelectorAll('*')
            allElements.forEach((el: any) => {
              if (el.style) {
                const computedStyle = window.getComputedStyle(el)
                const currentBg = el.style.backgroundColor || computedStyle.backgroundColor
                const currentColor = el.style.color || computedStyle.color
                
                if (!currentBg || currentBg === 'rgba(0, 0, 0, 0)' || currentBg === 'transparent') {
                  el.style.backgroundColor = '#ffffff !important'
                } else if (!currentBg.includes('#f')) {
                  el.style.backgroundColor = currentBg + ' !important'
                }
                
                if (!currentColor || currentColor.includes('rgb(0, 0, 0)')) {
                  el.style.color = '#000000 !important'
                } else {
                  el.style.color = currentColor + ' !important'
                }
                
                el.style.textShadow = 'none !important'
                el.style.boxShadow = 'none !important'
                el.style.outline = 'none !important'
                el.style.border = el.style.border || 'none'
              }
            })
          }
        }
      })

      // DOM 요소 제거
      document.body.removeChild(tempDiv)

      // PDF에 이미지 추가
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgWidth = this.pageWidth - (this.margin * 2)
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // 페이지가 길면 여러 페이지로 분할
      const pageHeight = this.pageHeight - (this.margin * 2)

      // 콘텐츠가 한 페이지 안에 들어가는 경우 (가장 일반적인 케이스)
      if (imgHeight <= pageHeight) {
        // 단일 페이지: 전체 이미지를 그대로 추가
        this.doc.addImage(
          imgData,
          'JPEG',
          this.margin,
          this.margin,
          imgWidth,
          imgHeight
        )
      } else {
        // 다중 페이지: 이미지를 잘라서 여러 페이지에 나눠 추가
        let remainingHeight = imgHeight
        let yPosition = 0
        let isFirstPage = true

        while (remainingHeight > 0) {
          const currentPageHeight = Math.min(pageHeight, remainingHeight)

          // 너무 작은 높이(5mm 미만)의 페이지는 생성하지 않음
          if (currentPageHeight < 5) {
            break
          }

          // 첫 페이지가 아니면 새 페이지 추가
          if (!isFirstPage) {
            this.doc.addPage()
          }

          // 이미지를 잘라서 현재 페이지에 추가
          const cropCanvas = document.createElement('canvas')
          const cropCtx = cropCanvas.getContext('2d')

          if (cropCtx) {
            const sourceY = yPosition * (canvas.height / imgHeight)
            const sourceHeight = currentPageHeight * (canvas.height / imgHeight)

            cropCanvas.width = canvas.width
            cropCanvas.height = sourceHeight

            cropCtx.drawImage(
              canvas,
              0, sourceY,
              canvas.width, sourceHeight,
              0, 0,
              canvas.width, sourceHeight
            )

            const cropImgData = cropCanvas.toDataURL('image/jpeg', 0.95)

            this.doc.addImage(
              cropImgData,
              'JPEG',
              this.margin,
              this.margin,
              imgWidth,
              currentPageHeight
            )
          }

          remainingHeight -= currentPageHeight
          yPosition += currentPageHeight
          isFirstPage = false
        }
      }

      return new Blob([this.doc.output('blob')], { type: 'application/pdf' })
      
    } catch (error) {
      console.error('한글 PDF 생성 오류:', error)
      throw error
    }
  }

  private generateHtmlContent(data: PermitPdfData): string {
    const businessName = this.escapeHtml(data.permitInfo.businessName)
    const localGovernment = this.escapeHtml(data.permitInfo.localGovernment)

    // ✅ 각 배출구의 시설 시작 인덱스 계산
    let dischargeStartIndex = 0
    let preventionStartIndex = 0
    const outletStartIndices: Array<{ discharge: number; prevention: number }> = []

    data.outlets.forEach(outlet => {
      outletStartIndices.push({
        discharge: dischargeStartIndex,
        prevention: preventionStartIndex
      })
      dischargeStartIndex += outlet.dischargeFacilities.length
      preventionStartIndex += outlet.preventionFacilities.length
    })

    return `
      <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 10px; line-height: 1.5; font-weight: 400; letter-spacing: -0.02em; background-color: #ffffff; color: #000000;">
        <!-- 제목 -->
        <div style="text-align: center; margin-bottom: 20px; background-color: #ffffff;">
          <h1 style="font-size: 22px; font-weight: bold; margin: 0; color: #1a1a1a; border-bottom: 3px solid #2563eb; padding-bottom: 8px; background-color: #ffffff;">
            대기배출시설 허가증
          </h1>
        </div>

        <!-- 기본 정보 -->
        <div style="margin-bottom: 20px; background-color: #ffffff;">
          <h2 style="font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 12px; border-left: 4px solid #2563eb; padding-left: 8px; background-color: #ffffff;">
            기본 정보
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; background-color: #ffffff; font-size: 11px;">
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; width: 25%; color: #000000;">사업장명</td>
              <td style="border: 1px solid #ddd; padding: 8px; width: 25%; background-color: #ffffff; color: #000000;">${businessName}</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; width: 25%; color: #000000;">사업장관리코드</td>
              <td style="border: 1px solid #ddd; padding: 8px; width: 25%; background-color: #ffffff; color: #000000;">${this.escapeHtml(data.permitInfo.businessManagementCode)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #000000;">지자체</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${localGovernment}</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #000000;">업종</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.escapeHtml(data.permitInfo.businessType)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #000000;">최초신고일</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.formatDate(data.permitInfo.firstReportDate)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #000000;">가동개시일</td>
              <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.formatDate(data.permitInfo.operationStartDate)}</td>
            </tr>
          </table>

          <!-- VPN 정보 -->
          ${(data.permitInfo.vpnWired > 0 || data.permitInfo.vpnWireless > 0) ? `
          <div style="margin-top: 10px; padding: 8px; background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 11px;">
            <div style="font-weight: bold; color: #1e40af; margin-bottom: 6px;">VPN 정보</div>
            <div style="display: flex; gap: 15px; color: #1e3a8a;">
              ${data.permitInfo.vpnWired > 0 ? `<span>• 유선 VPN: ${data.permitInfo.vpnWired}개</span>` : ''}
              ${data.permitInfo.vpnWireless > 0 ? `<span>• 무선 VPN: ${data.permitInfo.vpnWireless}개</span>` : ''}
            </div>
          </div>
          ` : ''}
        </div>

        <!-- 배출구별 시설 정보 -->
        <div style="margin-bottom: 20px; background-color: #ffffff;">
          <h2 style="font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 12px; border-left: 4px solid #2563eb; padding-left: 8px; background-color: #ffffff;">
            배출구별 시설 정보
          </h2>
          
          ${data.outlets.map((outlet, index) => this.generateOutletHtml(outlet, index, outletStartIndices[index])).join('')}
        </div>

        <!-- 메모 섹션 -->
        ${data.permitInfo.memo ? `
        <div style="margin-bottom: 20px; background-color: #ffffff;">
          <h2 style="font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 12px; border-left: 4px solid #2563eb; padding-left: 8px; background-color: #ffffff;">
            메모
          </h2>
          <div style="border: 1px solid #ddd; padding: 10px; background-color: #fafafa; border-radius: 4px; color: #000000; font-size: 11px;">
            ${this.escapeHtml(data.permitInfo.memo).replace(/\n/g, '<br>')}
          </div>
        </div>
        ` : ''}

        <!-- 하단 정보 -->
        <div style="margin-top: 25px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px; background-color: #ffffff;">
          <p style="margin: 4px 0; color: #6b7280;">생성일시: ${this.formatDateTime(new Date().toISOString())}</p>
          <p style="margin: 4px 0; color: #6b7280;">대기필증 ID: ${this.escapeHtml(data.permitInfo.id)}</p>
        </div>
      </div>
    `
  }

  private generateOutletHtml(
    outlet: PermitPdfData['outlets'][0],
    index: number,
    startIndices: { discharge: number; prevention: number }
  ): string {
    // 게이트웨이 표시 이름 생성
    const gatewayDisplay = outlet.gateway
      ? (outlet.gateway.match(/gateway(\d+)/)
          ? `Gateway ${outlet.gateway.match(/gateway(\d+)/)?.[1]}`
          : outlet.gateway)
      : '미할당'

    // 배출시설과 방지시설의 최대 개수를 구함 (한 행으로 표시하기 위해)
    const maxFacilities = Math.max(
      outlet.dischargeFacilities.length,
      outlet.preventionFacilities.length
    )

    // 게이트웨이별 색상 직접 매핑
    const gatewayColorMap: { [key: string]: { bg: string; text: string; border: string } } = {
      'gateway1': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
      'gateway2': { bg: '#d1fae5', text: '#059669', border: '#10b981' },
      'gateway3': { bg: '#fce7f3', text: '#be185d', border: '#ec4899' },
      'gateway4': { bg: '#fef3c7', text: '#b45309', border: '#f59e0b' },
      'gateway5': { bg: '#e0e7ff', text: '#4338ca', border: '#6366f1' },
      'gateway6': { bg: '#fce4ec', text: '#c2185b', border: '#e91e63' },
      'gateway7': { bg: '#e1f5fe', text: '#01579b', border: '#03a9f4' },
      'gateway8': { bg: '#f3e5f5', text: '#6a1b9a', border: '#9c27b0' },
      'gateway9': { bg: '#fff3e0', text: '#e65100', border: '#ff9800' },
      'gateway10': { bg: '#e8f5e9', text: '#2e7d32', border: '#4caf50' },
    }

    // 기본 색상
    const defaultColor = { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' }

    // 현재 게이트웨이 색상 선택
    const gatewayColor = outlet.gateway && gatewayColorMap[outlet.gateway.toLowerCase()]
      ? gatewayColorMap[outlet.gateway.toLowerCase()]
      : defaultColor

    // 게이트웨이 뱃지 HTML 생성 (인라인 스타일로 직접 색상 적용 - 테두리 제거)
    const gatewayBadgeHtml = outlet.gateway
      ? `<span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: bold; color: ${gatewayColor.text}; background-color: ${gatewayColor.bg}; padding: 2px 6px; border-radius: 3px;">🌐 ${gatewayDisplay}</span>`
      : ''

    // 시설이 하나도 없는 경우 처리
    if (maxFacilities === 0) {
      return `
        <div style="margin-bottom: 15px; border: 3px solid ${gatewayColor.border}; border-radius: 4px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${gatewayColor.bg}; padding: 8px; border-bottom: 2px solid ${gatewayColor.border};">
            <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: ${gatewayColor.text}; background-color: transparent;">
              ${this.escapeHtml(outlet.outletName)} (배출구 #${outlet.outletNumber})
              ${gatewayBadgeHtml}
            </h3>
          </div>
          <div style="padding: 10px; background-color: #ffffff; color: #6b7280; text-align: center; font-size: 11px;">
            등록된 시설이 없습니다.
          </div>
        </div>
      `
    }

    return `
      <div style="margin-bottom: 15px; border: 3px solid ${gatewayColor.border}; border-radius: 4px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: ${gatewayColor.bg}; padding: 8px; border-bottom: 2px solid ${gatewayColor.border};">
          <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: ${gatewayColor.text}; background-color: transparent;">
            ${this.escapeHtml(outlet.outletName)} (배출구 #${outlet.outletNumber})
            ${gatewayBadgeHtml}
          </h3>
        </div>

        <div style="padding: 10px; background-color: #ffffff;">
          <!-- 배출시설과 방지시설을 한 행으로 표시 (최적화된 레이아웃) -->
          <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; font-size: 9px; line-height: 1.3;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <!-- 배출시설 헤더 -->
                <th colspan="6" style="border: 1px solid #ddd; padding: 6px; font-weight: bold; text-align: center; background-color: #fef2f2; color: #dc2626; font-size: 10px;">
                  🏭 배출시설
                </th>
                <!-- 방지시설 헤더 -->
                <th colspan="6" style="border: 1px solid #ddd; padding: 6px; font-weight: bold; text-align: center; background-color: #f0fdf4; color: #059669; font-size: 10px;">
                  🛡️ 방지시설
                </th>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <!-- 배출시설 컬럼 -->
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">시설번호</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 13%; font-size: 9px;">시설명</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">용량</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 5%; font-size: 9px;">수량</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">그린링크</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">메모</th>
                <!-- 방지시설 컬럼 -->
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">시설번호</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 13%; font-size: 9px;">시설명</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">용량</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 5%; font-size: 9px;">수량</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">그린링크</th>
                <th style="border: 1px solid #ddd; padding: 5px 3px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%; font-size: 9px;">메모</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: maxFacilities }).map((_, i) => {
                const dischargeFacility = outlet.dischargeFacilities[i]
                const preventionFacility = outlet.preventionFacilities[i]

                // 배출시설 정보 생성
                let dischargeHtml = ''
                if (dischargeFacility) {
                  // ✅ 전체 배출시설 기준 연속 번호 계산
                  const facilityGlobalIndex = startIndices.discharge + i + 1
                  const defaultNum = dischargeFacility.defaultFacilityNumber || `배${facilityGlobalIndex}`
                  const userNum = dischargeFacility.facilityNumber || ''
                  const displayNum = userNum ? `${defaultNum} (${userNum})` : defaultNum
                  dischargeHtml = `
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000; font-weight: bold;">${this.escapeHtml(displayNum)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; background-color: #ffffff; color: #000000;">${this.escapeHtml(dischargeFacility.name)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(dischargeFacility.capacity)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${dischargeFacility.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(dischargeFacility.greenLinkCode || '')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; background-color: #ffffff; color: #000000;">${this.escapeHtml(dischargeFacility.memo || '')}</td>
                  `
                } else {
                  dischargeHtml = `
                    <td colspan="6" style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #fafafa; color: #9ca3af;">-</td>
                  `
                }

                // 방지시설 정보 생성
                let preventionHtml = ''
                if (preventionFacility) {
                  // ✅ 전체 방지시설 기준 연속 번호 계산
                  const facilityGlobalIndex = startIndices.prevention + i + 1
                  const defaultNum = preventionFacility.defaultFacilityNumber || `방${facilityGlobalIndex}`
                  const userNum = preventionFacility.facilityNumber || ''
                  const displayNum = userNum ? `${defaultNum} (${userNum})` : defaultNum
                  preventionHtml = `
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000; font-weight: bold;">${this.escapeHtml(displayNum)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; background-color: #ffffff; color: #000000;">${this.escapeHtml(preventionFacility.name)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(preventionFacility.capacity)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${preventionFacility.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(preventionFacility.greenLinkCode || '')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px 3px; background-color: #ffffff; color: #000000;">${this.escapeHtml(preventionFacility.memo || '')}</td>
                  `
                } else {
                  preventionHtml = `
                    <td colspan="6" style="border: 1px solid #ddd; padding: 4px 3px; text-align: center; background-color: #fafafa; color: #9ca3af;">-</td>
                  `
                }

                return `
                  <tr>
                    ${dischargeHtml}
                    ${preventionHtml}
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  private escapeHtml(unsafe: string | null | undefined): string {
    if (!unsafe) return ''
    
    // UTF-8 문자열을 안전하게 처리
    let safe = String(unsafe)
    
    // HTML 특수문자 이스케이프
    safe = safe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
    
    // 특수 기호들을 HTML 엔티티로 변환
    const specialChars: { [key: string]: string } = {
      '©': '&copy;',
      '®': '&reg;',
      '™': '&trade;',
      '℃': '&#8451;',
      '℉': '&#8457;',
      '±': '&plusmn;',
      '×': '&times;',
      '÷': '&divide;',
      '≥': '&ge;',
      '≤': '&le;',
      '≠': '&ne;',
      '→': '&rarr;',
      '←': '&larr;',
      '↑': '&uarr;',
      '↓': '&darr;',
      '∞': '&infin;',
      '∑': '&sum;',
      '∏': '&prod;',
      '∫': '&int;',
      '√': '&radic;',
      '∂': '&part;',
      '∆': '&Delta;',
      '∇': '&nabla;',
      '⊕': '&oplus;',
      '⊗': '&otimes;',
      '⊥': '&perp;',
      '∥': '&par;',
      '∠': '&ang;',
      '∴': '&there4;',
      '∵': '&becaus;',
      '∈': '&isin;',
      '∉': '&notin;',
      '∋': '&ni;',
      '∅': '&empty;',
      '∩': '&cap;',
      '∪': '&cup;',
      '⊂': '&sub;',
      '⊃': '&sup;',
      '⊆': '&sube;',
      '⊇': '&supe;',
      // 화살표 및 기타 기호들
      '⇒': '&rArr;',
      '⇐': '&lArr;',
      '⇑': '&uArr;',
      '⇓': '&dArr;',
      '⇔': '&hArr;',
      // 단위 기호들
      'µ': '&micro;',
      'Ω': '&Omega;',
      'α': '&alpha;',
      'β': '&beta;',
      'γ': '&gamma;',
      'δ': '&delta;',
      'π': '&pi;',
      'σ': '&sigma;',
      'λ': '&lambda;'
    }
    
    // 특수문자 변환
    for (const [char, entity] of Object.entries(specialChars)) {
      safe = safe.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), entity)
    }
    
    return safe
  }

  private formatDate(dateString: string | null): string {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  private formatDateTime(dateString: string): string {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateString
    }
  }
}

// 한글 지원 PDF 생성 함수 export
export async function generateKoreanAirPermitPdf(data: PermitPdfData): Promise<Blob> {
  const generator = new KoreanAirPermitPdfGenerator()
  return await generator.generatePdf(data)
}