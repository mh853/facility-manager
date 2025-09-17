'use client';

import Link from 'next/link';
import { Building2, ArrowRight, Users, FileText, BarChart3, Settings } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <Building2 className="w-16 h-16 text-white" />
              </div>
              <div>
                <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  시설관리 시스템
                </h1>
                <p className="text-xl text-gray-600 mt-3">통합 환경시설 관리 솔루션</p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50">
              <p className="text-gray-700 text-xl mb-3">환경시설 관리의 모든 것을 하나의 플랫폼에서</p>
              <p className="text-gray-500">
                💼 사업장 관리 · 📊 실시간 모니터링 · 📋 문서 자동화 · 🔍 데이터 분석
              </p>
            </div>
          </div>

          {/* 주요 기능 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {/* 실사관리 */}
            <Link
              href="/facility"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  실사관리
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                사업장 시설 실사 및 파일 관리를 통합적으로 수행할 수 있습니다.
              </p>
              <div className="flex items-center text-blue-600 group-hover:text-blue-700 font-medium">
                <span>시작하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 관리자 대시보드 */}
            <Link
              href="/admin"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                  관리자 대시보드
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                시스템 전체 현황을 모니터링하고 관리할 수 있는 통합 대시보드입니다.
              </p>
              <div className="flex items-center text-purple-600 group-hover:text-purple-700 font-medium">
                <span>관리하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 사업장 관리 */}
            <Link
              href="/admin/business"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                  사업장 관리
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                등록된 사업장 정보를 조회하고 관리할 수 있습니다.
              </p>
              <div className="flex items-center text-green-600 group-hover:text-green-700 font-medium">
                <span>관리하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 대기필증 관리 */}
            <Link
              href="/admin/air-permit"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-orange-100 rounded-xl group-hover:bg-orange-200 transition-colors">
                  <FileText className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                  대기필증 관리
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                대기배출시설 허가증을 체계적으로 관리할 수 있습니다.
              </p>
              <div className="flex items-center text-orange-600 group-hover:text-orange-700 font-medium">
                <span>관리하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 데이터 이력 */}
            <Link
              href="/admin/data-history"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                  <BarChart3 className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  데이터 이력
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                시스템 데이터 변경 이력을 조회하고 복구할 수 있습니다.
              </p>
              <div className="flex items-center text-indigo-600 group-hover:text-indigo-700 font-medium">
                <span>조회하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 문서 자동화 */}
            <Link
              href="/admin/document-automation"
              className="group bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-teal-100 rounded-xl group-hover:bg-teal-200 transition-colors">
                  <Settings className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                  문서 자동화
                </h3>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                문서 생성 및 자동화 설정을 관리할 수 있습니다.
              </p>
              <div className="flex items-center text-teal-600 group-hover:text-teal-700 font-medium">
                <span>설정하기</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* 시스템 정보 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">시설관리 시스템 v1.0</h2>
            <p className="text-gray-600 mb-6">
              주식회사 블루온 · 친환경 시설 관리 통합 솔루션
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>시스템 정상 운영</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>실시간 데이터 연동</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>보안 연결</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
