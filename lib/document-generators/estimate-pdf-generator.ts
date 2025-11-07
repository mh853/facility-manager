// lib/document-generators/estimate-pdf-generator.ts
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

// vfs_fonts 구조 확인 후 올바르게 할당
if (pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
} else {
  // 직접 vfs 접근 (일부 버전에서는 이 구조 사용)
  pdfMake.vfs = pdfFonts as any;
}

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
 * 견적서 PDF 생성
 */
export async function generateEstimatePDF(data: EstimateData): Promise<Buffer> {
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9
    },
    content: [
      // 헤더
      {
        text: 'IoT 견적서',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },

      // 견적 기본 정보
      {
        columns: [
          {
            width: '60%',
            stack: [
              {
                text: `견적일자: ${data.estimate_date}`,
                fontSize: 10,
                margin: [0, 0, 0, 5]
              }
            ]
          },
          {
            width: '40%',
            table: {
              widths: ['40%', '60%'],
              body: [
                [
                  { text: '공급자번호', style: 'tableHeader' },
                  { text: data.supplier_info.registration_number, style: 'tableCell' }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ],
        margin: [0, 0, 0, 10]
      },

      // 공급자 및 공급받는자 정보
      {
        table: {
          widths: ['15%', '35%', '15%', '35%'],
          body: [
            // 헤더
            [
              { text: '공급자', style: 'tableHeader', rowSpan: 4, alignment: 'center' },
              { text: `상호(법인명): ${data.supplier_info.company_name}`, style: 'tableCell', colSpan: 3 },
              {},
              {}
            ],
            [
              {},
              { text: `사업자등록번호: ${data.supplier_info.registration_number}`, style: 'tableCell', colSpan: 3 },
              {},
              {}
            ],
            [
              {},
              { text: `대표자: ${data.supplier_info.representative}`, style: 'tableCell' },
              { text: `업태: ${data.supplier_info.business_type || ''}`, style: 'tableCell', colSpan: 2 },
              {}
            ],
            [
              {},
              { text: `전화번호: ${data.supplier_info.phone || ''}`, style: 'tableCell' },
              { text: `팩스: ${data.supplier_info.fax || ''}`, style: 'tableCell', colSpan: 2 },
              {}
            ],
            // 공급받는자
            [
              { text: '공급받는자', style: 'tableHeader', rowSpan: 4, alignment: 'center' },
              { text: `상호(법인명): ${data.customer_name}`, style: 'tableCell', colSpan: 3 },
              {},
              {}
            ],
            [
              {},
              { text: `사업자등록번호: ${data.customer_registration_number || ''}`, style: 'tableCell', colSpan: 3 },
              {},
              {}
            ],
            [
              {},
              { text: `대표자: ${data.customer_representative || ''}`, style: 'tableCell' },
              { text: `업태: ${data.customer_business_type || ''}`, style: 'tableCell', colSpan: 2 },
              {}
            ],
            [
              {},
              { text: `주소: ${data.customer_address || ''}`, style: 'tableCell', colSpan: 3 },
              {},
              {}
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000'
        },
        margin: [0, 0, 0, 20]
      },

      // 공급가액 요약
      {
        text: `공급가액 합계: ₩ ${formatCurrency(data.total_amount)}`,
        fontSize: 11,
        bold: true,
        alignment: 'right',
        margin: [0, 0, 0, 10]
      },

      // 견적 항목 테이블
      {
        table: {
          headerRows: 1,
          widths: ['8%', '25%', '10%', '8%', '15%', '12%', '12%', '10%'],
          body: [
            // 헤더
            [
              { text: 'no', style: 'tableHeader', alignment: 'center' },
              { text: '품명', style: 'tableHeader', alignment: 'center' },
              { text: '규격', style: 'tableHeader', alignment: 'center' },
              { text: '수량', style: 'tableHeader', alignment: 'center' },
              { text: '단가', style: 'tableHeader', alignment: 'center' },
              { text: '공급가액', style: 'tableHeader', alignment: 'center' },
              { text: '세액', style: 'tableHeader', alignment: 'center' },
              { text: '비고', style: 'tableHeader', alignment: 'center' }
            ],
            // 항목들
            ...data.estimate_items.map(item => [
              { text: item.no.toString(), style: 'tableCell', alignment: 'center' },
              { text: item.name, style: 'tableCell' },
              { text: item.spec, style: 'tableCell', alignment: 'center' },
              { text: item.quantity.toString(), style: 'tableCell', alignment: 'center' },
              { text: formatCurrency(item.unit_price), style: 'tableCell', alignment: 'right' },
              { text: formatCurrency(item.supply_amount), style: 'tableCell', alignment: 'right' },
              { text: formatCurrency(item.vat_amount), style: 'tableCell', alignment: 'right' },
              { text: item.note, style: 'tableCell', fontSize: 8 }
            ]),
            // 빈 행들 (최소 15행 유지)
            ...Array(Math.max(0, 15 - data.estimate_items.length)).fill([
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' }
            ])
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000'
        },
        margin: [0, 0, 0, 10]
      },

      // 안내사항
      ...(data.terms_and_conditions ? [{
        text: data.terms_and_conditions,
        fontSize: 8,
        margin: [0, 10, 0, 10],
        lineHeight: 1.3
      }] : []),

      // 합계
      {
        columns: [
          {
            width: '70%',
            text: ''
          },
          {
            width: '30%',
            table: {
              widths: ['50%', '50%'],
              body: [
                [
                  { text: '합계', style: 'tableHeader', alignment: 'center' },
                  { text: formatCurrency(data.subtotal), style: 'tableCell', alignment: 'right', bold: true }
                ],
                [
                  { text: '세액', style: 'tableHeader', alignment: 'center' },
                  { text: formatCurrency(data.vat_amount), style: 'tableCell', alignment: 'right' }
                ]
              ]
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000'
            }
          }
        ]
      }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        fillColor: '#eeeeee',
        alignment: 'center'
      },
      tableCell: {
        fontSize: 9
      }
    }
  };

  return new Promise((resolve, reject) => {
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBuffer((buffer) => {
      resolve(buffer);
    });
  });
}

/**
 * PDF를 Base64로 인코딩
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
