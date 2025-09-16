import { TokenPayload, User, UserRole } from '@/types';

// JWT 대신 간단한 토큰 시스템 사용 (실제 환경에서는 JWT 사용 권장)
const TOKEN_SECRET = process.env.AUTH_SECRET || 'facility-manager-secret-key';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24시간

// 간단한 base64 인코딩/디코딩 (실제 환경에서는 JWT 사용)
function encodeToken(payload: TokenPayload): string {
  const data = JSON.stringify(payload);
  return Buffer.from(data).toString('base64');
}

function decodeToken(token: string): TokenPayload | null {
  try {
    const data = Buffer.from(token, 'base64').toString('utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function createToken(user: User): Promise<string> {
  const now = Date.now();
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_EXPIRY
  };

  return encodeToken(payload);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const payload = decodeToken(token);

    if (!payload) {
      return null;
    }

    // 토큰 만료 확인
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function isAdmin(role: UserRole): boolean {
  return role === 3;
}

export function canAccessAdminPanel(role: UserRole): boolean {
  return isAdmin(role);
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  // 관리자는 모든 권한 보유
  if (userRole === 3) return true;

  // 요청된 권한과 사용자 권한이 일치하거나 더 높은 권한
  return userRole >= requiredRole;
}

// 사용자 인증 헬퍼 함수들
export const AUTH_COOKIE_NAME = 'auth-token';
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: TOKEN_EXPIRY / 1000, // 초 단위
  path: '/'
};

// 클라이언트 사이드에서 사용할 토큰 관리
export function getTokenFromCookie(): string | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function setTokenCookie(token: string): void {
  if (typeof window === 'undefined') return;

  const expires = new Date(Date.now() + TOKEN_EXPIRY).toUTCString();
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function removeTokenCookie(): void {
  if (typeof window === 'undefined') return;

  document.cookie = `${AUTH_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// 개발 환경용 모의 사용자 데이터
export const MOCK_USERS: User[] = [
  {
    id: 'admin-1',
    email: 'admin@facility.blueon-iot.com',
    name: '시스템 관리자',
    role: 3,
    department: 'IT팀',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date()
  },
  {
    id: 'user-1',
    email: 'inspector1@facility.blueon-iot.com',
    name: '실사담당자1',
    role: 2,
    department: '환경팀',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date()
  },
  {
    id: 'user-2',
    email: 'inspector2@facility.blueon-iot.com',
    name: '실사담당자2',
    role: 1,
    department: '환경팀',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date()
  }
];

export function findUserByEmail(email: string): User | null {
  return MOCK_USERS.find(user => user.email === email && user.isActive) || null;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeUserForClient(user: User): Omit<User, 'isActive'> {
  const { isActive, ...safeUser } = user;
  return safeUser;
}