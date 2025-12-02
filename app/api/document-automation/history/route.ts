// app/api/document-automation/history/route.ts
// 문서 이력 조회 API

import { NextRequest } from 'next/server'
import {
  withApiHandler,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'
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

    // 뷰에서 조회
    let query = supabaseAdmin
      .from('document_history_detail')
      .select('*', { count: 'exact' })

    // 필터 적용
    if (businessId) {
      query = query.eq('business_id', businessId)
    }

    if (documentType && documentType !== 'construction_report') {
      query = query.eq('document_type', documentType)
    }

    if (fileFormat) {
      query = query.eq('file_format', fileFormat)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // 사업장명 검색
    if (search) {
      query = query.ilike('business_name', `%${search}%`)
    }

    // 정렬
    query = query.order('created_at', { ascending: false })

    const { data: documents, error: documentsError, count } = await query

    if (documentsError) {
      console.error('[DOCUMENT-HISTORY] 조회 오류:', documentsError)
      return createErrorResponse('문서 이력 조회 중 오류가 발생했습니다', 500)
    }

    // 착공신고서 조회 (별도 테이블)
    let constructionQuery = supabaseAdmin
      .from('construction_reports')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)

    // 필터 적용
    if (businessId) {
      constructionQuery = constructionQuery.eq('business_id', businessId)
    }

    if (startDate) {
      constructionQuery = constructionQuery.gte('created_at', startDate)
    }

    if (endDate) {
      constructionQuery = constructionQuery.lte('created_at', endDate)
    }

    if (search) {
      constructionQuery = constructionQuery.ilike('business_name', `%${search}%`)
    }

    constructionQuery = constructionQuery.order('created_at', { ascending: false })

    const { data: constructionReports, error: constructionError, count: constructionCount } = await constructionQuery

    if (constructionError) {
      console.error('[DOCUMENT-HISTORY] 착공신고서 조회 오류:', constructionError)
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

    // 통계 계산 (전체 문서 + 착공신고서)
    const { data: allDocs } = await supabaseAdmin
      .from('document_history_detail')
      .select('document_type, file_format')

    const { data: allConstructionReports } = await supabaseAdmin
      .from('construction_reports')
      .select('id')
      .eq('is_deleted', false)

    const summary = {
      total_documents: (allDocs?.length || 0) + (allConstructionReports?.length || 0),
      by_type: {
        purchase_order:
          allDocs?.filter((d) => d.document_type === 'purchase_order')
            .length || 0,
        estimate:
          allDocs?.filter((d) => d.document_type === 'estimate').length || 0,
        contract:
          allDocs?.filter((d) => d.document_type === 'contract').length || 0,
        construction_report: allConstructionReports?.length || 0,
        other: allDocs?.filter((d) => d.document_type === 'other').length || 0
      },
      by_format: {
        excel: allDocs?.filter((d) => d.file_format === 'excel').length || 0,
        pdf: (allDocs?.filter((d) => d.file_format === 'pdf').length || 0) + (allConstructionReports?.length || 0)
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

    // 문서 이력 저장
    const { data: historyData, error: historyError } = await supabaseAdmin
      .from('document_history')
      .insert({
        business_id,
        document_type,
        document_name,
        document_data,
        file_path: file_path || null,
        file_format,
        file_size: file_size || 0,
        created_by: user.id
      })
      .select()
      .single()

    if (historyError) {
      console.error('[DOCUMENT-HISTORY] 이력 저장 오류:', historyError)
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
