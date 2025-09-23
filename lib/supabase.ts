// lib/supabase.ts - Supabase 클라이언트 설정
import { createClient } from '@supabase/supabase-js';

// 환경변수 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 클라이언트용 (브라우저) - Realtime 활성화
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false, // 세션 유지 비활성화 (공용 앱)
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // 초당 이벤트 제한
    },
  },
  global: {
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  }
});

// 서버용 (관리자 권한) - 서버에서만 사용
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8'
      }
    }
  }
);

// Missing exports - API routes에서 사용하는 함수들 추가
export { createClient };

export function getSupabaseAdminClient() {
  return supabaseAdmin;
}

// 데이터베이스 타입 정의
export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          employee_id: string;
          name: string;
          email: string;
          password_hash: string | null;
          department: string;
          position: string;
          permission_level: number;
          is_active: boolean;
          signup_method: string;
          terms_agreed_at: string;
          privacy_agreed_at: string;
          personal_info_agreed_at: string;
          marketing_agreed_at: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          name: string;
          email: string;
          password_hash?: string | null;
          department: string;
          position: string;
          permission_level?: number;
          is_active?: boolean;
          signup_method?: string;
          terms_agreed_at?: string;
          privacy_agreed_at?: string;
          personal_info_agreed_at?: string;
          marketing_agreed_at?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          name?: string;
          email?: string;
          password_hash?: string | null;
          department?: string;
          position?: string;
          permission_level?: number;
          is_active?: boolean;
          signup_method?: string;
          terms_agreed_at?: string;
          privacy_agreed_at?: string;
          personal_info_agreed_at?: string;
          marketing_agreed_at?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
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
    hasServiceKey: !!supabaseServiceKey,
    charset: 'UTF-8'
  });
}