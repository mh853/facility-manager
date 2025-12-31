import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Crawl Batch Results API
// ============================================================
// Purpose: Log and retrieve individual batch crawl results
// Endpoints:
//   POST /api/subsidy-crawler/batches - Log batch result
//   PATCH /api/subsidy-crawler/batches/:id - Update batch status
// ============================================================

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/subsidy-crawler/batches - Create/update batch result
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      run_id,
      batch_number,
      url_ids,
      urls_in_batch,
      started_at,
      completed_at,
      processing_time_seconds,
      successful_urls,
      failed_urls,
      total_announcements,
      new_announcements,
      relevant_announcements,
      ai_verified_announcements,
      avg_response_time_ms,
      status,
      error_message,
      raw_results,
    } = body;

    // Validation
    if (!run_id || batch_number === undefined) {
      return NextResponse.json(
        { success: false, error: 'run_id and batch_number are required' },
        { status: 400 }
      );
    }

    // Upsert batch result
    const { data: batchResult, error } = await supabase
      .from('crawl_batch_results')
      .upsert(
        {
          run_id,
          batch_number,
          url_ids: url_ids || [],
          urls_in_batch: urls_in_batch || url_ids?.length || 0,
          started_at: started_at || new Date().toISOString(),
          completed_at,
          processing_time_seconds,
          successful_urls: successful_urls || 0,
          failed_urls: failed_urls || 0,
          total_announcements: total_announcements || 0,
          new_announcements: new_announcements || 0,
          relevant_announcements: relevant_announcements || 0,
          ai_verified_announcements: ai_verified_announcements || 0,
          avg_response_time_ms,
          status: status || 'running',
          error_message,
          raw_results,
        },
        {
          onConflict: 'run_id,batch_number',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting batch result:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: batchResult,
    });
  } catch (error: any) {
    console.error('Unexpected error logging batch result:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
