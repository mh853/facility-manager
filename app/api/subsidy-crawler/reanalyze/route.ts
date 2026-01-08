import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncement, normalizeDate } from '@/lib/gemini';

// ============================================================
// Gemini AI 재분석 API
// ============================================================
// 목적: 기존 공고의 Gemini AI 분석 결과 재추출 (신청기간, 예산 등)
// 엔드포인트: POST /api/subsidy-crawler/reanalyze
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'dev-secret';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface ReanalyzeRequest {
  announcement_ids?: string[];  // 특정 공고 ID들
  batch_size?: number;          // 배치 크기 (기본 50)
  reanalyze_all?: boolean;      // 모든 공고 재분석 (신청기간/예산 NULL인 공고만)
  force?: boolean;              // 이미 정보가 있어도 재분석
}

interface ReanalyzeResponse {
  success: boolean;
  total_processed: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: string[];
  duration_ms: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 인증 확인 (프로덕션 환경에서만)
  if (IS_PRODUCTION) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== CRAWLER_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const body: ReanalyzeRequest = await request.json();
    const batchSize = body.batch_size || 50;
    const force = body.force || false;

    let announcements: any[] = [];

    // 재분석 대상 공고 가져오기
    if (body.announcement_ids && body.announcement_ids.length > 0) {
      // 특정 ID들
      const { data, error } = await supabase
        .from('subsidy_announcements')
        .select('id, title, content, source_url, application_period_start, application_period_end, budget')
        .in('id', body.announcement_ids);

      if (error) throw error;
      announcements = data || [];

    } else if (body.reanalyze_all) {
      // 신청기간 또는 예산이 NULL인 공고만 (또는 force=true면 모든 공고)
      let query = supabase
        .from('subsidy_announcements')
        .select('id, title, content, source_url, application_period_start, application_period_end, budget')
        .limit(batchSize);

      if (!force) {
        query = query.or('application_period_start.is.null,application_period_end.is.null,budget.is.null');
      }

      const { data, error } = await query;
      if (error) throw error;
      announcements = data || [];

    } else {
      return NextResponse.json(
        { error: 'announcement_ids 또는 reanalyze_all=true 중 하나를 지정해야 합니다.' },
        { status: 400 }
      );
    }

    if (announcements.length === 0) {
      return NextResponse.json({
        success: true,
        message: '재분석할 공고가 없습니다.',
        total_processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`🔄 재분석 시작: ${announcements.length}개 공고`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // 각 공고를 Gemini AI로 재분석
    for (const announcement of announcements) {
      try {
        // Gemini AI 분석
        const analysisResult = await analyzeAnnouncement(
          announcement.title,
          announcement.content || '',
          announcement.source_url
        );

        const extractedInfo = analysisResult?.extracted_info || {};

        // 날짜 정규화
        const startDate = normalizeDate(extractedInfo.application_period_start);
        const endDate = normalizeDate(extractedInfo.application_period_end);

        // 업데이트할 데이터 준비
        const updateData: any = {
          relevance_score: analysisResult?.relevance_score ?? announcement.relevance_score,
          keywords_matched: analysisResult?.keywords_matched || announcement.keywords_matched,
        };

        // 신청기간 업데이트 (기존 값이 없거나 force=true일 때)
        if (!announcement.application_period_start || force) {
          updateData.application_period_start = startDate;
        }
        if (!announcement.application_period_end || force) {
          updateData.application_period_end = endDate;
        }

        // 예산 업데이트 (기존 값이 없거나 force=true일 때)
        if (!announcement.budget || force) {
          updateData.budget = extractedInfo.budget || null;
        }

        // 지원대상/지원금액 업데이트
        if (extractedInfo.target_description) {
          updateData.target_description = extractedInfo.target_description;
        }
        if (extractedInfo.support_amount) {
          updateData.support_amount = extractedInfo.support_amount;
        }

        // Supabase 업데이트
        const { error: updateError } = await supabase
          .from('subsidy_announcements')
          .update(updateData)
          .eq('id', announcement.id);

        if (updateError) {
          console.error(`❌ 업데이트 실패 (${announcement.title}):`, updateError);
          errors.push(`${announcement.title}: ${updateError.message}`);
          failed++;
        } else {
          console.log(`✅ 업데이트 완료: ${announcement.title}`);
          updated++;
        }

      } catch (error: any) {
        console.error(`❌ 재분석 실패 (${announcement.title}):`, error);
        errors.push(`${announcement.title}: ${error.message || 'Unknown error'}`);
        failed++;
      }

      // Rate limiting (Gemini API)
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    }

    const response: ReanalyzeResponse = {
      success: true,
      total_processed: announcements.length,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: Date.now() - startTime,
    };

    console.log(`✅ 재분석 완료: ${updated}개 업데이트, ${failed}개 실패`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Reanalyze error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Reanalysis failed',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
