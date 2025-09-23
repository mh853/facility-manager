// 웹소켓 서버 설정 (Next.js API Route용)
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

export type ExtendedNextApiResponse = NextApiResponse & {
  socket: {
    server: HTTPServer & {
      io?: SocketIOServer;
    };
  };
};

export interface AuthenticatedSocket {
  id: string;
  userId: string;
  userName: string;
  departmentId: string;
  permissionLevel: number;
}

// 인증된 소켓들을 관리하는 Map
const authenticatedSockets = new Map<string, AuthenticatedSocket>();

// 사용자별 소켓 연결 관리
const userSockets = new Map<string, Set<string>>();

export function initializeWebSocket(
  req: NextApiRequest,
  res: ExtendedNextApiResponse
): SocketIOServer {
  if (!res.socket.server.io) {
    console.log('🚀 웹소켓 서버 초기화 중...');

    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_SITE_URL
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('인증 토큰이 필요합니다.'));
        }

        // JWT 토큰 검증
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // 사용자 정보 조회
        const { data: user, error } = await supabaseAdmin
          .from('employees')
          .select('id, name, email, department_id, permission_level')
          .eq('id', decoded.userId)
          .eq('is_active', true)
          .single();

        if (error || !user) {
          return next(new Error('유효하지 않은 사용자입니다.'));
        }

        // 소켓에 사용자 정보 저장
        const authSocket: AuthenticatedSocket = {
          id: socket.id,
          userId: user.id,
          userName: user.name,
          departmentId: user.department_id,
          permissionLevel: user.permission_level
        };

        authenticatedSockets.set(socket.id, authSocket);

        // 사용자별 소켓 관리
        if (!userSockets.has(user.id)) {
          userSockets.set(user.id, new Set());
        }
        userSockets.get(user.id)!.add(socket.id);

        // 사용자 온라인 상태 업데이트
        await supabaseAdmin
          .from('user_sessions')
          .upsert({
            employee_id: user.id,
            session_token: socket.id,
            socket_id: socket.id,
            is_online: true,
            last_activity: new Date().toISOString()
          });

        console.log(`✅ 사용자 연결: ${user.name} (${socket.id})`);
        next();
      } catch (error) {
        console.error('웹소켓 인증 오류:', error);
        next(new Error('인증 실패'));
      }
    });

    io.on('connection', (socket) => {
      const authSocket = authenticatedSockets.get(socket.id);
      if (!authSocket) return;

      console.log(`🔗 웹소켓 연결: ${authSocket.userName}`);

      // 사용자를 개인 룸에 추가
      socket.join(`user:${authSocket.userId}`);

      // 부서 룸에 추가 (부서별 알림용)
      if (authSocket.departmentId) {
        socket.join(`department:${authSocket.departmentId}`);
      }

      // 온라인 사용자 목록 전송 (같은 부서 사용자들에게)
      broadcastOnlineUsers(io, authSocket.departmentId);

      // 실시간 알림 수신 핸들러
      socket.on('subscribe_notifications', () => {
        socket.join(`notifications:${authSocket.userId}`);
        console.log(`🔔 알림 구독: ${authSocket.userName}`);
      });

      // 프로젝트 실시간 업데이트 구독
      socket.on('subscribe_project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        console.log(`📁 프로젝트 구독: ${authSocket.userName} -> ${projectId}`);
      });

      // 작업 실시간 업데이트 구독
      socket.on('subscribe_task', (taskId: string) => {
        socket.join(`task:${taskId}`);
        console.log(`✅ 작업 구독: ${authSocket.userName} -> ${taskId}`);
      });

      // 타이핑 상태 전송
      socket.on('typing_start', (data: { taskId: string; commentId?: string }) => {
        socket.to(`task:${data.taskId}`).emit('user_typing', {
          userId: authSocket.userId,
          userName: authSocket.userName,
          taskId: data.taskId,
          commentId: data.commentId
        });
      });

      socket.on('typing_stop', (data: { taskId: string }) => {
        socket.to(`task:${data.taskId}`).emit('user_stop_typing', {
          userId: authSocket.userId,
          taskId: data.taskId
        });
      });

      // 연결 해제 처리
      socket.on('disconnect', async () => {
        console.log(`❌ 웹소켓 연결 해제: ${authSocket.userName}`);

        // 인증된 소켓에서 제거
        authenticatedSockets.delete(socket.id);

        // 사용자 소켓 목록에서 제거
        const userSocketSet = userSockets.get(authSocket.userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            userSockets.delete(authSocket.userId);

            // 마지막 소켓이면 오프라인 상태로 변경
            await supabaseAdmin
              .from('user_sessions')
              .update({ is_online: false })
              .eq('employee_id', authSocket.userId);
          }
        }

        // 온라인 사용자 목록 업데이트
        broadcastOnlineUsers(io, authSocket.departmentId);
      });

      // 하트비트 (연결 상태 확인)
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    res.socket.server.io = io;

    // 전역 접근을 위해 io 인스턴스 저장
    (global as any).io = io;
  }

  return res.socket.server.io;
}

// 온라인 사용자 목록 전송
async function broadcastOnlineUsers(io: SocketIOServer, departmentId: string) {
  try {
    const onlineUserIds = Array.from(authenticatedSockets.values())
      .filter(s => s.departmentId === departmentId)
      .map(s => s.userId);

    if (onlineUserIds.length > 0) {
      const { data: onlineUsers } = await supabaseAdmin
        .from('employees')
        .select('id, name, email')
        .in('id', onlineUserIds);

      io.to(`department:${departmentId}`).emit('online_users_update', onlineUsers);
    }
  } catch (error) {
    console.error('온라인 사용자 전송 오류:', error);
  }
}

// 특정 사용자에게 알림 전송
export function sendNotificationToUser(
  io: SocketIOServer,
  userId: string,
  notification: any
) {
  io.to(`notifications:${userId}`).emit('new_notification', notification);
  console.log(`🔔 알림 전송: ${userId}`);
}

// 프로젝트 업데이트 전송
export function sendProjectUpdate(
  io: SocketIOServer,
  projectId: string,
  update: any
) {
  io.to(`project:${projectId}`).emit('project_updated', {
    projectId,
    ...update
  });
  console.log(`📁 프로젝트 업데이트: ${projectId}`);
}

// 작업 업데이트 전송
export function sendTaskUpdate(
  io: SocketIOServer,
  taskId: string,
  update: any
) {
  io.to(`task:${taskId}`).emit('task_updated', {
    taskId,
    ...update
  });
  console.log(`✅ 작업 업데이트: ${taskId}`);
}

// 부서별 공지사항 전송
export function sendDepartmentBroadcast(
  io: SocketIOServer,
  departmentId: string,
  message: any
) {
  io.to(`department:${departmentId}`).emit('department_broadcast', message);
  console.log(`📢 부서 공지: ${departmentId}`);
}

export { authenticatedSockets, userSockets };