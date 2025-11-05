'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FacilitiesData, BusinessInfo, SystemType, SystemPhase } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ArrowLeft, Factory, Shield, Zap, Router, Camera, FileText, AlertTriangle, Building2, User, Save, ChevronDown, Wifi, WifiOff } from 'lucide-react';

// Import new section components
import BusinessInfoSection from '@/components/sections/BusinessInfoSection';
import SupabaseFacilitiesSection from '@/components/sections/SupabaseFacilitiesSection';
import ImprovedFacilityPhotoSection from '@/components/ImprovedFacilityPhotoSection';
import InspectorInfoSection from '@/components/sections/InspectorInfoSection';
import SpecialNotesSection from '@/components/sections/SpecialNotesSection';
import EnhancedFacilityInfoSection from '@/components/sections/EnhancedFacilityInfoSection';
import BusinessProgressSection from '@/components/sections/BusinessProgressSection';
// Import original components  
import FileUploadSection from '@/components/FileUploadSection';
import { FileProvider } from '@/contexts/FileContext';
import { ToastProvider } from '@/contexts/ToastContext';

// Hydration-safe hook
function useIsHydrated() {
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  return isHydrated;
}

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessName = useMemo(() => decodeURIComponent(params?.businessName as string), [params?.businessName]);
  const [systemType, setSystemType] = useState<SystemType>('presurvey');
  const [currentPhase, setCurrentPhase] = useState<SystemPhase>('presurvey');
  const isHydrated = useIsHydrated();
  
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [facilityNumbering, setFacilityNumbering] = useState<any>(null); // 대기필증 관리 시설번호
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All original state from page-old.tsx
  const [syncData, setSyncData] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState({
    inspector: false,
    notes: false
  });
  const [showSystemTypeDropdown, setShowSystemTypeDropdown] = useState(false);

  // 시설 상세 데이터 상태
  const [facilityDetails, setFacilityDetails] = useState<{[facilityId: string]: {[key: string]: string}}>({});

  // IoT 게이트웨이 정보 상태
  const [gatewayInfo, setGatewayInfo] = useState<{[outlet: number]: {gateway: string, vpn: '유선' | '무선'}}>({});

  // 보조CT 열 표시 여부 상태
  const [showAssistCT, setShowAssistCT] = useState(false);

  // 배출시설 추가 열 표시 여부 상태
  const [showNonPowered, setShowNonPowered] = useState(false);
  const [showIntegratedPower, setShowIntegratedPower] = useState(false);
  const [showContinuousProcess, setShowContinuousProcess] = useState(false);

  // 업데이트 타이머 참조
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inspector info state with proper formatting
  const [inspectorInfo, setInspectorInfo] = useState(() => ({
    name: '',
    contact: '',
    date: ''
  }));

  // Special notes state
  const [specialNotes, setSpecialNotes] = useState('');

  // Set default date after hydration with Korean formatting
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      setInspectorInfo(prev => {
        if (!prev.date) {
          const defaultDate = new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
          
          return { ...prev, date: defaultDate };
        }
        return prev;
      });
    }
  }, [isHydrated]);

  // All facility management functions from original page


  // Gateway info update with auto-save
  const updateGatewayInfo = useCallback((outlet: number, field: 'gateway' | 'vpn', value: string) => {
    const newGatewayInfo = {
      ...gatewayInfo,
      [outlet]: {
        ...gatewayInfo[outlet],
        [field]: value
      }
    };
    setGatewayInfo(newGatewayInfo);
    
    // Local state update only
  }, [gatewayInfo, facilityDetails]);

  // Facility ID generation
  const getFacilityId = (facility: any) => `${facility.outlet}-${facility.number}-${facility.name}`;

  // Update facility details with auto-save
  const updateFacilityDetail = useCallback((facilityId: string, field: string, value: string) => {
    const newDetails = {
      ...facilityDetails,
      [facilityId]: {
        ...facilityDetails[facilityId],
        [field]: value
      }
    };
    setFacilityDetails(newDetails);
    
    // Local state update only
  }, [facilityDetails]);

  // Calculate totals for all facility data
  const calculateTotals = useCallback(() => {
    const totals = {
      ph: 0, pressure: 0, temperature: 0, dischargeCT: 0, assistCT: 0,
      pump: 0, fan: 0, nonPowered: 0, integratedPower: 0, continuousProcess: 0,
      wired: 0, wireless: 0
    };

    if (facilities) {
      facilities.prevention.forEach((facility) => {
        const facilityId = getFacilityId(facility);
        const details = facilityDetails[facilityId] || {};
        
        if (details.ph === 'true') totals.ph++;
        if (details.pressure === 'true') totals.pressure++;
        if (details.temperature === 'true') totals.temperature++;
        if (details.pump === 'true') totals.pump++;
        if (details.fan === 'true') totals.fan++;
      });

      facilities.discharge.forEach((facility) => {
        const facilityId = getFacilityId(facility);
        const details = facilityDetails[facilityId] || {};
        
        if (details.dischargeCT === 'true') totals.dischargeCT++;
        if (details.assistCT === 'true') totals.assistCT++;
        if (details.nonPowered === 'true') totals.nonPowered++;
        if (details.integratedPower === 'true') totals.integratedPower++;
        if (details.continuousProcess === 'true') totals.continuousProcess++;
      });
    }

    // VPN data with duplicate removal by gateway number
    const wiredGateways = new Set<string>();
    const wirelessGateways = new Set<string>();
    
    Object.values(gatewayInfo).forEach(info => {
      if (info.gateway && info.gateway.trim()) {
        if (info.vpn === '유선') {
          wiredGateways.add(info.gateway.trim());
        } else if (info.vpn === '무선') {
          wirelessGateways.add(info.gateway.trim());
        }
      }
    });
    
    totals.wired = wiredGateways.size;
    totals.wireless = wirelessGateways.size;

    return totals;
  }, [facilityDetails, gatewayInfo, facilities]);

  // Phone number formatting
  const formatPhoneNumber = useCallback((value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    
    if (numbers.length >= 3 && numbers.startsWith('010')) {
      if (numbers.length <= 3) {
        return numbers;
      } else if (numbers.length <= 7) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      } else if (numbers.length <= 11) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      } else {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      }
    }
    
    return value;
  }, []);


  // Main data loading function
  const loadData = useCallback(async () => {
    if (!businessName) return;
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('데이터 로드 시작:', businessName);
      
      const [facilitiesRes] = await Promise.allSettled([
        fetch(`/api/facilities-supabase/${encodeURIComponent(businessName)}`, {
          headers: { 'Cache-Control': 'max-age=300' },
          signal: abortController.signal
        })
      ]);

      clearTimeout(timeoutId);

      const processResponse = async (result: PromiseSettledResult<Response>, type: string) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          return await result.value.json();
        }
        console.warn(`${type} API 실패:`, result);
        return null;
      };

      const [facilitiesData] = await Promise.all([
        processResponse(facilitiesRes, '시설')
      ]);

      console.log('🔍 [FRONTEND] 시설 데이터 처리:', { 
        success: facilitiesData?.success,
        hasData: !!facilitiesData?.data,
        facilities: facilitiesData?.data?.facilities,
        discharge: facilitiesData?.data?.facilities?.discharge?.length || 0,
        prevention: facilitiesData?.data?.facilities?.prevention?.length || 0
      });

      if (facilitiesData?.success) {
        setFacilities(facilitiesData.data.facilities);
        setFacilityNumbering(facilitiesData.data.facilityNumbering); // 🎯 대기필증 관리 시설번호 저장
        
        // API에서 받은 실제 사업장 정보 설정
        if (facilitiesData.data.businessInfo) {
          setBusinessInfo({
            ...facilitiesData.data.businessInfo,
            found: true
          });
          console.log('✅ [FRONTEND] 사업장 정보 설정 완료:', facilitiesData.data.businessInfo);
        } else {
          // 기본 사업장 정보 설정 (fallback)
          setBusinessInfo({
            businessName: businessName,
            사업장명: businessName,
            주소: '정보 없음',
            사업장연락처: '정보 없음',
            담당자명: '정보 없음',
            담당자연락처: '정보 없음',
            담당자직급: '정보 없음',
            대표자: '정보 없음',
            사업자등록번호: '정보 없음',
            업종: '정보 없음',
            found: false
          });
        }
      }

      // 대기필증 데이터 로딩 완료

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 네트워크를 확인해주세요.');
      } else {
        setError('데이터 로드 중 오류가 발생했습니다.');
      }
      console.error('데이터 로딩 오류:', err);
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
    }
  }, [businessName]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Reload data when system type changes
  useEffect(() => {
    if (businessName) {
      loadData();
    }
  }, [systemType, businessName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSystemTypeDropdown) {
        const target = event.target as Element;
        if (!target.closest('.system-type-dropdown')) {
          setShowSystemTypeDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSystemTypeDropdown]);

  // Input handlers with formatting
  const handleInspectorInfoChange = useCallback((field: string, value: string) => {
    let processedValue = value;
    
    if (field === 'contact') {
      processedValue = formatPhoneNumber(value);
    }
    
    setInspectorInfo(prev => ({
      ...prev,
      [field]: processedValue
    }));
  }, [formatPhoneNumber]);

  const handleSpecialNotesChange = useCallback((value: string) => {
    setSpecialNotes(value);
  }, []);

  // Save handlers with proper API calls
  const createSaveHandler = useCallback((endpoint: string, data: any, stateKey: 'inspector' | 'notes') => {
    return async () => {
      if (saveStates[stateKey]) return;
      
      try {
        console.log(`저장 시작: ${endpoint}`, data);
        setSaveStates(prev => ({ ...prev, [stateKey]: true }));
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log(`저장 응답: ${endpoint}`, result);

        if (response.ok && result.success) {
          const successMessage = stateKey === 'inspector' ? '실사자 정보가 저장되었습니다.' : '특이사항이 저장되었습니다.';
          
          // 저장 완료
          
          const toast = document.createElement('div');
          toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
          toast.textContent = successMessage;
          document.body.appendChild(toast);
          
          setTimeout(() => {
            toast.remove();
          }, 3000);
        } else {
          throw new Error(result.message || '저장 실패');
        }
      } catch (error) {
        console.error(`저장 오류: ${endpoint}`, error);
        const errorMessage = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
        
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50 animate-fade-in';
        toast.textContent = errorMessage;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 3000);
      } finally {
        setSaveStates(prev => ({ ...prev, [stateKey]: false }));
      }
    };
  }, [saveStates]);

  const saveInspectorInfo = useMemo(() => 
    createSaveHandler('/api/inspector-info', { businessName, inspectorInfo, systemType }, 'inspector'),
    [createSaveHandler, businessName, inspectorInfo, systemType]
  );

  const saveSpecialNotes = useMemo(() =>
    createSaveHandler('/api/special-notes', { businessName, specialNotes, systemType }, 'notes'),
    [createSaveHandler, businessName, specialNotes, systemType]
  );

  // Update handlers for new section components
  const handleInspectorUpdate = useCallback((info: typeof inspectorInfo) => {
    setInspectorInfo(info);
  }, []);

  const handleNotesUpdate = useCallback((notes: string) => {
    setSpecialNotes(notes);
  }, []);

  // Memoized facility stats
  const facilityStats = useMemo(() => {
    if (!facilities) return { hasDischarge: false, hasPrevention: false, hasFacilities: false };
    
    const hasDischarge = facilities.discharge.length > 0;
    const hasPrevention = facilities.prevention.length > 0;
    const hasFacilities = hasDischarge || hasPrevention;
    
    return { hasDischarge, hasPrevention, hasFacilities };
  }, [facilities]);

  if (loading) {
    return (
      <LoadingSpinner 
        type="business" 
        message={`${businessName} 사업장의 시설 정보를 불러오고 있습니다`}
        size="lg"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">데이터 로드 실패</h1>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!facilities || !businessInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📭</div>
          <h1 className="text-2xl font-bold text-gray-600 mb-2">데이터 없음</h1>
          <p className="text-gray-500 mb-4">사업장 데이터를 찾을 수 없습니다</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <FileProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        {/* Header with system type dropdown */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100/50">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 md:py-4">
            <div className="text-center text-gray-800">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 flex items-center justify-center gap-1 sm:gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                {businessName}
              </h1>
              <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
                <p className="text-gray-600 text-[10px] sm:text-xs md:text-sm lg:text-base font-medium">
                  시설 관리 및 보고서 작성
                </p>
                
                {/* System Phase selection dropdown */}
                <div className="relative system-type-dropdown">
                  <button
                    onClick={() => setShowSystemTypeDropdown(!showSystemTypeDropdown)}
                    className="bg-gray-700 hover:bg-gray-800 text-white px-2 py-1 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    {currentPhase === 'presurvey' && '🔍 설치 전 실사'}
                    {currentPhase === 'postinstall' && '📸 설치 후 사진'}
                    {currentPhase === 'aftersales' && '🔧 AS 사진'}
                    <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${showSystemTypeDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showSystemTypeDropdown && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10 min-w-[140px] md:min-w-[160px]">
                      <button
                        onClick={() => {
                          setCurrentPhase('presurvey');
                          setSystemType('presurvey');
                          setShowSystemTypeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 md:px-4 md:py-3 text-left hover:bg-gray-50 transition-colors text-xs md:text-sm ${
                          currentPhase === 'presurvey' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        🔍 설치 전 실사
                      </button>
                      <button
                        onClick={() => {
                          setCurrentPhase('postinstall');
                          setSystemType('completion');
                          setShowSystemTypeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 md:px-4 md:py-3 text-left hover:bg-gray-50 transition-colors text-xs md:text-sm ${
                          currentPhase === 'postinstall' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        📸 설치 후 사진
                      </button>
                      <button
                        onClick={() => {
                          setCurrentPhase('aftersales');
                          setSystemType('completion');
                          setShowSystemTypeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 md:px-4 md:py-3 text-left hover:bg-gray-50 transition-colors text-xs md:text-sm ${
                          currentPhase === 'aftersales' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        🔧 AS 사진
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 md:py-6">
          <div className="max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">

            {/* ========== PRESURVEY MODE SECTIONS ========== */}
            {systemType === 'presurvey' && (
              <>
                {/* 1. 사업장 정보 */}
                {businessInfo && (
                  <BusinessInfoSection businessInfo={businessInfo} />
                )}


                {/* 2-1. Supabase 시설 정보 */}
                <SupabaseFacilitiesSection businessName={businessName} />

                {/* 2-2. 강화된 시설 정보 섹션 (사전조사용) */}
                {facilities && (
                  <EnhancedFacilityInfoSection
                    businessName={businessName}
                    businessId={businessInfo?.id}
                    facilities={facilities}
                    systemType={systemType}
                    onFacilitiesUpdate={setFacilities}
                  />
                )}





                {/* 6. 실사자 정보 */}
                <InspectorInfoSection 
                  inspectorInfo={inspectorInfo}
                  onUpdate={handleInspectorUpdate}
                />

                {/* 7. 특이사항 */}
                <SpecialNotesSection 
                  notes={specialNotes}
                  onUpdate={handleNotesUpdate}
                />
              </>
            )}

            {/* 시설별 사진 업로드 섹션 */}
            {systemType === 'presurvey' && (
              <ImprovedFacilityPhotoSection
                businessName={businessName}
                facilities={facilities}
                facilityNumbering={facilityNumbering}
                currentPhase={currentPhase}
              />
            )}

            {/* ========== COMPLETION MODE SECTIONS ========== */}
            {systemType === 'completion' && (
              <>
                {/* 1. 사업장 정보 - for completion type or always show */}
                {businessInfo && (
                  <BusinessInfoSection businessInfo={businessInfo} />
                )}

                {/* 2. 강화된 시설 정보 섹션 */}
                {facilities && (
                  <EnhancedFacilityInfoSection
                    businessName={businessName}
                    businessId={businessInfo?.id}
                    facilities={facilities}
                    systemType={systemType}
                    onFacilitiesUpdate={setFacilities}
                  />
                )}


                {/* 4. 시설별 사진 업로드 섹션 (completion mode) */}
                <ImprovedFacilityPhotoSection
                  businessName={businessName}
                  facilities={facilities}
                  facilityNumbering={facilityNumbering}
                  currentPhase={currentPhase}
                />



            {/* 6. 실사자 정보 - Inspector Information */}
            {systemType === 'completion' ? (
              <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <div className="flex items-center gap-2 mb-4 md:mb-6">
                  <User className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">
                    {systemType === 'completion' ? '설치자 정보' : '실사자 정보'}
                  </h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {systemType === 'completion' ? '설치자 성명' : '실사자 성명'}
                    </label>
                    <input
                      type="text"
                      lang="ko"
                      inputMode="text"
                      value={inspectorInfo.name}
                      onChange={(e) => handleInspectorInfoChange('name', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={systemType === 'completion' ? '설치자 이름을 입력하세요' : '실사자 이름을 입력하세요'}
                      autoComplete="name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">연락처</label>
                    <input
                      type="tel"
                      value={inspectorInfo.contact}
                      onChange={(e) => handleInspectorInfoChange('contact', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="010-0000-0000"
                      autoComplete="tel"
                      maxLength={13}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {systemType === 'completion' ? '설치 일자' : '실사 일자'}
                    </label>
                    <input
                      type="date"
                      value={inspectorInfo.date}
                      onChange={(e) => handleInspectorInfoChange('date', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
                
                <button
                  onClick={saveInspectorInfo}
                  disabled={saveStates.inspector}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saveStates.inspector ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {systemType === 'completion' ? '설치자 정보 저장' : '실사자 정보 저장'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <InspectorInfoSection 
                inspectorInfo={inspectorInfo}
                onUpdate={handleInspectorUpdate}
              />
            )}

            {/* 7. 시설별 사진 업로드 */}
            <ImprovedFacilityPhotoSection
              businessName={businessName}
              facilities={facilities}
              facilityNumbering={facilityNumbering}
              currentPhase={currentPhase}
            />

                {/* 8. 특이사항 & 업무 진행 현황 - Business Progress Section */}
                <BusinessProgressSection
                  businessName={businessName}
                  specialNotes={specialNotes}
                  onSpecialNotesUpdate={(notes) => {
                    setSpecialNotes(notes);
                    handleSpecialNotesChange(notes);
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Global styles for animations */}
        <style jsx>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out;
          }
        `}</style>
        </div>
      </FileProvider>
    </ToastProvider>
  );
}