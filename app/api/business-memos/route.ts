// app/api/business-memos/route.ts - Business Memos CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { BusinessMemo, CreateBusinessMemoInput, UpdateBusinessMemoInput } from '@/types/database'

// GET - 특정 사업장의 모든 메모 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: '사업장 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log(`🔍 [BUSINESS-MEMOS] 사업장 메모 조회 시작 - businessId: ${businessId}`)
    
    const { data: memos, error } = await supabaseAdmin
      .from('business_memos')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 조회 실패:', error)
      return NextResponse.json(
        { success: false, error: `메모 조회 실패: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 조회 완료 - ${memos?.length || 0}개`)
    
    return NextResponse.json({
      success: true,
      data: memos || [],
      metadata: {
        businessId,
        count: memos?.length || 0
      }
    })

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] GET 요청 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST - 새 메모 추가
export async function POST(request: NextRequest) {
  try {
    const body: CreateBusinessMemoInput = await request.json()
    
    if (!body.business_id || !body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json(
        { success: false, error: '사업장 ID, 제목, 내용은 필수 입력사항입니다.' },
        { status: 400 }
      )
    }

    console.log(`📝 [BUSINESS-MEMOS] 새 메모 추가 - businessId: ${body.business_id}`)
    
    const memoData = {
      business_id: body.business_id,
      title: body.title.trim(),
      content: body.content.trim(),
      created_by: body.created_by || '관리자',
      updated_by: body.created_by || '관리자'
    }

    const { data: newMemo, error } = await supabaseAdmin
      .from('business_memos')
      .insert(memoData)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 추가 실패:', error)
      return NextResponse.json(
        { success: false, error: `메모 추가 실패: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ [BUSINESS-MEMOS] 새 메모 추가 완료 - ID: ${newMemo.id}`)
    
    return NextResponse.json({
      success: true,
      data: newMemo,
      message: '메모가 성공적으로 추가되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] POST 요청 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT - 기존 메모 수정
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memoId = searchParams.get('id')
    
    if (!memoId) {
      return NextResponse.json(
        { success: false, error: '메모 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const body: UpdateBusinessMemoInput = await request.json()
    
    if (!body.title?.trim() && !body.content?.trim()) {
      return NextResponse.json(
        { success: false, error: '제목 또는 내용 중 하나는 필수입니다.' },
        { status: 400 }
      )
    }

    console.log(`📝 [BUSINESS-MEMOS] 메모 수정 - ID: ${memoId}`)
    
    const updateData: any = {
      updated_by: body.updated_by || '관리자'
    }
    
    if (body.title?.trim()) {
      updateData.title = body.title.trim()
    }
    
    if (body.content?.trim()) {
      updateData.content = body.content.trim()
    }

    const { data: updatedMemo, error } = await supabaseAdmin
      .from('business_memos')
      .update(updateData)
      .eq('id', memoId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 수정 실패:', error)
      return NextResponse.json(
        { success: false, error: `메모 수정 실패: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 수정 완료 - ID: ${memoId}`)
    
    return NextResponse.json({
      success: true,
      data: updatedMemo,
      message: '메모가 성공적으로 수정되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] PUT 요청 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE - 메모 소프트 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memoId = searchParams.get('id')
    
    if (!memoId) {
      return NextResponse.json(
        { success: false, error: '메모 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log(`🗑️ [BUSINESS-MEMOS] 메모 삭제 - ID: ${memoId}`)
    
    const { data: deletedMemo, error } = await supabaseAdmin
      .from('business_memos')
      .update({ 
        is_deleted: true,
        updated_by: '관리자' // 향후 계정 시스템에서 실제 사용자로 변경
      })
      .eq('id', memoId)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('❌ [BUSINESS-MEMOS] 메모 삭제 실패:', error)
      return NextResponse.json(
        { success: false, error: `메모 삭제 실패: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ [BUSINESS-MEMOS] 메모 삭제 완료 - ID: ${memoId}`)
    
    return NextResponse.json({
      success: true,
      data: deletedMemo,
      message: '메모가 성공적으로 삭제되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ [BUSINESS-MEMOS] DELETE 요청 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}