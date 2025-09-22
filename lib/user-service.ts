import { supabase } from '@/lib/supabase';

export interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  role: number;
  department?: string;
  position?: string;
  phone?: string;
  provider?: string;
  provider_id?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export class UserService {
  static async findByEmail(email: string): Promise<DatabaseUser | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        console.error('User lookup error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('UserService.findByEmail error:', error);
      return null;
    }
  }

  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('UserService.updateLastLogin error:', error);
    }
  }

  static async createOrUpdateSocialUser(
    email: string,
    name: string,
    provider: string,
    providerId: string,
    avatarUrl?: string
  ): Promise<DatabaseUser | null> {
    try {

      // 기존 사용자 확인
      let existingUser = await this.findByEmail(email);

      if (existingUser) {
        // 기존 사용자 소셜 정보 업데이트
        const { data, error } = await supabase
          .from('users')
          .update({
            provider,
            provider_id: providerId,
            avatar_url: avatarUrl,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (error) {
          console.error('User update error:', error);
          return null;
        }

        return data;
      } else {
        // 새 사용자 생성 (일반 사용자 권한으로)
        const { data, error } = await supabase
          .from('users')
          .insert({
            email,
            name,
            role: 1, // 기본 권한: 일반 사용자
            provider,
            provider_id: providerId,
            avatar_url: avatarUrl,
            is_active: false, // 관리자 승인 필요
            last_login_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('User creation error:', error);
          return null;
        }

        return data;
      }
    } catch (error) {
      console.error('UserService.createOrUpdateSocialUser error:', error);
      return null;
    }
  }

  static async getAllUsers(): Promise<DatabaseUser[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get all users error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('UserService.getAllUsers error:', error);
      return [];
    }
  }

  static async updateUserRole(userId: string, newRole: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Update user role error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('UserService.updateUserRole error:', error);
      return false;
    }
  }

  static async activateUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Activate user error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('UserService.activateUser error:', error);
      return false;
    }
  }

  static async deactivateUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Deactivate user error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('UserService.deactivateUser error:', error);
      return false;
    }
  }
}