// app/test/page.tsx - 시스템 테스트 페이지
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Database, FileText, Users, History } from 'lucide-react'

export default function TestPage() {
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})

  const runTest = async (testName: string, apiUrl: string) => {
    setIsLoading(prev => ({ ...prev, [testName]: true }))
    
    try {
      const response = await fetch(apiUrl)
      const result = await response.json()
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: result.success,
          message: result.message,
          data: result.data,
          error: result.error
        }
      }))
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          message: '테스트 실행 실패',
          error: error.message
        }
      }))
    } finally {
      setIsLoading(prev => ({ ...prev, [testName]: false }))
    }
  }

  const TestCard = ({ 
    title, 
    description, 
    testKey, 
    apiUrl, 
    icon: Icon 
  }: {
    title: string
    description: string
    testKey: string
    apiUrl: string
    icon: any
  }) => {
    const result = testResults[testKey]
    const loading = isLoading[testKey]

    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>
          
          <button
            onClick={() => runTest(testKey, apiUrl)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '테스트 실행'
            )}
          </button>
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.message}
              </span>
            </div>

            {result.error && (
              <div className="text-sm text-red-600 mb-2">
                오류: {result.error}
              </div>
            )}

            {result.data && (
              <div className="text-sm text-gray-700">
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const runAllTests = async () => {
    const tests = [
      { key: 'connection', url: '/api/test-database?action=connection' },
      { key: 'sample-data', url: '/api/test-database?action=sample-data' },
      { key: 'create-test', url: '/api/test-database?action=create-test-business' },
      { key: 'history', url: '/api/test-database?action=history-test' }
    ]

    for (const test of tests) {
      await runTest(test.key, test.url)
      // 각 테스트 사이에 500ms 지연
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">시설관리시스템 테스트</h1>
              <p className="text-gray-600">데이터베이스 연결 및 주요 기능들을 테스트할 수 있습니다</p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={runAllTests}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                전체 테스트 실행
              </button>
              <Link
                href="/admin"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                관리자 페이지로
              </Link>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <h2 className="font-semibold text-blue-800 mb-2">테스트 전 확인사항</h2>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✅ .env.local 파일에 Supabase 환경변수가 설정되어 있나요?</li>
              <li>✅ database/schema.sql이 Supabase에서 실행되었나요?</li>
              <li>✅ npm run dev로 개발 서버가 실행 중인가요?</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TestCard
            title="데이터베이스 연결 테스트"
            description="Supabase 연결 상태와 테이블 생성 여부를 확인합니다"
            testKey="connection"
            apiUrl="/api/test-database?action=connection"
            icon={Database}
          />

          <TestCard
            title="샘플 데이터 조회"
            description="기존 사업장 데이터 조회 기능을 테스트합니다"
            testKey="sample-data"
            apiUrl="/api/test-database?action=sample-data"
            icon={Users}
          />

          <TestCard
            title="테스트 데이터 생성"
            description="새로운 사업장 데이터 생성 기능을 테스트합니다"
            testKey="create-test"
            apiUrl="/api/test-database?action=create-test-business"
            icon={FileText}
          />

          <TestCard
            title="데이터 이력 기능"
            description="데이터 변경 이력 추적 기능을 테스트합니다"
            testKey="history"
            apiUrl="/api/test-database?action=history-test"
            icon={History}
          />
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">테스트 완료 후 다음 단계</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/admin/business"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800 mb-2">사업장 관리</h3>
              <p className="text-sm text-gray-600">사업장 정보 CRUD 테스트</p>
            </Link>
            
            <Link
              href="/admin/air-permit"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800 mb-2">대기필증 관리</h3>
              <p className="text-sm text-gray-600">대기필증 정보 관리 테스트</p>
            </Link>
            
            <Link
              href="/admin/data-history"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800 mb-2">데이터 이력</h3>
              <p className="text-sm text-gray-600">변경 이력 및 복구 테스트</p>
            </Link>
            
            <Link
              href="/admin/document-automation"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800 mb-2">문서 자동화</h3>
              <p className="text-sm text-gray-600">문서 생성 기능 테스트</p>
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>문제가 발생하면 브라우저 개발자 도구(F12)의 Console 탭에서 상세 오류를 확인하세요</p>
        </div>
      </div>
    </div>
  )
}