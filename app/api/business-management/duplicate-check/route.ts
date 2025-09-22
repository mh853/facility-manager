// app/api/business-management/duplicate-check/route.ts - 사업장 중복 체크 API
import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// POST: 사업장명 중복 및 유사도 체크
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { business_name, exclude_id } = body

    if (!business_name) {
      return NextResponse.json(
        { error: '사업장명은 필수입니다' },
        { status: 400 }
      )
    }

    // 1. 정확히 같은 이름 체크
    const exactMatch = await DatabaseService.getBusinessByName(business_name)
    if (exactMatch && (!exclude_id || exactMatch.id !== exclude_id)) {
      return NextResponse.json({
        isDuplicate: true,
        exactMatch: exactMatch,
        similarMatches: [],
        message: '동일한 사업장명이 이미 존재합니다'
      })
    }

    // 2. 유사한 이름 체크
    const similarMatches = await DatabaseService.findSimilarBusinessNames(business_name)
    const filteredSimilar = similarMatches.filter(business => 
      business.business_name !== business_name && 
      (!exclude_id || business.id !== exclude_id)
    )

    return NextResponse.json({
      isDuplicate: false,
      exactMatch: null,
      similarMatches: filteredSimilar,
      message: filteredSimilar.length > 0 
        ? `${filteredSimilar.length}개의 유사한 사업장명이 발견되었습니다`
        : '중복되는 사업장명이 없습니다'
    })

  } catch (error) {
    console.error('사업장 중복 체크 오류:', error)
    return NextResponse.json(
      { error: '중복 체크에 실패했습니다' },
      { status: 500 }
    )
  }
}