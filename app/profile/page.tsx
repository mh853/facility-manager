'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TokenManager } from '@/lib/api-client';
import AdminLayout from '@/components/ui/AdminLayout';
import {
  User,
  Mail,
  Shield,
  Building2,
  Key,
  Save,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  department?: string;
  position?: string;
  permission_level: number;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
  avatar_url?: string;
  social_login_enabled?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // 프로필 편집 폼
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    department: '',
    position: ''
  });

  // 비밀번호 변경 폼
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = TokenManager.getToken();
      const response = await fetch(`/api/admin/employees/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const userProfile = data.data.employee;
          setProfile(userProfile);
          setEditForm({
            name: userProfile.name || '',
            email: userProfile.email || '',
            department: userProfile.department || '',
            position: userProfile.position || ''
          });
        }
      } else {
        setErrorMessage('프로필 정보를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      setErrorMessage('프로필 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    try {
      setSaving(true);
      setErrorMessage('');

      const token = TokenManager.getToken();
      const response = await fetch(`/api/admin/employees/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfile({ ...profile, ...editForm });
          setSuccessMessage('프로필이 성공적으로 업데이트되었습니다.');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } else {
        setErrorMessage('프로필 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      setErrorMessage('프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setErrorMessage('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');

      const token = TokenManager.getToken();
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          setShowPasswordForm(false);
          setSuccessMessage('비밀번호가 성공적으로 변경되었습니다.');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } else {
        const data = await response.json();
        setErrorMessage(data.error?.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionLabel = (level: number) => {
    switch (level) {
      case 3: return { text: '관리자', color: 'bg-red-100 text-red-800 border-red-200' };
      case 2: return { text: '매니저', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 1: return { text: '일반사용자', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      default: return { text: '사용자', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  if (loading) {
    return (
      <AdminLayout title="계정 설정" description="사용자 프로필 및 계정 정보 관리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">프로필 정보를 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout title="계정 설정" description="사용자 프로필 및 계정 정보 관리">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">프로필을 불러올 수 없습니다</h3>
            <p className="text-gray-600 mb-4">계정 정보에 접근할 수 없습니다.</p>
            <button
              onClick={() => router.push('/admin')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              돌아가기
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="계정 설정" description="사용자 프로필 및 계정 정보 관리">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* 성공/오류 메시지 */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{errorMessage}</span>
          </div>
        )}

        {/* 프로필 개요 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-gray-600">{profile.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getPermissionLabel(profile.permission_level).color}`}>
                  {getPermissionLabel(profile.permission_level).text}
                </span>
                {profile.social_login_enabled && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-200">
                    소셜 로그인
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">부서</p>
                <p className="font-medium text-gray-900">{profile.department || '미설정'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">직급</p>
                <p className="font-medium text-gray-900">{profile.position || '미설정'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">최근 로그인</p>
                <p className="font-medium text-gray-900">
                  {profile.last_login_at
                    ? new Date(profile.last_login_at).toLocaleDateString('ko-KR')
                    : '없음'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 프로필 편집 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <User className="w-5 h-5" />
            프로필 정보 수정
          </h3>

          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">부서</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="부서명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">직급</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="직급을 입력하세요"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                프로필 저장
              </button>
            </div>
          </form>
        </div>

        {/* 비밀번호 변경 */}
        {!profile.social_login_enabled && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                <Key className="w-5 h-5" />
                비밀번호 변경
              </h3>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showPasswordForm ? '취소' : '비밀번호 변경'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">현재 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">최소 8자 이상의 비밀번호를 입력하세요.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    비밀번호 변경
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 계정 정보 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <Shield className="w-5 h-5" />
            계정 정보
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">직원 ID</p>
              <p className="font-medium text-gray-900">{profile.employee_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">계정 생성일</p>
              <p className="font-medium text-gray-900">
                {new Date(profile.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">계정 상태</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                profile.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {profile.is_active ? '활성' : '비활성'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">권한 레벨</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPermissionLabel(profile.permission_level).color}`}>
                {getPermissionLabel(profile.permission_level).text}
              </span>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}