// app/api/construction-reports/pdf/route.ts
// 착공신고서 PDF 다운로드 API

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { generateFullHTML } from '@/lib/pdf-templates/construction-report-html'
import fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터에서 ID 가져오기
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다' },
        { status: 400 }
      )
    }

    console.log('[CONSTRUCTION-REPORTS-PDF] PDF 생성 요청:', { id })

    // Supabase에서 데이터 조회
    const { data: reportData, error: reportError } = await supabase
      .from('construction_reports')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (reportError || !reportData) {
      console.error('[CONSTRUCTION-REPORTS-PDF] 데이터 조회 오류:', reportError)
      return NextResponse.json(
        { success: false, error: '착공신고서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const data = reportData.report_data

    if (!data) {
      return NextResponse.json(
        { success: false, error: '착공신고서 데이터가 없습니다' },
        { status: 404 }
      )
    }

    console.log('[CONSTRUCTION-REPORTS-PDF] 데이터 조회 완료:', {
      business_name: data.business_name,
      report_date: data.report_date
    })

    // HTML 생성
    const html = generateFullHTML(data)

    console.log('[CONSTRUCTION-REPORTS-PDF] HTML 생성 완료')

    // 🔍 디버깅: 생성된 HTML을 파일로 저장
    fs.writeFileSync('/tmp/debug-construction-report.html', html, 'utf-8')
    console.log('[CONSTRUCTION-REPORTS-PDF] HTML 파일 저장: /tmp/debug-construction-report.html')

    // Playwright로 PDF 생성
    const browser = await chromium.launch({
      headless: true
    })

    console.log('[CONSTRUCTION-REPORTS-PDF] Playwright 브라우저 시작')

    const page = await browser.newPage()

    // HTML 설정
    await page.setContent(html, {
      waitUntil: 'networkidle'
    })

    console.log('[CONSTRUCTION-REPORTS-PDF] HTML 로드 완료')

    // PDF 생성 (Playwright 최신 렌더링 엔진 사용)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    })

    console.log('[CONSTRUCTION-REPORTS-PDF] PDF 생성 완료')

    await browser.close()

    console.log('[CONSTRUCTION-REPORTS-PDF] 브라우저 종료')

    // 파일명 생성
    const reportDate = new Date(data.report_date)
    const dateStr = reportDate.toISOString().split('T')[0].replace(/-/g, '')
    const fileName = `착공신고서_${data.business_name}_${dateStr}.pdf`

    // PDF 응답
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('[CONSTRUCTION-REPORTS-PDF] 처리 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류' },
      { status: 500 }
    )
  }
}
