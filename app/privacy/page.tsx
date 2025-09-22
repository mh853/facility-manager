'use client';

import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보 처리방침</h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">1. 개인정보의 처리 목적</h2>
              <p className="text-gray-600 leading-relaxed">
                시설 관리 시스템은 다음의 목적을 위하여 개인정보를 처리합니다:
              </p>
              <ul className="mt-3 ml-6 list-disc text-gray-600 space-y-2">
                <li>시설 관리 서비스 제공 및 업무 처리</li>
                <li>회원 가입 및 관리, 본인확인</li>
                <li>서비스 이용에 따른 정산 및 요금결제</li>
                <li>고객센터 운영 및 민원사무 처리</li>
                <li>법령 및 내부방침에 따른 감사업무 수행</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">2. 처리하는 개인정보의 항목</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">필수항목</h3>
                  <ul className="mt-2 ml-6 list-disc text-gray-600 space-y-1">
                    <li>이름, 이메일 주소</li>
                    <li>직책, 부서 정보</li>
                    <li>접속 로그, IP 주소</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700">소셜로그인 연동 시</h3>
                  <ul className="mt-2 ml-6 list-disc text-gray-600 space-y-1">
                    <li>카카오: 닉네임, 이메일, 프로필 이미지(선택)</li>
                    <li>네이버: 이름, 이메일, 프로필 이미지(선택)</li>
                    <li>구글: 이름, 이메일, 프로필 이미지(선택)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">3. 개인정보의 처리 및 보유기간</h2>
              <p className="text-gray-600 leading-relaxed">
                개인정보는 수집 목적 달성 시까지 보유하며, 관련 법령에 따라 일정기간 보관이 필요한 경우 해당 기간동안 보관합니다.
              </p>
              <ul className="mt-3 ml-6 list-disc text-gray-600 space-y-2">
                <li>회원 정보: 회원 탈퇴 시까지</li>
                <li>접속 로그: 3개월</li>
                <li>소셜로그인 연동 정보: 연동 해제 시까지</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 개인정보의 제3자 제공</h2>
              <p className="text-gray-600 leading-relaxed">
                본 시스템은 원칙적으로 개인정보를 제3자에게 제공하지 않습니다.
                다만, 법령의 규정에 의거하거나, 수사목적으로 법령에 정해진 절차와 방법에 따라
                수사기관의 요구가 있는 경우에는 개인정보를 제공할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 개인정보의 파기</h2>
              <p className="text-gray-600 leading-relaxed">
                개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
                지체없이 해당 개인정보를 파기합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 정보주체의 권리·의무 및 행사방법</h2>
              <p className="text-gray-600 leading-relaxed">
                정보주체는 다음과 같은 권리를 행사할 수 있습니다:
              </p>
              <ul className="mt-3 ml-6 list-disc text-gray-600 space-y-2">
                <li>개인정보 처리현황 통지요구</li>
                <li>개인정보 열람요구</li>
                <li>개인정보 정정·삭제요구</li>
                <li>개인정보 처리정지요구</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">7. 개인정보 보호책임자</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600">
                  <strong>개인정보 보호책임자:</strong> 시스템 관리자<br />
                  <strong>연락처:</strong> admin@facility.blueon-iot.com<br />
                  <strong>처리부서:</strong> 시설관리팀
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">8. 개인정보 처리방침 변경</h2>
              <p className="text-gray-600 leading-relaxed">
                이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는
                변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </section>

            <section className="border-t pt-6">
              <p className="text-sm text-gray-500">
                <strong>공고일자:</strong> 2025년 9월 22일<br />
                <strong>시행일자:</strong> 2025년 9월 22일
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}