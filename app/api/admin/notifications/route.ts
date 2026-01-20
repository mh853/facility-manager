// app/api/admin/notifications/route.ts
// Temporary placeholder API to prevent 404 errors
// This endpoint exists to handle stale requests from browser extensions or cached code

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const unread_only = searchParams.get('unread_only');
  const limit = searchParams.get('limit');

  // Log for debugging
  console.log('⚠️ [DEPRECATED-API] /api/admin/notifications called (should not be used)');
  console.log('   Params:', { unread_only, limit });
  console.log('   → Use Supabase Realtime instead (NotificationContext)');

  // Return empty response to prevent 404 errors
  return NextResponse.json({
    success: true,
    message: 'This API is deprecated. Use Supabase Realtime via NotificationContext.',
    data: {
      notifications: [],
      unreadCount: 0,
      total: 0
    },
    meta: {
      deprecated: true,
      migrateTo: 'NotificationContext with Supabase Realtime'
    }
  }, {
    status: 200,
    headers: {
      'X-Deprecated': 'true',
      'X-Migration-Guide': 'Use NotificationContext hook instead'
    }
  });
}

export async function POST(request: NextRequest) {
  console.log('⚠️ [DEPRECATED-API] POST /api/admin/notifications called (should not be used)');

  return NextResponse.json({
    success: true,
    message: 'This API is deprecated. Use Supabase Realtime via NotificationContext.'
  }, {
    status: 200,
    headers: {
      'X-Deprecated': 'true'
    }
  });
}
