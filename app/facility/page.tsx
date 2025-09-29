'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2 } from 'lucide-react';
import AdminLayout from '@/components/ui/AdminLayout';

export default memo(function FacilityPage() {
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
      <AdminLayout
        title="실사관리"
        description="사업장 시설 실사 및 파일 관리"
        actions={
          <button
            onClick={loadBusinessList}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] sm:text-xs md:text-sm"
          >
            🔄 <span className="hidden sm:inline">새로고침</span><span className="sm:hidden">새로고침</span>
          </button>
        }
      >
        <div className="flex items-center justify-center min-h-60 sm:min-h-80 md:min-h-96">
          <div className="text-center text-gray-800">
            <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 border-2 sm:border-3 md:border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2 sm:mb-3 md:mb-4" />
            <p className="text-sm sm:text-lg md:text-xl font-semibold">사업장 목록을 불러오는 중...</p>
            <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 mt-1 sm:mt-2">데이터베이스에서 시설 정보를 가져오고 있습니다</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="실사관리"
      description="사업장 시설 실사 및 파일 관리"
      actions={
        <button
          onClick={loadBusinessList}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] sm:text-xs md:text-sm"
        >
          🔄 <span className="hidden sm:inline">새로고침</span><span className="sm:hidden">새로고침</span>
        </button>
      }
    >
      <div className="max-w-4xl mx-auto">
        {/* 안내 메시지 */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl sm:rounded-2xl shadow-sm border border-blue-200 p-3 sm:p-4 md:p-6 lg:p-8 mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3 md:mb-4">
            <div className="p-2 sm:p-2.5 md:p-3 bg-blue-100 rounded-lg sm:rounded-xl">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900">사업장 선택</h2>
              <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-gray-600">실사를 진행할 사업장을 선택하여 시설 관리를 시작하세요</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 text-[9px] sm:text-[10px] md:text-xs lg:text-sm">
            <div className="flex items-center gap-1 sm:gap-2 text-blue-700">
              <span className="text-sm sm:text-base md:text-lg">📊</span>
              <span>실시간 데이터 연동</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 text-blue-700">
              <span className="text-sm sm:text-base md:text-lg">📷</span>
              <span>시설 사진 업로드</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 text-blue-700">
              <span className="text-sm sm:text-base md:text-lg">🔧</span>
              <span>통합 시설 관리</span>
            </div>
          </div>
        </div>

        {/* 메인 카드 */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* 통계 */}
          <div className="bg-gray-50 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-gray-600">
                등록된 사업장: <strong className="text-blue-600">{businessList.length}개</strong>
              </p>
              {businessList.length > 0 && !businessList[0].includes('❌') && !businessList[0].includes('⚠️') && (
                <span className="flex items-center gap-1 text-green-600 text-[9px] sm:text-[10px] md:text-xs lg:text-sm">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                  실시간 연결됨
                </span>
              )}
            </div>
          </div>

          {/* 검색 */}
          <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                lang="ko"
                inputMode="text"
                placeholder="사업장명 검색..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 sm:focus:ring-4 focus:ring-blue-100 text-[10px] sm:text-xs md:text-sm lg:text-lg transition-all"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm sm:text-base"
                >
                  ✕
                </button>
              )}
            </div>
            {filteredList.length !== businessList.length && (
              <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-gray-500 mt-1 sm:mt-2">
                {filteredList.length}개의 검색 결과 (전체 {businessList.length}개)
              </p>
            )}
          </div>

          {/* 사업장 리스트 */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto">
            {filteredList.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredList.map((business, index) => (
                  <button
                    key={index}
                    onClick={() => goToBusiness(business)}
                    className={`w-full px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-left transition-all group flex items-center gap-2 sm:gap-3 md:gap-4 ${
                      business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                        ? 'hover:bg-red-50 cursor-help'
                        : 'hover:bg-blue-50 cursor-pointer hover:shadow-sm'
                    }`}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                      business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                        ? 'bg-red-100 group-hover:bg-red-200'
                        : 'bg-gray-100 group-hover:bg-blue-100'
                    }`}>
                      <Building2 className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-500'
                          : 'text-gray-500 group-hover:text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] sm:text-xs md:text-sm lg:text-lg font-medium block truncate ${
                        business.includes('❌') || business.includes('⚠️') || business.includes('🔄')
                          ? 'text-red-600'
                          : 'text-gray-900 group-hover:text-blue-600'
                      }`}>
                        {business}
                      </span>
                      {!isErrorMessage(business) && (
                        <span className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-gray-500">시설 실사 관리</span>
                      )}
                    </div>
                    {!isErrorMessage(business) && (
                      <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
                        →
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <div className="p-3 sm:p-4 bg-gray-100 rounded-full w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                  <Search className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm sm:text-base md:text-lg font-medium">검색 결과가 없습니다</p>
                <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm mt-1">다른 검색어를 시도해보세요</p>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="bg-gray-50 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-gray-500">
                마지막 업데이트: {new Date().toLocaleString('ko-KR')}
              </div>
              <button
                onClick={loadBusinessList}
                className="text-blue-600 hover:text-blue-800 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium flex items-center gap-1 transition-colors"
              >
                🔄 데이터 새로고침
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
});