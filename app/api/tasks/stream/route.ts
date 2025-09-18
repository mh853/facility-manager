import { NextRequest } from 'next/server'

// 전역 클라이언트 연결 관리
const clients = new Set<ReadableStreamDefaultController>()

// 모든 클라이언트에게 데이터 브로드캐스트
function broadcastToClients(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`

  clients.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(message))
    } catch (error) {
      console.error('Failed to send message to client:', error)
      clients.delete(controller)
    }
  })
}

// 시뮬레이션된 업무 데이터
let mockTasks = [
  {
    id: '1',
    title: '환경개선 방지시설',
    businessName: '서울 제조업체 A',
    businessInfo: {
      address: '서울시 강남구 테헤란로 123',
      contact: '02-1234-5678',
      manager: '김철수'
    },
    type: 'self',
    status: 'customer_contact',
    priority: 'high',
    assignee: '이영희',
    dueDate: '2024-12-25',
    createdAt: '2024-01-15',
    description: '대기오염 방지시설 설치 프로젝트',
    notes: '긴급 처리 필요'
  },
  {
    id: '2',
    title: '폐수처리 보조금 신청',
    businessName: '경기 화학공장 B',
    businessInfo: {
      address: '경기도 안산시 단원구 고잔동 456',
      contact: '031-987-6543',
      manager: '박영수'
    },
    type: 'subsidy',
    status: 'application_submit',
    priority: 'medium',
    assignee: '김민준',
    dueDate: '2024-12-30',
    createdAt: '2024-01-16',
    description: '폐수처리시설 보조금 지원사업',
    notes: '서류 검토 중'
  },
  {
    id: '3',
    title: 'AS 요청 처리',
    businessName: 'AS 고객사',
    type: 'as',
    status: 'customer_contact',
    priority: 'high',
    assignee: '기술팀',
    dueDate: '2024-12-20',
    createdAt: '2024-01-17',
    description: 'AS 업무 처리',
    notes: 'AS 요청 접수'
  },
  {
    id: '4',
    title: '기타 업무',
    businessName: '',
    type: 'etc',
    status: 'etc_status',
    priority: 'low',
    assignee: '관리팀',
    dueDate: '2024-12-31',
    createdAt: '2024-01-18',
    description: '기타 업무 처리',
    notes: '기타 작업'
  }
]

export async function GET(request: NextRequest) {
  // SSE 스트림 생성
  const stream = new ReadableStream({
    start(controller) {
      // 클라이언트 연결 등록
      clients.add(controller)

      // 헤더 전송
      controller.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`
      ))

      // 초기 데이터 전송
      controller.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ type: 'initial', tasks: mockTasks })}\n\n`
      ))

      console.log(`SSE client connected. Total clients: ${clients.size}`)
    },

    cancel() {
      // 클라이언트 연결 해제
      clients.delete(this as any)
      console.log(`SSE client disconnected. Total clients: ${clients.size}`)
    }
  })

  // SSE 응답 헤더 설정
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

// POST 요청으로 업무 업데이트 시뮬레이션
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, task } = body

    switch (action) {
      case 'add':
        const newTask = {
          ...task,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString().split('T')[0]
        }
        mockTasks.push(newTask)

        // 모든 클라이언트에게 새 업무 브로드캐스트
        broadcastToClients({
          type: 'task_added',
          task: newTask
        })
        break

      case 'update':
        const taskIndex = mockTasks.findIndex(t => t.id === task.id)
        if (taskIndex !== -1) {
          mockTasks[taskIndex] = { ...mockTasks[taskIndex], ...task }

          // 모든 클라이언트에게 업데이트 브로드캐스트
          broadcastToClients({
            type: 'task_updated',
            task: mockTasks[taskIndex]
          })
        }
        break

      case 'delete':
        const deleteIndex = mockTasks.findIndex(t => t.id === task.id)
        if (deleteIndex !== -1) {
          const deletedTask = mockTasks.splice(deleteIndex, 1)[0]

          // 모든 클라이언트에게 삭제 브로드캐스트
          broadcastToClients({
            type: 'task_deleted',
            task: deletedTask
          })
        }
        break

      case 'simulate_change':
        // 시뮬레이션: 랜덤 업무 상태 변경
        if (mockTasks.length > 0) {
          const randomTask = mockTasks[Math.floor(Math.random() * mockTasks.length)]
          const statuses = ['customer_contact', 'site_inspection', 'quotation', 'contract']
          randomTask.status = statuses[Math.floor(Math.random() * statuses.length)] as any

          broadcastToClients({
            type: 'task_updated',
            task: randomTask
          })
        }
        break
    }

    return Response.json({
      success: true,
      message: `Action ${action} completed`,
      totalClients: clients.size
    })

  } catch (error) {
    console.error('SSE POST error:', error)
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// 디버깅용 클라이언트 상태 확인
export async function DELETE() {
  // 모든 연결 강제 종료 (디버깅용)
  clients.forEach(controller => {
    try {
      controller.close()
    } catch (error) {
      console.error('Error closing connection:', error)
    }
  })
  clients.clear()

  return Response.json({
    success: true,
    message: 'All SSE connections closed',
    totalClients: clients.size
  })
}