// lib/document-generators/excel-generator-ecosense.ts
// 에코센스 전용 발주서 Excel 생성기

import ExcelJS from 'exceljs'
import type { PurchaseOrderData } from '@/types/document-automation'

export interface EcosensePurchaseOrderData extends PurchaseOrderData {
  // 추가 필드
  manager_name?: string // 담당자명
  manager_contact?: string // 담당자 연락처
  manager_email?: string // 담당자 이메일
  installation_desired_date: string // 설치 희망날짜 (오늘 +7일)

  // 설치 공장 정보
  factory_name: string // 공장명 (business_name)
  factory_address: string // 공장주소 (address)
  factory_manager: string // 담당자 (manager_name from business_info)
  factory_contact: string // 연락처 (manager_contact from business_info)

  // 택배 주소
  delivery_recipient?: string // 수령인
  delivery_contact?: string // 연락처
  delivery_postal_code?: string // 우편번호
  delivery_full_address?: string // 전체 주소
  delivery_address_detail?: string // 상세 주소

  // 그린링크 정보
  greenlink_id?: string
  greenlink_pw?: string
}

export async function generateEcosensePurchaseOrderExcel(
  data: EcosensePurchaseOrderData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('발주서')

  // 페이지 설정
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  }

  // 컬럼 너비 설정
  worksheet.columns = [
    { width: 8 },   // A
    { width: 12 },  // B
    { width: 12 },  // C
    { width: 12 },  // D
    { width: 12 },  // E
    { width: 12 },  // F
    { width: 12 },  // G
    { width: 12 }   // H
  ]

  let currentRow = 1

  // ============================================================================
  // 헤더: 발주서 제목 및 수신/발신/참고 정보
  // ============================================================================

  // 제목 행
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
  const titleCell = worksheet.getCell(`A${currentRow}`)
  titleCell.value = '발    주    서'
  titleCell.font = { name: '맑은 고딕', size: 20, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(currentRow).height = 30
  currentRow++

  // 수신/발신/참고 정보
  currentRow++ // 빈 행

  // 수신/발신
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
  const senderCell = worksheet.getCell(`A${currentRow}`)
  senderCell.value = '수신 :  (주)에코센스\n참조 :  영업담당자'
  senderCell.font = { name: '맑은 고딕', size: 10 }
  senderCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

  worksheet.mergeCells(`D${currentRow}:E${currentRow}`)
  const dateHeaderCell = worksheet.getCell(`D${currentRow}`)
  dateHeaderCell.value = '(안)'
  dateHeaderCell.font = { name: '맑은 고딕', size: 10 }
  dateHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.mergeCells(`F${currentRow}:H${currentRow}`)
  const fromCell = worksheet.getCell(`F${currentRow}`)
  fromCell.value = '발신 :  주식회사 블루온\n담당자 :  김문수 부사장'
  fromCell.font = { name: '맑은 고딕', size: 10 }
  fromCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

  worksheet.getRow(currentRow).height = 30
  currentRow++

  // 날짜 및 통돌번호
  worksheet.getCell(`A${currentRow}`).value = data.order_date
  worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`B${currentRow}:C${currentRow}`)
  worksheet.getCell(`B${currentRow}`).value = '통돌번호\n생포접(관리번호)'
  worksheet.getCell(`B${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  worksheet.getCell(`B${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`D${currentRow}:E${currentRow}`)
  worksheet.getCell(`D${currentRow}`).value = '주식회사 블루온\n경기도 안성시 원곡면 지문 285'
  worksheet.getCell(`D${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  worksheet.getCell(`D${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = '대표자\n김경수'
  worksheet.getCell(`F${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  worksheet.getCell(`F${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`H${currentRow}`).value = '비고'
  worksheet.getCell(`H${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`H${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`H${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
  worksheet.getRow(currentRow).height = 30
  currentRow++

  // 두 번째 상세 정보 행
  worksheet.getCell(`A${currentRow}`).value = '(주)에코센스 귀하\n아래와 같이 발주합니다.'
  worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  worksheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`B${currentRow}:C${currentRow}`)
  worksheet.getCell(`B${currentRow}`).value = '담화'
  worksheet.getCell(`B${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`B${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`D${currentRow}:E${currentRow}`)
  worksheet.getCell(`D${currentRow}`).value = '비아스팀'
  worksheet.getCell(`D${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`D${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = '총액'
  worksheet.getCell(`F${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`F${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`H${currentRow}`).value = '도로교통외/밀무방법비용'
  worksheet.getCell(`H${currentRow}`).font = { name: '맑은 고딕', size: 8 }
  worksheet.getCell(`H${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  worksheet.getCell(`H${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
  worksheet.getRow(currentRow).height = 30
  currentRow++

  // 발주내역 IoT 헤더
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = '발주내역 IoT'
  worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 9, bold: true }
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`C${currentRow}`).value = '단위'
  worksheet.getCell(`C${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`C${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`D${currentRow}`).value = '수량'
  worksheet.getCell(`D${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`D${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`E${currentRow}`).value = '단가(원)'
  worksheet.getCell(`E${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`E${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`F${currentRow}`).value = '금액(원)'
  worksheet.getCell(`F${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`F${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  worksheet.getCell(`G${currentRow}`).value = '비고'
  worksheet.getCell(`G${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`G${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`G${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
  currentRow++

  // 품목 행
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = '품목'
  worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  // 품목 데이터 계산
  const totalGateway = (data.equipment.gateway_1_2 || 0) + (data.equipment.gateway_3_4 || 0) // ✅ Gateway split fields
  const equipmentData = [
    { name: '대기관', count: totalGateway },
    { name: '온도계', count: data.equipment.temperature_meter || 0 },
    { name: '단가(원)', header: true },
    { name: 'GW(1,2)', count: data.equipment.gateway_1_2 || 0 }, // ✅ Gateway split fields
    { name: 'GW(3,4)', count: data.equipment.gateway_3_4 || 0 }, // ✅ Gateway split fields
    { name: 'VPN', count: (data.equipment.vpn_router_wired || 0) + (data.equipment.vpn_router_wireless || 0) }
  ]

  worksheet.getCell(`C${currentRow}`).value = equipmentData[0].name
  worksheet.getCell(`D${currentRow}`).value = equipmentData[0].count
  worksheet.getCell(`E${currentRow}`).value = equipmentData[1].name
  worksheet.getCell(`F${currentRow}`).value = equipmentData[1].count
  worksheet.getCell(`G${currentRow}`).value = equipmentData[2].name

  for (let col = 'C'; col <= 'G'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
    worksheet.getCell(`${col}${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`${col}${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  currentRow++

  // 총수량 행
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
  worksheet.getCell(`A${currentRow}`).value = '총수량'
  worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 9 }
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  const totalQuantity = Object.values(data.equipment).reduce((sum, val) => sum + (val || 0), 0)

  worksheet.getCell(`C${currentRow}`).value = equipmentData[3].count
  worksheet.getCell(`D${currentRow}`).value = equipmentData[4].count
  worksheet.getCell(`E${currentRow}`).value = equipmentData[5].count

  worksheet.mergeCells(`F${currentRow}:G${currentRow}`)
  worksheet.getCell(`F${currentRow}`).value = `${data.grand_total.toLocaleString()} 원(부가세포함)`
  worksheet.getCell(`F${currentRow}`).font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFF0000' } }
  worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getCell(`F${currentRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  for (let col = 'C'; col <= 'E'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
    worksheet.getCell(`${col}${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`${col}${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  worksheet.getRow(currentRow).height = 20
  currentRow++

  // ============================================================================
  // 필수 기입 / 제조(O) 사항 섹션
  // ============================================================================

  currentRow++ // 빈 행

  worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
  const sectionHeader = worksheet.getCell(`A${currentRow}`)
  sectionHeader.value = '필수 기입 / 제조(O) 사항'
  sectionHeader.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  sectionHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  sectionHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF000000' }
  }
  sectionHeader.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
  worksheet.getRow(currentRow).height = 25
  currentRow++

  // 상세 정보 테이블 시작
  const detailSections = [
    {
      title: '1',
      subtitle: '설치\n성격(관리)당자',
      rows: [
        { label: '공장명', value: data.factory_name, colspan: 3 },
        { label: '담당자명', value: data.factory_manager, label2: '연락처', value2: data.factory_contact || '', label3: '이메일', value3: data.manager_email || '@korvoscc.com' }
      ]
    },
    {
      title: '2',
      subtitle: '설치공장정보',
      rows: [
        { label: '공장명', value: data.factory_name, colspan: 3 },
        { label: '택배주소', value: data.delivery_full_address || data.factory_address, fullRow: true }
      ]
    },
    {
      title: '3',
      subtitle: '그린링크정보\n(코드번호)',
      rows: [
        {
          label: '',
          value: data.greenlink_id || '4402269',
          multiColumn: [
            { label: '출동신고드(F)', value: 'F0002' },
            { label: '방식지설코드(P)', value: 'P0502', color: 'red' },
            { label: '배출시설코드(E)', value: 'E3606' }
          ]
        },
        {
          label: '',
          value: '',
          multiColumn: [
            { label: '', value: 'F0003' },
            { label: '', value: 'P0503', color: 'red' },
            { label: '', value: 'E3607' }
          ]
        }
      ]
    }
  ]

  // 각 섹션 렌더링 (간소화된 버전)
  for (const section of detailSections) {
    const sectionStartRow = currentRow

    // NO 열
    worksheet.getCell(`A${currentRow}`).value = section.title
    worksheet.getCell(`A${currentRow}`).font = { name: '맑은 고딕', size: 10, bold: true }
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`A${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }

    // 항목 열
    worksheet.getCell(`B${currentRow}`).value = section.subtitle
    worksheet.getCell(`B${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    worksheet.getCell(`B${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }

    // 상세 정보 (간소화)
    worksheet.mergeCells(`C${currentRow}:H${currentRow}`)
    let detailText = ''
    for (const row of section.rows) {
      if (row.fullRow) {
        detailText += `${row.label}: ${row.value}\n`
      } else if (row.colspan) {
        detailText += `${row.label}: ${row.value}\n`
      } else {
        detailText += `${row.label}: ${row.value} | ${row.label2}: ${row.value2}\n`
      }
    }
    worksheet.getCell(`C${currentRow}`).value = detailText.trim()
    worksheet.getCell(`C${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    worksheet.getCell(`C${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }

    worksheet.getRow(currentRow).height = 40
    currentRow++
  }

  // ============================================================================
  // 하단 정보 섹션
  // ============================================================================

  currentRow++ // 빈 행

  // 구분/이름/연락처/이메일 테이블
  const contactStartRow = currentRow

  // 헤더
  worksheet.getCell(`A${currentRow}`).value = '구분'
  worksheet.getCell(`B${currentRow}`).value = '이름'
  worksheet.getCell(`C${currentRow}`).value = ''
  worksheet.getCell(`D${currentRow}`).value = '연락처'
  worksheet.getCell(`E${currentRow}`).value = ''
  worksheet.getCell(`F${currentRow}`).value = '이메일'

  for (let col = 'A'; col <= 'F'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
    worksheet.getCell(`${col}${currentRow}`).font = { name: '맑은 고딕', size: 9, bold: true }
    worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`${col}${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  currentRow++

  // 발주담당
  worksheet.getCell(`A${currentRow}`).value = '발주담당'
  worksheet.getCell(`B${currentRow}`).value = data.manager_name || '김문수'
  worksheet.getCell(`D${currentRow}`).value = data.manager_contact || '010-4320-3521'
  worksheet.getCell(`F${currentRow}`).value = data.manager_email || 'seoh1521@gmail.com'

  for (let col = 'A'; col <= 'F'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
    worksheet.getCell(`${col}${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`${col}${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  currentRow++

  // 제조설치담당
  worksheet.getCell(`A${currentRow}`).value = '제조설치담당'
  worksheet.getCell(`B${currentRow}`).value = '김경수'
  worksheet.getCell(`D${currentRow}`).value = '010-2758-4273'
  worksheet.getCell(`F${currentRow}`).value = 'gong0900@naver.com'

  for (let col = 'A'; col <= 'F'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
    worksheet.getCell(`${col}${currentRow}`).font = { name: '맑은 고딕', size: 9 }
    worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(`${col}${currentRow}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  currentRow++

  // 특이사항
  currentRow++
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
  const notesCell = worksheet.getCell(`A${currentRow}`)
  notesCell.value = `특이사항\n\n무선으로 설치 시 폐인터넷전화기와 작업 완료 후\n변경 설정에 따라 지연결, 스위치는 제외로 한 후 철수 지 재발송요망.`
  notesCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF0000FF' }, bold: true }
  notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  notesCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
  worksheet.getRow(currentRow).height = 50

  // Excel 버퍼 생성
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
