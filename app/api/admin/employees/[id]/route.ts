import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/supabase-direct';
import { verifyTokenString } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 사용자 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증 - Authorization 헤더 또는 httpOnly 쿠키에서 토큰 확인
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // httpOnly 쿠키에서 토큰 확인
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const decodedToken = verifyTokenString(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = decodedToken.userId || decodedToken.id;
    const permissionLevel = decodedToken.permissionLevel || decodedToken.permission_level;

    // 자신의 정보이거나 관리자/슈퍼관리자인 경우에만 접근 허용
    if (userId !== params.id && permissionLevel < 3) {
      return NextResponse.json(
        { success: false, message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 사용자 정보 조회 - Direct PostgreSQL
    const employee = await queryOne(
      'SELECT * FROM employees WHERE id = $1',
      [params.id]
    );

    if (!employee) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소셜 계정 정보도 함께 조회 - Direct PostgreSQL
    const socialAccounts = await queryAll(
      'SELECT * FROM social_accounts WHERE user_id = $1',
      [params.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        employee,
        socialAccounts: socialAccounts || [],
        permissions: {
          canViewAllTasks: employee.permission_level >= 1,
          canCreateTasks: employee.permission_level >= 1,
          canEditTasks: employee.permission_level >= 1,
          canDeleteTasks: employee.permission_level >= 1,
          canViewReports: employee.permission_level >= 1,
          canApproveReports: employee.permission_level >= 1,
          canAccessAdminPages: employee.permission_level >= 3,
          canViewSensitiveData: employee.permission_level >= 3,
        }
      }
    });

  } catch (error) {
    console.error('사용자 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT 토큰 검증 - Authorization 헤더 또는 httpOnly 쿠키에서 토큰 확인
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // httpOnly 쿠키에서 토큰 확인
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const decodedToken = verifyTokenString(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = decodedToken.userId || decodedToken.id;
    const permissionLevel = decodedToken.permissionLevel || decodedToken.permission_level;

    const body = await request.json();
    const { name, email, department, position, permission_level, phone, mobile } = body;

    // 자신의 프로필 수정인지 확인
    const isSelfUpdate = userId === params.id;

    // 권한 레벨 변경 시도 시 관리자 권한 확인
    if (permission_level !== undefined && !isSelfUpdate) {
      // 다른 사람의 권한을 변경하려면 관리자 권한 필요
      if (permissionLevel < 3) {
        return NextResponse.json(
          { success: false, message: '관리자 권한이 필요합니다.' },
          { status: 403 }
        );
      }
    }

    // 입력 데이터 검증
    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: '이름과 이메일은 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (자신 제외) - Direct PostgreSQL
    const existingEmployee = await queryOne(
      'SELECT id FROM employees WHERE email = $1 AND id != $2',
      [email, params.id]
    );

    if (existingEmployee) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    // 기존 사용자 정보 조회 (권한 레벨 보존용) - Direct PostgreSQL
    const currentEmployee = await queryOne(
      'SELECT permission_level FROM employees WHERE id = $1',
      [params.id]
    );

    // 사용자 정보 업데이트 - Direct PostgreSQL
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    updateFields.push(`name = $${paramIndex}`);
    updateValues.push(name.trim());
    paramIndex++;

    updateFields.push(`email = $${paramIndex}`);
    updateValues.push(email.trim().toLowerCase());
    paramIndex++;

    updateFields.push(`department = $${paramIndex}`);
    updateValues.push(department?.trim() || null);
    paramIndex++;

    updateFields.push(`position = $${paramIndex}`);
    updateValues.push(position?.trim() || null);
    paramIndex++;

    updateFields.push(`phone = $${paramIndex}`);
    updateValues.push(phone?.trim() || null);
    paramIndex++;

    updateFields.push(`mobile = $${paramIndex}`);
    updateValues.push(mobile?.trim() || null);
    paramIndex++;

    // 권한 레벨 수정 요청이 있는지 확인 (0도 유효한 값이므로 !== null 체크)
    if (permission_level !== undefined && permission_level !== null) {
      // 자신의 권한은 수정 불가
      if (isSelfUpdate) {
        console.warn('⚠️ [PERMISSION-UPDATE] 자신의 권한 수정 시도 차단:', userId);
        return NextResponse.json(
          { success: false, message: '자신의 권한 레벨은 변경할 수 없습니다.' },
          { status: 403 }
        );
      }

      // 권한 수정 권한 확인 (레벨 3 이상 필요)
      if (permissionLevel < 3) {
        console.warn('⚠️ [PERMISSION-UPDATE] 권한 부족:', { userId, permissionLevel });
        return NextResponse.json(
          { success: false, message: '권한 수정 권한이 없습니다. 관리자 이상만 가능합니다.' },
          { status: 403 }
        );
      }

      // 시스템 권한(4) 설정은 시스템 권한자만 가능
      if (permission_level === 4 && permissionLevel < 4) {
        console.warn('⚠️ [PERMISSION-UPDATE] 시스템 권한 설정 시도 차단:', {
          userId,
          permissionLevel,
          requestedLevel: permission_level
        });
        return NextResponse.json(
          {
            success: false,
            message: '시스템 권한(레벨 4)은 시스템 관리자만 설정할 수 있습니다.'
          },
          { status: 403 }
        );
      }

      // 유효한 권한 레벨 범위 확인 (0-4)
      if (permission_level < 0 || permission_level > 4) {
        console.warn('⚠️ [PERMISSION-UPDATE] 유효하지 않은 권한 레벨:', permission_level);
        return NextResponse.json(
          { success: false, message: '유효하지 않은 권한 레벨입니다 (0-4).' },
          { status: 400 }
        );
      }

      // 권한 레벨 업데이트
      updateFields.push(`permission_level = $${paramIndex}`);
      updateValues.push(permission_level);
      paramIndex++;

      console.log('🔐 [PERMISSION-UPDATE] 권한 변경 요청:', {
        targetUserId: params.id,
        requestedBy: userId,
        requestedByLevel: permissionLevel,
        newPermissionLevel: permission_level,
        previousLevel: currentEmployee?.permission_level
      });
    }
    // 자신의 프로필 업데이트 시 권한 레벨 유지
    else if (currentEmployee) {
      updateFields.push(`permission_level = $${paramIndex}`);
      updateValues.push(currentEmployee.permission_level);
      paramIndex++;
    }

    // WHERE 조건용 파라미터 추가
    updateValues.push(params.id);

    const updatedEmployee = await queryOne(
      `UPDATE employees
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (!updatedEmployee) {
      console.error('❌ [USER-UPDATE] 업데이트 실패');
      return NextResponse.json(
        { success: false, message: '사용자 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('✅ [USER-UPDATE] 업데이트 성공:', {
      userId: params.id,
      updatedFields: updateFields,
      permissionLevelChanged: permission_level !== undefined && permission_level !== null,
      newPermissionLevel: updatedEmployee.permission_level
    });

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.',
      data: { employee: updatedEmployee }
    });

  } catch (error) {
    console.error('사용자 업데이트 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}