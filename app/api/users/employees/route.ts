// app/api/users/employees/route.ts - 직원 목록 조회 API
import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Employee 인터페이스 정의 (담당자 선택용)
export interface EmployeeForAssignment {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  department?: string;
  position?: string;
  is_active: boolean;
  last_login_at?: string;
}

// GET: 활성 직원 목록 조회 (담당자 선택용)
export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search'); // 검색어
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const department = searchParams.get('department');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('👥 [EMPLOYEES-API] 직원 목록 조회:', { search, includeInactive, department, limit });

    // 기본 쿼리 구성
    let query = supabaseAdmin
      .from('employees')
      .select(`
        id,
        name,
        email,
        employee_id,
        department,
        position,
        is_active,
        last_login_at,
        created_at
      `)
      .order('name', { ascending: true });

    // 활성 직원만 조회 (기본값)
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // 부서별 필터링
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    // 검색 기능 (이름, 이메일, 직원번호, 부서, 직급으로 검색)
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim().toLowerCase();
      const searchConditions = [
        `name.ilike.%${searchTerm}%`,
        `email.ilike.%${searchTerm}%`,
        `employee_id.ilike.%${searchTerm}%`,
        `department.ilike.%${searchTerm}%`,
        `position.ilike.%${searchTerm}%`
      ].join(',');
      query = query.or(searchConditions);
    }

    // 결과 개수 제한
    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data: employees, error } = await query;

    if (error) {
      console.error('🔴 [EMPLOYEES-API] 조회 오류:', error);
      throw error;
    }

    // 담당자 선택용 형태로 변환
    const employeesForAssignment: EmployeeForAssignment[] = (employees || []).map(emp => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      employee_id: emp.employee_id,
      department: emp.department || undefined,
      position: emp.position || undefined,
      is_active: emp.is_active,
      last_login_at: emp.last_login_at || undefined
    }));

    // 통계 정보 추가
    const totalCount = employees?.length || 0;
    const activeCount = employeesForAssignment.filter(emp => emp.is_active).length;
    const departmentStats = employeesForAssignment.reduce((acc, emp) => {
      const dept = emp.department || '미지정';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('✅ [EMPLOYEES-API] 조회 성공:', {
      totalCount,
      activeCount,
      searchTerm: search || 'none',
      departments: Object.keys(departmentStats).length
    });

    return createSuccessResponse({
      employees: employeesForAssignment,
      metadata: {
        totalCount,
        activeCount,
        searchTerm: search || null,
        departmentFilter: department || null,
        departmentStats,
        hasMore: totalCount >= limit
      }
    });

  } catch (error: any) {
    console.error('🔴 [EMPLOYEES-API] GET 오류:', error?.message || error);
    return createErrorResponse('직원 목록 조회 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// POST: 새로운 직원 등록 (관리자 전용)
export const POST = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name,
      email,
      employee_id,
      department,
      position,
      permission_level = 1
    } = body;

    console.log('👤 [EMPLOYEES-API] 새 직원 등록:', { name, email, employee_id, department });

    // 필수 필드 검증
    if (!name || !email || !employee_id) {
      return createErrorResponse('이름, 이메일, 직원번호는 필수입니다', 400);
    }

    // 이메일 중복 검사
    const { data: existingEmployee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmployee) {
      return createErrorResponse('이미 등록된 이메일입니다', 409);
    }

    // 직원번호 중복 검사
    const { data: existingEmployeeId } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('employee_id', employee_id)
      .single();

    if (existingEmployeeId) {
      return createErrorResponse('이미 등록된 직원번호입니다', 409);
    }

    // 새 직원 등록
    const { data: newEmployee, error } = await supabaseAdmin
      .from('employees')
      .insert({
        name,
        email,
        employee_id,
        department,
        position,
        permission_level,
        is_active: true,
        is_deleted: false
      })
      .select()
      .single();

    if (error) {
      console.error('🔴 [EMPLOYEES-API] 등록 오류:', error);
      throw error;
    }

    console.log('✅ [EMPLOYEES-API] 등록 성공:', newEmployee.id);

    return createSuccessResponse({
      employee: newEmployee,
      message: '새 직원이 성공적으로 등록되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [EMPLOYEES-API] POST 오류:', error?.message || error);
    return createErrorResponse('직원 등록 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });

// PUT: 직원 정보 수정
export const PUT = withApiHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      id,
      name,
      email,
      employee_id,
      department,
      position,
      is_active
    } = body;

    console.log('📝 [EMPLOYEES-API] 직원 정보 수정:', { id, name, email });

    if (!id) {
      return createErrorResponse('직원 ID는 필수입니다', 400);
    }

    // 업데이트할 필드만 포함
    const updateData: any = { updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (employee_id !== undefined) updateData.employee_id = employee_id;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: updatedEmployee, error } = await supabaseAdmin
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      console.error('🔴 [EMPLOYEES-API] 수정 오류:', error);
      throw error;
    }

    if (!updatedEmployee) {
      return createErrorResponse('직원을 찾을 수 없습니다', 404);
    }

    console.log('✅ [EMPLOYEES-API] 수정 성공:', updatedEmployee.id);

    return createSuccessResponse({
      employee: updatedEmployee,
      message: '직원 정보가 성공적으로 수정되었습니다'
    });

  } catch (error: any) {
    console.error('🔴 [EMPLOYEES-API] PUT 오류:', error?.message || error);
    return createErrorResponse('직원 정보 수정 중 오류가 발생했습니다', 500);
  }
}, { logLevel: 'debug' });