// API Route: 사업장 업무 상태 배치 조회 엔드포인트
// 대량의 사업장 업무 상태를 한 번의 요청으로 효율적으로 조회

import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { queryAll } from '@/lib/supabase-direct'
import { verifyTokenHybrid } from '@/lib/secure-jwt'

// 사용자 권한 확인 헬퍼 함수
async function checkUserPermission(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const result = await verifyTokenHybrid(token);

    if (!result.user) {
      return { authorized: false, user: null };
    }

    return {
      authorized: true,
      user: result.user
    };
  } catch (error) {
    console.error('권한 확인 오류:', error);
    return { authorized: false, user: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [FACILITY-TASKS-BATCH] 배치 조회 요청 시작')

    // 사용자 인증
    const { authorized, user } = await checkUserPermission(request)
    if (!authorized || !user) {
      return createErrorResponse('인증이 필요합니다', 401)
    }

    // 요청 본문에서 사업장 목록 가져오기
    const body = await request.json()
    const { businessNames }: { businessNames: string[] } = body

    if (!businessNames || !Array.isArray(businessNames)) {
      return createErrorResponse('사업장 목록이 필요합니다', 400)
    }

    console.log(`📊 [FACILITY-TASKS-BATCH] ${businessNames.length}개 사업장 배치 조회`)

    // 대용량 처리를 위한 청크 단위 분할 (200개씩)
    const CHUNK_SIZE = 200
    const chunks: string[][] = []
    for (let i = 0; i < businessNames.length; i += CHUNK_SIZE) {
      chunks.push(businessNames.slice(i, i + CHUNK_SIZE))
    }

    console.log(`🔄 [FACILITY-TASKS-BATCH] ${chunks.length}개 청크로 분할하여 처리`)

    // 모든 청크를 병렬로 조회 - Direct PostgreSQL 사용
    const allTasksResults = await Promise.all(
      chunks.map(async (chunk, index) => {
        console.log(`📋 [FACILITY-TASKS-BATCH] 청크 ${index + 1}/${chunks.length} 조회 중 (${chunk.length}개 사업장)`)

        try {
          // 동적 IN 절 파라미터 생성
          const placeholders = chunk.map((_, i) => `$${i + 1}`).join(', ')

          const tasks = await queryAll(
            `SELECT * FROM facility_tasks
             WHERE business_name IN (${placeholders})
               AND is_active = true
               AND is_deleted = false
             ORDER BY updated_at DESC`,
            chunk
          )

          console.log(`✅ [FACILITY-TASKS-BATCH] 청크 ${index + 1} 완료 - ${tasks?.length || 0}개 업무`)
          return tasks || []
        } catch (error) {
          console.error(`🔴 [FACILITY-TASKS-BATCH] 청크 ${index + 1} 조회 오류:`, error)
          throw error
        }
      })
    )

    // 모든 결과를 하나로 합치기
    const allTasks = allTasksResults.flat()

    console.log(`📋 [FACILITY-TASKS-BATCH] ${allTasks?.length || 0}개 업무 조회됨`)

    // 사업장별로 업무 그룹화
    const businessTaskMap: Record<string, any[]> = {}
    businessNames.forEach(name => {
      businessTaskMap[name] = []
    })

    // 조회된 업무를 사업장별로 분류
    allTasks?.forEach(task => {
      const businessName = task.business_name
      if (businessTaskMap[businessName]) {
        businessTaskMap[businessName].push(task)
      }
    })

    // 각 사업장별 상태 계산
    const businessStatuses: Record<string, any> = {}

    for (const businessName of businessNames) {
      const tasks = businessTaskMap[businessName] || []
      const activeTasks = tasks.filter(task => !task.completed_at)

      if (activeTasks.length === 0) {
        const completedTasks = tasks.filter(task => task.completed_at)

        if (completedTasks.length > 0) {
          const latestCompleted = completedTasks.sort((a, b) =>
            new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
          )[0]

          businessStatuses[businessName] = {
            statusText: '업무 완료',
            colorClass: 'bg-green-100 text-green-800',
            lastUpdated: latestCompleted.completed_at,
            taskCount: completedTasks.length,
            hasActiveTasks: false
          }
        } else {
          businessStatuses[businessName] = {
            statusText: '업무 미등록',
            colorClass: 'bg-gray-100 text-gray-600',
            lastUpdated: '',
            taskCount: 0,
            hasActiveTasks: false
          }
        }
      } else {
        // 우선순위별 정렬
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const sortedTasks = activeTasks.sort((a, b) => {
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
          if (priorityDiff !== 0) return priorityDiff
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        })

        const topTask = sortedTasks[0]
        const statusLabels: Record<string, string> = {
          // 자비/공통 단계
          customer_contact: '고객 상담',
          site_inspection: '현장 실사',
          quotation: '견적서 작성',
          contract: '계약 체결',
          deposit_confirm: '계약금 확인',
          product_order: '제품 발주',
          product_shipment: '제품 출고',
          installation_schedule: '설치 협의',
          installation: '제품 설치',
          balance_payment: '잔금 입금',
          document_complete: '서류 발송 완료',

          // 보조금 전용 단계
          application_submit: '신청서 제출',
          document_supplement: '서류 보완',
          pre_construction_inspection: '착공 전 실사',
          pre_construction_supplement: '착공 보완',
          pre_construction_supplement_1st: '착공 보완 1차',
          pre_construction_supplement_2nd: '착공 보완 2차',
          pre_construction_supplement_3rd: '착공 보완 3차',
          completion_inspection: '준공 실사',
          completion_supplement: '준공 보완',
          completion_supplement_1st: '준공 보완 1차',
          completion_supplement_2nd: '준공 보완 2차',
          completion_supplement_3rd: '준공 보완 3차',
          final_document_submit: '서류 제출',
          subsidy_payment: '보조금 입금',

          // 기타
          etc_status: '기타'
        }

        const statusLabel = statusLabels[topTask.status] || topTask.status
        let statusText = activeTasks.length === 1 ? statusLabel : `${statusLabel} 외 ${activeTasks.length - 1}건`

        // 단계별 고유 색상 매핑 (우선순위 대신 단계로 통일감 부여)
        const statusColors: Record<string, string> = {
          // 영업/계약 단계 (초기)
          customer_contact: 'bg-purple-100 text-purple-800',      // 고객 상담
          site_inspection: 'bg-blue-100 text-blue-800',           // 현장 실사
          quotation: 'bg-yellow-100 text-yellow-800',             // 견적서 작성
          contract: 'bg-green-100 text-green-800',                // 계약 체결

          // 진행 단계 (중기)
          deposit_confirm: 'bg-emerald-100 text-emerald-800',     // 계약금 확인
          product_order: 'bg-indigo-100 text-indigo-800',         // 제품 발주
          product_shipment: 'bg-cyan-100 text-cyan-800',          // 제품 출고
          installation_schedule: 'bg-amber-100 text-amber-800',   // 설치 협의
          installation: 'bg-orange-100 text-orange-800',          // 제품 설치

          // 완료 단계 (후기)
          balance_payment: 'bg-teal-100 text-teal-800',           // 잔금 입금
          document_complete: 'bg-sky-100 text-sky-800',           // 서류 발송 완료

          // 보조금 전용 단계
          application_submit: 'bg-violet-100 text-violet-800',    // 신청서 제출
          document_supplement: 'bg-yellow-100 text-yellow-800',   // 서류 보완
          pre_construction_inspection: 'bg-blue-100 text-blue-800', // 착공 전 실사
          pre_construction_supplement: 'bg-orange-100 text-orange-800', // 착공 보완
          pre_construction_supplement_1st: 'bg-orange-100 text-orange-800', // 착공 보완 1차
          pre_construction_supplement_2nd: 'bg-orange-100 text-orange-800', // 착공 보완 2차
          pre_construction_supplement_3rd: 'bg-orange-100 text-orange-800', // 착공 보완 3차
          completion_inspection: 'bg-cyan-100 text-cyan-800',     // 준공 실사
          completion_supplement: 'bg-amber-100 text-amber-800',   // 준공 보완
          completion_supplement_1st: 'bg-amber-100 text-amber-800', // 준공 보완 1차
          completion_supplement_2nd: 'bg-amber-100 text-amber-800', // 준공 보완 2차
          completion_supplement_3rd: 'bg-amber-100 text-amber-800', // 준공 보완 3차
          final_document_submit: 'bg-green-100 text-green-800',   // 서류 제출
          subsidy_payment: 'bg-emerald-100 text-emerald-800',     // 보조금 입금

          // 기타
          etc_status: 'bg-gray-100 text-gray-600'                 // 기타
        }

        businessStatuses[businessName] = {
          statusText,
          colorClass: statusColors[topTask.status] || 'bg-gray-100 text-gray-600',
          lastUpdated: topTask.updated_at,
          taskCount: activeTasks.length,
          hasActiveTasks: true
        }
      }
    }

    console.log(`✅ [FACILITY-TASKS-BATCH] 배치 조회 완료: ${Object.keys(businessStatuses).length}개 사업장`)

    return createSuccessResponse({
      businessStatuses,
      totalBusinesses: businessNames.length,
      totalTasks: allTasks?.length || 0,
      user: {
        id: user.id,
        name: user.name,
        permission_level: user.permission_level
      }
    })

  } catch (error) {
    console.error('❌ [FACILITY-TASKS-BATCH] 오류:', error)
    return createErrorResponse('배치 조회 중 오류가 발생했습니다', 500)
  }
}