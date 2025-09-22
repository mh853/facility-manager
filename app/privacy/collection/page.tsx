'use client';

import React from 'react';

export default function PersonalInfoCollectionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보 수집 및 이용 동의서</h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">1. 개인정보 수집 목적</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                시설 관리 시스템은 다음과 같은 목적으로 개인정보를 수집합니다:
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-2 text-gray-700">
                  <li><strong>✓ 회원 가입 및 관리:</strong> 본인확인, 회원자격 유지·관리, 서비스 부정이용 방지</li>
                  <li><strong>✓ 서비스 제공:</strong> 시설 관리 업무 처리, 보고서 작성 및 관리, 파일 업로드 서비스</li>
                  <li><strong>✓ 고객 지원:</strong> 문의사항 처리, 공지사항 전달, 서비스 개선 안내</li>
                  <li><strong>✓ 법적 의무 이행:</strong> 관련 법령에 따른 의무 이행 및 감사 업무</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">2. 수집하는 개인정보 항목</h2>

              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">📋 필수 수집 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">회원가입 시</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 이름</li>
                        <li>• 이메일 주소</li>
                        <li>• 비밀번호</li>
                        <li>• 부서명</li>
                        <li>• 직책</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">서비스 이용 시</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 접속 IP 주소</li>
                        <li>• 접속 로그</li>
                        <li>• 서비스 이용 기록</li>
                        <li>• 쿠키 정보</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">🔗 소셜 로그인 연동 시 추가 수집 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">카카오</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 카카오 계정 ID</li>
                        <li>• 닉네임</li>
                        <li>• 이메일</li>
                        <li>• 프로필 이미지 (선택)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">네이버</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 네이버 계정 ID</li>
                        <li>• 이름</li>
                        <li>• 이메일</li>
                        <li>• 프로필 이미지 (선택)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">구글</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 구글 계정 ID</li>
                        <li>• 이름</li>
                        <li>• 이메일</li>
                        <li>• 프로필 이미지 (선택)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3">📊 선택 수집 정보</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 마케팅 수신 동의 정보</li>
                    <li>• 서비스 개선을 위한 설문조사 응답</li>
                    <li>• 이벤트 참여 정보</li>
                  </ul>
                  <p className="text-xs text-green-600 mt-2">
                    ※ 선택 정보는 동의하지 않아도 서비스 이용이 가능합니다.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">3. 개인정보 수집 방법</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <ul className="space-y-2 text-gray-700">
                  <li><strong>• 직접 수집:</strong> 회원가입, 서비스 이용, 문의 접수 시</li>
                  <li><strong>• 자동 수집:</strong> 웹사이트 방문, 쿠키를 통한 수집</li>
                  <li><strong>• 소셜 연동:</strong> 카카오, 네이버, 구글 로그인 시</li>
                  <li><strong>• 서비스 이용:</strong> 시설 관리 업무 수행 시</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 개인정보 보유 및 이용 기간</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        수집 목적
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        보유 기간
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근거
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        회원 관리
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        회원 탈퇴 시까지
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        서비스 이용약관
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        접속 로그
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        3개월
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        통신비밀보호법
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        소셜 연동 정보
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        연동 해제 시까지
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        이용자 동의
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        마케팅 정보
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        동의 철회 시까지
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        이용자 동의
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 동의를 거부할 권리 및 불이익</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 mb-2">
                  <strong>✓ 동의 거부 권리:</strong> 귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다.
                </p>
                <p className="text-yellow-800">
                  <strong>✓ 동의 거부 시 불이익:</strong> 필수 항목에 대한 동의를 거부할 경우 회원가입 및 서비스 이용이 제한될 수 있습니다.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 개인정보 보호책임자</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">개인정보 보호책임자</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li><strong>성명:</strong> 시스템 관리자</li>
                      <li><strong>부서:</strong> 시설관리팀</li>
                      <li><strong>연락처:</strong> admin@facility.blueon-iot.com</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">개인정보 보호 담당부서</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li><strong>부서명:</strong> 시설관리팀</li>
                      <li><strong>담당자:</strong> 시스템 관리자</li>
                      <li><strong>연락처:</strong> admin@facility.blueon-iot.com</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t pt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">개인정보 수집 및 이용 동의</h3>
                <p className="text-sm text-blue-700">
                  위의 개인정보 수집 및 이용에 관한 내용을 읽고 이해했으며,
                  개인정보 수집 및 이용에 동의합니다.
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                <strong>고지일자:</strong> 2025년 9월 22일<br />
                <strong>시행일자:</strong> 2025년 9월 22일
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}