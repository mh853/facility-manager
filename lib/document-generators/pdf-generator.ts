// lib/document-generators/pdf-generator.ts
// PDF 문서 생성 유틸리티

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PurchaseOrderData } from '@/types/document-automation'

// 한글 폰트 설정을 위한 타입 확장
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable
  }
}

/**
 * 발주서 PDF 파일 생성
 */
export async function generatePurchaseOrderPDF(
  data: PurchaseOrderData
): Promise<Buffer> {
  // A4 세로 문서 생성
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  let yPosition = margin

  // ========== 1. 제목 ==========
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  // 한글 대신 영문 제목 사용 (한글 폰트 문제로 인해)
  doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // ========== 2. 발주 정보 ==========
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // 발주일자와 제조사를 한 줄에 표시
  doc.text(`발주일자: ${data.order_date}`, margin, yPosition)
  doc.text(
    `제조사: ${getManufacturerName(data.manufacturer)}`,
    pageWidth - margin - 50,
    yPosition
  )
  yPosition += 10

  // ========== 3. 수신처 정보 박스 ==========
  doc.setFillColor(68, 114, 196)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('수신처', margin + 3, yPosition + 5.5)
  yPosition += 8

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // 사업장명
  doc.setFillColor(231, 230, 230)
  doc.rect(margin, yPosition, 40, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('사업장명', margin + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.business_name, margin + 45, yPosition + 5)
  yPosition += 7

  // 주소
  doc.setFillColor(231, 230, 230)
  doc.rect(margin, yPosition, 40, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('주소', margin + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.address, margin + 45, yPosition + 5)
  yPosition += 7

  // 담당자 및 연락처
  doc.setFillColor(231, 230, 230)
  doc.rect(margin, yPosition, 40, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('담당자', margin + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.manager_name, margin + 45, yPosition + 5)

  doc.setFillColor(231, 230, 230)
  doc.rect(pageWidth / 2, yPosition, 40, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('연락처', pageWidth / 2 + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.manager_contact, pageWidth / 2 + 45, yPosition + 5)
  yPosition += 10

  // ========== 4. 납품처 정보 박스 ==========
  doc.setFillColor(68, 114, 196)
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('납품처', margin + 3, yPosition + 5.5)
  yPosition += 8

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // 납품주소
  doc.setFillColor(231, 230, 230)
  doc.rect(margin, yPosition, 40, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('납품주소', margin + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.delivery_address, margin + 45, yPosition + 5)
  yPosition += 10

  // ========== 5. 발주 품목 테이블 ==========
  const tableData = data.item_details.map((item, index) => [
    (index + 1).toString(),
    item.item_name,
    item.specification,
    item.quantity.toString(),
    item.unit_price.toLocaleString('ko-KR'),
    item.total_price.toLocaleString('ko-KR'),
    item.notes || ''
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [['No', '품목명', '규격', '수량', '단가', '금액', '비고']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [68, 114, 196],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 40 },
      2: { cellWidth: 35 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 28 }
    },
    margin: { left: margin, right: margin }
  })

  // 테이블 종료 위치 가져오기
  yPosition = (doc as any).lastAutoTable.finalY + 5

  // ========== 6. 합계 ==========
  const summaryX = pageWidth - margin - 60
  const summaryWidth = 60

  // 소계
  doc.setFillColor(231, 230, 230)
  doc.rect(summaryX, yPosition, 30, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('소계', summaryX + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    data.subtotal.toLocaleString('ko-KR'),
    summaryX + summaryWidth - 3,
    yPosition + 5,
    { align: 'right' }
  )
  yPosition += 7

  // VAT
  doc.setFillColor(231, 230, 230)
  doc.rect(summaryX, yPosition, 30, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('VAT (10%)', summaryX + 3, yPosition + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    data.vat.toLocaleString('ko-KR'),
    summaryX + summaryWidth - 3,
    yPosition + 5,
    { align: 'right' }
  )
  yPosition += 7

  // 합계
  doc.setFillColor(68, 114, 196)
  doc.rect(summaryX, yPosition, summaryWidth, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('합계', summaryX + 3, yPosition + 6)
  doc.text(
    data.grand_total.toLocaleString('ko-KR'),
    summaryX + summaryWidth - 3,
    yPosition + 6,
    { align: 'right' }
  )
  yPosition += 10

  // ========== 7. 특이사항 ==========
  if (data.special_notes) {
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)

    doc.setFillColor(231, 230, 230)
    doc.rect(margin, yPosition, 40, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text('특이사항', margin + 3, yPosition + 5)

    doc.setFont('helvetica', 'normal')
    const splitNotes = doc.splitTextToSize(
      data.special_notes,
      pageWidth - margin - 45
    )
    doc.text(splitNotes, margin + 45, yPosition + 5)
  }

  // PDF를 Buffer로 변환
  const pdfBlob = doc.output('arraybuffer')
  return Buffer.from(pdfBlob)
}

/**
 * 제조사명 한글 변환
 */
function getManufacturerName(manufacturer: string): string {
  const names: Record<string, string> = {
    ecosense: '에코센스',
    gaia_cns: '가이아씨앤에스',
    cleanearth: '크린어스',
    evs: 'EVS'
  }
  return names[manufacturer] || manufacturer
}
