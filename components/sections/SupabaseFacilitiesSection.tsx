'use client';

import { useState, useEffect } from 'react';
import { Building2, Factory, Shield, AlertCircle, RefreshCw, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { FacilitiesData, Facility } from '@/types';
import FacilityEditModal from '@/components/modals/FacilityEditModal';

interface SupabaseFacilitiesSectionProps {
  businessName: string;
  onDataUpdate?: (facilities: FacilitiesData) => void;
}

export default function SupabaseFacilitiesSection({ 
  businessName, 
  onDataUpdate 
}: SupabaseFacilitiesSectionProps) {
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 시설 정보 로드
  const loadFacilities = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `/api/facilities-supabase/${encodeURIComponent(businessName)}${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success && result.data) {
        const facilitiesData = result.data.facilities;
        setFacilities(facilitiesData);
        setLastUpdated(new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' }));
        
        // 부모 컴포넌트에 데이터 전달
        if (onDataUpdate) {
          onDataUpdate(facilitiesData);
        }
      } else {
        setError(result.message || '시설 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Supabase 시설 정보 로드 실패:', err);
      setError('시설 정보 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessName) {
      loadFacilities();
    }
  }, [businessName]);

  // 시설 카드 클릭 핸들러
  const handleFacilityClick = (facility: Facility) => {
    setSelectedFacility(facility);
    setIsModalOpen(true);
  };

  // 모달 닫기
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedFacility(null);
  };

  // 시설 정보 저장 후 처리
  const handleFacilitySave = (updatedFacility: Facility) => {
    if (!facilities) return;

    // 업데이트된 시설로 로컬 상태 갱신
    const updatedFacilities: FacilitiesData = {
      discharge: facilities.discharge.map(f =>
        f.id === updatedFacility.id ? updatedFacility : f
      ),
      prevention: facilities.prevention.map(f =>
        f.id === updatedFacility.id ? updatedFacility : f
      )
    };

    setFacilities(updatedFacilities);

    // 부모 컴포넌트에 업데이트 전달
    if (onDataUpdate) {
      onDataUpdate(updatedFacilities);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <Building2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">시설 정보</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">시설 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-red-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">시설 정보</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadFacilities(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const dischargeCount = facilities?.discharge?.reduce((total, facility) => total + facility.quantity, 0) || 0;
  const preventionCount = facilities?.prevention?.reduce((total, facility) => total + facility.quantity, 0) || 0;
  const totalFacilities = dischargeCount + preventionCount;

  // 배출구별 시설 분류
  const facilitiesByOutlet = () => {
    if (!facilities) return {};
    
    const grouped: { [outlet: number]: { discharge: Facility[], prevention: Facility[] } } = {};
    
    facilities.discharge.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].discharge.push(facility);
    });
    
    facilities.prevention.forEach(facility => {
      if (!grouped[facility.outlet]) {
        grouped[facility.outlet] = { discharge: [], prevention: [] };
      }
      grouped[facility.outlet].prevention.push(facility);
    });
    
    return grouped;
  };

  const outletFacilities = facilitiesByOutlet();
  const outlets = Object.keys(outletFacilities).map(Number).sort((a, b) => a - b);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border-2 border-gray-200/80 hover:shadow-2xl hover:border-gray-300/80 transition-all duration-300">
      <div
        className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-green-50 transition-colors"
      >
        <div
          className="flex items-center gap-3 flex-1"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <Building2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">시설 정보</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadFacilities(true);
            }}
            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-gray-200 shadow-sm"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="cursor-pointer p-1"
          >
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="px-6 pb-6">
          {/* 요약 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Factory className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-medium text-gray-600">배출시설</h3>
              </div>
              <p className="text-2xl font-bold text-orange-600">{dischargeCount}</p>
              <p className="text-xs text-gray-500">개</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-medium text-gray-600">방지시설</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{preventionCount}</p>
              <p className="text-xs text-gray-500">개</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-green-500" />
                <h3 className="text-sm font-medium text-gray-600">배출구</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">{outlets.length}</p>
              <p className="text-xs text-gray-500">개</p>
            </div>
          </div>

          {/* 시설 정보가 없는 경우 */}
          {totalFacilities === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
              <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">등록된 시설 정보가 없습니다.</p>
              <p className="text-sm text-gray-500">Supabase에 시설 데이터를 추가해주세요.</p>
            </div>
          ) : (
            /* 배출구별 시설 목록 */
            <div className="space-y-6">
              {outlets.map(outlet => {
                const outletData = outletFacilities[outlet];
                const outletDischarge = outletData.discharge || [];
                const outletPrevention = outletData.prevention || [];
                
                return (
                  <div key={outlet} className="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                        배출구 {outlet}
                      </span>
                      <span className="text-sm text-gray-500">
                        (배출시설 {outletDischarge.length}개, 방지시설 {outletPrevention.length}개)
                      </span>
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* 배출시설 */}
                      {outletDischarge.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
                            <Factory className="w-4 h-4" />
                            배출시설
                          </h4>
                          <div className="space-y-2">
                            {outletDischarge.map((facility, index) => (
                              <div
                                key={index}
                                onClick={() => handleFacilityClick(facility)}
                                className="bg-orange-50 border border-orange-200 rounded-lg p-3 cursor-pointer hover:bg-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-800">{facility.name}</p>
                                    <p className="text-sm text-gray-600">용량: {facility.capacity}</p>
                                    <p className="text-sm text-gray-600">수량: {facility.quantity}개</p>
                                  </div>
                                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                                    #{facility.number}
                                  </span>
                                </div>
                                {facility.notes && (
                                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                    메모: {facility.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 방지시설 */}
                      {outletPrevention.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            방지시설
                          </h4>
                          <div className="space-y-2">
                            {outletPrevention.map((facility, index) => (
                              <div
                                key={index}
                                onClick={() => handleFacilityClick(facility)}
                                className="bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-800">{facility.name}</p>
                                    <p className="text-sm text-gray-600">용량: {facility.capacity}</p>
                                    <p className="text-sm text-gray-600">수량: {facility.quantity}개</p>
                                  </div>
                                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                                    #{facility.number}
                                  </span>
                                </div>
                                {facility.notes && (
                                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                    메모: {facility.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 데이터 출처 표시 */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            <span className="bg-gray-100 px-2 py-1 rounded-full">
              📋 대기필증 관리 시스템에서 로드됨
            </span>
          </div>
        </div>
      )}

      {/* 시설 편집 모달 */}
      {selectedFacility && (
        <FacilityEditModal
          facility={selectedFacility}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleFacilitySave}
        />
      )}
    </div>
  );
}