// pages/api/socket.ts - Supabase Realtime으로 전환 완료
// 이 파일은 더 이상 사용되지 않습니다.
// Supabase Realtime + PostgreSQL 트리거 시스템이 대체합니다.

import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({
    success: false,
    message: 'WebSocket 서버는 더 이상 사용되지 않습니다. Supabase Realtime으로 전환되었습니다.',
    migration: {
      from: 'Socket.io WebSocket',
      to: 'Supabase Realtime + PostgreSQL Triggers',
      benefits: [
        'Vercel 무료 플랜 호환',
        '무한 재연결 루프 해결',
        '폴링 폴백으로 안정성 보장',
        'PostgreSQL 트리거로 데이터 일관성 보장'
      ]
    }
  });
}