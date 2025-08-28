// app/api/document-automation/route.ts - 문서 자동화 API
import { NextRequest, NextResponse } from 'next/server'
import { DocumentAutomationService, DocumentGenerationRequest } from '@/lib/document-automation'

// GET: 사용 가능한 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const templateId = searchParams.get('templateId')
    const businessId = searchParams.get('businessId')

    // 템플릿 목록 조회
    if (!action || action === 'templates') {
      const templates = await DocumentAutomationService.getAvailableTemplates()
      return NextResponse.json({ data: templates })
    }

    // 템플릿 유효성 검사
    if (action === 'validate' && templateId) {
      const validation = await DocumentAutomationService.validateTemplate(templateId)
      return NextResponse.json({ data: validation })
    }

    // 플레이스홀더 데이터 미리보기
    if (action === 'preview' && businessId) {
      const placeholderData = await DocumentAutomationService.generatePlaceholderData(businessId)
      return NextResponse.json({ data: placeholderData })
    }

    return NextResponse.json(
      { error: '올바르지 않은 요청입니다' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Document automation GET error:', error)
    return NextResponse.json(
      { error: '요청 처리에 실패했습니다' },
      { status: 500 }
    )
  }
}

// POST: 문서 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...requestData } = body

    // 단일 문서 생성
    if (!action || action === 'generate') {
      const { templateId, businessId, outputFileName, outputFolderId } = requestData

      if (!templateId || !businessId) {
        return NextResponse.json(
          { error: '템플릿 ID와 사업장 ID는 필수입니다' },
          { status: 400 }
        )
      }

      const generationRequest: DocumentGenerationRequest = {
        templateId,
        businessId,
        outputFileName,
        outputFolderId
      }

      const result = await DocumentAutomationService.generateDocumentFromTemplate(generationRequest)

      // 생성 이력 저장
      await DocumentAutomationService.saveDocumentHistory({
        businessId,
        templateId,
        documentId: result.documentId,
        documentUrl: result.documentUrl,
        generatedAt: new Date().toISOString()
      })

      return NextResponse.json({
        message: '문서가 성공적으로 생성되었습니다',
        data: result
      })
    }

    // 일괄 문서 생성
    if (action === 'bulk') {
      const { requests } = requestData

      if (!Array.isArray(requests) || requests.length === 0) {
        return NextResponse.json(
          { error: '생성 요청 목록이 필요합니다' },
          { status: 400 }
        )
      }

      const result = await DocumentAutomationService.generateBulkDocuments(requests)

      // 성공한 항목들의 이력 저장
      for (const success of result.successful) {
        const request = requests.find((r: DocumentGenerationRequest) => r.businessId === success.businessId)
        if (request) {
          await DocumentAutomationService.saveDocumentHistory({
            businessId: success.businessId,
            templateId: request.templateId,
            documentId: success.documentId,
            documentUrl: success.documentUrl,
            generatedAt: new Date().toISOString()
          })
        }
      }

      return NextResponse.json({
        message: `${result.successful.length}개 문서가 생성되었습니다`,
        data: result
      })
    }

    return NextResponse.json(
      { error: '올바르지 않은 액션입니다' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Document automation POST error:', error)
    return NextResponse.json(
      { error: `문서 생성에 실패했습니다: ${error.message}` },
      { status: 500 }
    )
  }
}