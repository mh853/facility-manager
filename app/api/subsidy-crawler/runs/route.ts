import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Crawl Runs Monitoring API
// ============================================================
// Purpose: Retrieve crawl run history and statistics
// Endpoints:
//   GET /api/subsidy-crawler/runs - List recent crawl runs
//   GET /api/subsidy-crawler/runs?limit=10&offset=0 - Paginated list
// ============================================================

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/subsidy-crawler/runs - List crawl runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status'); // Filter by status
    const triggerType = searchParams.get('trigger_type'); // Filter by trigger type

    // Build query
    let query = supabase
      .from('vw_recent_crawl_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }

    const { data: runs, error } = await query;

    if (error) {
      console.error('Error fetching crawl runs:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('crawl_runs')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (triggerType) {
      countQuery = countQuery.eq('trigger_type', triggerType);
    }

    const { count } = await countQuery;

    // Calculate aggregate statistics
    const stats = {
      total_runs: count || 0,
      runs_with_results: runs?.filter(r => r.total_announcements > 0).length || 0,
      avg_success_rate: runs && runs.length > 0
        ? runs.reduce((sum, r) => sum + (r.success_rate || 0), 0) / runs.length
        : 0,
      avg_relevance_rate: runs && runs.length > 0
        ? runs.reduce((sum, r) => sum + (r.relevance_rate || 0), 0) / runs.length
        : 0,
      avg_ai_verification_rate: runs && runs.length > 0
        ? runs.reduce((sum, r) => sum + (r.ai_verification_rate || 0), 0) / runs.length
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        runs,
        pagination: {
          limit,
          offset,
          total: count || 0,
          has_more: (offset + limit) < (count || 0),
        },
        statistics: stats,
      },
    });
  } catch (error: any) {
    console.error('Unexpected error in crawl runs API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/subsidy-crawler/runs - Create new crawl run (for GitHub Actions)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      run_id,
      trigger_type = 'scheduled',
      github_run_id,
      total_batches,
    } = body;

    // Validation
    if (!run_id) {
      return NextResponse.json(
        { success: false, error: 'run_id is required' },
        { status: 400 }
      );
    }

    // Create new crawl run
    const { data: newRun, error } = await supabase
      .from('crawl_runs')
      .insert({
        run_id,
        trigger_type,
        github_run_id,
        total_batches: total_batches || 0,
        status: 'running',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating crawl run:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newRun,
    });
  } catch (error: any) {
    console.error('Unexpected error creating crawl run:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
