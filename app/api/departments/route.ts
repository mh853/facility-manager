// app/api/departments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth/middleware';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeEmployees = searchParams.get('include_employees') === 'true';
    const activeOnly = searchParams.get('active_only') !== 'false'; // 기본값 true

    let query = supabaseAdmin
      .from('departments')
      .select(`
        *,
        parent:departments!parent_id(name),
        ${includeEmployees ? 'employees(id, name, email, role, is_active)' : ''}
      `);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: departments, error } = await query.order('name');

    if (error) throw error;

    // 계층 구조 정리
    const departmentsWithStats = departments?.map((dept: any) => ({
      ...dept,
      employee_count: dept.employees?.filter((emp: any) => emp.is_active).length || 0,
      total_employees: dept.employees?.length || 0
    }));

    return NextResponse.json({
      success: true,
      data: departmentsWithStats
    });

  } catch (error) {
    console.error('❌ [DEPARTMENTS] 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '부서 목록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 관리자 권한 확인
    if (!user || user.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, error: '부서 생성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { name, parent_id, description } = await request.json();

    // 입력 검증
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '부서명을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 부모 부서 존재 확인 (parent_id가 있는 경우)
    if (parent_id) {
      const { data: parentDept, error: parentError } = await supabaseAdmin
        .from('departments')
        .select('id, name')
        .eq('id', parent_id)
        .eq('is_active', true)
        .single();

      if (parentError || !parentDept) {
        return NextResponse.json(
          { success: false, error: '존재하지 않는 상위 부서입니다.' },
          { status: 400 }
        );
      }
    }

    const { data: department, error } = await supabaseAdmin
      .from('departments')
      .insert({
        name: name.trim(),
        parent_id: parent_id || null,
        description: description?.trim() || null
      })
      .select(`
        *,
        parent:departments!parent_id(name)
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: '이미 존재하는 부서명입니다.' },
          { status: 400 }
        );
      }
      throw error;
    }

    console.log('✅ [DEPARTMENTS] 부서 생성 완료:', {
      id: department.id,
      name: department.name,
      createdBy: user.name
    });

    return NextResponse.json({
      success: true,
      data: department,
      message: '부서가 생성되었습니다.'
    });

  } catch (error) {
    console.error('❌ [DEPARTMENTS] 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: '부서 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request);
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 관리자 권한 확인
    if (!user || user.permissionLevel < 3) {
      return NextResponse.json(
        { success: false, error: '부서 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id, name, parent_id, description, is_active } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: '부서 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 기존 부서 확인
    const { data: existingDept } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existingDept) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 부서입니다.' },
        { status: 404 }
      );
    }

    const updateData: any = { updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name.trim();
    if (parent_id !== undefined) updateData.parent_id = parent_id;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: department, error } = await supabaseAdmin
      .from('departments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        parent:departments!parent_id(name)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: '이미 존재하는 부서명입니다.' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: department,
      message: '부서 정보가 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('❌ [DEPARTMENTS] 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '부서 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}