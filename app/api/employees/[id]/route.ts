import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/utils/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// GET /api/employees/[id] - 특정 직원 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const authResult = await verifyToken(token);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('id, employee_id, name, email, permission_level, department, team, position, phone, mobile, is_active, last_login_at, created_at, updated_at')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single();

    if (error || !employee) {
      console.error('❌ [EMPLOYEES] 직원 조회 오류:', error);
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '직원을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    console.log('✅ [EMPLOYEES] 직원 조회 성공:', employee.name);

    return NextResponse.json({
      success: true,
      data: employee,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [EMPLOYEES] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] - 직원 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const authResult = await verifyToken(token);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const currentUser = authResult.data?.user;

    // 본인 정보 수정이거나 관리자인 경우만 허용
    if (currentUser?.id !== params.id && currentUser?.permission_level !== 3) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSION', message: '수정 권한이 없습니다.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      email,
      password,
      permissionLevel,
      department,
      team,
      position,
      phone,
      mobile,
      isActive
    } = body;

    // 기존 직원 정보 조회
    const { data: existingEmployee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingEmployee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '직원을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    // 권한 레벨 변경은 관리자만 가능
    if (permissionLevel !== undefined && permissionLevel !== existingEmployee.permission_level) {
      if (currentUser?.permission_level !== 3) {
        return NextResponse.json(
          { success: false, error: { code: 'INSUFFICIENT_PERMISSION', message: '권한 변경은 관리자만 가능합니다.' } },
          { status: 403 }
        );
      }
    }

    // 이메일 중복 확인 (본인 제외)
    if (email && email !== existingEmployee.email) {
      const { data: emailCheck } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('email', email)
        .neq('id', params.id)
        .single();

      if (emailCheck) {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_EXISTS', message: '이미 사용 중인 이메일입니다.' } },
          { status: 400 }
        );
      }
    }

    // 업데이트 데이터 구성
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (permissionLevel !== undefined) updateData.permission_level = permissionLevel;
    if (department !== undefined) updateData.department = department;
    if (team !== undefined) updateData.team = team;
    if (position !== undefined) updateData.position = position;
    if (phone !== undefined) updateData.phone = phone;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (isActive !== undefined && currentUser?.permission_level === 3) {
      updateData.is_active = isActive;
    }

    // 비밀번호 변경
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // 직원 정보 업데이트
    const { data: updatedEmployee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', params.id)
      .select('id, employee_id, name, email, permission_level, department, team, position, phone, mobile, is_active, updated_at')
      .single();

    if (updateError) {
      console.error('❌ [EMPLOYEES] 수정 오류:', updateError);
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: '직원 정보 수정 중 오류가 발생했습니다.' } },
        { status: 500 }
      );
    }

    console.log('✅ [EMPLOYEES] 수정 성공:', updatedEmployee.name);

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [EMPLOYEES] PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] - 직원 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('cookie')?.match(/auth-token=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const authResult = await verifyToken(token);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    // 관리자만 삭제 가능
    if (authResult.data?.user.permission_level !== 3) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSION', message: '직원 삭제 권한이 없습니다.' } },
        { status: 403 }
      );
    }

    // 자기 자신은 삭제 불가
    if (authResult.data?.user.id === params.id) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE_SELF', message: '본인 계정은 삭제할 수 없습니다.' } },
        { status: 400 }
      );
    }

    // 기존 직원 확인
    const { data: existingEmployee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingEmployee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '직원을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    // 소프트 삭제 (is_deleted = true, is_active = false)
    const { error: deleteError } = await supabaseAdmin
      .from('employees')
      .update({
        is_deleted: true,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id);

    if (deleteError) {
      console.error('❌ [EMPLOYEES] 삭제 오류:', deleteError);
      return NextResponse.json(
        { success: false, error: { code: 'DELETE_ERROR', message: '직원 삭제 중 오류가 발생했습니다.' } },
        { status: 500 }
      );
    }

    console.log('✅ [EMPLOYEES] 삭제 성공:', existingEmployee.name);

    return NextResponse.json({
      success: true,
      data: {
        message: '직원이 성공적으로 삭제되었습니다.',
        deletedEmployee: {
          id: existingEmployee.id,
          name: existingEmployee.name,
          email: existingEmployee.email
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [EMPLOYEES] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}