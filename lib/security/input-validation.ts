import { z } from 'zod';

// 기본 한국어 에러 메시지
const koreanErrorMessages = {
  required: "필수 입력 항목입니다",
  invalid_type_error: "잘못된 데이터 타입입니다",
  too_small: "최소 길이를 만족하지 않습니다",
  too_big: "최대 길이를 초과했습니다",
  invalid_email: "올바른 이메일 형식이 아닙니다",
  invalid_url: "올바른 URL 형식이 아닙니다"
};

// 한국어 특화 검증 스키마들
export const ValidationSchemas = {
  // 이메일 검증
  email: z.string({
    message: koreanErrorMessages.required
  })
  .email(koreanErrorMessages.invalid_email)
  .max(255, "이메일은 255자를 초과할 수 없습니다"),

  // 비밀번호 검증 (소셜 로그인용으로 간소화)
  password: z.string({
    message: koreanErrorMessages.required
  })
  .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
  .max(128, "비밀번호는 128자를 초과할 수 없습니다")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    "비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다"
  ),

  // 한국어 이름 검증
  koreanName: z.string({
    message: koreanErrorMessages.required
  })
  .min(2, "이름은 최소 2자 이상이어야 합니다")
  .max(50, "이름은 50자를 초과할 수 없습니다")
  .regex(
    /^[가-힣a-zA-Z\s]+$/,
    "이름은 한글, 영문, 공백만 사용할 수 있습니다"
  ),

  // 사업장명 검증
  businessName: z.string({
    message: "사업장명은 필수입니다"
  })
  .min(2, "사업장명은 최소 2자 이상이어야 합니다")
  .max(100, "사업장명은 100자를 초과할 수 없습니다")
  .regex(
    /^[가-힣a-zA-Z0-9\s\-_().(주)(유)(재)㈜㈜]+$/,
    "사업장명에 사용할 수 없는 문자가 포함되어 있습니다"
  ),

  // 전화번호 검증 (한국 형식)
  phoneNumber: z.string()
  .optional()
  .refine(
    (val) => !val || /^0(2|[3-6][1-5]|70)-?\d{3,4}-?\d{4}$|^01[016789]-?\d{3,4}-?\d{4}$/.test(val),
    "올바른 전화번호 형식이 아닙니다 (예: 02-1234-5678, 010-1234-5678)"
  ),

  // 권한 레벨 검증
  permissionLevel: z.number({
    message: "권한 레벨은 필수입니다"
  })
  .int("권한 레벨은 정수여야 합니다")
  .min(1, "권한 레벨은 1 이상이어야 합니다")
  .max(3, "권한 레벨은 3 이하여야 합니다"),

  // 파일 업로드 검증
  uploadedFile: z.object({
    name: z.string().min(1, "파일명이 필요합니다"),
    size: z.number()
      .max(10 * 1024 * 1024, "파일 크기는 10MB를 초과할 수 없습니다")
      .positive("파일 크기는 양수여야 합니다"),
    type: z.string().refine(
      (type) => [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ].includes(type),
      "지원하지 않는 파일 형식입니다"
    )
  }),

  // URL 검증
  url: z.string()
  .url(koreanErrorMessages.invalid_url)
  .max(2048, "URL이 너무 깁니다"),

  // 소셜 로그인 제공자 검증
  socialProvider: z.enum(['kakao', 'naver', 'google'], {
    message: "지원하지 않는 소셜 로그인 제공자입니다"
  }),

  // 소셜 로그인 토큰 검증
  socialToken: z.string({
    message: "소셜 로그인 토큰이 필요합니다"
  })
  .min(10, "유효하지 않은 토큰입니다")
  .max(4096, "토큰이 너무 깁니다"),

  // JWT 토큰 검증
  jwtToken: z.string({
    message: "인증 토큰이 필요합니다"
  })
  .regex(
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
    "올바른 JWT 토큰 형식이 아닙니다"
  )
};

// 복합 스키마들
export const ComplexSchemas = {
  // 직원 생성 요청
  createEmployee: z.object({
    employeeId: z.string().min(1, "사번은 필수입니다").max(20, "사번은 20자를 초과할 수 없습니다"),
    name: ValidationSchemas.koreanName,
    email: ValidationSchemas.email,
    password: ValidationSchemas.password.optional(), // 소셜 로그인은 비밀번호 선택적
    permissionLevel: ValidationSchemas.permissionLevel,
    department: z.string().max(50, "부서명은 50자를 초과할 수 없습니다").optional(),
    position: z.string().max(50, "직급은 50자를 초과할 수 없습니다").optional(),
    phone: ValidationSchemas.phoneNumber
  }),

  // 소셜 로그인 요청
  socialLoginRequest: z.object({
    provider: ValidationSchemas.socialProvider,
    code: z.string().min(1, "인증 코드가 필요합니다"),
    state: z.string().optional(),
    redirectUri: ValidationSchemas.url.optional()
  }),

  // 업무 생성 요청
  createTask: z.object({
    title: z.string().min(1, "제목은 필수입니다").max(200, "제목은 200자를 초과할 수 없습니다"),
    content: z.string().min(1, "내용은 필수입니다").max(2000, "내용은 2000자를 초과할 수 없습니다"),
    priority: z.number().min(1).max(5),
    assigneeId: z.string().uuid("올바른 담당자 ID가 아닙니다"),
    businessId: z.string().uuid("올바른 사업장 ID가 아닙니다").optional(),
    dueDate: z.string().datetime("올바른 날짜 형식이 아닙니다").optional()
  })
};

// 검증 실행 함수
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const result = schema.safeParse(input);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const errors = result.error.issues.map((err: any) => {
        if (err.path.length > 0) {
          return `${err.path.join('.')}: ${err.message}`;
        }
        return err.message;
      });

      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['검증 중 오류가 발생했습니다']
    };
  }
}

// HTML 이스케이프 함수
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// SQL 인젝션 방지를 위한 문자열 이스케이프
export function escapeSqlString(input: string): string {
  return input.replace(/'/g, "''");
}

// 파일명 안전화
export function sanitizeFileName(fileName: string): string {
  // 위험한 문자 제거 및 한글 파일명 지원
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 위험한 문자 제거
    .replace(/^\.+/, '') // 시작 점 제거
    .substring(0, 255); // 최대 길이 제한
}

// API 요청 바디 크기 검증
export function validateRequestSize(contentLength: string | null, maxSize: number = 10 * 1024 * 1024): boolean {
  if (!contentLength) return true; // Content-Length가 없으면 통과

  const size = parseInt(contentLength, 10);
  return !isNaN(size) && size <= maxSize;
}

// IP 주소 검증
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}