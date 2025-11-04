// lib/document-generators/excel-generator.ts
// 엑셀 문서 생성 유틸리티

import ExcelJS from 'exceljs'
import type { PurchaseOrderData } from '@/types/document-automation'

/**
 * 발주서 엑셀 파일 생성
 */
export async function generatePurchaseOrderExcel(
  data: PurchaseOrderData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('발주서')

  // 워크시트 설정
  worksheet.properties.defaultRowHeight = 20

  // 컬럼 너비 설정
  worksheet.columns = [
    { width: 5 },   // A
    { width: 20 },  // B
    { width: 30 },  // C
    { width: 12 },  // D
    { width: 15 },  // E
    { width: 15 },  // F
    { width: 20 }   // G
  ]

  // ========== 1. 제목 ==========
  worksheet.mergeCells('A1:G1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = '발 주 서'
  titleCell.font = { size: 18, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 40

  // ========== 2. 발주 정보 ==========
  worksheet.mergeCells('A3:B3')
  worksheet.getCell('A3').value = '발주일자'
  worksheet.getCell('A3').font = { bold: true }
  worksheet.getCell('A3').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells('C3:D3')
  worksheet.getCell('C3').value = data.order_date
  worksheet.getCell('C3').alignment = { horizontal: 'center' }

  worksheet.mergeCells('E3:F3')
  worksheet.getCell('E3').value = '제조사'
  worksheet.getCell('E3').font = { bold: true }
  worksheet.getCell('E3').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.getCell('G3').value = getManufacturerName(data.manufacturer)
  worksheet.getCell('G3').alignment = { horizontal: 'center' }

  // ========== 3. 수신처 정보 ==========
  worksheet.mergeCells('A5:B5')
  worksheet.getCell('A5').value = '수신처'
  worksheet.getCell('A5').font = { bold: true, size: 12 }
  worksheet.getCell('A5').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  worksheet.getCell('A5').font = { bold: true, color: { argb: 'FFFFFFFF' } }

  worksheet.mergeCells('A6:B6')
  worksheet.getCell('A6').value = '사업장명'
  worksheet.getCell('A6').font = { bold: true }
  worksheet.getCell('A6').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells('C6:G6')
  worksheet.getCell('C6').value = data.business_name

  worksheet.mergeCells('A7:B7')
  worksheet.getCell('A7').value = '주소'
  worksheet.getCell('A7').font = { bold: true }
  worksheet.getCell('A7').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells('C7:G7')
  worksheet.getCell('C7').value = data.address

  worksheet.mergeCells('A8:B8')
  worksheet.getCell('A8').value = '담당자'
  worksheet.getCell('A8').font = { bold: true }
  worksheet.getCell('A8').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells('C8:D8')
  worksheet.getCell('C8').value = data.manager_name

  worksheet.mergeCells('E8:F8')
  worksheet.getCell('E8').value = '연락처'
  worksheet.getCell('E8').font = { bold: true }
  worksheet.getCell('E8').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.getCell('G8').value = data.manager_contact

  // ========== 4. 납품처 정보 ==========
  worksheet.mergeCells('A10:B10')
  worksheet.getCell('A10').value = '납품처'
  worksheet.getCell('A10').font = { bold: true, size: 12 }
  worksheet.getCell('A10').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  worksheet.getCell('A10').font = { bold: true, color: { argb: 'FFFFFFFF' } }

  worksheet.mergeCells('A11:B11')
  worksheet.getCell('A11').value = '납품주소'
  worksheet.getCell('A11').font = { bold: true }
  worksheet.getCell('A11').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells('C11:G11')
  worksheet.getCell('C11').value = data.delivery_address

  // ========== 5. 발주 품목 테이블 ==========
  const tableStartRow = 13

  // 테이블 헤더
  const headerRow = worksheet.getRow(tableStartRow)
  const headers = ['No', '품목명', '규격', '수량', '단가', '금액', '비고']

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })

  // 테이블 데이터
  let currentRow = tableStartRow + 1
  data.item_details.forEach((item, index) => {
    const row = worksheet.getRow(currentRow)
    const cells = [
      index + 1,
      item.item_name,
      item.specification,
      item.quantity,
      item.unit_price,
      item.total_price,
      item.notes || ''
    ]

    cells.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.value = value
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }

      // 숫자 정렬
      if (typeof value === 'number') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.numFmt = '#,##0'
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })

    currentRow++
  })

  // ========== 6. 합계 ==========
  currentRow += 1

  worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = '소계'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`A${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`A${currentRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = data.subtotal
  worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
  worksheet.getCell(`F${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`F${currentRow}`).font = { bold: true }

  currentRow++

  worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = 'VAT (10%)'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`A${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`A${currentRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' }
  }

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = data.vat
  worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
  worksheet.getCell(`F${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`F${currentRow}`).font = { bold: true }

  currentRow++

  worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = '합계'
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 }
  worksheet.getCell(`A${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`A${currentRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  worksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    color: { argb: 'FFFFFFFF' }
  }

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = data.grand_total
  worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
  worksheet.getCell(`F${currentRow}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  worksheet.getCell(`F${currentRow}`).font = { bold: true, size: 12 }
  worksheet.getCell(`F${currentRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFCE4D6' }
  }

  // ========== 7. 특이사항 ==========
  if (data.special_notes) {
    currentRow += 2

    worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
    worksheet.getCell(`A${currentRow}`).value = '특이사항'
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
    }

    worksheet.mergeCells(`C${currentRow}:G${currentRow}`)
    worksheet.getCell(`C${currentRow}`).value = data.special_notes
    worksheet.getCell(`C${currentRow}`).alignment = {
      horizontal: 'left',
      vertical: 'top',
      wrapText: true
    }
  }

  // 모든 셀에 기본 테두리 적용
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) {
      row.eachCell((cell) => {
        if (!cell.border) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }
      })
    }
  })

  // 버퍼로 변환
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
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
