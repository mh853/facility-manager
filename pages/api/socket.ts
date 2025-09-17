// pages/api/socket.ts - 웹소켓 서버 초기화 엔드포인트
import { NextApiRequest } from 'next';
import { ExtendedNextApiResponse, initializeWebSocket } from '@/lib/websocket/websocket-server';

export default function handler(req: NextApiRequest, res: ExtendedNextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '지원되지 않는 메소드입니다.' });
  }

  try {
    const io = initializeWebSocket(req, res);
    console.log('✅ 웹소켓 서버 준비 완료');

    res.status(200).json({
      success: true,
      message: '웹소켓 서버가 성공적으로 초기화되었습니다.',
      connectedClients: io.engine.clientsCount
    });
  } catch (error) {
    console.error('웹소켓 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: '웹소켓 서버 초기화에 실패했습니다.'
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};