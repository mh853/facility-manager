// lib/document-automation.ts - 문서 자동화 서비스
import { DatabaseService, BusinessWithPermits } from './database-service'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

// Google Docs API 클라이언트 설정
const getDocsClient = () => {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive'
    ]
  })

  return google.docs({ version: 'v1', auth })
}

const getDriveClient = () => {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive'
    ]
  })

  return google.drive({ version: 'v3', auth })
}

// 문서 템플릿 인터페이스
export interface DocumentTemplate {
  id: string
  name: string
  templateId: string
  description: string
  placeholders: string[]
}

// 문서 생성 요청 인터페이스
export interface DocumentGenerationRequest {
  templateId: string
  businessId: string
  outputFileName?: string
  outputFolderId?: string
}

// 문서 자동화 서비스 클래스
export class DocumentAutomationService {
  
  /**
   * 사업장 데이터로부터 문서용 플레이스홀더 데이터 생성
   */
  static async generatePlaceholderData(businessId: string): Promise<Record<string, string>> {
    const businessData = await DatabaseService.getBusinessWithAllDetails(businessId)
    
    if (!businessData) {
      throw new Error('사업장 데이터를 찾을 수 없습니다')
    }

    // 기본 사업장 정보
    const placeholders: Record<string, string> = {
      // 사업장 기본 정보
      '{{BUSINESS_NAME}}': businessData.business_name || '',
      '{{LOCAL_GOVERNMENT}}': businessData.local_government || '',
      '{{ADDRESS}}': businessData.address || '',
      '{{MANAGER_NAME}}': businessData.manager_name || '',
      '{{MANAGER_POSITION}}': businessData.manager_position || '',
      '{{MANAGER_CONTACT}}': businessData.manager_contact || '',
      '{{BUSINESS_CONTACT}}': businessData.business_contact || '',
      '{{FAX_NUMBER}}': businessData.fax_number || '',
      '{{EMAIL}}': businessData.email || '',
      
      // 대표자 정보
      '{{REPRESENTATIVE_NAME}}': businessData.representative_name || '',
      '{{REPRESENTATIVE_BIRTH_DATE}}': '',
      '{{BUSINESS_REGISTRATION_NUMBER}}': businessData.business_registration_number || '',
      
      // 장비 정보
      '{{MANUFACTURER}}': businessData.manufacturer || '',
      '{{PH_METER}}': businessData.ph_sensor ? 'O' : 'X',
      '{{DIFFERENTIAL_PRESSURE_METER}}': businessData.differential_pressure_meter ? 'O' : 'X',
      '{{TEMPERATURE_METER}}': businessData.temperature_meter ? 'O' : 'X',
      '{{DISCHARGE_CT}}': businessData.additional_info?.discharge_ct || '',
      '{{PREVENTION_CT}}': businessData.additional_info?.prevention_ct || '',
      '{{GATEWAY}}': businessData.gateway ? String(businessData.gateway) : '',
      '{{VPN_WIRED}}': businessData.vpn_wired ? 'O' : 'X',
      '{{VPN_WIRELESS}}': businessData.vpn_wireless ? 'O' : 'X',
      '{{MULTIPLE_STACK}}': businessData.multiple_stack ? 'O' : 'X',
      
      // 현재 날짜
      '{{CURRENT_DATE}}': new Date().toLocaleDateString('ko-KR'),
      '{{CURRENT_YEAR}}': new Date().getFullYear().toString(),
      '{{CURRENT_MONTH}}': (new Date().getMonth() + 1).toString(),
      '{{CURRENT_DAY}}': new Date().getDate().toString()
    }

    // 대기필증 정보가 있는 경우 추가
    if (businessData.air_permits.length > 0) {
      const firstPermit = businessData.air_permits[0]
      
      placeholders['{{BUSINESS_TYPE}}'] = firstPermit.business_type || ''
      placeholders['{{ANNUAL_POLLUTANT_EMISSION}}'] = firstPermit.annual_emission_amount?.toString() || ''
      placeholders['{{FIRST_REPORT_DATE}}'] = firstPermit.first_report_date 
        ? new Date(firstPermit.first_report_date).toLocaleDateString('ko-KR') 
        : ''
      placeholders['{{OPERATION_START_DATE}}'] = firstPermit.operation_start_date 
        ? new Date(firstPermit.operation_start_date).toLocaleDateString('ko-KR') 
        : ''

      // 배출구 및 시설 정보
      const outlets = firstPermit.outlets
      if (outlets.length > 0) {
        // 첫 번째 배출구 정보
        const firstOutlet = outlets[0]
        placeholders['{{OUTLET_NUMBER}}'] = firstOutlet.outlet_number.toString()
        placeholders['{{OUTLET_NAME}}'] = firstOutlet.outlet_name || ''

        // 배출시설 목록
        const dischargeFacilities = firstOutlet.discharge_facilities
          .map(f => `${f.facility_name} (${f.capacity || '-'}, ${f.quantity}개)`)
          .join(', ')
        placeholders['{{DISCHARGE_FACILITIES}}'] = dischargeFacilities

        // 방지시설 목록
        const preventionFacilities = firstOutlet.prevention_facilities
          .map(f => `${f.facility_name} (${f.capacity || '-'}, ${f.quantity}개)`)
          .join(', ')
        placeholders['{{PREVENTION_FACILITIES}}'] = preventionFacilities
      }
    }

    return placeholders
  }

  /**
   * Google Docs 템플릿에서 문서 생성
   */
  static async generateDocumentFromTemplate(request: DocumentGenerationRequest): Promise<{
    documentId: string
    documentUrl: string
  }> {
    try {
      const docs = getDocsClient()
      const drive = getDriveClient()

      // 플레이스홀더 데이터 생성
      const placeholderData = await this.generatePlaceholderData(request.businessId)

      // 템플릿 문서 복사
      const copyResponse = await drive.files.copy({
        fileId: request.templateId,
        requestBody: {
          name: request.outputFileName || `Generated Document - ${new Date().toISOString().split('T')[0]}`
        }
      })

      const newDocumentId = copyResponse.data.id!

      // 복사된 문서로 이동 (필요한 경우)
      if (request.outputFolderId) {
        await drive.files.update({
          fileId: newDocumentId,
          addParents: request.outputFolderId,
          fields: 'id, parents'
        })
      }

      // 문서 내용 가져오기
      const docResponse = await docs.documents.get({
        documentId: newDocumentId
      })

      const document = docResponse.data

      // 플레이스홀더 교체 요청 배열 생성
      const requests: any[] = []

      Object.entries(placeholderData).forEach(([placeholder, value]) => {
        requests.push({
          replaceAllText: {
            containsText: {
              text: placeholder,
              matchCase: false
            },
            replaceText: value
          }
        })
      })

      // 플레이스홀더 교체 실행
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: newDocumentId,
          requestBody: {
            requests
          }
        })
      }

      return {
        documentId: newDocumentId,
        documentUrl: `https://docs.google.com/document/d/${newDocumentId}/edit`
      }

    } catch (error) {
      console.error('Document generation error:', error)
      throw new Error(`문서 생성 실패: ${error}`)
    }
  }

  /**
   * 사용 가능한 템플릿 목록 조회
   */
  static async getAvailableTemplates(): Promise<DocumentTemplate[]> {
    // 환경변수에서 템플릿 ID 목록을 가져오거나, 데이터베이스에서 조회
    const templates: DocumentTemplate[] = [
      {
        id: 'business_report',
        name: '사업장 현황 보고서',
        templateId: process.env.BUSINESS_REPORT_TEMPLATE_ID || '',
        description: '사업장의 기본 정보와 현황을 정리한 보고서',
        placeholders: [
          '{{BUSINESS_NAME}}', '{{LOCAL_GOVERNMENT}}', '{{ADDRESS}}',
          '{{MANAGER_NAME}}', '{{MANAGER_CONTACT}}', '{{CURRENT_DATE}}'
        ]
      },
      {
        id: 'air_permit_report',
        name: '대기필증 보고서',
        templateId: process.env.AIR_PERMIT_TEMPLATE_ID || '',
        description: '대기필증 정보와 배출시설 현황 보고서',
        placeholders: [
          '{{BUSINESS_NAME}}', '{{BUSINESS_TYPE}}', '{{ANNUAL_POLLUTANT_EMISSION}}',
          '{{DISCHARGE_FACILITIES}}', '{{PREVENTION_FACILITIES}}', '{{CURRENT_DATE}}'
        ]
      },
      {
        id: 'facility_inspection',
        name: '시설 점검 보고서',
        templateId: process.env.FACILITY_INSPECTION_TEMPLATE_ID || '',
        description: '시설 점검 결과 및 현황 보고서',
        placeholders: [
          '{{BUSINESS_NAME}}', '{{PH_METER}}', '{{DIFFERENTIAL_PRESSURE_METER}}',
          '{{TEMPERATURE_METER}}', '{{GATEWAY}}', '{{CURRENT_DATE}}'
        ]
      }
    ]

    return templates.filter(template => template.templateId) // 템플릿 ID가 있는 것만 반환
  }

  /**
   * 문서 생성 이력 저장
   */
  static async saveDocumentHistory(data: {
    businessId: string
    templateId: string
    documentId: string
    documentUrl: string
    generatedAt: string
  }): Promise<void> {
    // 문서 생성 이력을 데이터베이스에 저장
    // 현재는 로그만 출력하지만, 필요시 별도 테이블에 저장 가능
    console.log('Document generated:', data)
  }

  /**
   * 여러 사업장의 문서를 일괄 생성
   */
  static async generateBulkDocuments(requests: DocumentGenerationRequest[]): Promise<{
    successful: Array<{ businessId: string; documentId: string; documentUrl: string }>
    failed: Array<{ businessId: string; error: string }>
  }> {
    const successful: Array<{ businessId: string; documentId: string; documentUrl: string }> = []
    const failed: Array<{ businessId: string; error: string }> = []

    for (const request of requests) {
      try {
        const result = await this.generateDocumentFromTemplate(request)
        successful.push({
          businessId: request.businessId,
          documentId: result.documentId,
          documentUrl: result.documentUrl
        })
      } catch (error) {
        failed.push({
          businessId: request.businessId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return { successful, failed }
  }

  /**
   * 문서 템플릿 유효성 검사
   */
  static async validateTemplate(templateId: string): Promise<{
    isValid: boolean
    placeholders: string[]
    error?: string
  }> {
    try {
      const docs = getDocsClient()
      
      const response = await docs.documents.get({
        documentId: templateId
      })

      const content = response.data.body?.content || []
      
      // 문서에서 플레이스홀더 추출
      const placeholders = new Set<string>()
      const extractPlaceholders = (elements: any[]) => {
        for (const element of elements) {
          if (element.paragraph?.elements) {
            for (const textElement of element.paragraph.elements) {
              if (textElement.textRun?.content) {
                const text = textElement.textRun.content
                const matches = text.match(/\{\{[^}]+\}\}/g)
                if (matches) {
                  matches.forEach((match: string) => placeholders.add(match))
                }
              }
            }
          }
          if (element.table?.tableRows) {
            for (const row of element.table.tableRows) {
              if (row.tableCells) {
                for (const cell of row.tableCells) {
                  if (cell.content) {
                    extractPlaceholders(cell.content)
                  }
                }
              }
            }
          }
        }
      }

      extractPlaceholders(content)

      return {
        isValid: true,
        placeholders: Array.from(placeholders)
      }

    } catch (error) {
      return {
        isValid: false,
        placeholders: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// 유틸리티 함수들
export const documentUtils = {
  /**
   * 문서 이름 생성
   */
  generateDocumentName: (businessName: string, templateName: string): string => {
    const date = new Date().toISOString().split('T')[0]
    return `${templateName} - ${businessName} - ${date}`
  },

  /**
   * 플레이스홀더 유효성 검사
   */
  validatePlaceholders: (templatePlaceholders: string[], dataPlaceholders: string[]): {
    missing: string[]
    unused: string[]
  } => {
    const templateSet = new Set(templatePlaceholders)
    const dataSet = new Set(dataPlaceholders)
    
    return {
      missing: templatePlaceholders.filter(p => !dataSet.has(p)),
      unused: dataPlaceholders.filter(p => !templateSet.has(p))
    }
  }
}