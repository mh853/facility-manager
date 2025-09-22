'use client';

import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">서비스 이용약관</h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제1조 (목적)</h2>
              <p className="text-gray-600 leading-relaxed">
                이 약관은 시설 관리 시스템(이하 "서비스")의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제2조 (정의)</h2>
              <ul className="space-y-3 text-gray-600">
                <li><strong>1. "서비스"</strong>란 시설 관리, 점검, 보고서 작성 등의 업무를 지원하는 웹 기반 시스템을 말합니다.</li>
                <li><strong>2. "회원"</strong>이란 서비스에 개인정보를 제공하여 회원등록을 한 자로서, 서비스를 지속적으로 이용할 수 있는 자를 말합니다.</li>
                <li><strong>3. "이용자"</strong>란 서비스에 접속하여 이 약관에 따라 서비스를 받는 회원 및 비회원을 말합니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제3조 (약관의 효력 및 변경)</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                1. 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
              </p>
              <p className="text-gray-600 leading-relaxed">
                2. 회사는 합리적인 사유가 발생할 경우에는 이 약관을 변경할 수 있으며,
                약관이 변경되는 경우에는 변경된 약관의 내용과 시행일을 정하여,
                그 시행일로부터 최소 7일 이전에 공지합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제4조 (회원가입)</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                1. 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.
              </p>
              <p className="text-gray-600 leading-relaxed mb-3">
                2. 회사는 다음 각 호에 해당하는 신청에 대하여는 승낙하지 않거나 사후에 이용계약을 해지할 수 있습니다:
              </p>
              <ul className="ml-6 list-disc text-gray-600 space-y-1">
                <li>가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
                <li>허위의 정보를 기재하거나, 회사가 제시하는 내용을 기재하지 않은 경우</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제5조 (서비스의 제공 및 변경)</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                1. 회사는 회원에게 아래와 같은 서비스를 제공합니다:
              </p>
              <ul className="ml-6 list-disc text-gray-600 space-y-1 mb-3">
                <li>시설 관리 및 점검 서비스</li>
                <li>보고서 작성 및 관리 서비스</li>
                <li>파일 업로드 및 저장 서비스</li>
                <li>기타 회사가 추가 개발하거나 다른 회사와의 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                2. 회사는 서비스의 내용 및 제공일자를 변경할 수 있으며, 이 경우 변경된 서비스의 내용 및 제공일자를 명시하여 현재의 서비스를 제공하고 있는 곳에 즉시 공지합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제6조 (서비스의 중단)</h2>
              <p className="text-gray-600 leading-relaxed">
                회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제7조 (회원의 의무)</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                회원은 다음 행위를 하여서는 안 됩니다:
              </p>
              <ul className="ml-6 list-disc text-gray-600 space-y-1">
                <li>신청 또는 변경시 허위 내용의 등록</li>
                <li>타인의 정보 도용</li>
                <li>회사가 게시한 정보의 변경</li>
                <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                <li>회사 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                <li>회사 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제8조 (저작권의 귀속 및 이용제한)</h2>
              <p className="text-gray-600 leading-relaxed">
                1. 회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                2. 이용자는 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">제9조 (분쟁해결)</h2>
              <p className="text-gray-600 leading-relaxed">
                1. 회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                2. 서비스 이용으로 발생한 분쟁에 대해 소송이 제기되는 경우 회사의 본사 소재지를 관할하는 법원을 전속관할 법원으로 합니다.
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