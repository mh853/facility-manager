// utils/korean-pdf-generator.ts - 한글 지원 PDF 생성 유틸리티
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

interface PermitPdfData {
  permitInfo: {
    id: string
    businessName: string
    localGovernment: string
    businessType: string
    facilityNumber: string
    greenLinkCode: string
    memo: string
    firstReportDate: string
    operationStartDate: string
    createdAt: string
    updatedAt: string
  }
  outlets: Array<{
    outletNumber: number
    outletName: string
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
  private readonly margin = 15
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
        padding: 40px;
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
              padding: 40px !important;
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
    
    return `
      <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 20px; line-height: 1.6; font-weight: 400; letter-spacing: -0.02em; background-color: #ffffff; color: #000000;">
        <!-- 제목 -->
        <div style="text-align: center; margin-bottom: 30px; background-color: #ffffff;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: #1a1a1a; border-bottom: 3px solid #2563eb; padding-bottom: 10px; background-color: #ffffff;">
            대기배출시설 허가증
          </h1>
        </div>

        <!-- 기본 정보 -->
        <div style="margin-bottom: 30px; background-color: #ffffff;">
          <h2 style="font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; background-color: #ffffff;">
            기본 정보
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #ffffff;">
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; width: 25%; color: #000000;">사업장명</td>
              <td style="border: 1px solid #ddd; padding: 12px; width: 25%; background-color: #ffffff; color: #000000;">${businessName}</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; width: 25%; color: #000000;">지자체</td>
              <td style="border: 1px solid #ddd; padding: 12px; width: 25%; background-color: #ffffff; color: #000000;">${localGovernment}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; color: #000000;">업종</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff; color: #000000;">${this.escapeHtml(data.permitInfo.businessType)}</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; color: #000000;">시설번호</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff; color: #000000;">${this.escapeHtml(data.permitInfo.facilityNumber)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; color: #000000;">그린링크코드</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff; color: #000000;">${this.escapeHtml(data.permitInfo.greenLinkCode)}</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; color: #000000;">최초신고일</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff; color: #000000;">${this.formatDate(data.permitInfo.firstReportDate)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; font-weight: bold; color: #000000;">가동개시일</td>
              <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff; color: #000000;" colspan="3">${this.formatDate(data.permitInfo.operationStartDate)}</td>
            </tr>
          </table>
        </div>

        <!-- 배출구별 시설 정보 -->
        <div style="margin-bottom: 30px; background-color: #ffffff;">
          <h2 style="font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; background-color: #ffffff;">
            배출구별 시설 정보
          </h2>
          
          ${data.outlets.map((outlet, index) => this.generateOutletHtml(outlet, index)).join('')}
        </div>

        <!-- 메모 섹션 -->
        ${data.permitInfo.memo ? `
        <div style="margin-bottom: 30px; background-color: #ffffff;">
          <h2 style="font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; background-color: #ffffff;">
            메모
          </h2>
          <div style="border: 1px solid #ddd; padding: 15px; background-color: #fafafa; border-radius: 4px; color: #000000;">
            ${this.escapeHtml(data.permitInfo.memo).replace(/\n/g, '<br>')}
          </div>
        </div>
        ` : ''}

        <!-- 하단 정보 -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 11px; background-color: #ffffff;">
          <p style="margin: 5px 0; color: #6b7280;">생성일시: ${this.formatDateTime(new Date().toISOString())}</p>
          <p style="margin: 5px 0; color: #6b7280;">대기필증 ID: ${this.escapeHtml(data.permitInfo.id)}</p>
        </div>
      </div>
    `
  }

  private generateOutletHtml(outlet: PermitPdfData['outlets'][0], index: number): string {
    return `
      <div style="margin-bottom: 25px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #f3f4f6; padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #374151; background-color: #f3f4f6;">
            ${this.escapeHtml(outlet.outletName)} (배출구 #${outlet.outletNumber})
          </h3>
        </div>
        
        <div style="padding: 15px; background-color: #ffffff;">
          <!-- 배출시설 -->
          ${outlet.dischargeFacilities.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: bold; color: #dc2626; margin-bottom: 10px; padding: 8px; background-color: #fef2f2; border-left: 4px solid #dc2626;">
              🏭 배출시설
            </h4>
            <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 10%;">시설번호</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 28%;">시설명</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 17%;">용량</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%;">수량</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 17%;">그린링크</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 20%;">메모</th>
                </tr>
              </thead>
              <tbody>
                ${outlet.dischargeFacilities.map((facility, facilityIndex) => {
                  const defaultNum = facility.defaultFacilityNumber || `배${facilityIndex + 1}`
                  const userNum = facility.facilityNumber || ''
                  // 기본값과 사용자 입력값을 함께 표시 (사용자 입력값이 있는 경우)
                  const displayNum = userNum ? `${defaultNum} (${userNum})` : defaultNum
                  return `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000; font-weight: bold;">${this.escapeHtml(displayNum)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.name)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.capacity)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${facility.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.greenLinkCode || '')}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.memo || '')}</td>
                </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- 방지시설 -->
          ${outlet.preventionFacilities.length > 0 ? `
          <div>
            <h4 style="font-size: 14px; font-weight: bold; color: #059669; margin-bottom: 10px; padding: 8px; background-color: #f0fdf4; border-left: 4px solid #059669;">
              🛡️ 방지시설
            </h4>
            <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 10%;">시설번호</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 28%;">시설명</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 17%;">용량</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 8%;">수량</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 17%;">그린링크</th>
                  <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; background-color: #f8f9fa; color: #000000; width: 20%;">메모</th>
                </tr>
              </thead>
              <tbody>
                ${outlet.preventionFacilities.map((facility, facilityIndex) => {
                  const defaultNum = facility.defaultFacilityNumber || `방${facilityIndex + 1}`
                  const userNum = facility.facilityNumber || ''
                  // 기본값과 사용자 입력값을 함께 표시 (사용자 입력값이 있는 경우)
                  const displayNum = userNum ? `${defaultNum} (${userNum})` : defaultNum
                  return `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000; font-weight: bold;">${this.escapeHtml(displayNum)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.name)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.capacity)}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${facility.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.greenLinkCode || '')}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; background-color: #ffffff; color: #000000;">${this.escapeHtml(facility.memo || '')}</td>
                </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
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