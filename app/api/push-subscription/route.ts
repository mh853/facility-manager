import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// 푸시 구독 등록
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth() as any;
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 구독 정보입니다.' },
        { status: 400 }
      );
    }

    // 기존 구독 확인 및 업데이트
    const { data: existingSubscription, error: checkError } = await supabaseAdmin
      .from('user_sessions')
      .select('id, push_subscription')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('기존 구독 확인 실패:', checkError);
      return NextResponse.json(
        { success: false, error: '구독 정보 확인에 실패했습니다.' },
        { status: 500 }
      );
    }

    const pushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime
    };

    if (existingSubscription) {
      // 기존 세션 업데이트
      const { error: updateError } = await supabaseAdmin
        .from('user_sessions')
        .update({
          push_subscription: pushSubscriptionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('구독 업데이트 실패:', updateError);
        return NextResponse.json(
          { success: false, error: '구독 정보 업데이트에 실패했습니다.' },
          { status: 500 }
        );
      }
    } else {
      // 새 세션 생성
      const userAgent = request.headers.get('user-agent') || '';
      const ipAddress = request.headers.get('x-forwarded-for') ||
                        request.headers.get('x-real-ip') ||
                        'unknown';

      const { error: insertError } = await supabaseAdmin
        .from('user_sessions')
        .insert({
          user_id: user.id,
          session_token: `push_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          user_agent: userAgent,
          ip_address: ipAddress,
          push_subscription: pushSubscriptionData,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일
          is_active: true
        });

      if (insertError) {
        console.error('새 구독 생성 실패:', insertError);
        return NextResponse.json(
          { success: false, error: '구독 정보 저장에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    console.log(`사용자 ${user.id}의 푸시 구독 등록/업데이트 완료`);

    return NextResponse.json({
      success: true,
      message: '푸시 알림 구독이 등록되었습니다.'
    });

  } catch (error) {
    console.error('푸시 구독 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 푸시 구독 해제
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth() as any;
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // 사용자의 푸시 구독 정보 제거
    const { error: deleteError } = await supabaseAdmin
      .from('user_sessions')
      .update({
        push_subscription: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deleteError) {
      console.error('구독 해제 실패:', deleteError);
      return NextResponse.json(
        { success: false, error: '구독 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`사용자 ${user.id}의 푸시 구독 해제 완료`);

    return NextResponse.json({
      success: true,
      message: '푸시 알림 구독이 해제되었습니다.'
    });

  } catch (error) {
    console.error('푸시 구독 해제 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 푸시 구독 상태 확인
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth() as any;
    if (authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('user_sessions')
      .select('push_subscription, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('push_subscription', 'is', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('구독 상태 확인 실패:', error);
      return NextResponse.json(
        { success: false, error: '구독 상태 확인에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        isSubscribed: !!subscription,
        subscriptionInfo: subscription ? {
          created_at: subscription.created_at,
          updated_at: subscription.updated_at,
          endpoint: subscription.push_subscription.endpoint.substring(0, 50) + '...'
        } : null
      }
    });

  } catch (error) {
    console.error('푸시 구독 상태 확인 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}