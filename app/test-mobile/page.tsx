'use client'

import { Plus } from 'lucide-react'
import AdminLayout from '@/components/ui/AdminLayout'

export default function TestMobilePage() {
  return (
    <AdminLayout
      title="모바일 버튼 테스트"
      description="모바일에서 버튼이 보이는지 테스트하는 페이지"
      actions={
        <div className="flex items-center gap-2">
          {/* 테스트 버튼 1 - 사업장 스타일 */}
          <button
            onClick={() => alert('사업장 추가 버튼 클릭됨!')}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm md:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">추가</span>
            <span className="hidden sm:inline">새 사업장 추가</span>
          </button>

          {/* 테스트 버튼 2 - 업무 스타일 */}
          <button
            onClick={() => alert('업무 추가 버튼 클릭됨!')}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">추가</span>
            <span className="hidden sm:inline">새 업무</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📱 모바일 버튼 테스트</h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">화면 크기별 버튼 표시</h3>
              <ul className="mt-2 text-sm text-gray-600 space-y-1">
                <li><strong>&lt; 640px (모바일):</strong> "추가" 버튼만 표시</li>
                <li><strong>≥ 640px (태블릿):</strong> 전체 텍스트 표시</li>
                <li><strong>≥ 768px (데스크탑):</strong> 모든 버튼과 기능 표시</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-gray-900">테스트 방법</h3>
              <ol className="mt-2 text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>개발자 도구 열기 (F12)</li>
                <li>모바일 뷰 토글 (Ctrl+Shift+M)</li>
                <li>화면 크기를 320px, 640px, 768px로 변경</li>
                <li>상단 버튼들이 올바르게 표시되는지 확인</li>
                <li>버튼 클릭 시 알림창이 나타나는지 확인</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-900">📱 320px</h4>
                <p className="text-sm text-gray-600 mt-1">매우 작은 모바일</p>
                <p className="text-xs text-blue-600 mt-2">"추가" 버튼만</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-900">📲 640px</h4>
                <p className="text-sm text-gray-600 mt-1">큰 모바일/작은 태블릿</p>
                <p className="text-xs text-blue-600 mt-2">전체 텍스트</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-900">💻 768px+</h4>
                <p className="text-sm text-gray-600 mt-1">태블릿/데스크탑</p>
                <p className="text-xs text-blue-600 mt-2">모든 기능</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 flex items-center">
            ⚠️ 중요 사항
          </h3>
          <p className="text-sm text-yellow-700 mt-2">
            만약 이 페이지에서도 버튼이 보이지 않는다면, 브라우저 캐시를 클리어하거나
            개발자 도구에서 "Disable cache"를 체크한 후 새로고침해주세요.
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}