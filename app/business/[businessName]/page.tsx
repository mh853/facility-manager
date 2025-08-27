'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { FacilitiesData, BusinessInfo, SystemType } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AlertTriangle, Building2, User, FileText, Zap, Shield, Camera, Save, ChevronDown, Router, Wifi, WifiOff } from 'lucide-react';

// Regular imports to fix webpack dynamic loading issues
import BusinessInfoCard from '@/components/BusinessInfoCard';
import FacilityStats from '@/components/FacilityStats';
import FileUploadSection from '@/components/FileUploadSection';
import { FileProvider, useFileContext } from '@/contexts/FileContext';

// Hydration-safe hook
function useIsHydrated() {
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  return isHydrated;
}

export default function BusinessPage() {
  const params = useParams();
  const businessName = useMemo(() => decodeURIComponent(params.businessName as string), [params.businessName]);
  const [systemType, setSystemType] = useState<SystemType>('presurvey'); // 기본값을 presurvey로 변경
  const isHydrated = useIsHydrated();
  
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상태 최적화 with 동기화
  const [inspectorInfo, setInspectorInfo] = useState(() => ({
    name: '',
    contact: '',
    date: '' // Initialize empty to prevent hydration mismatch
  }));
  
  // Set default date after hydration
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

  const [specialNotes, setSpecialNotes] = useState('');
  const [syncData, setSyncData] = useState<any>(null); // 구글시트 동기화 데이터
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false); // 동기화 로딩 상태
  const [syncError, setSyncError] = useState<string | null>(null); // 동기화 에러
  const [saveStates, setSaveStates] = useState({
    inspector: false,
    notes: false
  });
  const [showSystemTypeDropdown, setShowSystemTypeDropdown] = useState(false);

  // 시설 상세 데이터 상태 (각 시설별 추가 정보)
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

  // 구글시트에 상세정보 저장
  const saveFacilityDetailsToSheet = useCallback(async (facilityDetails: any, gatewayInfo: any) => {
    try {
      const response = await fetch('/api/facility-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName,
          facilityDetails,
          gatewayInfo
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.error('구글시트 저장 실패:', result.message);
      } else {
        console.log('구글시트에 상세정보 저장 완료');
      }
    } catch (error) {
      console.error('구글시트 저장 오류:', error);
    }
  }, [businessName]);

  // 구글시트에서 상세정보 불러오기
  const loadFacilityDetailsFromSheet = useCallback(async () => {
    try {
      const response = await fetch(`/api/facility-details?businessName=${encodeURIComponent(businessName)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setFacilityDetails(result.data.facilityDetails || {});
        setGatewayInfo(result.data.gatewayInfo || {});
        console.log('구글시트에서 상세정보 불러오기 완료');
      }
    } catch (error) {
      console.error('구글시트 불러오기 오류:', error);
    }
  }, [businessName]);

  // 게이트웨이 정보 업데이트 시 자동 저장
  const updateGatewayInfo = useCallback((outlet: number, field: 'gateway' | 'vpn', value: string) => {
    const newGatewayInfo = {
      ...gatewayInfo,
      [outlet]: {
        ...gatewayInfo[outlet],
        [field]: value
      }
    };
    setGatewayInfo(newGatewayInfo);
    
    // 자동 구글시트 저장 (디바운스 방지)
    const timeoutId = setTimeout(() => {
      saveFacilityDetailsToSheet(facilityDetails, newGatewayInfo);
    }, 1000); // 1초 대기 후 저장
    
    // 이전 타이머 취소
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = timeoutId;
  }, [gatewayInfo, facilityDetails, saveFacilityDetailsToSheet]);

  // 시설별 고유 ID 생성 함수
  const getFacilityId = (facility: any) => `${facility.outlet}-${facility.number}-${facility.name}`;

  // 시설 상세 데이터 업데이트 함수 (구글시트 자동 저장 포함)
  const updateFacilityDetail = useCallback((facilityId: string, field: string, value: string) => {
    const newDetails = {
      ...facilityDetails,
      [facilityId]: {
        ...facilityDetails[facilityId],
        [field]: value
      }
    };
    setFacilityDetails(newDetails);
    
    // 자동 구글시트 저장 (디바운스 방지)
    const timeoutId = setTimeout(() => {
      saveFacilityDetailsToSheet(newDetails, gatewayInfo);
    }, 1000); // 1초 대기 후 저장
    
    // 이전 타이머 취소
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = timeoutId;
  }, [facilityDetails, gatewayInfo]);

  // 데이터 합계 계산 함수
  const calculateTotals = useCallback(() => {
    const totals = {
      ph: 0,
      pressure: 0,
      temperature: 0,
      dischargeCT: 0,
      assistCT: 0,
      pump: 0,
      fan: 0,
      nonPowered: 0,
      integratedPower: 0,
      continuousProcess: 0,
      wired: 0,
      wireless: 0
    };

    // 시설별로 데이터를 구분해서 계산
    if (facilities) {
      // 방지시설 데이터 합계
      facilities.prevention.forEach((facility, index) => {
        const facilityId = getFacilityId(facility);
        const details = facilityDetails[facilityId] || {};
        
        if (details.ph === 'true') totals.ph++;
        if (details.pressure === 'true') totals.pressure++;
        if (details.temperature === 'true') totals.temperature++;
        if (details.pump === 'true') totals.pump++;
        if (details.fan === 'true') totals.fan++;
      });

      // 배출시설 데이터 합계
      facilities.discharge.forEach((facility, index) => {
        const facilityId = getFacilityId(facility);
        const details = facilityDetails[facilityId] || {};
        
        if (details.dischargeCT === 'true') totals.dischargeCT++;
        if (details.assistCT === 'true') totals.assistCT++;
        if (details.nonPowered === 'true') totals.nonPowered++;
        if (details.integratedPower === 'true') totals.integratedPower++;
        if (details.continuousProcess === 'true') totals.continuousProcess++;
      });
    }

    // VPN 데이터 합계 (게이트웨이 번호 기준 중복 제거)
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

  // 구글시트에 데이터 업데이트
  const updateGoogleSheets = useCallback(async (showAlert: boolean = true) => {
    try {
      const totals = calculateTotals();
      
      const response = await fetch('/api/update-facility-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName,
          data: totals,
          gatewayInfo,
          facilityDetails
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (showAlert) {
          alert('구글시트에 데이터가 업데이트되었습니다!');
        }
      } else {
        if (showAlert) {
          alert(`구글시트 업데이트 실패: ${result.message}`);
        }
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('구글시트 업데이트 실패:', error);
      if (showAlert) {
        alert('구글시트 업데이트 중 오류가 발생했습니다.');
      }
      throw error;
    }
  }, [businessName, calculateTotals]);

  // 데이터 저장 및 불러오기 함수
  const saveFacilityData = useCallback(async () => {
    try {
      // 구글시트에 상세정보 저장
      await saveFacilityDetailsToSheet(facilityDetails, gatewayInfo);
      
      // 합계 데이터도 업데이트 (알림 표시 안함)
      await updateGoogleSheets(false);
      
      alert('시설 데이터가 구글시트에 저장되었습니다!');
      console.log('시설 데이터 저장 완료');
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      alert('데이터 저장에 실패했습니다.');
    }
  }, [facilityDetails, gatewayInfo, saveFacilityDetailsToSheet, updateGoogleSheets]);

  const loadFacilityData = useCallback(async () => {
    try {
      await loadFacilityDetailsFromSheet();
      alert('구글시트에서 시설 데이터가 불러와졌습니다.');
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
      alert('데이터 불러오기에 실패했습니다.');
    }
  }, [loadFacilityDetailsFromSheet]);

  // 컴포넌트 마운트 시 데이터 불러오기
  useEffect(() => {
    if (businessName) {
      loadFacilityDetailsFromSheet();
    }
  }, [businessName, loadFacilityDetailsFromSheet]);

  // 구글시트에서 데이터 동기화 (최적화)
  const loadSyncData = useCallback(async (isInitialLoad = false) => {
    if (!businessName) return;
    
    try {
      setSyncLoading(true);
      setSyncError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`/api/sync?businessName=${encodeURIComponent(businessName)}&systemType=${systemType}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=60' // 1분 캐시
        }
      });
      
      clearTimeout(timeoutId);
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('🔄 동기화 데이터 로드 성공:', result.data);
        
        setSyncData(result.data);
        if (typeof window !== 'undefined') {
          setLastSyncTime(new Date().toLocaleTimeString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour12: false
          }));
        }
        
        // 폼에 데이터 미리 채우기 (최초 로드 시에만)
        if (isInitialLoad) {
          setInspectorInfo(prev => ({
            ...prev,
            name: prev.name || result.data.설치담당자 || '',
            contact: prev.contact || result.data.연락처 || '',
            date: prev.date || result.data.설치일 || (typeof window !== 'undefined' ? new Date().toLocaleDateString('ko-KR', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1) : '')
          }));
          
          setSpecialNotes(prev => prev || result.data.특이사항 || '');
        }
        
        console.log('🔄 폼 데이터 동기화 완료');
      } else {
        console.log('🔄 동기화 데이터 없음:', result.message);
        setSyncError(result.message || '동기화 데이터를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('🔄 동기화 데이터 로드 실패:', error);
      setSyncError('동기화 데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setSyncLoading(false);
    }
  }, [businessName, systemType]); // systemType 의존성 추가
  const loadData = useCallback(async () => {
    if (!businessName) return;
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10초 타임아웃
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📱 데이터 로드 시작:', businessName);
      
      // 병렬 요청 with abort signal
      const [facilitiesRes, businessRes] = await Promise.allSettled([
        fetch(`/api/facilities/${encodeURIComponent(businessName)}`, {
          headers: { 'Cache-Control': 'max-age=300' },
          signal: abortController.signal
        }),
        fetch(`/api/business/${encodeURIComponent(businessName)}`, {
          headers: { 'Cache-Control': 'max-age=600' },
          signal: abortController.signal
        })
      ]);

      clearTimeout(timeoutId);

      // 결과 처리 최적화
      const processResponse = async (result: PromiseSettledResult<Response>, type: string) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          return await result.value.json();
        }
        console.warn(`📱 ⚠️ ${type} API 실패:`, result);
        return null;
      };

      const [facilitiesData, businessData] = await Promise.all([
        processResponse(facilitiesRes, '시설'),
        processResponse(businessRes, '사업장')
      ]);

      // 상태 업데이트 배치
      if (facilitiesData?.success) {
        setFacilities(facilitiesData.data.facilities);
      }
      
      if (businessData?.success) {
        setBusinessInfo(businessData.data);
      }

      // 데이터 로드 완료 후 동기화 데이터 로드 (최초 로드)
      await loadSyncData(true);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 네트워크를 확인해주세요.');
      } else {
        setError('데이터 로드 중 오류가 발생했습니다.');
      }
      console.error('📱 ❌ 데이터 로딩 오류:', err);
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
    }
  }, [businessName, loadSyncData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // systemType이 변경될 때마다 데이터 다시 로드
  useEffect(() => {
    if (businessName) {
      loadData();
    }
  }, [systemType, businessName]);

  // 드롭다운 외부 클릭 시 닫기
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

  // 연락처 포맷팅 함수
  const formatPhoneNumber = useCallback((value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');
    
    // 010으로 시작하는 11자리 숫자 자동 포맷팅
    if (numbers.length >= 3 && numbers.startsWith('010')) {
      if (numbers.length <= 3) {
        return numbers;
      } else if (numbers.length <= 7) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      } else if (numbers.length <= 11) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      } else {
        // 11자리 초과시 잘라내기
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      }
    }
    
    return value; // 다른 형식이면 원본 반환
  }, []);

  // 입력 핸들러 최적화 (연락처 포맷팅 포함)
  const handleInspectorInfoChange = useCallback((field: string, value: string) => {
    let processedValue = value;
    
    // 연락처 필드일 때 자동 포맷팅 적용
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

  // 저장 함수 최적화 with debugging
  const createSaveHandler = useCallback((endpoint: string, data: any, stateKey: 'inspector' | 'notes') => {
    return async () => {
      if (saveStates[stateKey]) return;
      
      try {
        console.log(`💾 저장 시작: ${endpoint}`, data);
        setSaveStates(prev => ({ ...prev, [stateKey]: true }));
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log(`💾 저장 응답: ${endpoint}`, result);

        if (response.ok && result.success) {
          // 성공 피드백 최적화
          const successMessage = stateKey === 'inspector' ? '실사자 정보가 저장되었습니다.' : '특이사항이 저장되었습니다.';
          
          // 저장 성공 후 동기화 데이터 다시 로드 (실사자 정보만)
          if (stateKey === 'inspector') {
            setTimeout(() => {
              loadSyncData(false); // 초기 로드가 아니므로 false
            }, 500);
          }
          // 특이사항 저장 시에는 동기화 데이터 재로드 안함
          
          // Toast 대신 간단한 성공 표시
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
        console.error(`❌ 저장 오류: ${endpoint}`, error);
        const errorMessage = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
        
        // 오류 토스트
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
  }, [saveStates, loadSyncData]);

  const saveInspectorInfo = useMemo(() => 
    createSaveHandler('/api/inspector-info', { businessName, inspectorInfo, systemType }, 'inspector'),
    [createSaveHandler, businessName, inspectorInfo, systemType]
  );

  const saveSpecialNotes = useMemo(() =>
    createSaveHandler('/api/special-notes', { businessName, specialNotes, systemType }, 'notes'),
    [createSaveHandler, businessName, specialNotes, systemType]
  );

  // 메모화된 계산
  const facilityStats = useMemo(() => {
    if (!facilities) return { hasDischarge: false, hasPrevention: false, hasFacilities: false };
    
    const hasDischarge = facilities.discharge.length > 0;
    const hasPrevention = facilities.prevention.length > 0;
    const hasFacilities = hasDischarge || hasPrevention;
    
    return { hasDischarge, hasPrevention, hasFacilities };
  }, [facilities]);

  // Wait for hydration to prevent SSR mismatch
  if (!isHydrated || loading) {
    return <LoadingSpinner message="시설 정보를 불러오는 중입니다..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md mx-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <FileProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      {/* 고정 헤더 */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center text-white">
            <h1 className="text-xl md:text-2xl font-bold mb-2 flex items-center justify-center gap-2">
              <Building2 className="w-5 h-5 md:w-6 md:h-6" />
              {businessName}
            </h1>
            <div className="flex items-center justify-center gap-4">
              <p className="text-blue-100 text-xs md:text-sm">
                시설 관리 및 보고서 작성
              </p>
              
              {/* 시스템 타입 선택 드롭다운 */}
              <div className="relative system-type-dropdown">
                <button
                  onClick={() => setShowSystemTypeDropdown(!showSystemTypeDropdown)}
                  className="bg-blue-500 hover:bg-blue-600 px-2 py-1 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {systemType === 'presurvey' ? '🔍 설치 전 실사' : '📸 설치 후 사진'}
                  <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${showSystemTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showSystemTypeDropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10 min-w-[140px] md:min-w-[160px]">
                    <button
                      onClick={() => {
                        setSystemType('presurvey');
                        setShowSystemTypeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 md:px-4 md:py-3 text-left hover:bg-gray-50 transition-colors text-xs md:text-sm ${
                        systemType === 'presurvey' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      🔍 설치 전 실사
                    </button>
                    <button
                      onClick={() => {
                        setSystemType('completion');
                        setShowSystemTypeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 md:px-4 md:py-3 text-left hover:bg-gray-50 transition-colors text-xs md:text-sm ${
                        systemType === 'completion' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      📸 설치 후 사진
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-4 py-6">

        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
          {/* 사업장 정보 - 시설 현황 위에 표시 */}
          {businessInfo && (
            <BusinessInfoCard businessInfo={businessInfo} loading={false} />
          )}

          {/* 시설 현황 */}
          {facilities && (
            <FacilityStats facilities={facilities} loading={false} />
          )}

          {/* 배출시설과 방지시설 상세 정보 */}
          {facilityStats.hasFacilities && (
            <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
              {/* 배출시설 상세 정보 */}
              {facilityStats.hasDischarge && (
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                      <h3 className="text-lg md:text-xl font-bold text-gray-900">배출시설 상세 정보</h3>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setShowAssistCT(!showAssistCT)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          showAssistCT
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        보조CT {showAssistCT ? '숨기기' : '보기'}
                      </button>
                      <button
                        onClick={() => setShowNonPowered(!showNonPowered)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          showNonPowered
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        무동력 {showNonPowered ? '숨기기' : '보기'}
                      </button>
                      <button
                        onClick={() => setShowIntegratedPower(!showIntegratedPower)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          showIntegratedPower
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        통합전원 {showIntegratedPower ? '숨기기' : '보기'}
                      </button>
                      <button
                        onClick={() => setShowContinuousProcess(!showContinuousProcess)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          showContinuousProcess
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        연속공정 {showContinuousProcess ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-red-50">
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">배출구</th>
                          <th className="border border-gray-300 px-2 py-1 text-left text-xs">시설명</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-16">용량</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">수량</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">배출CT</th>
                          {showAssistCT && (
                            <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">보조CT</th>
                          )}
                          {showNonPowered && (
                            <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">무동력</th>
                          )}
                          {showIntegratedPower && (
                            <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">통합전원</th>
                          )}
                          {showContinuousProcess && (
                            <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">연속공정</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {facilities!.discharge.map((facility, index) => {
                          const facilityId = getFacilityId(facility);
                          const currentDetails = facilityDetails[facilityId] || {};
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-1 py-1 text-xs text-center w-10">{facility.outlet}</td>
                              <td className="border border-gray-300 px-2 py-1 text-xs">{facility.name}</td>
                              <td className="border border-gray-300 px-1 py-1 text-xs w-16">{facility.capacity}</td>
                              <td className="border border-gray-300 px-1 py-1 text-xs text-center w-10">{facility.quantity}</td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-10">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.dischargeCT === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'dischargeCT', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-red-600 focus:ring-red-500 rounded"
                                />
                              </td>
                              {showAssistCT && (
                                <td className="border border-gray-300 px-1 py-1 text-center w-10">
                                  <input
                                    type="checkbox"
                                    checked={currentDetails.assistCT === 'true'}
                                    onChange={(e) => updateFacilityDetail(facilityId, 'assistCT', e.target.checked ? 'true' : 'false')}
                                    className="w-3 h-3 text-red-600 focus:ring-red-500 rounded"
                                  />
                                </td>
                              )}
                              {showNonPowered && (
                                <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                  <input
                                    type="checkbox"
                                    checked={currentDetails.nonPowered === 'true'}
                                    onChange={(e) => updateFacilityDetail(facilityId, 'nonPowered', e.target.checked ? 'true' : 'false')}
                                    className="w-3 h-3 text-red-600 focus:ring-red-500 rounded"
                                  />
                                </td>
                              )}
                              {showIntegratedPower && (
                                <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                  <input
                                    type="checkbox"
                                    checked={currentDetails.integratedPower === 'true'}
                                    onChange={(e) => updateFacilityDetail(facilityId, 'integratedPower', e.target.checked ? 'true' : 'false')}
                                    className="w-3 h-3 text-red-600 focus:ring-red-500 rounded"
                                  />
                                </td>
                              )}
                              {showContinuousProcess && (
                                <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                  <input
                                    type="checkbox"
                                    checked={currentDetails.continuousProcess === 'true'}
                                    onChange={(e) => updateFacilityDetail(facilityId, 'continuousProcess', e.target.checked ? 'true' : 'false')}
                                    className="w-3 h-3 text-red-600 focus:ring-red-500 rounded"
                                  />
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 방지시설 상세 정보 */}
              {facilityStats.hasPrevention && (
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                    <Shield className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">방지시설 상세 정보</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-green-50">
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">배출구</th>
                          <th className="border border-gray-300 px-2 py-1 text-left text-xs">시설명</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-16">용량</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-10">수량</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">PH</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">차압</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">온도</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">펌프</th>
                          <th className="border border-gray-300 px-1 py-1 text-left text-xs w-8">송풍</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilities!.prevention.map((facility, index) => {
                          const facilityId = getFacilityId(facility);
                          const currentDetails = facilityDetails[facilityId] || {};
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-1 py-1 text-xs text-center w-10">{facility.outlet}</td>
                              <td className="border border-gray-300 px-2 py-1 text-xs">{facility.name}</td>
                              <td className="border border-gray-300 px-1 py-1 text-xs w-16">{facility.capacity}</td>
                              <td className="border border-gray-300 px-1 py-1 text-xs text-center w-10">{facility.quantity}</td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.ph === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'ph', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-green-600 focus:ring-green-500 rounded"
                                />
                              </td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.pressure === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'pressure', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-green-600 focus:ring-green-500 rounded"
                                />
                              </td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.temperature === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'temperature', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-green-600 focus:ring-green-500 rounded"
                                />
                              </td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.pump === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'pump', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-green-600 focus:ring-green-500 rounded"
                                />
                              </td>
                              <td className="border border-gray-300 px-1 py-1 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={currentDetails.fan === 'true'}
                                  onChange={(e) => updateFacilityDetail(facilityId, 'fan', e.target.checked ? 'true' : 'false')}
                                  className="w-3 h-3 text-green-600 focus:ring-green-500 rounded"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IoT 게이트웨이 정보 */}
          {facilityStats.hasFacilities && (
            <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-2">
                  <Router className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">IoT 게이트웨이 정보</h3>
                </div>
                
                {/* VPN 연결 현황 요약 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">VPN 연결:</span>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md">
                      <WifiOff className="w-3 h-3" />
                      <span>유선 {calculateTotals().wired}개</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                      <Wifi className="w-3 h-3" />
                      <span>무선 {calculateTotals().wireless}개</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid gap-4">
                {Object.keys(
                  [...(facilities?.discharge || []), ...(facilities?.prevention || [])]
                    .reduce((outlets, facility) => {
                      outlets[facility.outlet] = true;
                      return outlets;
                    }, {} as {[key: number]: boolean})
                ).sort((a, b) => parseInt(a) - parseInt(b)).map(outlet => {
                  const outletNum = parseInt(outlet);
                  const currentGateway = gatewayInfo[outletNum] || { gateway: '', vpn: '유선' as const };
                  
                  return (
                    <div key={outlet} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-700">배출구 {outlet}:</span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* 게이트웨이 번호 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">
                            게이트웨이 번호
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={currentGateway.gateway}
                            onChange={(e) => {
                              // 숫자만 허용
                              const numericValue = e.target.value.replace(/[^0-9]/g, '');
                              updateGatewayInfo(outletNum, 'gateway', numericValue);
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="게이트웨이 번호 입력 (숫자만)"
                          />
                        </div>
                        
                        {/* VPN 정보 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">
                            VPN 연결 유형
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateGatewayInfo(outletNum, 'vpn', '유선')}
                              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                currentGateway.vpn === '유선'
                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                              }`}
                            >
                              <WifiOff className="w-4 h-4" />
                              유선
                            </button>
                            <button
                              onClick={() => updateGatewayInfo(outletNum, 'vpn', '무선')}
                              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                currentGateway.vpn === '무선'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                              }`}
                            >
                              <Wifi className="w-4 h-4" />
                              무선
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 데이터 저장/불러오기 버튼 */}
              <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={saveFacilityData}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <Save className="w-4 h-4" />
                  시설 데이터 저장
                </button>
                <button
                  onClick={loadFacilityData}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  데이터 불러오기
                </button>
              </div>
            </div>
          )}

          {/* 실사자/설치자 정보 */}
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

          {/* 사진 업로드 - Lazy Loading */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Camera className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              <h3 className="text-lg md:text-xl font-bold text-gray-900">사진 업로드</h3>
            </div>
            
            {facilities ? (
              <FileUploadSection 
                businessName={businessName}
                systemType={systemType}
                facilities={facilities}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>시설 정보를 불러오는 중입니다...</p>
                <button 
                  onClick={loadData}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline transition-colors"
                >
                  데이터 다시 로드
                </button>
              </div>
            )}
          </div>






          {/* 특이사항 */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <FileText className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              <h3 className="text-lg md:text-xl font-bold text-gray-900">특이사항</h3>
            </div>
            
            <textarea
              value={specialNotes}
              onChange={(e) => handleSpecialNotesChange(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              rows={6}
              placeholder="특이사항을 입력하세요..."
            />
            
            <button
              onClick={saveSpecialNotes}
              disabled={saveStates.notes}
              className="mt-4 bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saveStates.notes ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  특이사항 저장
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 글로벌 스타일 */}
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
  );
}
