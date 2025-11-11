// utils/contractPdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ContractData {
  contract_number: string;
  contract_date: string;
  contract_type: 'subsidy' | 'self_pay';
  business_name: string;
  business_address: string;
  business_representative: string;
  business_registration_number?: string;
  business_phone?: string;
  business_fax?: string;
  total_amount: number;
  supplier_company_name: string;
  supplier_representative: string;
  supplier_address: string;
  payment_advance_ratio?: number; // 선금 비율 (기본 50%)
  payment_balance_ratio?: number; // 잔금 비율 (기본 50%)
  additional_cost?: number; // 추가공사비
  negotiation_cost?: number; // 협의사항(네고)
  equipment_counts?: {
    ph_meter: number;
    differential_pressure_meter: number;
    temperature_meter: number;
    discharge_current_meter: number;
    fan_current_meter: number;
    pump_current_meter: number;
    gateway: number;
    vpn: number;
  };
}

/**
 * HTML 요소를 PDF로 변환 (페이지별로 분리)
 * @param element - 변환할 HTML 요소
 * @param filename - 저장할 파일명
 * @returns PDF Blob
 */
export async function generateContractPDF(
  element: HTMLElement,
  filename: string
): Promise<Blob> {
  try {
    // 페이지별 요소 찾기
    const page1 = element.querySelector('.page-1') as HTMLElement;
    const page2 = element.querySelector('.page-2') as HTMLElement;
    const page3 = element.querySelector('.page-3') as HTMLElement;

    if (!page1 || !page2 || !page3) {
      throw new Error('페이지 요소를 찾을 수 없습니다.');
    }

    // PDF 생성 (압축 활성화)
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true // PDF 압축 활성화
    });

    const imgWidth = 170; // A4 width in mm (210mm - 40mm margins)
    const maxHeight = 257; // A4 height in mm (297mm - 40mm margins)
    const topMargin = 20; // 상단 여백 20mm
    const leftMargin = 20; // 좌측 여백 20mm

    // 공통 html2canvas 옵션 (파일 크기 최적화)
    const canvasOptions = {
      scale: 1.2, // 해상도 낮춤 (2 → 1.2로 약 70% 크기 감소)
      useCORS: true,
      logging: false,
      windowWidth: 1200, // 렌더링 크기 최적화 (1920 → 1200)
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      removeContainer: true
    };

    // 페이지 1 처리
    const canvas1 = await html2canvas(page1, canvasOptions);
    const imgData1 = canvas1.toDataURL('image/jpeg', 0.85); // PNG → JPEG (품질 85%)
    let imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;

    // 최대 높이를 초과하면 비율 조정
    if (imgHeight1 > maxHeight) {
      const ratio = maxHeight / imgHeight1;
      imgHeight1 = maxHeight;
      const adjustedWidth = imgWidth * ratio;
      pdf.addImage(imgData1, 'JPEG', leftMargin + (imgWidth - adjustedWidth) / 2, topMargin, adjustedWidth, imgHeight1);
    } else {
      pdf.addImage(imgData1, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight1);
    }

    // 페이지 2 추가
    pdf.addPage();
    const canvas2 = await html2canvas(page2, canvasOptions);
    const imgData2 = canvas2.toDataURL('image/jpeg', 0.85); // PNG → JPEG (품질 85%)
    let imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;

    // 최대 높이를 초과하면 비율 조정
    if (imgHeight2 > maxHeight) {
      const ratio = maxHeight / imgHeight2;
      imgHeight2 = maxHeight;
      const adjustedWidth = imgWidth * ratio;
      pdf.addImage(imgData2, 'JPEG', leftMargin + (imgWidth - adjustedWidth) / 2, topMargin, adjustedWidth, imgHeight2);
    } else {
      pdf.addImage(imgData2, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight2);
    }

    // 페이지 3 추가
    pdf.addPage();
    const canvas3 = await html2canvas(page3, canvasOptions);
    const imgData3 = canvas3.toDataURL('image/jpeg', 0.85); // PNG → JPEG (품질 85%)
    let imgHeight3 = (canvas3.height * imgWidth) / canvas3.width;

    // 최대 높이를 초과하면 비율 조정
    if (imgHeight3 > maxHeight) {
      const ratio = maxHeight / imgHeight3;
      imgHeight3 = maxHeight;
      const adjustedWidth = imgWidth * ratio;
      pdf.addImage(imgData3, 'JPEG', leftMargin + (imgWidth - adjustedWidth) / 2, topMargin, adjustedWidth, imgHeight3);
    } else {
      pdf.addImage(imgData3, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight3);
    }

    // Blob 반환
    return pdf.output('blob');
  } catch (error) {
    console.error('PDF 생성 오류:', error);
    throw new Error('PDF 생성에 실패했습니다.');
  }
}

/**
 * PDF를 Supabase Storage에 업로드
 * @param blob - PDF Blob
 * @param contractNumber - 계약서 번호
 * @param contractType - 계약서 유형
 * @returns 업로드된 파일 URL
 */
export async function uploadContractPDF(
  blob: Blob,
  contractNumber: string,
  contractType: string
): Promise<string> {
  try {
    const filename = `${contractType}_${contractNumber}_${Date.now()}.pdf`;
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('folder', 'contracts');

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    console.log('📤 PDF 업로드 API 응답:', {
      status: response.status,
      ok: response.ok,
      data
    });

    if (data.success && data.url) {
      return data.url;
    } else {
      console.error('❌ PDF 업로드 실패 상세:', {
        message: data.message,
        error: data.error,
        response_data: data
      });
      throw new Error(data.message || '파일 업로드 실패');
    }
  } catch (error) {
    console.error('PDF 업로드 오류:', error);
    throw new Error('PDF 업로드에 실패했습니다.');
  }
}

/**
 * PDF 다운로드
 * @param blob - PDF Blob
 * @param filename - 파일명
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 금액을 한글로 변환
 * @param amount - 변환할 금액
 * @returns 한글 금액
 */
export function formatAmountToKorean(amount: number): string {
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  if (amount === 0) return '영';

  let result = '';
  let unitIndex = 0;

  while (amount > 0) {
    const part = amount % 10000;
    if (part > 0) {
      let partStr = '';
      const thousand = Math.floor(part / 1000);
      const hundred = Math.floor((part % 1000) / 100);
      const ten = Math.floor((part % 100) / 10);
      const one = part % 10;

      if (thousand > 0) partStr += digits[thousand] + '천';
      if (hundred > 0) partStr += digits[hundred] + '백';
      if (ten > 0) partStr += digits[ten] + '십';
      if (one > 0) partStr += digits[one];

      result = partStr + units[unitIndex] + result;
    }
    amount = Math.floor(amount / 10000);
    unitIndex++;
  }

  return result;
}
