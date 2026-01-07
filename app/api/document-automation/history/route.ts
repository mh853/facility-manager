// app/api/document-automation/history/route.ts
// 문서 이력 조회 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { queryOne, queryAll, query as pgQuery } from '@/lib/supabase-direct'
import { verifyTokenHybrid } from '@/lib/secure-jwt'
import type { DocumentHistoryListResponse } from '@/types/document-automation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 사용자 인증
async function checkUserPermission(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '')
  } else {
    const cookieToken = request.cookies.get('auth_token')?.value
    if (cookieToken) token = cookieToken
  }

  if (!token) {
    return { authorized: false, user: null }
  }

  try {
    const result = await verifyTokenHybrid(token)
    if (!result.user) {
      return { authorized: false, user: null }
    }
    return { authorized: true, user: result.user }
  } catch (error) {
    console.error('[DOCUMENT-HISTORY] 권한 확인 오류:', error)
    return { authorized: false, user: null }
  }
}

// GET: 문서 이력 목록 조회
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { authorized, user } = await checkUserPermission(request)
    if (!authorized || !user) {
      return createErrorResponse('인증이 필요합니다', 401)
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('business_id') || undefined
    const documentType = searchParams.get('document_type') || undefined
    const fileFormat = searchParams.get('file_format') || undefined
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('[DOCUMENT-HISTORY] 이력 조회:', {
      user: user.name,
      businessId,
      documentType,
      fileFormat,
      page,
      limit
    })

    // 뷰에서 조회 - Direct PostgreSQL
    const whereClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (businessId) {
      whereClauses.push(`business_id = $${paramIndex}`)
      params.push(businessId)
      paramIndex++
    }

    if (documentType && documentType !== 'construction_report') {
      whereClauses.push(`document_type = $${paramIndex}`)
      params.push(documentType)
      paramIndex++
    }

    if (fileFormat) {
      whereClauses.push(`file_format = $${paramIndex}`)
      params.push(fileFormat)
      paramIndex++
    }

    if (startDate) {
      whereClauses.push(`created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      whereClauses.push(`created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    if (search) {
      whereClauses.push(`business_name ILIKE $${paramIndex}`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const documents = await queryAll(
      `SELECT * FROM document_history_detail
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    )

    if (!documents) {
      console.error('[DOCUMENT-HISTORY] 조회 오류')
      return createErrorResponse('문서 이력 조회 중 오류가 발생했습니다', 500)
    }

    // 착공신고서 조회 (별도 테이블) - Direct PostgreSQL
    const constructionWhereClauses: string[] = ['is_deleted = false']
    const constructionParams: any[] = []
    let constructionParamIndex = 1

    if (businessId) {
      constructionWhereClauses.push(`business_id = $${constructionParamIndex}`)
      constructionParams.push(businessId)
      constructionParamIndex++
    }

    if (startDate) {
      constructionWhereClauses.push(`created_at >= $${constructionParamIndex}`)
      constructionParams.push(startDate)
      constructionParamIndex++
    }

    if (endDate) {
      constructionWhereClauses.push(`created_at <= $${constructionParamIndex}`)
      constructionParams.push(endDate)
      constructionParamIndex++
    }

    if (search) {
      constructionWhereClauses.push(`business_name ILIKE $${constructionParamIndex}`)
      constructionParams.push(`%${search}%`)
      constructionParamIndex++
    }

    const constructionWhereClause = 'WHERE ' + constructionWhereClauses.join(' AND ')

    const constructionReports = await queryAll(
      `SELECT * FROM construction_reports
       ${constructionWhereClause}
       ORDER BY created_at DESC`,
      constructionParams
    )

    if (!constructionReports) {
      console.error('[DOCUMENT-HISTORY] 착공신고서 조회 오류')
    }

    // 착공신고서를 문서 이력 형식으로 변환
    const constructionDocs = (constructionReports || []).map(report => ({
      id: report.id,
      business_id: report.business_id,
      business_name: report.business_name,
      document_type: 'construction_report',
      document_name: `착공신고서_${report.business_name}_${report.report_number}`,
      file_format: 'pdf',
      file_size: 0,
      file_path: report.pdf_file_url || null,
      document_data: report.report_data,
      created_at: report.created_at,
      created_by: report.created_by_name || '시스템',
      metadata: {
        report_number: report.report_number,
        subsidy_amount: report.subsidy_amount,
        report_date: report.report_date
      }
    }))

    // 문서 타입 필터링 (착공신고서만 조회하는 경우)
    let allDocuments = documents || []
    if (documentType === 'construction_report') {
      allDocuments = constructionDocs
    } else if (!documentType) {
      // 전체 조회 시 병합
      allDocuments = [...(documents || []), ...constructionDocs]
      allDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    // 페이지네이션 적용
    const startIndex = (page - 1) * limit
    const paginatedDocs = allDocuments.slice(startIndex, startIndex + limit)
    const totalCount = allDocuments.length

    // 통계 계산 (전체 문서 + 착공신고서) - Direct PostgreSQL
    const allDocs = await queryAll(
      'SELECT document_type, file_format FROM document_history_detail',
      []
    )

    const allConstructionReportsCount = await queryOne(
      'SELECT COUNT(*) as count FROM construction_reports WHERE is_deleted = false',
      []
    )

    const constructionReportCount = parseInt(allConstructionReportsCount?.count || '0')

    const summary = {
      total_documents: (allDocs?.length || 0) + constructionReportCount,
      by_type: {
        purchase_order:
          allDocs?.filter((d) => d.document_type === 'purchase_order')
            .length || 0,
        estimate:
          allDocs?.filter((d) => d.document_type === 'estimate').length || 0,
        contract:
          allDocs?.filter((d) => d.document_type === 'contract').length || 0,
        construction_report: constructionReportCount,
        other: allDocs?.filter((d) => d.document_type === 'other').length || 0
      },
      by_format: {
        excel: allDocs?.filter((d) => d.file_format === 'excel').length || 0,
        pdf: (allDocs?.filter((d) => d.file_format === 'pdf').length || 0) + constructionReportCount
      }
    }

    const response: DocumentHistoryListResponse = {
      success: true,
      data: {
        documents: paginatedDocs,
        pagination: {
          total: totalCount,
          page,
          limit,
          total_pages: Math.ceil(totalCount / limit)
        },
        summary
      }
    }

    return createSuccessResponse(response.data)
  } catch (error) {
    console.error('[DOCUMENT-HISTORY] API 오류:', error)
    return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })

// POST: 문서 이력 수동 저장 (클라이언트 측 생성 파일용)
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const { authorized, user } = await checkUserPermission(request)
    if (!authorized || !user) {
      return createErrorResponse('인증이 필요합니다', 401)
    }

    const body = await request.json()
    const {
      business_id,
      document_type,
      document_name,
      document_data,
      file_format,
      file_size,
      file_path
    } = body

    if (!business_id || !document_type || !document_name) {
      return createErrorResponse('필수 정보가 누락되었습니다', 400)
    }

    console.log('[DOCUMENT-HISTORY] 이력 저장 요청:', {
      user: user.name,
      business_id,
      document_type,
      document_name
    })

    // 문서 이력 저장 - Direct PostgreSQL
    const historyData = await queryOne(
      `INSERT INTO document_history (
        business_id, document_type, document_name, document_data,
        file_path, file_format, file_size, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        business_id,
        document_type,
        document_name,
        document_data,
        file_path || null,
        file_format,
        file_size || 0,
        user.id
      ]
    )

    if (!historyData) {
      console.error('[DOCUMENT-HISTORY] 이력 저장 오류')
      return createErrorResponse('문서 이력 저장 중 오류가 발생했습니다', 500)
    }

    console.log('[DOCUMENT-HISTORY] 이력 저장 완료:', {
      historyId: historyData.id,
      fileName: document_name
    })

    return createSuccessResponse({
      history_id: historyData.id,
      document_name,
      created_at: historyData.created_at
    })
  } catch (error) {
    console.error('[DOCUMENT-HISTORY] API 오류:', error)
    return createErrorResponse('서버 내부 오류가 발생했습니다', 500)
  }
}, { logLevel: 'debug' })
