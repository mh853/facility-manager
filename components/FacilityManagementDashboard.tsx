'use client';

import { useState, useEffect } from 'react';
import { Building, Calendar, CheckCircle2, Clock, AlertCircle, Camera, Cog, FileText, Users, Wrench } from 'lucide-react';

// 타입 정의
interface BusinessInfo {
  id: string;
  business_name: string;
  installation_phase: 'presurvey' | 'installation' | 'completed';
  surveyor_name?: string;
  surveyor_contact?: string;
  surveyor_company?: string;
  survey_date?: string;
  installation_date?: string;
  completion_date?: string;
  special_notes?: string;
}

interface ProjectPhase {
  id: string;
  phase_type: 'presurvey' | 'installation' | 'completion';
  phase_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  progress_percentage: number;
  start_date?: string;
  end_date?: string;
  expected_completion_date?: string;
  assigned_to?: string;
  supervisor?: string;
}

interface MeasurementDevice {
  id: string;
  device_type: string;
  device_name: string;
  model_number?: string;
  serial_number?: string;
  device_status: 'normal' | 'maintenance' | 'error' | 'inactive';
  current_value?: number;
  unit?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
}

interface FacilityManagementDashboardProps {
  businessName: string;
  onPhaseChange?: (phase: 'presurvey' | 'installation' | 'completed') => void;
}

// 단계별 색상 테마
const getPhaseTheme = (phase: string) => {
  const themes: { [key: string]: { bg: string; text: string; border: string; icon: string } } = {
    'presurvey': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: 'text-blue-600' },
    'installation': { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: 'text-orange-600' },
    'completed': { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: 'text-green-600' }
  };
  return themes[phase] || themes['presurvey'];
};

// 상태별 색상 테마
const getStatusTheme = (status: string) => {
  const themes: { [key: string]: { bg: string; text: string; border: string } } = {
    'pending': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    'in_progress': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    'completed': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    'delayed': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    'cancelled': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' }
  };
  return themes[status] || themes['pending'];
};

export default function FacilityManagementDashboard({ 
  businessName, 
  onPhaseChange 
}: FacilityManagementDashboardProps) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [projectPhases, setProjectPhases] = useState<ProjectPhase[]>([]);
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<'presurvey' | 'installation' | 'completed'>('presurvey');

  // 데이터 로드
  useEffect(() => {
    if (businessName) {
      loadFacilityData();
    }
  }, [businessName]);

  const loadFacilityData = async () => {
    setLoading(true);
    try {
      // 실제 API 호출로 교체 예정
      // const response = await fetch(`/api/facility-management/${encodeURIComponent(businessName)}`);
      // const data = await response.json();
      
      // 임시 데이터
      setBusinessInfo({
        id: '1',
        business_name: businessName,
        installation_phase: 'presurvey',
        surveyor_name: '김실사',
        surveyor_contact: '010-1234-5678',
        surveyor_company: '환경기술(주)',
        survey_date: '2025-09-01',
        special_notes: '3층 건물, 접근성 양호'
      });

      setProjectPhases([
        {
          id: '1',
          phase_type: 'presurvey',
          phase_name: '설치 전 실사',
          status: 'in_progress',
          progress_percentage: 75,
          start_date: '2025-09-01',
          assigned_to: '김실사',
          supervisor: '박팀장'
        },
        {
          id: '2',
          phase_type: 'installation',
          phase_name: '장비 설치',
          status: 'pending',
          progress_percentage: 0,
          assigned_to: '이설치',
          supervisor: '박팀장'
        },
        {
          id: '3',
          phase_type: 'completion',
          phase_name: '설치 후 검수',
          status: 'pending',
          progress_percentage: 0,
          assigned_to: '최검수',
          supervisor: '박팀장'
        }
      ]);

      setDevices([
        {
          id: '1',
          device_type: 'gateway',
          device_name: 'IoT 게이트웨이',
          model_number: 'GW-2000',
          serial_number: 'GW20250001',
          device_status: 'normal'
        },
        {
          id: '2',
          device_type: 'ph_meter',
          device_name: 'pH 측정기',
          model_number: 'PH-500',
          serial_number: 'PH20250001',
          device_status: 'maintenance',
          current_value: 7.2,
          unit: 'pH'
        },
        {
          id: '3',
          device_type: 'differential_pressure_meter',
          device_name: '차압계',
          model_number: 'DP-300',
          device_status: 'normal',
          current_value: 250.5,
          unit: 'Pa'
        }
      ]);
    } catch (error) {
      console.error('시설 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = (newPhase: 'presurvey' | 'installation' | 'completed') => {
    setSelectedPhase(newPhase);
    onPhaseChange?.(newPhase);
  };

  const getDeviceIcon = (deviceType: string) => {
    const icons: { [key: string]: any } = {
      'gateway': Cog,
      'ph_meter': Wrench,
      'differential_pressure_meter': Wrench,
      'temperature_meter': Wrench,
      'ct_meter': Wrench
    };
    return icons[deviceType] || Wrench;
  };

  const getDeviceTypeLabel = (deviceType: string) => {
    const labels: { [key: string]: string } = {
      'gateway': '게이트웨이',
      'ph_meter': 'pH 측정기',
      'differential_pressure_meter': '차압계',
      'temperature_meter': '온도계',
      'ct_meter': 'CT 측정기'
    };
    return labels[deviceType] || deviceType;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{businessName}</h1>
              <p className="text-sm text-gray-600">시설 관리 및 보고서 작성</p>
            </div>
          </div>
          
          {/* 단계 선택 탭 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'presurvey', label: '설치 전 실사', icon: FileText },
              { key: 'installation', label: '설치 작업', icon: Wrench },
              { key: 'completed', label: '설치 후 사진', icon: Camera }
            ].map(({ key, label, icon: Icon }) => {
              const isActive = selectedPhase === key;
              const theme = getPhaseTheme(key);
              
              return (
                <button
                  key={key}
                  onClick={() => handlePhaseChange(key as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? `${theme.bg} ${theme.text} ${theme.border} border` 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 사업장 기본 정보 */}
        {businessInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">현재 단계</p>
              <div className="flex items-center gap-2 mt-1">
                {businessInfo.installation_phase === 'presurvey' && <FileText className="w-4 h-4 text-blue-600" />}
                {businessInfo.installation_phase === 'installation' && <Wrench className="w-4 h-4 text-orange-600" />}
                {businessInfo.installation_phase === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                <span className="font-semibold text-gray-900">
                  {businessInfo.installation_phase === 'presurvey' && '설치 전 실사'}
                  {businessInfo.installation_phase === 'installation' && '설치 작업'}
                  {businessInfo.installation_phase === 'completed' && '설치 완료'}
                </span>
              </div>
            </div>

            {businessInfo.surveyor_name && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">실사자</p>
                <p className="font-semibold text-gray-900 mt-1">{businessInfo.surveyor_name}</p>
                {businessInfo.surveyor_company && (
                  <p className="text-xs text-gray-500">{businessInfo.surveyor_company}</p>
                )}
              </div>
            )}

            {businessInfo.survey_date && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">실사일</p>
                <p className="font-semibold text-gray-900 mt-1">
                  {new Date(businessInfo.survey_date).toLocaleDateString('ko-KR')}
                </p>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">측정기기 수</p>
              <p className="font-semibold text-gray-900 mt-1">{devices.length}개</p>
              <p className="text-xs text-gray-500">
                정상: {devices.filter(d => d.device_status === 'normal').length}개
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 프로젝트 진행 단계 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            프로젝트 진행 단계
          </h2>
          
          <div className="space-y-4">
            {projectPhases.map((phase, index) => {
              const statusTheme = getStatusTheme(phase.status);
              const phaseTheme = getPhaseTheme(phase.phase_type);
              
              return (
                <div key={phase.id} className={`border rounded-lg p-4 ${statusTheme.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${phaseTheme.bg}`}>
                        <span className={`text-sm font-bold ${phaseTheme.text}`}>{index + 1}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{phase.phase_name}</h3>
                        <p className="text-sm text-gray-600">담당: {phase.assigned_to}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusTheme.bg} ${statusTheme.text}`}>
                        {phase.status === 'pending' && '대기중'}
                        {phase.status === 'in_progress' && '진행중'}
                        {phase.status === 'completed' && '완료'}
                        {phase.status === 'delayed' && '지연'}
                        {phase.status === 'cancelled' && '취소'}
                      </span>
                      {phase.status === 'in_progress' && (
                        <Clock className="w-4 h-4 text-blue-500" />
                      )}
                      {phase.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {phase.status === 'delayed' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {phase.status === 'in_progress' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>진행률</span>
                        <span>{phase.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${phase.progress_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {phase.start_date && (
                    <div className="mt-2 text-xs text-gray-500">
                      시작일: {new Date(phase.start_date).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 측정기기 현황 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Cog className="w-5 h-5 text-blue-600" />
            측정기기 현황
          </h2>
          
          <div className="space-y-3">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.device_type);
              const statusColor = device.device_status === 'normal' ? 'text-green-500' : 
                                device.device_status === 'maintenance' ? 'text-orange-500' : 
                                device.device_status === 'error' ? 'text-red-500' : 'text-gray-500';
              
              return (
                <div key={device.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DeviceIcon className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900 text-sm">
                        {getDeviceTypeLabel(device.device_type)}
                      </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${statusColor.replace('text-', 'bg-')}`}></div>
                  </div>
                  
                  {device.model_number && (
                    <p className="text-xs text-gray-500 mb-1">모델: {device.model_number}</p>
                  )}
                  
                  {device.current_value !== undefined && (
                    <p className="text-sm font-medium text-gray-900">
                      현재값: {device.current_value} {device.unit}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    상태: <span className={statusColor}>
                      {device.device_status === 'normal' && '정상'}
                      {device.device_status === 'maintenance' && '점검중'}
                      {device.device_status === 'error' && '오류'}
                      {device.device_status === 'inactive' && '비활성'}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          
          {devices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Cog className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>등록된 측정기기가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 특이사항 */}
      {businessInfo?.special_notes && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            특이사항
          </h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-gray-800">{businessInfo.special_notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}