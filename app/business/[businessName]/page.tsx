'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FacilitiesData, BusinessInfo, SystemType } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AlertTriangle, Building2, User, FileText, Zap, Shield, Camera, Save, ChevronDown } from 'lucide-react';
import UploadedFilesManager from '@/components/UploadedFilesManager'; // 일반 import로 변경

// Dynamic imports for better chunk loading
const BusinessInfoCard = dynamic(() => import('@/components/BusinessInfoCard'), {
  loading: () => <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse"><div className="h-32 bg-gray-200 rounded"></div></div>,
  ssr: false
});

const FacilityStats = dynamic(() => import('@/components/FacilityStats'), {
  loading: () => <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse"><div className="h-32 bg-gray-200 rounded"></div></div>,
  ssr: false
});

const FileUploadSection = dynamic(() => import('@/components/FileUploadSection'), {
  loading: () => <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse"><div className="h-40 bg-gray-200 rounded"></div></div>,
  ssr: false
});

export default function BusinessPage() {
  const params = useParams();
  const businessName = useMemo(() => decodeURIComponent(params.businessName as string), [params.businessName]);
  const [systemType, setSystemType] = useState<SystemType>('presurvey'); // 기본값을 presurvey로 변경
  
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상태 최적화 with 동기화
  const [inspectorInfo, setInspectorInfo] = useState(() => ({
    name: '',
    contact: '',
    date: new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1)
  }));

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
        setLastSyncTime(new Date().toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour12: false
        }));
        
        // 폼에 데이터 미리 채우기 (최초 로드 시에만)
        if (isInitialLoad) {
          setInspectorInfo(prev => ({
            ...prev,
            name: prev.name || result.data.설치담당자 || '',
            contact: prev.contact || result.data.연락처 || '',
            date: prev.date || result.data.설치일 || new Date().toLocaleDateString('ko-KR', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1)
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

  if (loading) {
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
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">배출시설 상세 정보</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-red-50">
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">배출구</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">시설명</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">용량</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilities!.discharge.map((facility, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.outlet}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.name}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.capacity}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.quantity}</td>
                          </tr>
                        ))}
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
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">배출구</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">시설명</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">용량</th>
                          <th className="border border-gray-300 px-2 md:px-3 py-2 text-left text-xs md:text-sm">수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilities!.prevention.map((facility, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.outlet}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.name}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.capacity}</td>
                            <td className="border border-gray-300 px-2 md:px-3 py-2 text-xs md:text-sm">{facility.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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





          {/* 업로드된 파일 관리 */}
          <UploadedFilesManager 
            businessName={businessName}
            systemType={systemType}
            onFileDeleted={() => {
              // 파일 삭제 후 동기화 데이터 새로고침 (초기 로드 아님)
              loadSyncData(false);
            }}
          />

          {/* 동기화 상태 표시 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-900">
                🔄 구글시트 동기화 상태 ({systemType === 'completion' ? '설치 후 사진' : '설치 전 실사'})
              </h3>
              <button
                onClick={() => loadSyncData(false)} // 수동 새로고침은 초기 로드 아님
                disabled={syncLoading}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {syncLoading ? (
                  <>
                    <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin inline-block mr-1" />
                    로딩중
                  </>
                ) : (
                  '새로고침'
                )}
              </button>
            </div>
            
            {syncLoading ? (
              <div className="text-center py-4 text-blue-700">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">동기화 데이터를 불러오는 중...</p>
              </div>
            ) : syncError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">동기화 오류</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{syncError}</p>
                <p className="text-xs text-red-600 mt-2">• 구글시트에서 해당 사업장을 찾을 수 없거나 권한이 없을 수 있습니다.</p>
              </div>
            ) : syncData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-800">
                  <div>
                    <span className="font-medium">상태:</span> {syncData.상태 || '미설정'}
                  </div>
                  <div>
                    <span className="font-medium">담당자:</span> {syncData.설치담당자 || '미설정'}
                  </div>
                  <div>
                    <span className="font-medium">연락처:</span> {syncData.연락처 || '미설정'}
                  </div>
                  <div>
                    <span className="font-medium">마지막 동기화:</span> {lastSyncTime || '없음'}
                  </div>
                </div>
                {syncData.특이사항 && (
                  <div className="mt-2 text-xs text-blue-700">
                    <span className="font-medium">특이사항:</span> {syncData.특이사항}
                  </div>
                )}
                {syncData.URL && (
                  <div className="mt-2">
                    <a 
                      href={syncData.URL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      구글시트에서 보기 →
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-gray-600">
                <p className="text-sm">동기화 데이터가 아직 로드되지 않았습니다.</p>
                <p className="text-xs text-gray-500 mt-1">시스템이 처음 로드되거나 동기화가 필요할 수 있습니다.</p>
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
  );
}
