// lib/supabase.ts - Supabase 클라이언트 설정
import { createClient } from '@supabase/supabase-js';

// 환경변수 검증 (브라우저에서 안전하게)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다');
}

if (!supabaseAnonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다');
}

// 클라이언트용 (브라우저)
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false, // 세션 유지 비활성화 (공용 앱)
  }
});

// 서버용 (관리자 권한) - 서버에서만 사용
let supabaseAdminInstance: any = null;

export const supabaseAdmin = (() => {
  if (typeof window !== 'undefined') {
    return supabase;
  }
  
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      supabaseUrl || '', 
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );
  }
  
  return supabaseAdminInstance;
})();

// 데이터베이스 타입 정의
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          status: string;
          google_folder_id: string | null;
          facility_info: any;
          created_at: string;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string;
          google_folder_id?: string | null;
          facility_info?: any;
          created_at?: string;
          updated_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          google_folder_id?: string | null;
          facility_info?: any;
          created_at?: string;
          updated_at?: string;
          synced_at?: string | null;
        };
      };
      facilities: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          type: 'basic' | 'discharge' | 'prevention';
          details: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          type: 'basic' | 'discharge' | 'prevention';
          details?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          type?: 'basic' | 'discharge' | 'prevention';
          details?: any;
          created_at?: string;
        };
      };
      uploaded_files: {
        Row: {
          id: string;
          business_id: string;
          facility_id: string | null;
          filename: string;
          original_filename: string;
          file_hash: string | null;
          file_path: string;
          google_file_id: string | null;
          file_size: number;
          mime_type: string;
          upload_status: 'uploaded' | 'syncing' | 'synced' | 'failed';
          thumbnail_path: string | null;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          facility_id?: string | null;
          filename: string;
          original_filename: string;
          file_hash?: string | null;
          file_path: string;
          google_file_id?: string | null;
          file_size: number;
          mime_type: string;
          upload_status?: 'uploaded' | 'syncing' | 'synced' | 'failed';
          thumbnail_path?: string | null;
          created_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          facility_id?: string | null;
          filename?: string;
          original_filename?: string;
          file_hash?: string | null;
          file_path?: string;
          google_file_id?: string | null;
          file_size?: number;
          mime_type?: string;
          upload_status?: 'uploaded' | 'syncing' | 'synced' | 'failed';
          thumbnail_path?: string | null;
          created_at?: string;
          synced_at?: string | null;
        };
      };
      sync_queue: {
        Row: {
          id: string;
          operation_type: 'upload_to_drive' | 'update_sheet' | 'delete_file';
          payload: any;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          retry_count: number;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          operation_type: 'upload_to_drive' | 'update_sheet' | 'delete_file';
          payload: any;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          operation_type?: 'upload_to_drive' | 'update_sheet' | 'delete_file';
          payload?: any;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
      };
    };
  };
}

// 타입이 지정된 클라이언트
export const typedSupabase = supabase as any;
export const typedSupabaseAdmin = supabaseAdmin as any;

// 서버에서만 로그 출력
if (typeof window === 'undefined') {
  console.log('✅ [SUPABASE] 서버 클라이언트 초기화 완료:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}