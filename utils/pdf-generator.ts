// utils/pdf-generator.ts - PDF 생성 유틸리티
import jsPDF from 'jspdf'

// 한글 폰트 지원을 위한 타입 설정
declare module 'jspdf' {
  interface jsPDF {
    autoTable: any
  }
}

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
    }>
    preventionFacilities: Array<{
      name: string
      capacity: string
      quantity: number
    }>
  }>
}

export class AirPermitPdfGenerator {
  private doc: jsPDF
  private readonly pageWidth = 210 // A4 width in mm
  private readonly pageHeight = 297 // A4 height in mm
  private readonly margin = 20
  private readonly contentWidth = this.pageWidth - (this.margin * 2)
  private currentY = this.margin

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4')
  }

  async generatePdf(data: PermitPdfData): Promise<Blob> {
    try {
      // 제목
      this.addTitle('대기배출시설 허가증')
      
      // 기본 정보 섹션
      this.addBasicInfo(data.permitInfo)
      
      // 배출구별 시설 정보
      this.addOutletInfo(data.outlets)
      
      // 메모 섹션
      if (data.permitInfo.memo) {
        this.addMemoSection(data.permitInfo.memo)
      }
      
      // 하단 정보
      this.addFooter(data.permitInfo)
      
      // PDF 생성
      return new Blob([this.doc.output('blob')], { type: 'application/pdf' })
      
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      throw error
    }
  }

  private addTitle(title: string) {
    this.doc.setFontSize(20)
    this.doc.setFont('helvetica', 'bold')
    
    const titleWidth = this.doc.getTextWidth(title)
    const titleX = (this.pageWidth - titleWidth) / 2
    
    this.doc.text(title, titleX, this.currentY)
    this.currentY += 15
    
    // 구분선
    this.doc.setLineWidth(0.5)
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.currentY += 10
  }

  private addBasicInfo(info: PermitPdfData['permitInfo']) {
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('기본 정보', this.margin, this.currentY)
    this.currentY += 8

    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    const infoItems = [
      { label: '사업장명', value: info.businessName },
      { label: '지자체', value: info.localGovernment },
      { label: '업종', value: info.businessType },
      { label: '시설번호', value: info.facilityNumber },
      { label: '그린링크코드', value: info.greenLinkCode },
      { label: '최초신고일', value: this.formatDate(info.firstReportDate) },
      { label: '가동개시일', value: this.formatDate(info.operationStartDate) }
    ]

    infoItems.forEach(item => {
      if (item.value) {
        this.doc.text(`${item.label}: ${item.value}`, this.margin, this.currentY)
        this.currentY += 6
      }
    })

    this.currentY += 5
  }

  private addOutletInfo(outlets: PermitPdfData['outlets']) {
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('배출구별 시설 정보', this.margin, this.currentY)
    this.currentY += 10

    outlets.forEach((outlet, index) => {
      // 페이지 넘김 체크
      if (this.currentY > this.pageHeight - 50) {
        this.doc.addPage()
        this.currentY = this.margin
      }

      // 배출구 제목
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(`${outlet.outletName}`, this.margin, this.currentY)
      this.currentY += 8

      // 배출시설 정보
      if (outlet.dischargeFacilities.length > 0) {
        this.doc.setFontSize(10)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text('배출시설:', this.margin + 5, this.currentY)
        this.currentY += 6

        this.doc.setFont('helvetica', 'normal')
        outlet.dischargeFacilities.forEach(facility => {
          const facilityText = `• ${facility.name}${facility.capacity ? ` (${facility.capacity})` : ''}${facility.quantity > 1 ? ` × ${facility.quantity}` : ''}`
          this.doc.text(facilityText, this.margin + 10, this.currentY)
          this.currentY += 5
        })
        this.currentY += 3
      }

      // 방지시설 정보
      if (outlet.preventionFacilities.length > 0) {
        this.doc.setFontSize(10)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text('방지시설:', this.margin + 5, this.currentY)
        this.currentY += 6

        this.doc.setFont('helvetica', 'normal')
        outlet.preventionFacilities.forEach(facility => {
          const facilityText = `• ${facility.name}${facility.capacity ? ` (${facility.capacity})` : ''}${facility.quantity > 1 ? ` × ${facility.quantity}` : ''}`
          this.doc.text(facilityText, this.margin + 10, this.currentY)
          this.currentY += 5
        })
      }

      // 배출구 구분선
      if (index < outlets.length - 1) {
        this.currentY += 5
        this.doc.setLineWidth(0.2)
        this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
        this.currentY += 8
      }
    })

    this.currentY += 10
  }

  private addMemoSection(memo: string) {
    // 페이지 넘김 체크
    if (this.currentY > this.pageHeight - 40) {
      this.doc.addPage()
      this.currentY = this.margin
    }

    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('메모', this.margin, this.currentY)
    this.currentY += 8

    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    // 메모 텍스트를 여러 줄로 분할
    const lines = this.doc.splitTextToSize(memo, this.contentWidth)
    lines.forEach((line: string) => {
      this.doc.text(line, this.margin, this.currentY)
      this.currentY += 5
    })

    this.currentY += 10
  }

  private addFooter(info: PermitPdfData['permitInfo']) {
    // 페이지 하단으로 이동
    const footerY = this.pageHeight - 30

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`생성일시: ${this.formatDateTime(new Date().toISOString())}`, this.margin, footerY)
    this.doc.text(`대기필증 ID: ${info.id}`, this.margin, footerY + 5)
    
    // 중앙에 페이지 번호
    const pageNum = `- ${this.doc.internal.pages.length - 1} -`
    const pageNumWidth = this.doc.getTextWidth(pageNum)
    this.doc.text(pageNum, (this.pageWidth - pageNumWidth) / 2, footerY + 10)
  }

  private formatDate(dateString: string): string {
    if (!dateString) return ''
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

// PDF 생성 함수 export
export async function generateAirPermitPdf(data: PermitPdfData): Promise<Blob> {
  const generator = new AirPermitPdfGenerator()
  return await generator.generatePdf(data)
}