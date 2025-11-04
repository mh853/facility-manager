// lib/document-generators/excel-generator-ecosense-template.ts
// 에코센스 발주서 - Excel 템플릿 기반 생성기

import ExcelJS from 'exceljs'
import path from 'path'
import type { PurchaseOrderDataEcosense } from '@/types/document-automation'

export async function generateEcosensePurchaseOrderFromTemplate(
  data: PurchaseOrderDataEcosense
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // 템플릿 파일 로드
  const templatePath = path.join(
    process.cwd(),
    '양식',
    '@_발주서(에코센스_KT무선)_250701.xlsx'
  )

  console.log('[ECOSENSE-TEMPLATE] 템플릿 로드:', templatePath)

  try {
    await workbook.xlsx.readFile(templatePath)
  } catch (error) {
    console.error('[ECOSENSE-TEMPLATE] 템플릿 로드 실패:', error)
    throw new Error('템플릿 파일을 읽을 수 없습니다')
  }

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error('워크시트를 찾을 수 없습니다')
  }

  console.log('[ECOSENSE-TEMPLATE] 데이터 채우기 시작')

  // ============================================================================
  // 블루온 담당자 정보
  // ============================================================================
  worksheet.getCell('AF3').value = data.manager_name || '담당자'
  worksheet.getCell('K53').value = data.manager_name || '담당자'
  worksheet.getCell('U53').value = data.manager_contact || ''
  worksheet.getCell('AJ53').value = data.manager_email || ''

  // ============================================================================
  // 품목 항목명 및 수량 (12-13행)
  // ============================================================================
  // 먼저 모든 품목 셀을 비움 (템플릿 기본값 제거)
  const allColumns = ['H', 'N', 'T', 'Z', 'AF', 'AL', 'AR']
  allColumns.forEach(col => {
    worksheet.getCell(`${col}12`).value = null
    worksheet.getCell(`${col}13`).value = null
  })

  // 전류계 합산 (미리보기와 동일한 로직)
  const totalCtCount = (data.equipment.discharge_ct || 0) + (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)

  // 품목 데이터 준비 (수량이 0보다 큰 것만 필터링)
  const allEquipmentItems = [
    { name: 'PH센서', count: Number(data.equipment.ph_sensor) || 0 },
    { name: '차압계', count: Number(data.equipment.differential_pressure_meter) || 0 },
    { name: '온도계', count: Number(data.equipment.temperature_meter) || 0 },
    { name: '전류계', count: totalCtCount },  // 전류계 합산값 추가
    { name: '게이트웨이', count: Number(data.equipment.gateway) || 0 },
    { name: 'VPN(유선)', count: Number(data.equipment.vpn_router_wired) || 0 },
    { name: 'VPN(무선)', count: Number(data.equipment.vpn_router_wireless) || 0 },
    { name: '확장디바이스', count: Number(data.equipment.expansion_device) || 0 }
  ]

  // 수량이 0보다 큰 항목만 필터링
  const validItems = allEquipmentItems.filter(item => item.count > 0)

  console.log('[ECOSENSE-TEMPLATE] 품목 항목:', validItems)

  // 왼쪽부터 순서대로 빈칸 없이 배치
  validItems.forEach((item, index) => {
    if (index < allColumns.length) {
      const col = allColumns[index]
      worksheet.getCell(`${col}12`).value = item.name
      worksheet.getCell(`${col}13`).value = item.count
      console.log(`[ECOSENSE-TEMPLATE] 품목 추가: ${col}12=${item.name}, ${col}13=${item.count}`)
    }
  })

  // ============================================================================
  // 발주 금액 (N14 셀에 표시)
  // ============================================================================
  if (data.subtotal) {
    worksheet.getCell('N14').value = data.subtotal
    console.log(`[ECOSENSE-TEMPLATE] 금액 추가: N14=${data.subtotal}`)
  }

  // ============================================================================
  // 설치(납품) 희망일자 - 오늘 +7일
  // ============================================================================
  const today = new Date()
  const installationDate = new Date(today)
  installationDate.setDate(today.getDate() + 7)
  worksheet.getCell('U19').value = data.installation_desired_date || installationDate.toISOString().split('T')[0]

  // ============================================================================
  // 사업장 및 담당자 정보
  // ============================================================================
  worksheet.getCell('K21').value = data.factory_name || data.business_name
  worksheet.getCell('U21').value = data.factory_manager || ''
  worksheet.getCell('AE21').value = data.factory_contact || ''

  // 사업장 담당자 이메일 (블루온 담당자 이메일이 아님!)
  const emailValue = data.factory_email || ''
  worksheet.getCell('AO21').value = emailValue
  console.log('[ECOSENSE-TEMPLATE] AO21 이메일 설정:', {
    factory_email: data.factory_email,
    final_value: emailValue
  })

  // ============================================================================
  // 주소 정보
  // ============================================================================
  worksheet.getCell('U22').value = data.factory_address || data.address
  worksheet.getCell('U23').value = data.delivery_full_address || data.delivery_address || data.address

  // ============================================================================
  // VPN 체크박스 (유선/무선)
  // ============================================================================
  // ExcelJS에서 체크박스는 셀 값으로 표시
  const vpnType = data.vpn_type?.toLowerCase() || 'wired'
  if (vpnType === 'wired' || vpnType === 'lan') {
    worksheet.getCell('U38').value = '☑' // 유선 체크
    worksheet.getCell('AJ38').value = '☐' // 무선 미체크
  } else if (vpnType === 'wireless' || vpnType === 'lte') {
    worksheet.getCell('U38').value = '☐' // 유선 미체크
    worksheet.getCell('AJ38').value = '☑' // 무선 체크
  } else {
    // 기본값: 유선
    worksheet.getCell('U38').value = '☑'
    worksheet.getCell('AJ38').value = '☐'
  }

  // ============================================================================
  // 전류계 타입 (41-42행)
  // ============================================================================
  // U열(16L), AE열(24L), AO열(36L)

  // 41행: 송풍전류계 + 펌프전류계
  const fanPumpTotal = (data.equipment.fan_ct || 0) + (data.equipment.pump_ct || 0)

  if (fanPumpTotal > 0) {
    // 송풍+펌프는 항상 16L
    worksheet.getCell('U41').value = fanPumpTotal
    worksheet.getCell('AE41').value = 0
    worksheet.getCell('AO41').value = 0
  }

  // 42행: 배출전류계 (사용자 지정 타입 적용)
  const dischargeCt = data.equipment.discharge_ct || 0

  if (dischargeCt > 0) {
    // 사용자가 지정한 타입별 수량 사용
    worksheet.getCell('U42').value = data.ct_16l || dischargeCt
    worksheet.getCell('AE42').value = data.ct_24l || 0
    worksheet.getCell('AO42').value = data.ct_36l || 0
  }

  // ============================================================================
  // 온도센서 타입 (44행 체크박스)
  // ============================================================================
  // 기본값: 프렌지타입 (U44), 니플(소켓)타입 (AJ44)
  const sensorType = data.temperature_sensor_type || 'flange'

  worksheet.getCell('U44').value = sensorType === 'flange' ? '☑' : '☐'
  worksheet.getCell('AJ44').value = sensorType === 'nipple' ? '☑' : '☐'

  // ============================================================================
  // 온도센서 길이 (46행)
  // ============================================================================
  // U46(10CM), AE46(20CM), AO46(40CM)
  const sensorLength = data.temperature_sensor_length || '10cm'

  worksheet.getCell('U46').value = sensorLength === '10cm' ? '☑' : '☐'
  worksheet.getCell('AE46').value = sensorLength === '20cm' ? '☑' : '☐'
  worksheet.getCell('AO46').value = sensorLength === '40cm' ? '☑' : '☐'

  // ============================================================================
  // PH 인디게이터 부착위치 (48행)
  // ============================================================================
  // U48(방지시설판넬-타공), AE48(독립형하이박스부착), AO48(해당없음)
  const phLocation = data.ph_indicator_location || 'independent_box'

  worksheet.getCell('U48').value = phLocation === 'panel' ? '☑' : '☐'
  worksheet.getCell('AE48').value = phLocation === 'independent_box' ? '☑' : '☐'
  worksheet.getCell('AO48').value = phLocation === 'none' ? '☑' : '☐'

  // ============================================================================
  // 결제조건*세금계산서 발행 후 7일 이내 (50행)
  // ============================================================================
  // U50(선금5|잔금5), AE50(납품 후 완납), AO50(기타사항-선입금)
  // 기본값: 기타사항(선입금)
  const paymentTerms = data.payment_terms || 'other_prepaid'

  worksheet.getCell('U50').value = paymentTerms === 'prepay_5_balance_5' ? '☑' : '☐'
  worksheet.getCell('AE50').value = paymentTerms === 'full_after_delivery' ? '☑' : '☐'
  worksheet.getCell('AO50').value = paymentTerms === 'other_prepaid' ? '☑' : '☐'

  console.log('[ECOSENSE-TEMPLATE] 데이터 채우기 완료')

  // ============================================================================
  // Excel 버퍼 생성
  // ============================================================================
  const buffer = await workbook.xlsx.writeBuffer()
  const resultBuffer = Buffer.from(buffer)
  console.log('[ECOSENSE-TEMPLATE] 파일 생성 완료:', resultBuffer.length, 'bytes')

  return resultBuffer
}

/**
 * 품목별 굵기 분류 함수 (향후 확장 가능)
 *
 * @param count 전류계 개수
 * @returns { size16L, size24L, size36L }
 */
function distributeCtSizes(count: number): {
  size16L: number
  size24L: number
  size36L: number
} {
  // 기본값: 모두 16L로 배정
  // TODO: 실제 비즈니스 로직에 따라 수정 필요
  return {
    size16L: count,
    size24L: 0,
    size36L: 0
  }
}
