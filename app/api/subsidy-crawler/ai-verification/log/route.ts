import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// AI Verification Logging API
// ============================================================
// Purpose: Log individual AI verification results for announcements
// Endpoints:
//   POST /api/subsidy-crawler/ai-verification/log - Log single verification
//   POST /api/subsidy-crawler/ai-verification/log/batch - Log multiple verifications
// ============================================================

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/subsidy-crawler/ai-verification/log - Log single AI verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      run_id,
      batch_number,
      announcement_url,
      announcement_title,
      announcement_content,
      source_url,
      keyword_matched,
      matched_keywords,
      keyword_score,
      ai_verified,
      ai_confidence,
      ai_reasoning,
      gemini_model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      api_cost_usd,
      response_time_ms,
    } = body;

    // Validation
    if (!run_id || !announcement_url || !announcement_title || !source_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'run_id, announcement_url, announcement_title, and source_url are required',
        },
        { status: 400 }
      );
    }

    // Insert verification log
    const { data: log, error } = await supabase
      .from('ai_verification_log')
      .insert({
        run_id,
        batch_number,
        announcement_url,
        announcement_title,
        announcement_content,
        source_url,
        keyword_matched: keyword_matched || false,
        matched_keywords,
        keyword_score,
        ai_verified: ai_verified || false,
        ai_confidence,
        ai_reasoning,
        gemini_model: gemini_model || 'gemini-1.5-flash',
        prompt_tokens,
        completion_tokens,
        total_tokens,
        api_cost_usd,
        response_time_ms,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging AI verification:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('Unexpected error logging AI verification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
