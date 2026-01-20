import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Individual Crawl Run Detail API
// ============================================================
// Purpose: Get detailed information about a specific crawl run
// Endpoints:
//   GET /api/subsidy-crawler/runs/[runId] - Get run details with batches
//   PATCH /api/subsidy-crawler/runs/[runId] - Update run status/stats
// ============================================================

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/subsidy-crawler/runs/[runId] - Get detailed run information
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;

    // Get run details
    const { data: run, error: runError } = await supabase
      .from('vw_recent_crawl_runs')
      .select('*')
      .eq('run_id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: 'Crawl run not found' },
        { status: 404 }
      );
    }

    // Get batch results for this run
    const { data: batches, error: batchError } = await supabase
      .from('crawl_batch_results')
      .select('*')
      .eq('run_id', runId)
      .order('batch_number', { ascending: true });

    if (batchError) {
      console.error('Error fetching batch results:', batchError);
    }

    // Get AI verification summary for this run
    const { data: aiStats, error: aiError } = await supabase
      .from('ai_verification_log')
      .select('ai_verified, disagreement')
      .eq('run_id', runId);

    const aiSummary = aiStats ? {
      total_verifications: aiStats.length,
      ai_verified_count: aiStats.filter(v => v.ai_verified).length,
      disagreement_count: aiStats.filter(v => v.disagreement).length,
      agreement_rate: aiStats.length > 0
        ? ((aiStats.length - aiStats.filter(v => v.disagreement).length) / aiStats.length * 100).toFixed(2)
        : 0,
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        run,
        batches: batches || [],
        ai_verification_summary: aiSummary,
      },
    });
  } catch (error: any) {
    console.error('Unexpected error in crawl run detail API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/subsidy-crawler/runs/[runId] - Update run status and statistics
export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    const body = await request.json();

    const {
      completed_at,
      status,
      error_message,
      total_urls_crawled,
      successful_urls,
      failed_urls,
      total_announcements,
      new_announcements,
      relevant_announcements,
      ai_verified_announcements,
      avg_response_time_ms,
      total_processing_time_seconds,
      completed_batches,
    } = body;

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (completed_at !== undefined) updateData.completed_at = completed_at;
    if (status !== undefined) updateData.status = status;
    if (error_message !== undefined) updateData.error_message = error_message;
    if (total_urls_crawled !== undefined) updateData.total_urls_crawled = total_urls_crawled;
    if (successful_urls !== undefined) updateData.successful_urls = successful_urls;
    if (failed_urls !== undefined) updateData.failed_urls = failed_urls;
    if (total_announcements !== undefined) updateData.total_announcements = total_announcements;
    if (new_announcements !== undefined) updateData.new_announcements = new_announcements;
    if (relevant_announcements !== undefined) updateData.relevant_announcements = relevant_announcements;
    if (ai_verified_announcements !== undefined) updateData.ai_verified_announcements = ai_verified_announcements;
    if (avg_response_time_ms !== undefined) updateData.avg_response_time_ms = avg_response_time_ms;
    if (total_processing_time_seconds !== undefined) updateData.total_processing_time_seconds = total_processing_time_seconds;
    if (completed_batches !== undefined) updateData.completed_batches = completed_batches;

    // Auto-calculate successful_urls and failed_urls from batch results when completing
    // This ensures crawl_runs table has accurate aggregated statistics
    if (completed_at !== undefined) {
      console.log(`[PATCH /runs/${runId}] Completing run - auto-calculating batch statistics...`);

      const { data: batchStats, error: batchError } = await supabase
        .from('crawl_batch_results')
        .select('successful_urls, failed_urls')
        .eq('run_id', runId);

      if (batchError) {
        console.warn(`[PATCH /runs/${runId}] Failed to fetch batch statistics:`, batchError);
      } else if (batchStats && batchStats.length > 0) {
        const totalSuccessful = batchStats.reduce((sum, batch) => sum + (batch.successful_urls || 0), 0);
        const totalFailed = batchStats.reduce((sum, batch) => sum + (batch.failed_urls || 0), 0);

        // Override with auto-calculated values (more accurate than manually provided)
        updateData.successful_urls = totalSuccessful;
        updateData.failed_urls = totalFailed;

        console.log(`[PATCH /runs/${runId}] Auto-calculated: successful=${totalSuccessful}, failed=${totalFailed} from ${batchStats.length} batches`);
      } else {
        console.log(`[PATCH /runs/${runId}] No batch results found - keeping provided values or defaults`);
      }
    }

    // Update run
    const { data: updatedRun, error } = await supabase
      .from('crawl_runs')
      .update(updateData)
      .eq('run_id', runId)
      .select()
      .single();

    if (error) {
      console.error('Error updating crawl run:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRun,
    });
  } catch (error: any) {
    console.error('Unexpected error updating crawl run:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
