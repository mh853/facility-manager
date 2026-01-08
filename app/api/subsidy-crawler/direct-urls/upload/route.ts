import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// CSV Upload API
// ============================================================
// 목적: CSV 파일 파싱 및 direct_url_sources 테이블 업데이트
// 엔드포인트: POST /api/subsidy-crawler/direct-urls/upload
// ============================================================

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'dev-secret';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================
// 타입 정의
// ============================================================

interface CsvRow {
  url: string;
  region_code: string;
  region_name: string;
  category: string;
  notes: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface UploadResult {
  success: boolean;
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    inserted_rows: number;
    updated_rows: number;
    skipped_rows: number;
  };
  errors: ValidationError[];
  duplicate_urls?: string[];
}

// ============================================================
// POST: CSV 파일 업로드 및 처리
// ============================================================

export async function POST(request: NextRequest) {
  // 인증 확인: CRAWLER_SECRET, Authorization Bearer, 또는 쿠키 세션
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // 공통 오류 응답 템플릿
  const createErrorResponse = (message: string, status: number) => NextResponse.json(
    {
      success: false,
      error: message,
      summary: {
        total_rows: 0,
        valid_rows: 0,
        error_rows: 0,
        inserted_rows: 0,
        updated_rows: 0,
        skipped_rows: 0,
      },
      errors: [{ row: 0, field: 'auth', message }],
    },
    { status }
  );

  // 1. CRAWLER_SECRET 인증 (GitHub Actions용)
  if (token && token === CRAWLER_SECRET) {
    // GitHub Actions 크롤러 인증 성공
  }
  // 2. Authorization Bearer 토큰 인증 (Supabase 세션)
  else if (token && token !== CRAWLER_SECRET) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return createErrorResponse('인증이 실패했습니다. 세션이 만료되었습니다.', 401);
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('permission_level')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.permission_level < 4) {
      return createErrorResponse(
        `시스템 관리자 권한(레벨 4)이 필요합니다. 현재 권한: ${userData?.permission_level || 'unknown'}`,
        403
      );
    }
  }
  // 3. 쿠키 기반 세션 인증 (폴백)
  else {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('=').map(decodeURIComponent))
    );
    const accessToken = cookies['sb-access-token'] || cookies['sb-uvdvfsjekqshxtxthxeq-auth-token'];

    if (!accessToken) {
      return createErrorResponse('로그인이 필요합니다.', 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return createErrorResponse('세션이 만료되었습니다. 다시 로그인해주세요.', 401);
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('permission_level')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.permission_level < 4) {
      return createErrorResponse(
        `시스템 관리자 권한(레벨 4)이 필요합니다. 현재 권한: ${userData?.permission_level || 'unknown'}`,
        403
      );
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '파일이 제공되지 않았습니다',
          summary: {
            total_rows: 0,
            valid_rows: 0,
            error_rows: 0,
            inserted_rows: 0,
            updated_rows: 0,
            skipped_rows: 0,
          },
          errors: [{
            row: 0,
            field: 'file',
            message: 'CSV 파일을 선택해주세요.',
          }],
        },
        { status: 400 }
      );
    }

    // 파일 타입 확인
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSV 파일만 업로드 가능합니다',
          summary: {
            total_rows: 0,
            valid_rows: 0,
            error_rows: 0,
            inserted_rows: 0,
            updated_rows: 0,
            skipped_rows: 0,
          },
          errors: [{
            row: 0,
            field: 'file',
            message: 'CSV 파일만 업로드 가능합니다.',
            value: file.name,
          }],
        },
        { status: 400 }
      );
    }

    // 파일 읽기
    const fileContent = await file.text();

    // CSV 파싱 및 검증
    const { rows, errors } = parseAndValidateCsv(fileContent);

    // 유효한 행만 필터링
    const validRows = rows.filter((_, index) =>
      !errors.some(e => e.row === index + 1)
    );

    // 데이터베이스 저장
    const { inserted, updated, skipped, duplicateUrls } = await saveToDatabase(validRows);

    const result: UploadResult = {
      success: errors.length === 0,
      summary: {
        total_rows: rows.length,
        valid_rows: validRows.length,
        error_rows: errors.length,
        inserted_rows: inserted,
        updated_rows: updated,
        skipped_rows: skipped,
      },
      errors,
      duplicate_urls: duplicateUrls.length > 0 ? duplicateUrls : undefined,
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'CSV 파일 처리 중 오류가 발생했습니다',
        summary: {
          total_rows: 0,
          valid_rows: 0,
          error_rows: 0,
          inserted_rows: 0,
          updated_rows: 0,
          skipped_rows: 0,
        },
        errors: [{
          row: 0,
          field: 'system',
          message: error.message || '시스템 오류가 발생했습니다.',
        }],
      },
      { status: 500 }
    );
  }
}

// ============================================================
// CSV 파싱 및 검증
// ============================================================

function parseAndValidateCsv(content: string): {
  rows: CsvRow[];
  errors: ValidationError[];
} {
  const rows: CsvRow[] = [];
  const errors: ValidationError[] = [];

  // BOM 제거
  const cleanContent = content.replace(/^\uFEFF/, '');

  // 줄 분리 (주석 및 빈 줄 제외)
  const lines = cleanContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (lines.length === 0) {
    errors.push({
      row: 0,
      field: 'file',
      message: 'CSV 파일이 비어있습니다',
    });
    return { rows, errors };
  }

  // 헤더 검증
  const headerLine = lines[0];
  const expectedHeaders = ['url', 'region_code', 'region_name', 'category', 'notes'];
  const actualHeaders = parseCSVLine(headerLine);

  if (!arraysEqual(actualHeaders, expectedHeaders)) {
    errors.push({
      row: 1,
      field: 'header',
      message: `헤더가 올바르지 않습니다. 예상: ${expectedHeaders.join(', ')}`,
      value: actualHeaders.join(', '),
    });
    return { rows, errors };
  }

  // 데이터 행 파싱
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    const values = parseCSVLine(line);

    if (values.length !== expectedHeaders.length) {
      errors.push({
        row: rowNumber,
        field: 'format',
        message: `컬럼 수가 올바르지 않습니다 (예상: ${expectedHeaders.length}, 실제: ${values.length})`,
      });
      continue;
    }

    const [url, region_code, region_name, category, notes] = values;

    // URL 검증
    if (!url || !isValidUrl(url)) {
      errors.push({
        row: rowNumber,
        field: 'url',
        message: 'URL 형식이 올바르지 않습니다',
        value: url,
      });
    }

    // region_code 검증 (5자리 숫자) - 선택 사항
    if (region_code && region_code.trim().length > 0 && !/^\d{5}$/.test(region_code)) {
      errors.push({
        row: rowNumber,
        field: 'region_code',
        message: 'region_code는 5자리 숫자여야 합니다 (비워두거나 5자리 숫자 입력)',
        value: region_code,
      });
    }

    // region_name 검증
    if (!region_name || region_name.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'region_name',
        message: 'region_name은 필수입니다',
        value: region_name,
      });
    }

    rows.push({
      url: url.trim(),
      region_code: region_code.trim(),
      region_name: region_name.trim(),
      category: category.trim(),
      notes: notes.trim(),
    });
  }

  return { rows, errors };
}

// CSV 라인 파싱 (쉼표, 따옴표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i++; // 다음 따옴표 건너뛰기
      } else {
        // 따옴표 시작/종료
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 컬럼 구분자
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current); // 마지막 컬럼
  return result;
}

// URL 유효성 검사
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// 배열 동등 비교
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

// ============================================================
// 데이터베이스 저장
// ============================================================

async function saveToDatabase(rows: CsvRow[]): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  duplicateUrls: string[];
}> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const duplicateUrls: string[] = [];

  for (const row of rows) {
    try {
      // 기존 URL 확인
      const { data: existing } = await supabase
        .from('direct_url_sources')
        .select('id, url')
        .eq('url', row.url)
        .single();

      if (existing) {
        // 기존 URL 업데이트
        const { error: updateError } = await supabase
          .from('direct_url_sources')
          .update({
            region_code: row.region_code,
            region_name: row.region_name,
            category: row.category,
            notes: row.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Update error:', updateError);
          skipped++;
        } else {
          updated++;
          duplicateUrls.push(row.url);
        }
      } else {
        // 새 URL 삽입
        const { error: insertError } = await supabase
          .from('direct_url_sources')
          .insert({
            url: row.url,
            region_code: row.region_code,
            region_name: row.region_name,
            category: row.category,
            notes: row.notes,
            is_active: true,
            consecutive_failures: 0,
            total_attempts: 0,
            total_successes: 0,
            error_count: 0,
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          skipped++;
        } else {
          inserted++;
        }
      }
    } catch (error) {
      console.error('Database operation error:', error);
      skipped++;
    }
  }

  return { inserted, updated, skipped, duplicateUrls };
}
