'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/ui/AdminLayout';
import FilterPanel from '@/components/FilterPanel';
import BusinessCard, { BusinessInfo } from '@/components/BusinessCard';
import Pagination from '@/components/Pagination';

export default memo(function FacilityPage() {
  const [businessList, setBusinessList] = useState<BusinessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectorName, setInspectorName] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [photoStatus, setPhotoStatus] = useState<'all' | 'with_photos' | 'without_photos'>('all');
  const [phases, setPhases] = useState({
    presurvey: true,
    postinstall: true,
    aftersales: true
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // 페이지당 10개 표시

  // 실사자명 옵션 추출
  const inspectorOptions = useMemo(() => {
    const names = new Set<string>();
    businessList.forEach(business => {
      if (business.presurvey_inspector_name) names.add(business.presurvey_inspector_name);
      if (business.postinstall_installer_name) names.add(business.postinstall_installer_name);
      if (business.aftersales_technician_name) names.add(business.aftersales_technician_name);
    });
    return Array.from(names).sort();
  }, [businessList]);

  // 필터링 로직
  const filteredList = useMemo(() => {
    return businessList.filter(business => {
      // 1. 사업장명, 주소, 실사자명 통합 검색
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();

        // 사업장명 검색
        const matchesBusinessName = business.business_name.toLowerCase().includes(searchLower);

        // 주소 검색
        const matchesAddress = business.address?.toLowerCase().includes(searchLower) || false;

        // 실사자명 검색 (설치 전 실사자, 설치자, AS 담당자)
        const matchesInspector =
          business.presurvey_inspector_name?.toLowerCase().includes(searchLower) ||
          business.postinstall_installer_name?.toLowerCase().includes(searchLower) ||
          business.aftersales_technician_name?.toLowerCase().includes(searchLower) ||
          false;

        // 하나라도 매칭되면 표시
        if (!matchesBusinessName && !matchesAddress && !matchesInspector) {
          return false;
        }
      }

      // 2. 실사자명 필터
      if (inspectorName && inspectorName !== 'all') {
        const hasInspector =
          business.presurvey_inspector_name === inspectorName ||
          business.postinstall_installer_name === inspectorName ||
          business.aftersales_technician_name === inspectorName;
        if (!hasInspector) return false;
      }

      // 3. 날짜 범위 필터
      if (dateFrom || dateTo) {
        const dates = [
          business.presurvey_inspector_date,
          business.postinstall_installer_date,
          business.aftersales_technician_date
        ].filter(Boolean);

        if (dates.length === 0) return false;

        const inRange = dates.some(date => {
          if (!date) return false;
          if (dateFrom && date < dateFrom) return false;
          if (dateTo && date > dateTo) return false;
          return true;
        });

        if (!inRange) return false;
      }

      // 4. 사진 등록 여부 필터
      if (photoStatus === 'with_photos') {
        if (!business.has_photos) return false;
      } else if (photoStatus === 'without_photos') {
        if (business.has_photos) return false;
      }

      // 5. Phase 필터 (진행 단계)
      const allPhasesSelected = phases.presurvey && phases.postinstall && phases.aftersales;
      if (!allPhasesSelected && business.phases) {
        // 하나라도 선택되어 있으면 해당 phase 진행된 사업장만 표시
        const hasSelectedPhase =
          (phases.presurvey && business.phases.presurvey) ||
          (phases.postinstall && business.phases.postinstall) ||
          (phases.aftersales && business.phases.aftersales);

        if (!hasSelectedPhase) return false;
      }

      return true;
    });
  }, [businessList, searchTerm, inspectorName, dateFrom, dateTo, photoStatus, phases]);

  // 페이지네이션 적용된 리스트
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredList.slice(startIndex, endIndex);
  }, [filteredList, currentPage, itemsPerPage]);

  // Phase 변경 핸들러
  const handlePhaseChange = useCallback((phase: 'presurvey' | 'postinstall' | 'aftersales', checked: boolean) => {
    setPhases(prev => ({
      ...prev,
      [phase]: checked
    }));
  }, []);

  // 필터 초기화
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setInspectorName('all');
    setDateFrom('');
    setDateTo('');
    setPhotoStatus('all');
    setPhases({
      presurvey: true,
      postinstall: true,
      aftersales: true
    });
  }, []);

  // 사업장 목록 로드
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
          'Cache-Control': 'max-age=300'
        }
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
        const businesses = data.data.businesses;
        setBusinessList(businesses);
      } else {
        throw new Error(data.message || '올바르지 않은 응답 형식');
      }
    } catch (err) {
      console.error('🔴 [FRONTEND] 사업장 목록 로드 실패:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(`데이터 로드 실패: ${errorMessage}`);
      setBusinessList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessList();
  }, [loadBusinessList]);

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, inspectorName, dateFrom, dateTo, photoStatus, phases]);

  // 사업장 선택 핸들러
  const goToBusiness = useCallback((businessName: string) => {
    router.push(`/business/${encodeURIComponent(businessName)}`);
  }, [router]);

  if (loading) {
    return (
      <AdminLayout
        title="실사관리"
        description="사업장 시설 실사 및 파일 관리"
        actions={
          <button
            onClick={loadBusinessList}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 새로고침
          </button>
        }
      >
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center text-gray-800">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold">사업장 목록을 불러오는 중...</p>
            <p className="text-sm text-gray-600 mt-2">데이터베이스에서 시설 정보를 가져오고 있습니다</p>
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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          🔄 새로고침
        </button>
      }
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 필터 패널 */}
        <FilterPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          inspectorName={inspectorName}
          onInspectorChange={setInspectorName}
          inspectorOptions={inspectorOptions}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          photoStatus={photoStatus}
          onPhotoStatusChange={setPhotoStatus}
          phases={phases}
          onPhaseChange={handlePhaseChange}
          filteredCount={filteredList.length}
          totalCount={businessList.length}
          isExpanded={isFilterExpanded}
          onToggleExpanded={() => setIsFilterExpanded(!isFilterExpanded)}
          onReset={handleResetFilters}
        />

        {/* 사업장 리스트 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {filteredList.length > 0 ? (
            <>
              {/* 사업장 카드 리스트 */}
              <div className="divide-y divide-gray-100">
                {paginatedList.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    onClick={goToBusiness}
                  />
                ))}
              </div>

              {/* 페이지네이션 */}
              <Pagination
                currentPage={currentPage}
                totalItems={filteredList.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
            <div className="text-center py-16">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">🔍</span>
              </div>
              <p className="text-gray-500 text-base font-medium">검색 결과가 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">다른 검색어나 필터를 시도해보세요</p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                필터 초기화
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
});
