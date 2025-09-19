import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRE_TIME = '365d'; // 1년 - 무기한 세션을 위한 긴 만료시간

export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1년 - 무기한 세션
  path: '/',
};

// JWT Token 생성
export function createToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE_TIME });
}

// JWT Token 검증
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// JWT Token 문자열 검증 (별칭)
export function verifyTokenString(token: string): any {
  return verifyToken(token);
}

// 비밀번호 해싱
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// 비밀번호 검증
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// 이메일로 사용자 찾기
export async function findUserByEmail(email: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

// ID로 사용자 찾기
export async function findUserById(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
}

// 사용자 생성
export async function createUser(userData: {
  employee_id: string;
  name: string;
  email: string;
  password?: string;
  permission_level: number;
  department?: string;
  position?: string;
  phone?: string;
  is_active?: boolean;
}) {
  try {
    // 비밀번호가 있으면 해싱
    const hashedPassword = userData.password ? await hashPassword(userData.password) : null;

    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({
        ...userData,
        password: hashedPassword,
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// 사용자 업데이트
export async function updateUser(userId: string, updateData: any) {
  try {
    // 비밀번호가 있으면 해싱
    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// 사용자 삭제 (실제로는 비활성화)
export async function deactivateUser(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error deactivating user:', error);
    throw error;
  }
}

// 권한 확인
export function checkPermission(userPermissionLevel: number, requiredLevel: number): boolean {
  return userPermissionLevel >= requiredLevel;
}

// 관리자 권한 확인
export function isAdmin(userPermissionLevel: number): boolean {
  return userPermissionLevel >= 3;
}

// 토큰에서 사용자 정보 추출
export function getUserFromToken(token: string) {
  const decoded = verifyToken(token);
  return decoded ? { userId: decoded.userId, email: decoded.email, permissionLevel: decoded.permissionLevel } : null;
}

// Request에서 토큰 추출
export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Request에서 사용자 정보 추출
export function getUserFromRequest(request: Request) {
  const token = extractTokenFromRequest(request);
  return token ? getUserFromToken(token) : null;
}