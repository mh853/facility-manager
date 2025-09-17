// app/api/departments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const departmentId = params.id;

    // 부서 상세 정보 조회
    const { data: department, error } = await supabaseAdmin
      .from('departments')
      .select(`
        *,
        parent:departments!parent_id(id, name),
        children:departments!parent_id(id, name, is_active),
        employees(
          id, name, email, role, permission_level, is_active,
          created_at, last_login_at
        )
      `)
      .eq('id', departmentId)
      .single();

    if (error || !department) {
      return NextResponse.json(
        { success: false, error: '부서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 부서 계층 구조 조회
    const { data: hierarchy } = await supabaseAdmin
      .rpc('get_department_hierarchy', { dept_id: departmentId });

    // 통계 계산
    const activeEmployees = department.employees?.filter((emp: any) => emp.is_active) || [];
    const stats = {
      total_employees: department.employees?.length || 0,
      active_employees: activeEmployees.length,
      by_role: activeEmployees.reduce((acc: any, emp: any) => {
        acc[emp.role] = (acc[emp.role] || 0) + 1;
        return acc;
      }, {}),
      by_permission: activeEmployees.reduce((acc: any, emp: any) => {
        const level = `level_${emp.permission_level}`;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {})
    };

    return NextResponse.json({
      success: true,
      data: {
        ...department,
        hierarchy,
        stats
      }
    });

  } catch (error) {
    console.error('❌ [DEPARTMENTS] 상세 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '부서 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 관리자 권한 확인
    if (user.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, error: '부서 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const departmentId = params.id;

    // 부서 존재 확인
    const { data: department } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .eq('id', departmentId)
      .single();

    if (!department) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 부서입니다.' },
        { status: 404 }
      );
    }

    // 하위 부서 확인
    const { data: childDepartments } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .eq('parent_id', departmentId);

    if (childDepartments && childDepartments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '하위 부서가 있는 부서는 삭제할 수 없습니다.',
          details: {
            child_departments: childDepartments.map(child => child.name)
          }
        },
        { status: 400 }
      );
    }

    // 소속 직원 확인
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .eq('department_id', departmentId)
      .eq('is_active', true);

    if (employees && employees.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '소속 직원이 있는 부서는 삭제할 수 없습니다.',
          details: {
            employee_count: employees.length,
            suggestion: '직원들을 다른 부서로 이동한 후 삭제해주세요.'
          }
        },
        { status: 400 }
      );
    }

    // 안전한 삭제 (is_active = false로 설정)
    const { error: deleteError } = await supabaseAdmin
      .from('departments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', departmentId);

    if (deleteError) throw deleteError;

    console.log('✅ [DEPARTMENTS] 부서 비활성화 완료:', {
      id: departmentId,
      name: department.name,
      deletedBy: user.name
    });

    return NextResponse.json({
      success: true,
      message: '부서가 비활성화되었습니다.'
    });

  } catch (error) {
    console.error('❌ [DEPARTMENTS] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '부서 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}