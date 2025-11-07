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
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; padding: 30px; line-height: 1.5; background-color: #ffffff; color: #000000;">
      <!-- 헤더 -->
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 15px;">
        <h1 style="font-size: 32px; font-weight: bold; margin: 0; color: #1a1a1a;">IoT 견적서</h1>
      </div>

      <!-- 견적 기본 정보 -->
      <div style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <div style="font-size: 14px; margin-bottom: 8px; color: #374151;"><strong>견적일자:</strong> ${data.estimate_date}</div>
          <div style="font-size: 14px; color: #374151;"><strong>견적번호:</strong> ${data.estimate_number}</div>
        </div>
      </div>

      <!-- 공급받는자(좌) 및 공급자(우) 정보 -->
      <div style="display: flex; gap: 20px; margin-bottom: 30px;">
        <!-- 공급받는자 (왼쪽) -->
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 2px solid #2563eb;">
            <tbody>
              <tr>
                <td colspan="2" style="border: 1px solid #d1d5db; padding: 12px; background-color: #2563eb; color: #ffffff; font-weight: bold; text-align: center; font-size: 15px;">공급받는자</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold; width: 35%;">상호(법인명)</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">${data.customer_name}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">사업자등록번호</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">${data.customer_registration_number || '-'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">대표자</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">${data.customer_representative || '-'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">업태 / 업종</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">${data.customer_business_type || '-'} / ${data.customer_business_category || '-'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">주소</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">${data.customer_address || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 공급자 (오른쪽) -->
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 2px solid #059669;">
            <tbody>
              <tr>
                <td colspan="2" style="border: 1px solid #d1d5db; padding: 12px; background-color: #059669; color: #ffffff; font-weight: bold; text-align: center; font-size: 15px;">공급자</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold; width: 35%;">상호(법인명)</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">주식회사 블루온</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">사업자등록번호</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">679-86-02827</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">대표자</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">김경수</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">업태 / 업종</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">제조업 / 전동기및발전기</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 10px; background-color: #f3f4f6; font-weight: bold;">전화 / 팩스</td>
                <td style="border: 1px solid #d1d5db; padding: 10px;">1661-5543 / 031-8077-2054</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 공급가액 합계 강조 -->
      <div style="text-align: right; margin-bottom: 20px; padding: 15px; background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px;">
        <div style="font-size: 18px; font-weight: bold; color: #92400e;">
          총 견적금액: <span style="font-size: 24px; color: #b45309;">₩ ${formatCurrency(data.total_amount)}</span>
        </div>
      </div>

      <!-- 견적 항목 테이블 (비고란 제거) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; border: 2px solid #374151;">
        <thead>
          <tr style="background-color: #374151; color: #ffffff;">
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 8%;">No</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 32%;">품명</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 10%;">규격</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 10%;">수량</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 15%;">단가</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 15%;">공급가액</th>
            <th style="border: 1px solid #6b7280; padding: 12px; text-align: center; width: 10%;">세액</th>
          </tr>
        </thead>
        <tbody>
          ${data.estimate_items.map((item, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-weight: bold;">${item.no}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">${item.name}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center;">${item.spec}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center;">${item.quantity}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${formatCurrency(item.unit_price)}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold;">${formatCurrency(item.supply_amount)}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${formatCurrency(item.vat_amount)}</td>
            </tr>
          `).join('')}
          ${Array(Math.max(0, 8 - data.estimate_items.length)).fill(0).map((_, index) => `
            <tr style="background-color: ${(data.estimate_items.length + index) % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="border: 1px solid #d1d5db; padding: 10px; height: 25px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
              <td style="border: 1px solid #d1d5db; padding: 10px;">&nbsp;</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 안내사항 -->
      ${data.terms_and_conditions ? `
        <div style="margin-bottom: 25px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #1e40af; font-size: 14px;">▣ 안내사항</div>
${data.terms_and_conditions}
        </div>
      ` : ''}

      <!-- 합계 -->
      <div style="display: flex; justify-content: flex-end;">
        <table style="width: 280px; border-collapse: collapse; font-size: 15px; border: 2px solid #374151;">
          <tbody>
            <tr>
              <td style="border: 1px solid #6b7280; padding: 12px; background-color: #374151; color: #ffffff; font-weight: bold; text-align: center; width: 40%;">공급가액</td>
              <td style="border: 1px solid #6b7280; padding: 12px; text-align: right; font-weight: bold; font-size: 16px;">${formatCurrency(data.subtotal)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #6b7280; padding: 12px; background-color: #374151; color: #ffffff; font-weight: bold; text-align: center;">부가세(10%)</td>
              <td style="border: 1px solid #6b7280; padding: 12px; text-align: right; font-size: 16px;">${formatCurrency(data.vat_amount)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #6b7280; padding: 12px; background-color: #059669; color: #ffffff; font-weight: bold; text-align: center;">합계</td>
              <td style="border: 1px solid #6b7280; padding: 12px; text-align: right; font-weight: bold; background-color: #d1fae5; font-size: 18px; color: #065f46;">${formatCurrency(data.total_amount)}</td>
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
