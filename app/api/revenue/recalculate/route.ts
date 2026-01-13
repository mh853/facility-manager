import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 매출 재계산 API - 권한 레벨 4 (슈퍼관리자) 전용
export async function POST(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
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

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 슈퍼관리자 권한 확인 (레벨 4)
    if (decodedToken.permissionLevel < 4) {
      return NextResponse.json(
        { success: false, message: '슈퍼관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { businessId, recalculateAll } = body;

    // 전체 재계산 요청인 경우
    if (recalculateAll === true) {
      console.log('🔄 [RECALCULATE-ALL] 전체 재계산 시작');

      // 1. revenue_calculations 테이블의 모든 기록 삭제
      const { error: deleteAllError } = await supabaseAdmin
        .from('revenue_calculations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteAllError) {
        console.error('❌ [RECALCULATE-ALL] 삭제 실패:', deleteAllError.message);
        return NextResponse.json(
          { success: false, message: '기존 데이터 삭제 실패' },
          { status: 500 }
        );
      }

      // 2. 모든 사업장 조회
      const { data: allBusinesses, error: fetchAllError } = await supabaseAdmin
        .from('business_info')
        .select('id, business_name')
        .eq('is_deleted', false);

      if (fetchAllError || !allBusinesses) {
        console.error('❌ [RECALCULATE-ALL] 사업장 조회 실패');
        return NextResponse.json(
          { success: false, message: '사업장 조회 실패' },
          { status: 500 }
        );
      }

      console.log(`📊 [RECALCULATE-ALL] ${allBusinesses.length}개 사업장 처리 중...`);

      // 3. 병렬 처리 (5개씩 배치)
      const BATCH_SIZE = 5;
      let successCount = 0;
      let failCount = 0;
      const failedBusinesses: string[] = [];

      for (let i = 0; i < allBusinesses.length; i += BATCH_SIZE) {
        const batch = allBusinesses.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (business) => {
            const calculateResponse = await fetch(`${request.nextUrl.origin}/api/revenue/calculate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                business_id: business.id,
                save_result: true
              })
            });

            const calculateResult = await calculateResponse.json();

            if (!calculateResult.success) {
              throw new Error(calculateResult.message || '계산 실패');
            }

            return business.business_name;
          })
        );

        // 배치 결과 집계
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            failCount++;
            failedBusinesses.push(batch[idx].business_name);
          }
        });

        // 진행상황 로그 (배치 단위로만)
        if ((i + BATCH_SIZE) % 25 === 0 || i + BATCH_SIZE >= allBusinesses.length) {
          console.log(`📊 [RECALCULATE-ALL] 진행: ${Math.min(i + BATCH_SIZE, allBusinesses.length)}/${allBusinesses.length}`);
        }
      }

      console.log(`✅ [RECALCULATE-ALL] 완료 - 성공: ${successCount}, 실패: ${failCount}`);

      if (failedBusinesses.length > 0) {
        console.log('⚠️ [RECALCULATE-ALL] 실패 사업장:', failedBusinesses.join(', '));
      }

      return NextResponse.json({
        success: true,
        message: `전체 재계산 완료 (성공: ${successCount}개, 실패: ${failCount}개)`,
        data: {
          recalculatedAll: true,
          total: allBusinesses.length,
          success: successCount,
          fail: failCount,
          failedBusinesses: failedBusinesses.length > 0 ? failedBusinesses : undefined
        }
      });
    }

    // 개별 사업장 재계산
    if (!businessId) {
      return NextResponse.json(
        { success: false, message: '사업장 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🔄 [RECALCULATE] 재계산 요청:', {
      businessId,
      requestedBy: decodedToken.email
    });

    // 1. 먼저 사업장 정보 조회
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('business_info')
      .select('business_name')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      console.error('❌ [RECALCULATE] 사업장 조회 실패:', fetchError);
      return NextResponse.json(
        { success: false, message: `사업장을 찾을 수 없습니다: ${fetchError?.message}` },
        { status: 404 }
      );
    }

    // 2. revenue_calculations 테이블에서 해당 사업장의 계산 기록 삭제
    // (존재하지 않아도 오류가 발생하지 않음)
    const { error: deleteError } = await supabaseAdmin
      .from('revenue_calculations')
      .delete()
      .eq('business_id', businessId);

    if (deleteError) {
      console.log('⚠️  [RECALCULATE] revenue_calculations 삭제 시 오류 (테이블이 없을 수 있음):', deleteError.message);
      // 테이블이 없어도 계속 진행
    }

    console.log('✅ [RECALCULATE] 재계산 준비 완료:', business.business_name);
    console.log('🔄 [RECALCULATE] 즉시 계산 실행 시작...');

    // 3. 즉시 계산 실행 (내부 호출)
    try {
      const calculateResponse = await fetch(`${request.nextUrl.origin}/api/revenue/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_id: businessId,
          save_result: true
        })
      });

      const calculateResult = await calculateResponse.json();

      if (!calculateResult.success) {
        console.error('❌ [RECALCULATE] 계산 실패:', calculateResult.message);
        return NextResponse.json({
          success: false,
          message: `계산 중 오류 발생: ${calculateResult.message}`
        }, { status: 500 });
      }

      const resultData = calculateResult.data || calculateResult;
      console.log('✅ [RECALCULATE] 계산 완료:', business.business_name);
      console.log('   - 영업비용:', resultData.sales_commission || 0);
      console.log('   - 최종 매출:', resultData.total_revenue || 0);

      return NextResponse.json({
        success: true,
        message: `${business.business_name}의 매출 정보가 재계산되었습니다.`,
        data: {
          businessName: business.business_name,
          calculation: calculateResult.data
        }
      });
    } catch (calculateError) {
      console.error('❌ [RECALCULATE] 계산 실행 오류:', calculateError);
      return NextResponse.json({
        success: false,
        message: '계산 실행 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [RECALCULATE] API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
