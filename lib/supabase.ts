// lib/supabase.ts - Supabase 클라이언트 설정
import { createClient } from '@supabase/supabase-js';

// 환경변수 가져오기 (trim()으로 공백/개행 제거)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

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

// 서버용 (관리자 권한) - Connection Pooling 최적화
let supabaseAdminInstance: any = null;

export const getSupabaseAdmin = () => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Accept-Charset': 'utf-8',
            'x-connection-pooling': 'true', // Connection pooling 활성화
            'Prefer': 'return=representation', // Read-after-write consistency 보장
          }
        }
      }
    );
  }
  return supabaseAdminInstance;
};

// 하위 호환성을 위한 export (기존 코드 지원)
export const supabaseAdmin = getSupabaseAdmin();

// Missing exports - API routes에서 사용하는 함수들 추가
export { createClient };

export function getSupabaseAdminClient() {
  return getSupabaseAdmin();
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

  // ⚠️ forcePrimary=true 사용 시 중요: SERVICE_ROLE_KEY가 있어야 Primary DB 사용 가능
  if (!supabaseServiceKey) {
    console.warn('⚠️ [SUPABASE] SUPABASE_SERVICE_ROLE_KEY 없음 - forcePrimary=true 사용 시에도 Replica DB 사용됨!')
    console.warn('⚠️ [SUPABASE] 대기필증 저장 후 UI 업데이트 딜레이가 발생할 수 있습니다.')
    console.warn('⚠️ [SUPABASE] .env.local에 SUPABASE_SERVICE_ROLE_KEY 설정 필요!')
  } else {
    console.log('✅ [SUPABASE] supabaseAdmin이 Primary DB에 연결됩니다 (read-after-write consistency 보장)')
  }
}