'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    position: ''
  });

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    personalInfo: false,
    marketing: false
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAgreementChange = (key: keyof typeof agreements) => {
    setAgreements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAllAgreementChange = () => {
    const allChecked = Object.values(agreements).every(v => v);
    const newValue = !allChecked;
    setAgreements({
      terms: newValue,
      privacy: newValue,
      personalInfo: newValue,
      marketing: newValue
    });
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) newErrors.push('이름을 입력해주세요.');
    if (!formData.email.trim()) newErrors.push('이메일을 입력해주세요.');
    if (!formData.password) newErrors.push('비밀번호를 입력해주세요.');
    if (formData.password !== formData.confirmPassword) newErrors.push('비밀번호가 일치하지 않습니다.');
    // 부서와 직책은 이제 선택사항 (검증 제거)

    if (!agreements.terms) newErrors.push('서비스 이용약관에 동의해주세요.');
    if (!agreements.privacy) newErrors.push('개인정보 처리방침에 동의해주세요.');
    if (!agreements.personalInfo) newErrors.push('개인정보 수집 및 이용에 동의해주세요.');

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          agreements
        }),
      });

      if (response.ok) {
        alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
        router.push('/login');
      } else {
        const error = await response.json();
        setErrors([error.message || '회원가입 중 오류가 발생했습니다.']);
      }
    } catch (error) {
      setErrors(['네트워크 오류가 발생했습니다.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h.01M7 11h.01M7 15h.01M11 7h.01M11 11h.01M11 15h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">시설관리 시스템</h1>
          <p className="text-sm text-gray-600 mt-2">주식회사 블루온</p>
          <p className="text-xs text-gray-500 mt-1">새 계정을 생성하세요</p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">회원가입</h2>
            <p className="text-sm text-gray-600">이메일과 비밀번호로 새 계정을 만드세요</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* 기본 정보 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이름을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이메일을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="비밀번호를 입력하세요 (6자 이상)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                부서 <span className="text-gray-500">(선택사항)</span>
              </label>
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="부서를 입력하세요 (선택사항)"
              />
            </div>

            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                직책 <span className="text-gray-500">(선택사항)</span>
              </label>
              <input
                id="position"
                name="position"
                type="text"
                value={formData.position}
                onChange={handleInputChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="직책을 입력하세요 (선택사항)"
              />
            </div>

          {/* 약관 동의 */}
          <div className="mt-6">
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">약관 동의</h3>

              <div className="space-y-3">
                {/* 전체 동의 */}
                <div className="flex items-center">
                  <input
                    id="all-agreements"
                    type="checkbox"
                    checked={Object.values(agreements).every(v => v)}
                    onChange={handleAllAgreementChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="all-agreements" className="ml-2 block text-sm font-medium text-gray-900">
                    전체 동의
                  </label>
                </div>

                <hr className="border-gray-200" />

                {/* 필수 동의사항 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={agreements.terms}
                      onChange={() => handleAgreementChange('terms')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                      <span className="text-red-500">[필수]</span> 서비스 이용약관 동의
                    </label>
                  </div>
                  <Link href="/terms" target="_blank" className="text-sm text-blue-600 hover:text-blue-500">
                    보기
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="privacy"
                      type="checkbox"
                      checked={agreements.privacy}
                      onChange={() => handleAgreementChange('privacy')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="privacy" className="ml-2 block text-sm text-gray-900">
                      <span className="text-red-500">[필수]</span> 개인정보 처리방침 동의
                    </label>
                  </div>
                  <Link href="/privacy" target="_blank" className="text-sm text-blue-600 hover:text-blue-500">
                    보기
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="personal-info"
                      type="checkbox"
                      checked={agreements.personalInfo}
                      onChange={() => handleAgreementChange('personalInfo')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="personal-info" className="ml-2 block text-sm text-gray-900">
                      <span className="text-red-500">[필수]</span> 개인정보 수집 및 이용 동의
                    </label>
                  </div>
                  <Link href="/privacy/collection" target="_blank" className="text-sm text-blue-600 hover:text-blue-500">
                    보기
                  </Link>
                </div>

                {/* 선택 동의사항 */}
                <div className="flex items-center">
                  <input
                    id="marketing"
                    type="checkbox"
                    checked={agreements.marketing}
                    onChange={() => handleAgreementChange('marketing')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="marketing" className="ml-2 block text-sm text-gray-900">
                    <span className="text-gray-500">[선택]</span> 마케팅 정보 수신 동의
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 오류 메시지 */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    다음 항목을 확인해주세요:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>가입 중...</span>
                </>
              ) : (
                <span className="font-medium">회원가입</span>
              )}
            </button>

            <div className="text-center mt-6">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                이미 계정이 있으신가요? 로그인하기
              </Link>
              <p className="text-xs text-gray-500 mt-2">
                회원가입 시 관리자 승인 후 이용 가능합니다.
              </p>
            </div>
          </form>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2025 주식회사 블루온. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}