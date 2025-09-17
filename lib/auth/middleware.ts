// lib/auth/middleware.ts
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  permissionLevel: number;
  role: string;
  departmentId?: string;
}

export interface AuthResult {
  user?: AuthUser;
  error?: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return { error: '인증 토큰이 필요합니다.' };
    }

    // JWT 토큰 검증
    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return { error: '유효하지 않은 토큰입니다.' };
    }

    // 사용자 정보 조회 (최신 정보 확인)
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select(`
        id, email, name, permission_level, role, department_id,
        is_active, is_deleted
      `)
      .eq('id', decodedToken.userId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !employee) {
      return { error: '사용자를 찾을 수 없습니다.' };
    }

    return {
      user: {
        userId: employee.id,
        email: employee.email,
        name: employee.name,
        permissionLevel: employee.permission_level,
        role: employee.role || 'staff',
        departmentId: employee.department_id
      }
    };

  } catch (error) {
    console.error('❌ [AUTH_MIDDLEWARE] 인증 검증 실패:', error);
    return { error: '인증 처리 중 오류가 발생했습니다.' };
  }
}

export function requireAuth(minPermissionLevel: number = 1) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuth(request);

    if (error || !user) {
      return { error: error || '인증이 필요합니다.', status: 401 };
    }

    if (user.permissionLevel < minPermissionLevel) {
      return { error: '권한이 부족합니다.', status: 403 };
    }

    return { user };
  };
}

export function requireRole(allowedRoles: string[]) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuth(request);

    if (error || !user) {
      return { error: error || '인증이 필요합니다.', status: 401 };
    }

    if (!allowedRoles.includes(user.role)) {
      return { error: '역할 권한이 부족합니다.', status: 403 };
    }

    return { user };
  };
}