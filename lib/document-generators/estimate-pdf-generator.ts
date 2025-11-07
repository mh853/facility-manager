// lib/document-generators/estimate-pdf-generator.ts - 한글 지원 견적서 PDF 생성기
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface EstimateItem {
  no: number;
  name: string;
  spec: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  vat_amount: number;
  note: string;
}

interface EstimateData {
  estimate_number: string;
  estimate_date: string;
  customer_name: string;
  customer_address?: string;
  customer_registration_number?: string;
  customer_representative?: string;
  customer_business_type?: string;
  customer_business_category?: string;
  customer_phone?: string;
  supplier_info: {
    company_name: string;
    address: string;
    registration_number: string;
    representative: string;
    business_type?: string;
    business_category?: string;
    phone?: string;
    fax?: string;
  };
  estimate_items: EstimateItem[];
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  terms_and_conditions?: string;
}

/**
 * 금액 포맷팅 (천 단위 콤마)
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR');
}

/**
 * HTML을 Canvas로 렌더링하는 헬퍼 함수
 */
async function renderHtmlToCanvas(htmlContent: string): Promise<HTMLCanvasElement> {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  tempDiv.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    background-color: #ffffff !important;
    padding: 30px;
    font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #000000 !important;
    font-weight: 400;
    letter-spacing: -0.02em;
    box-sizing: border-box;
  `;

  document.body.appendChild(tempDiv);

  // 폰트 로딩 대기
  await new Promise(resolve => setTimeout(resolve, 500));

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
      const clonedDiv = clonedDoc.querySelector('div');
      if (clonedDiv) {
        clonedDiv.style.cssText = `
          position: static !important;
          left: auto !important;
          width: 794px !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          padding: 30px !important;
          margin: 0 !important;
          font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕", Arial, sans-serif !important;
        `;
      }
    }
  });

  // DOM 요소 제거
  document.body.removeChild(tempDiv);

  return canvas;
}

/**
 * Canvas를 PDF에 추가하는 헬퍼 함수
 */
async function addCanvasToPdf(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  isNewPage: boolean
): Promise<void> {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let remainingHeight = imgHeight;
  let yPosition = 0;

  while (remainingHeight > 0) {
    const currentPageHeight = Math.min(pageHeight, remainingHeight);

    // 이미지를 잘라서 현재 페이지에 추가
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');

    if (cropCtx) {
      const cropRatio = currentPageHeight / imgHeight;
      cropCanvas.width = canvas.width;
      cropCanvas.height = canvas.height * cropRatio;

      cropCtx.drawImage(
        canvas,
        0, yPosition * (canvas.height / imgHeight),
        canvas.width, canvas.height * cropRatio,
        0, 0,
        canvas.width, canvas.height * cropRatio
      );

      const cropImgData = cropCanvas.toDataURL('image/jpeg', 0.95);

      doc.addImage(
        cropImgData,
        'JPEG',
        margin,
        margin,
        imgWidth,
        currentPageHeight
      );
    }

    remainingHeight -= currentPageHeight;
    yPosition += currentPageHeight;

    if (remainingHeight > 0) {
      doc.addPage();
    }
  }
}

/**
 * 견적서 HTML 생성
 */
function generateEstimateHtml(data: EstimateData): string {
  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 20px; line-height: 1.4; background-color: #ffffff; color: #000000;">
      <!-- 헤더 -->
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="font-size: 22px; font-weight: bold; margin: 0 0 15px 0; color: #000000;">IoT 견적서</h1>
      </div>

      <!-- 견적 기본 정보 -->
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="font-size: 11px; margin-bottom: 5px;">견적일자: ${data.estimate_date}</div>
            <div style="font-size: 11px;">견적번호: ${data.estimate_number}</div>
          </div>
          <div style="border: 1px solid #000; padding: 8px;">
            <div style="font-size: 10px;"><strong>공급자번호</strong></div>
            <div style="font-size: 10px;">${data.supplier_info.registration_number}</div>
          </div>
        </div>
      </div>

      <!-- 공급자 및 공급받는자 정보 -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
        <tbody>
          <!-- 공급자 -->
          <tr>
            <td rowspan="4" style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center; width: 12%; vertical-align: middle;">공급자</td>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">상호(법인명): ${data.supplier_info.company_name}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">사업자등록번호: ${data.supplier_info.registration_number}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; width: 29%;">대표자: ${data.supplier_info.representative}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;">업태: ${data.supplier_info.business_type || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px;">전화: ${data.supplier_info.phone || ''}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;">팩스: ${data.supplier_info.fax || ''}</td>
          </tr>

          <!-- 공급받는자 -->
          <tr>
            <td rowspan="4" style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center; vertical-align: middle;">공급받는자</td>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">상호(법인명): ${data.customer_name}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">사업자등록번호: ${data.customer_registration_number || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px;">대표자: ${data.customer_representative || ''}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;">업태: ${data.customer_business_type || ''}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">주소: ${data.customer_address || ''}</td>
          </tr>
        </tbody>
      </table>

      <!-- 공급가액 합계 -->
      <div style="text-align: right; margin-bottom: 15px; font-size: 12px; font-weight: bold;">
        공급가액 합계: ₩ ${formatCurrency(data.total_amount)}
      </div>

      <!-- 견적 항목 테이블 -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 6%;">no</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 22%;">품명</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 8%;">규격</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 6%;">수량</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 15%;">단가</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 15%;">공급가액</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 13%;">세액</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 15%;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${data.estimate_items.map(item => `
            <tr>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.no}</td>
              <td style="border: 1px solid #000; padding: 5px;">${item.name}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.spec}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.quantity}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatCurrency(item.unit_price)}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatCurrency(item.supply_amount)}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatCurrency(item.vat_amount)}</td>
              <td style="border: 1px solid #000; padding: 5px; font-size: 8px;">${item.note}</td>
            </tr>
          `).join('')}
          ${Array(Math.max(0, 10 - data.estimate_items.length)).fill(0).map(() => `
            <tr>
              <td style="border: 1px solid #000; padding: 5px; height: 20px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 안내사항 -->
      ${data.terms_and_conditions ? `
        <div style="margin-bottom: 15px; font-size: 9px; line-height: 1.5; white-space: pre-wrap; padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
${data.terms_and_conditions}
        </div>
      ` : ''}

      <!-- 합계 -->
      <div style="display: flex; justify-content: flex-end;">
        <table style="width: 200px; border-collapse: collapse; font-size: 11px;">
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center; width: 40%;">합계</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(data.subtotal)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center;">세액</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(data.vat_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 견적서 PDF 생성 (HTML to Canvas 방식)
 */
export async function generateEstimatePDF(data: EstimateData): Promise<Buffer> {
  try {
    // PDF 생성
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const pageWidth = 210 - (margin * 2);
    const pageHeight = 297 - (margin * 2);

    // HTML 컨텐츠 생성
    const htmlContent = generateEstimateHtml(data);

    // Canvas로 렌더링
    const canvas = await renderHtmlToCanvas(htmlContent);

    // PDF에 추가
    await addCanvasToPdf(doc, canvas, margin, pageWidth, pageHeight, false);

    // Buffer로 변환
    const pdfBlob = doc.output('arraybuffer');
    return Buffer.from(pdfBlob);

  } catch (error) {
    console.error('[ESTIMATE-PDF] PDF 생성 오류:', error);
    throw error;
  }
}

/**
 * PDF를 Base64로 인코딩
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
