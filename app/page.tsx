'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2 } from 'lucide-react';

export default memo(function HomePage() {
  const [businessList, setBusinessList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 메모이제이션된 필터링
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return businessList;
    const searchLower = searchTerm.toLowerCase();
    return businessList.filter(business =>
      business.toLowerCase().includes(searchLower)
    );
  }, [searchTerm, businessList]);

  // 사업장 목록 로드 최적화
  const loadBusinessList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      console.log('🔍 [FRONTEND] business-list API 호출 시작');
      const response = await fetch('/api/business-list', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=300' // 5분 캐시
        }
      });
      
      console.log('🔍 [FRONTEND] API 응답:', { 
        status: response.status, 
        ok: response.ok,
        url: response.url 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 데이터 로드 실패`);
      }
      
      const data = await response.json();
      console.log('🔍 [FRONTEND] API 데이터:', { 
        success: data.success, 
        hasData: !!data.data,
        businesses: data.data?.businesses?.length || 0 
      });
      
      if (data.success && data.data && Array.isArray(data.data.businesses)) {
        // business-list API 응답 구조에 맞춤
        const businesses = data.data.businesses;
        
        if (businesses.length > 0) {
          setBusinessList(businesses);
        } else {
          throw new Error('유효한 사업장 데이터가 없습니다');
        }
      } else {
        throw new Error(data.message || '올바르지 않은 응답 형식');
      }
    } catch (err) {
      console.error('🔴 [FRONTEND] 사업장 목록 로드 실패:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(`데이터 로드 실패: ${errorMessage}`);
      
      // 디버깅 정보 표시
      setBusinessList([
        '❌ 데이터 로드 실패',
        `⚠️ 오류: ${errorMessage}`,
        '🔄 다시 시도하려면 새로고침하세요'
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessList();
  }, [loadBusinessList]);

  // 사업장 선택 핸들러 최적화
  const goToBusiness = useCallback((businessName: string) => {
    // 오류 메시지인 경우 페이지 이동 방지
    if (businessName.includes('❌') || businessName.includes('⚠️') || businessName.includes('🔄')) {
      alert('실제 사업장을 선택해주세요. 현재 표시된 항목은 오류 메시지입니다.');
      return;
    }
    
    router.push(`/business/${encodeURIComponent(businessName)}`);
  }, [router]);

  // 검색 입력 핸들러 최적화
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // 에러 여부 체크 최적화
  const isErrorMessage = useCallback((business: string) => {
    return business.includes('❌') || business.includes('⚠️') || business.includes('🔄');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-800">
          <div className="w-16 h-16 border-4 border-gray-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">사업장 목록을 불러오는 중...</p>
          <p className="text-sm text-gray-600 mt-2">데이터베이스에서 시설 정보를 가져오고 있습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <Building2 className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  시설관리 시스템
                </h1>
                <p className="text-lg text-gray-600 mt-2">친환경 시설 관리 통합 솔루션</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <p className="text-gray-700 text-lg mb-2">사업장을 선택하여 시설 관리를 시작하세요</p>
              <p className="text-sm text-gray-500">
                ✨ 실시간 데이터 연동 · 📊 시설 현황 관리 · 📷 사진 업로드
              </p>
            </div>
          </div>

          {/* 메인 카드 */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* 통계 */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <p className="text-center text-gray-600">
                등록된 사업장: <strong className="text-blue-600">{businessList.length}개</strong>
                {businessList.length > 0 && !businessList[0].includes('❌') && !businessList[0].includes('⚠️') && (
                  <span className="ml-2 text-green-600">✅ 실시간 데이터</span>
                )}
              </p>
            </div>

            {/* 검색 */}
            <div className="p-6 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  lang="ko"
                  inputMode="text"
                  placeholder="사업장 검색..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-lg"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* 사업장 리스트 */}
            <div className="max-h-96 overflow-y-auto">
              {filteredList.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredList.map((business, index) => (
                    <button
                      key={index}
                      onClick={() => goToBusiness(business)}
                      className={`w-full px-6 py-4 text-left transition-colors group flex items-center gap-3 ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'hover:bg-red-50 cursor-help'
                          : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                    >
                      <Building2 className={`w-5 h-5 ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-400 group-hover:text-red-600'
                          : 'text-gray-400 group-hover:text-blue-600'
                      }`} />
                      <span className={`text-lg font-medium ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-600'
                          : 'text-gray-900 group-hover:text-blue-600'
                      }`}>
                        {business}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="bg-gray-50 px-6 py-4 text-center border-t">
              <div className="space-x-4">
                <button 
                  onClick={loadBusinessList}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  🔄 데이터 새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
